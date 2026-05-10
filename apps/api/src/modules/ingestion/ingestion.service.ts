import type { PrismaClient } from '@prisma/client';
import { GitHubService } from '../github/github.service.js';
import { IngestionRepository } from './ingestion.repository.js';
import { AnalysisService } from '../analysis/analysis.service.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

// ============================================================
// Ingestion Service — GitHub → Reputation in one flat pass
//
// 1. Fetch all repos + pinned names (parallel)
// 2. Select up to 5 high-signal repos
// 3. Ingest all 5 in parallel
// 4. Run AI analysis in a single batched Gemini call
// 5. Compute reputation scores
// ============================================================

export class IngestionService {
  private readonly github: GitHubService;
  private readonly repo: IngestionRepository;
  private readonly analysis: AnalysisService;
  private readonly scoring: ScoringService;

  constructor(private readonly prisma: PrismaClient) {
    this.github = new GitHubService();
    this.repo = new IngestionRepository(prisma);
    this.analysis = new AnalysisService(prisma);
    this.scoring = new ScoringService(prisma);
  }

  /**
   * Full GitHub → reputation sync for a builder.
   * Kicks off asynchronously; caller gets back immediately.
   */
  async triggerSync(builderId: string): Promise<void> {
    const profile = await this.prisma.gitHubProfile.findUnique({
      where: { builderId },
      select: { username: true, accessToken: true },
    });

    if (!profile) throw new NotFoundError('GitHub profile not connected. Link GitHub first.');

    const { accessToken, username } = profile;
    const startTime = Date.now();
    logger.info({ builderId, username }, 'GitHub reputation sync started');

    // Step 1: Fetch repo list and pinned names in parallel
    const [allRepos, pinnedNames] = await Promise.all([
      this.github.fetchUserRepos(accessToken, username),
      this.github.fetchPinnedRepos(accessToken, username),
    ]);

    const filtered = allRepos.filter((r) => !r.archived && !r.fork);
    const selected = this.github.selectHighSignalRepos(filtered, pinnedNames, 5);

    logger.info({ builderId, total: allRepos.length, selected: selected.length }, 'Repos selected');

    // Step 2: Ingest all selected repos in parallel
    const ingestionResults = await Promise.allSettled(
      selected.map((r) => this.github.ingestLightweightRepository(accessToken, r, username))
    );

    // Step 3: Persist to DB
    const repoIds: string[] = [];
    for (let i = 0; i < ingestionResults.length; i++) {
      const result = ingestionResults[i];
      if (result.status === 'rejected') {
        logger.warn({ repo: selected[i].full_name, err: result.reason }, 'Repo ingest failed, skipping');
        continue;
      }
      try {
        const { repoId } = await this.repo.upsertRepository(builderId, result.value);
        await this.repo.markRepoOwner(repoId, username);
        repoIds.push(repoId);
      } catch (err) {
        logger.warn({ repo: selected[i].full_name, err }, 'Repo persist failed, skipping');
      }
    }

    if (repoIds.length === 0) {
      logger.warn({ builderId }, 'No repos persisted — skipping analysis');
      await this.prisma.gitHubProfile.update({
        where: { builderId },
        data: { lastSyncedAt: new Date() },
      });
      return;
    }

    // Step 4: Single batched Gemini call for all repos
    // Errors are caught internally — analysis failure is non-fatal, scoring still runs
    try {
      await this.analysis.analyzeRepositoriesBatch(builderId, repoIds);
    } catch (err) {
      logger.error({ builderId, err }, 'Batch analysis failed — proceeding to score with available data');
    }

    // Step 5: Compute reputation scores from whatever data is available
    await this.scoring.computeReputation(builderId);

    // Update lastSyncedAt AFTER scores are written — frontend polls on this signal
    await this.prisma.gitHubProfile.update({
      where: { builderId },
      data: { lastSyncedAt: new Date() },
    });

    logger.info({ builderId, repos: repoIds.length, ms: Date.now() - startTime }, 'Sync complete');
  }
}
