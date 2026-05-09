import type { PrismaClient } from '@prisma/client';
import type { RepoIngestionData } from '../github/github.types.js';
import { logger } from '../../lib/logger.js';

// ============================================================
// Ingestion Repository — Database write operations
// Handles all Prisma transactions for ingested data
// ============================================================

export class IngestionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert a fully ingested repository with all related data.
   * Uses a transaction to ensure atomicity.
   */
  async upsertRepository(
    builderId: string,
    data: RepoIngestionData
  ): Promise<{ repoId: string; isNew: boolean }> {
    const { repo, languages, commits, contributors } = data;

    return this.prisma.$transaction(async (tx) => {
      // Check if repo exists
      const existing = await tx.repository.findUnique({
        where: { githubId: repo.githubId },
        select: { id: true },
      });

      const isNew = !existing;

      // Upsert repo
      const upserted = await tx.repository.upsert({
        where: { githubId: repo.githubId },
        create: {
          builderId,
          githubId: repo.githubId,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          url: repo.url,
          homepage: repo.homepage,
          isPrivate: repo.isPrivate,
          isFork: repo.isFork,
          isArchived: repo.isArchived,
          stars: repo.stars,
          forks: repo.forks,
          watchers: repo.watchers,
          openIssues: repo.openIssues,
          size: repo.size,
          defaultBranch: repo.defaultBranch,
          primaryLanguage: repo.primaryLanguage,
          topics: repo.topics,
          licenseName: repo.licenseName,
          hasDeployment: repo.hasDeployment,
          commitCount: commits.length,
          pushedAt: repo.pushedAt,
          repoCreatedAt: repo.repoCreatedAt,
          repoUpdatedAt: repo.repoUpdatedAt,
          analysisStatus: 'PENDING',
        },
        update: {
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          url: repo.url,
          homepage: repo.homepage,
          isPrivate: repo.isPrivate,
          isFork: repo.isFork,
          isArchived: repo.isArchived,
          stars: repo.stars,
          forks: repo.forks,
          watchers: repo.watchers,
          openIssues: repo.openIssues,
          size: repo.size,
          defaultBranch: repo.defaultBranch,
          primaryLanguage: repo.primaryLanguage,
          topics: repo.topics,
          licenseName: repo.licenseName,
          hasDeployment: repo.hasDeployment,
          commitCount: commits.length,
          pushedAt: repo.pushedAt,
          repoCreatedAt: repo.repoCreatedAt,
          repoUpdatedAt: repo.repoUpdatedAt,
        },
      });

      const repoId = upserted.id;

      // Replace languages
      await tx.repositoryLanguage.deleteMany({ where: { repositoryId: repoId } });
      if (languages.length > 0) {
        await tx.repositoryLanguage.createMany({
          data: languages.map((l) => ({
            repositoryId: repoId,
            language: l.language,
            bytes: l.bytes,
            percentage: l.percentage,
            color: l.color,
          })),
        });
      }

      // Upsert commits (by sha)
      for (const commit of commits) {
        await tx.commit.upsert({
          where: {
            repositoryId_sha: { repositoryId: repoId, sha: commit.sha },
          },
          create: {
            repositoryId: repoId,
            sha: commit.sha,
            message: commit.message,
            authorLogin: commit.authorLogin,
            authorEmail: commit.authorEmail,
            additions: commit.additions,
            deletions: commit.deletions,
            committedAt: commit.committedAt,
          },
          update: {
            message: commit.message,
            authorLogin: commit.authorLogin,
            additions: commit.additions,
            deletions: commit.deletions,
          },
        });
      }

      // Replace contributors
      await tx.contributor.deleteMany({ where: { repositoryId: repoId } });
      if (contributors.length > 0) {
        await tx.contributor.createMany({
          data: contributors.map((c) => ({
            repositoryId: repoId,
            githubLogin: c.githubLogin,
            githubId: c.githubId,
            avatarUrl: c.avatarUrl,
            contributions: c.contributions,
            isOwner: false, // Will be updated by pipeline
          })),
        });
      }

      logger.debug(
        {
          repoId,
          repo: repo.fullName,
          languages: languages.length,
          commits: commits.length,
          contributors: contributors.length,
        },
        'Repository upserted'
      );

      return { repoId, isNew };
    });
  }

  /**
   * Mark the repository owner in contributor table.
   */
  async markRepoOwner(repositoryId: string, ownerLogin: string): Promise<void> {
    await this.prisma.contributor.updateMany({
      where: { repositoryId, githubLogin: ownerLogin },
      data: { isOwner: true },
    });
  }

  /**
   * Update repository analysis status.
   */
  async updateRepoStatus(
    repoId: string,
    status: 'PENDING' | 'INGESTING' | 'ANALYZING' | 'COMPLETED' | 'FAILED'
  ): Promise<void> {
    await this.prisma.repository.update({
      where: { id: repoId },
      data: { analysisStatus: status },
    });
  }

  /**
   * Get all repository IDs for a builder.
   */
  async getBuilderRepoIds(builderId: string): Promise<string[]> {
    const repos = await this.prisma.repository.findMany({
      where: { builderId },
      select: { id: true },
    });
    return repos.map((r) => r.id);
  }

  /**
   * Get existing GitHub IDs for a builder (to detect new repos).
   */
  async getExistingGitHubIds(builderId: string): Promise<Set<number>> {
    const repos = await this.prisma.repository.findMany({
      where: { builderId },
      select: { githubId: true },
    });
    return new Set(repos.map((r) => r.githubId));
  }
}
