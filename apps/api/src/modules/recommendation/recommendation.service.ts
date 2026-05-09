import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../lib/errors.js';
import type { CollaboratorRecommendation } from './recommendation.schema.js';

// ============================================================
// Recommendation Service — Suggests collaborators based on
// graph proximity, skill complementarity, and ecosystem fit.
// ============================================================

export class RecommendationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get top collaborator recommendations for a builder.
   * Scores candidates by: skill complement + graph proximity + domain overlap
   */
  async getCollaboratorRecommendations(
    builderId: string,
    limit: number = 5
  ): Promise<CollaboratorRecommendation[]> {
    const me = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        skillTags: true,
        reputationScores: true,
        outgoingEdges: { select: { targetBuilderId: true, weight: true, edgeType: true } },
        repositories: {
          where: { analysisStatus: 'COMPLETED' },
          include: { analysis: true },
        },
      },
    });

    if (!me) throw new NotFoundError('Builder', builderId);

    const mySkills = new Set(me.skillTags.map((s) => s.name.toLowerCase()));
    const myDomains = new Set(
      me.repositories.flatMap((r) => r.analysis?.probableDomains ?? []).map((d) => d.toLowerCase())
    );
    const connectedIds = new Set(me.outgoingEdges.map((e) => e.targetBuilderId));

    // Load other builders for comparison
    const candidates = await this.prisma.builder.findMany({
      where: {
        id: { not: builderId },
        skillTags: { some: {} }, // only builders with computed skills
      },
      include: {
        githubProfile: { select: { username: true, avatarUrl: true } },
        skillTags: true,
        reputationScores: true,
        repositories: {
          where: { analysisStatus: 'COMPLETED' },
          include: { analysis: true },
          take: 5,
          orderBy: { stars: 'desc' },
        },
      },
      take: 100,
    });

    const scored: (CollaboratorRecommendation & { _raw: number })[] = candidates
      .map((candidate) => {
        const theirSkills = new Set(candidate.skillTags.map((s) => s.name.toLowerCase()));
        const theirDomains = new Set(
          candidate.repositories
            .flatMap((r) => r.analysis?.probableDomains ?? [])
            .map((d) => d.toLowerCase())
        );

        // Skill complementarity: skills they have that I don't
        const complementarySkills = [...theirSkills].filter((s) => !mySkills.has(s));
        const complementScore = Math.min(30, complementarySkills.length * 5);

        // Shared domain overlap: working in same ecosystem
        const sharedDomains = [...myDomains].filter((d) => theirDomains.has(d));
        const domainScore = Math.min(30, sharedDomains.length * 8);

        // Graph proximity bonus (already connected)
        const proximityScore = connectedIds.has(candidate.id) ? 20 : 0;

        // Reputation quality bonus
        const theirOverallScore =
          candidate.reputationScores.length > 0
            ? candidate.reputationScores.reduce((s, d) => s + d.score, 0) /
              candidate.reputationScores.length
            : 0;
        const reputationBonus = Math.min(20, theirOverallScore / 5);

        const matchScore = Math.round(complementScore + domainScore + proximityScore + reputationBonus);

        const reasons: string[] = [];
        if (complementarySkills.length > 0) {
          reasons.push(`Brings ${complementarySkills.slice(0, 2).join(', ')} expertise you lack`);
        }
        if (sharedDomains.length > 0) {
          reasons.push(`Works in ${sharedDomains.slice(0, 2).join(', ')}`);
        }
        if (connectedIds.has(candidate.id)) {
          reasons.push('Already in your collaboration network');
        }
        if (theirOverallScore >= 60) {
          reasons.push(`High reputation builder (${Math.round(theirOverallScore)}/100)`);
        }

        return {
          builderId: candidate.id,
          displayName: candidate.displayName,
          walletAddress: candidate.walletAddress,
          githubUsername: candidate.githubProfile?.username ?? null,
          avatarUrl: candidate.githubProfile?.avatarUrl ?? candidate.avatarUrl,
          matchScore,
          reasons,
          sharedDomains: sharedDomains.slice(0, 3),
          complementarySkills: complementarySkills.slice(0, 5),
          overallScore: Math.round(theirOverallScore),
          _raw: matchScore,
        };
      })
      .filter((r) => r.matchScore > 0)
      .sort((a, b) => b._raw - a._raw)
      .slice(0, limit);

    return scored.map(({ _raw, ...r }) => r);
  }
}
