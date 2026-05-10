import type { PrismaClient } from '@prisma/client';
import { GitHubService } from '../github/github.service.js';
import { IngestionRepository } from './ingestion.repository.js';
import { AnalysisService } from '../analysis/analysis.service.js';
import { ScoringService } from '../scoring/scoring.service.js';
import { BuilderService } from '../builder/builder.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

// ============================================================
// Ingestion Service — GitHub → Reputation in one flat pass
//
// 1. Fetch all repos + pinned names (parallel)
// 2. Select up to 5 high-signal repos
// 3. Ingest all 5 in parallel
// 4. Run repo analysis (single Gemini call, structured JSON scores only)
// 5. Compute reputation scores
// 6. Update lastSyncedAt  ← frontend stops polling here
// 7. Fire-and-forget builder summary after 6 s  ← separate Gemini call,
//    small plain-text prompt, well past the 15 RPM rate-limit window
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

    // Step 4: Repo analysis — structured JSON scores only (no builder summary)
    // Errors are non-fatal; scoring still runs on behavioral signals
    try {
      await this.analysis.analyzeRepositoriesBatch(builderId, repoIds);
    } catch (err) {
      logger.error({ builderId, err }, 'Repo analysis failed — proceeding with available data');
    }

    // Step 5: Compute reputation scores
    await this.scoring.computeReputation(builderId);

    // Step 6: Update lastSyncedAt — this is the signal the frontend polls on
    await this.prisma.gitHubProfile.update({
      where: { builderId },
      data: { lastSyncedAt: new Date() },
    });

    // Bust the profile cache so the next page load reads fresh scores from DB
    BuilderService.invalidateProfile(builderId);

    logger.info({ builderId, repos: repoIds.length, ms: Date.now() - startTime }, 'Sync complete');

    // Step 7: Fire-and-forget builder summary.
    //
    // Runs 6 seconds after the repo-analysis Gemini call to clear the
    // 15 RPM free-tier window (one slot = 60 s / 15 = 4 s, 6 s is safe).
    // Uses a tiny plain-text prompt — far less likely to hit token limits.
    // Falls back to a template if Gemini still fails.
    setTimeout(() => {
      this.analysis
        .generateBuilderSummary(builderId)
        .catch((err) =>
          logger.error({ builderId, err }, 'Builder summary generation failed')
        );
    }, 6_000);
  }
}
