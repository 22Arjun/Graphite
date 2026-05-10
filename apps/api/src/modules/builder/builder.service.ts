import type { PrismaClient } from '@prisma/client';
import { BuilderRepository } from './builder.repository.js';
import { NotFoundError } from '../../lib/errors.js';
import type { PaginationParams } from '../../lib/types.js';

// Simple in-memory profile cache — avoids repeated multi-query trips to Supabase
// on every page load. TTL of 30 s; invalidated explicitly after a sync completes.
const profileCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

// ============================================================
// Builder Service — Business logic for builder profiles
// ============================================================

export class BuilderService {
  private readonly repo: BuilderRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new BuilderRepository(prisma);
  }

  static invalidateProfile(builderId: string) {
    profileCache.delete(builderId);
  }

  /**
   * Get full builder profile.
   */
  async getProfile(builderId: string) {
    const cached = profileCache.get(builderId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const [builder, stats] = await Promise.all([
      this.repo.findById(builderId),
      this.repo.getGitHubStats(builderId),
    ]);
    if (!builder) {
      throw new NotFoundError('Builder', builderId);
    }

    // Compute overall reputation score from dimension scores
    const dimensions = builder.reputationScores;
    const overallScore =
      dimensions.length > 0
        ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
        : 0;

    const result = {
      ...builder,
      githubStats: stats,
      reputation: {
        overallScore,
        dimensions: builder.reputationScores,
        signalCount: dimensions.reduce((sum, d) => sum + d.signals.length, 0),
      },
      connectedSources: {
        github: !!builder.githubProfile,
        linkedin: !!builder.linkedInData,
        twitter: !!builder.twitterData,
        hackathons: builder._count.hackathonEntries,
        resume: !!builder.resumeData,
      },
    };

    profileCache.set(builderId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  /**
   * Update builder profile.
   */
  async updateProfile(
    builderId: string,
    data: { displayName?: string; bio?: string }
  ) {
    const builder = await this.repo.findById(builderId);
    if (!builder) {
      throw new NotFoundError('Builder', builderId);
    }

    await this.repo.updateProfile(builderId, data);
    return this.getProfile(builderId);
  }

  /**
   * Get builder repositories with pagination.
   */
  async getRepositories(
    builderId: string,
    pagination: PaginationParams,
    filters?: { status?: string; language?: string; search?: string }
  ) {
    return this.repo.getRepositories(builderId, pagination, filters);
  }

  /**
   * Get detailed repository info with analysis.
   */
  async getRepository(builderId: string, repositoryId: string) {
    const repo = await this.repo.findById(builderId);
    if (!repo) throw new NotFoundError('Builder', builderId);

    // Directly query the repository with full details
    // Delegation to repository layer for complex queries
    return repositoryId; // Placeholder — expand with full repo + analysis fetch
  }

  /**
   * Get builder's GitHub stats.
   */
  async getGitHubStats(builderId: string) {
    return this.repo.getGitHubStats(builderId);
  }
}
