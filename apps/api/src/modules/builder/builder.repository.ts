import type { PrismaClient } from '@prisma/client';
import type { PaginationParams, PaginatedResult } from '../../lib/types.js';

// ============================================================
// Builder Repository — Database access layer
// ============================================================

export interface BuilderWithRelations {
  id: string;
  walletAddress: string;
  displayName: string | null;
  bio: string | null;
  aiSummary: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  githubProfile: {
    username: string;
    avatarUrl: string | null;
    name: string | null;
    publicRepos: number;
    followers: number;
    following: number;
    lastSyncedAt: Date | null;
  } | null;
  repositories: {
    id: string;
    name: string;
    fullName: string;
    description: string | null;
    primaryLanguage: string | null;
    stars: number;
    forks: number;
    analysisStatus: string;
  }[];
  reputationScores: {
    dimension: string;
    score: number;
    confidence: number;
    signals: string[];
    trend: string;
    computedAt: Date;
  }[];
  skillTags: {
    name: string;
    category: string;
    confidence: number;
    inferredFrom: string[];
  }[];
  _count: {
    repositories: number;
    outgoingEdges: number;
    incomingEdges: number;
  };
}

export class BuilderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get full builder profile with all relations.
   */
  async findById(builderId: string): Promise<BuilderWithRelations | null> {
    return this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        githubProfile: {
          select: {
            username: true,
            avatarUrl: true,
            name: true,
            publicRepos: true,
            followers: true,
            following: true,
            lastSyncedAt: true,
          },
        },
        repositories: {
          select: {
            id: true,
            name: true,
            fullName: true,
            description: true,
            primaryLanguage: true,
            stars: true,
            forks: true,
            analysisStatus: true,
          },
          orderBy: { stars: 'desc' },
        },
        reputationScores: {
          select: {
            dimension: true,
            score: true,
            confidence: true,
            signals: true,
            trend: true,
            computedAt: true,
          },
        },
        skillTags: {
          select: {
            name: true,
            category: true,
            confidence: true,
            inferredFrom: true,
          },
          orderBy: { confidence: 'desc' },
        },
        _count: {
          select: {
            repositories: true,
            outgoingEdges: true,
            incomingEdges: true,
          },
        },
      },
    }) as unknown as BuilderWithRelations | null;
  }

  /**
   * Get builder by wallet address.
   */
  async findByWallet(walletAddress: string): Promise<BuilderWithRelations | null> {
    const builder = await this.prisma.builder.findUnique({
      where: { walletAddress },
      select: { id: true },
    });

    if (!builder) return null;
    return this.findById(builder.id);
  }

  /**
   * Update builder profile fields.
   */
  async updateProfile(
    builderId: string,
    data: { displayName?: string; bio?: string }
  ): Promise<void> {
    await this.prisma.builder.update({
      where: { id: builderId },
      data,
    });
  }

  /**
   * Get builder's repositories with pagination and filtering.
   */
  async getRepositories(
    builderId: string,
    pagination: PaginationParams,
    filters?: { status?: string; language?: string; search?: string }
  ): Promise<PaginatedResult<any>> {
    const where: any = { builderId };

    if (filters?.status) {
      where.analysisStatus = filters.status;
    }
    if (filters?.language) {
      where.primaryLanguage = filters.language;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.repository.findMany({
        where,
        include: {
          languages: {
            orderBy: { bytes: 'desc' },
          },
          analysis: {
            select: {
              architectureComplexity: true,
              codeQualitySignals: true,
              executionMaturity: true,
              originalityScore: true,
              inferredSkills: true,
              probableDomains: true,
              builderSummary: true,
            },
          },
          _count: { select: { commits: true, contributors: true } },
        },
        orderBy: { stars: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.repository.count({ where }),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: pagination.page * pagination.limit < total,
    };
  }

  /**
   * Get aggregated GitHub stats for a builder.
   */
  async getGitHubStats(builderId: string) {
    const [repoStats, languageStats, commitCount] = await Promise.all([
      this.prisma.repository.aggregate({
        where: { builderId },
        _sum: { stars: true, forks: true },
        _count: true,
      }),
      this.prisma.repositoryLanguage.groupBy({
        by: ['language', 'color'],
        where: { repository: { builderId } },
        _sum: { bytes: true },
        orderBy: { _sum: { bytes: 'desc' } },
        take: 10,
      }),
      this.prisma.commit.count({
        where: { repository: { builderId } },
      }),
    ]);

    const totalLangBytes = languageStats.reduce((sum, l) => sum + (l._sum.bytes || 0), 0);

    return {
      totalRepos: repoStats._count,
      totalStars: repoStats._sum.stars || 0,
      totalForks: repoStats._sum.forks || 0,
      totalCommits: commitCount,
      topLanguages: languageStats.map((l) => ({
        language: l.language,
        bytes: l._sum.bytes || 0,
        percentage: totalLangBytes > 0
          ? Math.round(((l._sum.bytes || 0) / totalLangBytes) * 10000) / 100
          : 0,
        color: l.color,
      })),
    };
  }
}
