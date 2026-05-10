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
    hackathonEntries: number;
  };
  linkedInData: { currentRole: string | null; company: string | null } | null;
  twitterData: { handle: string; followerCount: number } | null;
  resumeData: { currentRole: string | null; parsedSkills: string[] } | null;
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
            hackathonEntries: true,
          },
        },
        linkedInData: {
          select: { currentRole: true, company: true },
        },
        twitterData: {
          select: { handle: true, followerCount: true },
        },
        resumeData: {
          select: { currentRole: true, parsedSkills: true },
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
    const [repoStats, primaryLangStats] = await Promise.all([
      // Aggregate stars, forks, real commit counts across ALL repos
      this.prisma.repository.aggregate({
        where: { builderId },
        _sum: { stars: true, forks: true, commitCount: true },
        _count: true,
      }),
      // Language distribution from primaryLanguage across ALL repos (not just the 5 analyzed)
      this.prisma.repository.groupBy({
        by: ['primaryLanguage'],
        where: { builderId, primaryLanguage: { not: null } },
        _count: { primaryLanguage: true },
        orderBy: { _count: { primaryLanguage: 'desc' } },
        take: 10,
      }),
    ]);

    const totalRepoCount = repoStats._count;
    // commitCount on each repo is set from the GraphQL totalCount — real numbers
    const totalCommits = repoStats._sum.commitCount || 0;

    // Convert repo-count-per-language into percentages
    const totalWithLang = primaryLangStats.reduce((s, l) => s + (l._count.primaryLanguage || 0), 0);

    const LANG_COLORS: Record<string, string> = {
      TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
      Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
      C: '#555555', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF',
      Dart: '#00B4AB', PHP: '#4F5D95', Scala: '#c22d40', Shell: '#89e051',
      HTML: '#e34c26', CSS: '#563d7c', Vue: '#41b883', Svelte: '#ff3e00',
      Solidity: '#AA6746',
    };

    return {
      totalRepos: totalRepoCount,
      totalStars: repoStats._sum.stars || 0,
      totalForks: repoStats._sum.forks || 0,
      totalCommits,
      topLanguages: primaryLangStats
        .filter((l) => l.primaryLanguage)
        .map((l) => ({
          language: l.primaryLanguage as string,
          bytes: l._count.primaryLanguage || 0,
          percentage: totalWithLang > 0
            ? Math.round(((l._count.primaryLanguage || 0) / totalWithLang) * 10000) / 100
            : 0,
          color: LANG_COLORS[l.primaryLanguage as string] ?? '#8b8b8b',
        })),
    };
  }
}
