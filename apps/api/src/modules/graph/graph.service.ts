import type { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger.js';
import { NotFoundError } from '../../lib/errors.js';
import type { GraphResponse } from './graph.schema.js';

// ============================================================
// Graph Service — Builds and serves the collaboration graph.
//
// Nodes: builders, repositories, skills
// Edges: collaborated (shared repos), forked, skill_match
// ============================================================

export class GraphService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Build collaboration edges for a builder based on:
   * 1. Shared repository contributors (co-builders)
   * 2. Fork relationships
   * 3. Skill similarity (if other builders exist)
   */
  async buildGraph(builderId: string): Promise<void> {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        repositories: {
          include: { contributors: true },
        },
        skillTags: { select: { name: true } },
      },
    });

    if (!builder) throw new NotFoundError('Builder', builderId);

    // Find other builders who share repository contributors
    const myContributorLogins = new Set(
      builder.repositories
        .flatMap((r) => r.contributors)
        .filter((c) => !c.isOwner)
        .map((c) => c.githubLogin)
    );

    // Find builders whose GitHub profiles match contributor logins
    if (myContributorLogins.size > 0) {
      const relatedProfiles = await this.prisma.gitHubProfile.findMany({
        where: { username: { in: Array.from(myContributorLogins) } },
        select: { builderId: true, username: true },
      });

      for (const profile of relatedProfiles) {
        if (profile.builderId === builderId) continue;

        // Count shared contributions
        const sharedContribs = builder.repositories.reduce((count, repo) => {
          return count + repo.contributors.filter((c) => c.githubLogin === profile.username).length;
        }, 0);

        const weight = Math.min(1, sharedContribs / 10);

        await this.prisma.collaborationEdge.upsert({
          where: {
            sourceBuilderId_targetBuilderId_edgeType: {
              sourceBuilderId: builderId,
              targetBuilderId: profile.builderId,
              edgeType: 'collaborated',
            },
          },
          create: {
            sourceBuilderId: builderId,
            targetBuilderId: profile.builderId,
            weight,
            edgeType: 'collaborated',
            metadata: { sharedContributions: sharedContribs },
          },
          update: {
            weight,
            metadata: { sharedContributions: sharedContribs },
          },
        });
      }
    }

    // Skill match edges with other builders
    const mySkills = new Set(builder.skillTags.map((s) => s.name.toLowerCase()));
    if (mySkills.size > 0) {
      const otherBuilders = await this.prisma.builder.findMany({
        where: { id: { not: builderId } },
        include: { skillTags: { select: { name: true } } },
        take: 50,
      });

      for (const other of otherBuilders) {
        const otherSkills = new Set(other.skillTags.map((s) => s.name.toLowerCase()));
        const shared = [...mySkills].filter((s) => otherSkills.has(s));

        if (shared.length >= 2) {
          const weight = Math.min(1, shared.length / 8);

          await this.prisma.collaborationEdge.upsert({
            where: {
              sourceBuilderId_targetBuilderId_edgeType: {
                sourceBuilderId: builderId,
                targetBuilderId: other.id,
                edgeType: 'skill_match',
              },
            },
            create: {
              sourceBuilderId: builderId,
              targetBuilderId: other.id,
              weight,
              edgeType: 'skill_match',
              metadata: { sharedSkills: shared },
            },
            update: {
              weight,
              metadata: { sharedSkills: shared },
            },
          });
        }
      }
    }

    logger.info({ builderId }, 'Graph edges built');
  }

  /**
   * Get the collaboration graph for a builder — nodes + edges.
   * Returns the builder's repos and connected builders as a graph.
   */
  async getBuilderGraph(builderId: string): Promise<GraphResponse> {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        githubProfile: { select: { username: true, avatarUrl: true } },
        repositories: {
          where: { analysisStatus: 'COMPLETED' },
          include: { languages: true },
          take: 20,
          orderBy: { stars: 'desc' },
        },
        skillTags: { orderBy: { confidence: 'desc' }, take: 10 },
        reputationScores: true,
        outgoingEdges: {
          include: {
            targetBuilder: {
              include: {
                githubProfile: { select: { username: true, avatarUrl: true } },
                reputationScores: true,
              },
            },
          },
          take: 20,
        },
      },
    });

    if (!builder) throw new NotFoundError('Builder', builderId);

    const overallScore =
      builder.reputationScores.length > 0
        ? Math.round(
            builder.reputationScores.reduce((s, d) => s + d.score, 0) /
              builder.reputationScores.length
          )
        : 0;

    const nodes: GraphResponse['nodes'] = [];
    const edges: GraphResponse['edges'] = [];
    const addedBuilderIds = new Set<string>();

    // Center node: this builder
    nodes.push({
      id: builderId,
      type: 'builder',
      label: builder.githubProfile?.username ?? builder.displayName ?? 'You',
      score: overallScore,
      metadata: {
        avatarUrl: builder.githubProfile?.avatarUrl ?? builder.avatarUrl,
        walletAddress: builder.walletAddress,
        isMe: true,
      },
    });
    addedBuilderIds.add(builderId);

    // Repository nodes
    for (const repo of builder.repositories) {
      nodes.push({
        id: `repo-${repo.id}`,
        type: 'repository',
        label: repo.name,
        metadata: {
          fullName: repo.fullName,
          stars: repo.stars,
          primaryLanguage: repo.primaryLanguage,
          url: repo.url,
        },
      });

      edges.push({
        id: `owns-${repo.id}`,
        source: builderId,
        target: `repo-${repo.id}`,
        weight: 1,
        edgeType: 'owns',
      });
    }

    // Skill nodes (top 5)
    for (const skill of builder.skillTags.slice(0, 5)) {
      nodes.push({
        id: `skill-${skill.name}`,
        type: 'skill',
        label: skill.name,
        metadata: { confidence: skill.confidence },
      });

      edges.push({
        id: `skill-edge-${skill.name}`,
        source: builderId,
        target: `skill-${skill.name}`,
        weight: skill.confidence,
        edgeType: 'has_skill',
      });
    }

    // Connected builder nodes
    for (const edge of builder.outgoingEdges) {
      const target = edge.targetBuilder;
      if (addedBuilderIds.has(target.id)) continue;

      const targetScore =
        target.reputationScores.length > 0
          ? Math.round(
              target.reputationScores.reduce((s, d) => s + d.score, 0) /
                target.reputationScores.length
            )
          : 0;

      nodes.push({
        id: target.id,
        type: 'builder',
        label: target.githubProfile?.username ?? target.displayName ?? 'Builder',
        score: targetScore,
        metadata: {
          avatarUrl: target.githubProfile?.avatarUrl,
          edgeType: edge.edgeType,
        },
      });
      addedBuilderIds.add(target.id);

      edges.push({
        id: edge.id,
        source: builderId,
        target: target.id,
        weight: edge.weight,
        edgeType: edge.edgeType,
      });
    }

    return { nodes, edges };
  }
}
