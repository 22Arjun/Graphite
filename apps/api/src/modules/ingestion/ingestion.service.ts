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
// Ingestion Service — Fast GitHub ingestion pipeline
//
// Phase 1 (ingestion): Fetch all repo list + pinned names in
//   parallel, select up to 5 high-signal repos, then ingest
//   all 5 in parallel. Completes in ~15-30 seconds.
//
// Phase 2 (analysis): AI analysis runs fully async after
//   ingestion completes. Does not block the user.
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
   * Trigger GitHub ingestion for a builder.
   * Returns immediately with a jobId; pipeline runs async.
   */
  async triggerIngestion(builderId: string, fullSync: boolean = false): Promise<{ jobId: string }> {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        githubProfile: {
          select: { username: true, accessToken: true },
        },
      },
    });

    if (!builder) throw new NotFoundError('Builder', builderId);
    if (!builder.githubProfile) throw new NotFoundError('GitHub profile not connected. Link GitHub first.');

    const hasActive = await this.queue.hasActiveJob(builderId, 'GITHUB_INGEST');
    if (hasActive) throw new ConflictError('An ingestion job is already running for this builder');

    const job = await this.queue.createJob({
      builderId,
      jobType: 'GITHUB_INGEST',
      payload: { fullSync },
    });

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

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundError('Job', jobId);
    return job;
  }

  async resetStuckJobs(builderId: string) {
    return this.queue.resetStuckJobs(builderId);
  }

  async getBuilderJobs(builderId: string) {
    return this.queue.getBuilderJobs(builderId);
  }

  // -------------------------------------------------------
  // Phase 1: Fast Ingestion Pipeline
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

      // Fetch all repos + pinned names in parallel — two independent API calls
      await this.queue.updateProgress(jobId, 5, { phase: 'fetching_repos' });
      const [rawRepos, pinnedNames] = await Promise.all([
        this.github.fetchUserRepos(accessToken, username),
        this.github.fetchPinnedRepos(accessToken, username),
      ]);

      // Filter archived repos and, unless fullSync, forks
      const filteredRepos = rawRepos.filter((r) => {
        if (r.archived) return false;
        if (r.fork && !fullSync) return false;
        return true;
      });

      // Select up to 5 high-signal repos: pinned → starred → recent
      const selectedRepos = this.github.selectHighSignalRepos(filteredRepos, pinnedNames);

      logger.info(
        {
          jobId,
          total: rawRepos.length,
          filtered: filteredRepos.length,
          selected: selectedRepos.length,
          pinned: pinnedNames.length,
        },
        'Repos selected for ingestion'
      );

      await this.queue.updateProgress(jobId, 20, {
        phase: 'ingesting_repos',
        total: selectedRepos.length,
      });

      // Ingest all selected repos in parallel — the key performance improvement
      const ingestionResults = await Promise.allSettled(
        selectedRepos.map((rawRepo) =>
          this.github.ingestLightweightRepository(accessToken, rawRepo, username)
        )
      );

      await this.queue.updateProgress(jobId, 80, { phase: 'persisting' });

      let newRepos = 0;
      let updatedRepos = 0;
      let totalCommits = 0;
      let totalContributors = 0;
      const languageSet = new Set<string>();

      for (let i = 0; i < ingestionResults.length; i++) {
        const result = ingestionResults[i];
        const rawRepo = selectedRepos[i];

        if (result.status === 'rejected') {
          logger.error({ jobId, repo: rawRepo.full_name, err: result.reason }, 'Repo ingest failed');
          continue;
        }

        const ingestionData = result.value;

        try {
          const { repoId, isNew } = await this.repo.upsertRepository(builderId, ingestionData);
          await this.repo.markRepoOwner(repoId, username);

          if (isNew) newRepos++;
          else updatedRepos++;
          totalCommits += ingestionData.commits.length;
          totalContributors += ingestionData.contributors.length;
          ingestionData.languages.forEach((l) => languageSet.add(l.language));
        } catch (err) {
          logger.error({ jobId, repo: rawRepo.full_name, err }, 'Failed to persist repo, skipping');
        }
      }

      // Update GitHub profile sync timestamp
      try {
        await this.prisma.gitHubProfile.update({
          where: { builderId },
          data: { lastSyncedAt: new Date() },
        });
      } catch (err) {
        logger.warn({ jobId, err }, 'Failed to update lastSyncedAt, continuing');
      }

      const summary: IngestionSummary = {
        totalRepos: selectedRepos.length,
        newRepos,
        updatedRepos,
        totalCommits,
        totalContributors,
        uniqueLanguages: languageSet.size,
        durationMs: Date.now() - startTime,
      };

      await this.queue.completeJob(jobId, summary as unknown as Record<string, unknown>);
      logger.info({ jobId, summary }, 'Ingestion pipeline completed');

      // Phase 2: async AI analysis — does not block ingestion completion
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

  // -------------------------------------------------------
  // Phase 2: Async AI Analysis + Scoring + Graph
  // -------------------------------------------------------

  /**
   * Runs fully async after ingestion completes.
   * AI analysis is rate-limited but does not block the user.
   * Repos already COMPLETED (status = COMPLETED) are skipped automatically
   * by analyzeBuilderRepositories which only targets PENDING/FAILED repos.
   */
  private async runPostIngestionPipeline(builderId: string, parentJobId: string): Promise<void> {
    logger.info({ builderId, parentJobId }, 'Starting post-ingestion pipeline');

    // Step 1: AI analysis of pending repos
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
}
