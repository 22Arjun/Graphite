import type { PrismaClient } from '@prisma/client';
import { GitHubService } from '../github/github.service.js';
import { IngestionRepository } from './ingestion.repository.js';
import { JobQueue } from './ingestion.queue.js';
import { AnalysisService } from '../analysis/analysis.service.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { GraphService } from '../graph/graph.service.js';
import { NotFoundError, ConflictError, IngestionError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { IngestionSummary } from './ingestion.schema.js';

// ============================================================
// Ingestion Service — Orchestrates the full GitHub ingestion
// pipeline: fetch repos → fetch details → normalize → store
//
// Designed for async execution via job queue.
// The triggerIngestion method creates a job and runs the
// pipeline. In production, this would be dispatched to a
// worker process via BullMQ/Redis.
// ============================================================

export class IngestionService {
  private readonly github: GitHubService;
  private readonly repo: IngestionRepository;
  private readonly queue: JobQueue;
  private readonly analysis: AnalysisService;
  private readonly scoring: ScoringService;
  private readonly graph: GraphService;

  constructor(private readonly prisma: PrismaClient) {
    this.github = new GitHubService();
    this.repo = new IngestionRepository(prisma);
    this.queue = new JobQueue(prisma);
    this.analysis = new AnalysisService(prisma);
    this.scoring = new ScoringService(prisma);
    this.graph = new GraphService(prisma);
  }

  /**
   * Trigger full GitHub ingestion for a builder.
   * Creates a job, then runs the pipeline asynchronously.
   */
  async triggerIngestion(builderId: string, fullSync: boolean = false): Promise<{ jobId: string }> {
    // Validate builder exists and has GitHub connected
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        githubProfile: {
          select: { username: true, accessToken: true },
        },
      },
    });

    if (!builder) {
      throw new NotFoundError('Builder', builderId);
    }

    if (!builder.githubProfile) {
      throw new NotFoundError('GitHub profile not connected. Link GitHub first.');
    }

    // Check for active ingestion jobs
    const hasActive = await this.queue.hasActiveJob(builderId, 'GITHUB_INGEST');
    if (hasActive) {
      throw new ConflictError('An ingestion job is already running for this builder');
    }

    // Create job
    const job = await this.queue.createJob({
      builderId,
      jobType: 'GITHUB_INGEST',
      payload: { fullSync },
    });

    // Run pipeline asynchronously (fire-and-forget)
    // In production: dispatch to BullMQ worker instead
    this.runIngestionPipeline(
      job.id,
      builderId,
      builder.githubProfile.username,
      builder.githubProfile.accessToken,
      fullSync
    ).catch((err) => {
      logger.error({ jobId: job.id, err }, 'Ingestion pipeline failed (unhandled)');
    });

    return { jobId: job.id };
  }

  /**
   * Get the status of an ingestion job.
   */
  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundError('Job', jobId);
    return job;
  }

  /**
   * Force-fail all stuck jobs for a builder so they can trigger a fresh run.
   */
  async resetStuckJobs(builderId: string) {
    return this.queue.resetStuckJobs(builderId);
  }

  /**
   * Get all jobs for a builder.
   */
  async getBuilderJobs(builderId: string) {
    return this.queue.getBuilderJobs(builderId);
  }

  // -------------------------------------------------------
  // Pipeline Execution
  // -------------------------------------------------------

  private async runIngestionPipeline(
    jobId: string,
    builderId: string,
    username: string,
    accessToken: string,
    fullSync: boolean
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await this.queue.startJob(jobId);
      logger.info({ jobId, builderId, username }, 'Starting ingestion pipeline');

      // Phase 1: Fetch all repos
      await this.queue.updateProgress(jobId, 5, { phase: 'fetching_repos' });
      const rawRepos = await this.github.fetchUserRepos(accessToken, username);

      // Filter: skip forks unless fullSync, skip archived
      const filteredRepos = rawRepos.filter((r) => {
        if (r.archived) return false;
        if (r.fork && !fullSync) return false;
        return true;
      });

      logger.info(
        { jobId, total: rawRepos.length, filtered: filteredRepos.length },
        'Repositories fetched'
      );

      // Phase 2: Detect new/existing repos
      const existingIds = await this.repo.getExistingGitHubIds(builderId);
      const reposToProcess = fullSync
        ? filteredRepos
        : filteredRepos; // Always process all non-archived for metadata updates

      const totalRepos = reposToProcess.length;
      let newRepos = 0;
      let updatedRepos = 0;
      let totalCommits = 0;
      let totalContributors = 0;
      const languageSet = new Set<string>();

      // Phase 3: Ingest each repo
      for (let i = 0; i < totalRepos; i++) {
        const rawRepo = reposToProcess[i];
        const progress = 10 + Math.round(((i + 1) / totalRepos) * 85); // 10-95%

        try {
          await this.queue.updateProgress(jobId, progress, {
            phase: 'ingesting_repos',
            current: i + 1,
            total: totalRepos,
            currentRepo: rawRepo.full_name,
          });

          // Full ingestion: metadata + languages + commits + contributors
          const ingestionData = await this.github.ingestRepository(
            accessToken,
            rawRepo,
            username
          );

          // Persist to database
          const { repoId, isNew } = await this.repo.upsertRepository(builderId, ingestionData);

          // Mark owner
          await this.repo.markRepoOwner(repoId, username);

          // Track stats
          if (isNew) newRepos++;
          else updatedRepos++;
          totalCommits += ingestionData.commits.length;
          totalContributors += ingestionData.contributors.length;
          ingestionData.languages.forEach((l) => languageSet.add(l.language));

          // Small delay to be kind to GitHub API
          if (i < totalRepos - 1) {
            await this.sleep(300);
          }
        } catch (err) {
          // Log error but continue with other repos
          logger.error(
            { jobId, repo: rawRepo.full_name, err },
            'Failed to ingest repository, skipping'
          );
        }
      }

      // Phase 4: Update GitHub profile sync timestamp (non-critical)
      try {
        await this.prisma.gitHubProfile.update({
          where: { builderId },
          data: { lastSyncedAt: new Date() },
        });
      } catch (err) {
        logger.warn({ jobId, err }, 'Failed to update lastSyncedAt, continuing');
      }

      // Complete job with summary
      const summary: IngestionSummary = {
        totalRepos,
        newRepos,
        updatedRepos,
        totalCommits,
        totalContributors,
        uniqueLanguages: languageSet.size,
        durationMs: Date.now() - startTime,
      };

      await this.queue.completeJob(jobId, summary as unknown as Record<string, unknown>);
      logger.info({ jobId, summary }, 'Ingestion pipeline completed');

      // Chain: Analysis → Scoring → Graph (fire-and-forget)
      this.runPostIngestionPipeline(builderId, jobId).catch((err) => {
        logger.error({ jobId, builderId, err }, 'Post-ingestion pipeline failed');
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await this.queue.failJob(jobId, errorMessage);
      logger.error({ jobId, err }, 'Ingestion pipeline failed');
      throw new IngestionError(errorMessage, jobId, 'pipeline');
    }
  }

  /**
   * After ingestion: analyze repos → compute reputation → build graph.
   * Each step is logged but failures don't stop the chain.
   */
  private async runPostIngestionPipeline(builderId: string, parentJobId: string): Promise<void> {
    logger.info({ builderId, parentJobId }, 'Starting post-ingestion pipeline');

    // Step 1: Analyze all pending repositories (with per-repo progress updates)
    const analysisJob = await this.queue.createJob({ builderId, jobType: 'REPO_ANALYSIS' });
    try {
      await this.queue.startJob(analysisJob.id);
      const { analyzed, failed } = await this.analysis.analyzeBuilderRepositories(
        builderId,
        async (progress, current, total) => {
          await this.queue.updateProgress(analysisJob.id, progress, { current, total });
        }
      );
      await this.queue.completeJob(analysisJob.id, { analyzed, failed });
      logger.info({ builderId, analyzed, failed }, 'Repo analysis completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis error';
      await this.queue.failJob(analysisJob.id, msg);
      logger.error({ builderId, err }, 'Repo analysis job failed');
    }

    // Step 2: Compute reputation scores
    const scoringJob = await this.queue.createJob({ builderId, jobType: 'REPUTATION_COMPUTE' });
    try {
      await this.queue.startJob(scoringJob.id);
      const scores = await this.scoring.computeReputation(builderId);
      await this.queue.completeJob(scoringJob.id, { dimensions: scores.length });
      logger.info({ builderId, dimensions: scores.length }, 'Reputation scoring completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scoring error';
      await this.queue.failJob(scoringJob.id, msg);
      logger.error({ builderId, err }, 'Reputation scoring job failed');
    }

    // Step 3: Build collaboration graph
    const graphJob = await this.queue.createJob({ builderId, jobType: 'GRAPH_BUILD' });
    try {
      await this.queue.startJob(graphJob.id);
      await this.graph.buildGraph(builderId);
      await this.queue.completeJob(graphJob.id, { built: true });
      logger.info({ builderId }, 'Graph build completed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Graph build error';
      await this.queue.failJob(graphJob.id, msg);
      logger.error({ builderId, err }, 'Graph build job failed');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
