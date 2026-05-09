import type { PrismaClient } from '@prisma/client';
import { BuilderRepository } from './builder.repository.js';
import { NotFoundError } from '../../lib/errors.js';
import type { PaginationParams } from '../../lib/types.js';

// ============================================================
// Builder Service — Business logic for builder profiles
// ============================================================

export class BuilderService {
  private readonly repo: BuilderRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new BuilderRepository(prisma);
  }

  /**
   * Get full builder profile.
   */
  async getProfile(builderId: string) {
    const builder = await this.repo.findById(builderId);
    if (!builder) {
      throw new NotFoundError('Builder', builderId);
    }

    const stats = await this.repo.getGitHubStats(builderId);

    // Compute overall reputation score from dimension scores
    const dimensions = builder.reputationScores;
    const overallScore =
      dimensions.length > 0
        ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
        : 0;

    return {
      ...builder,
      githubStats: stats,
      reputation: {
        overallScore,
        dimensions: builder.reputationScores,
        signalCount: dimensions.reduce((sum, d) => sum + d.signals.length, 0),
      },
    };
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
