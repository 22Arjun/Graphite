import type { PrismaClient, ReputationDimension, LinkedInData, TwitterData, HackathonEntry, ResumeData } from '@prisma/client';
import { logger } from '../../lib/logger.js';
import { NotFoundError } from '../../lib/errors.js';
import type { DimensionScore } from './scoring.schema.js';

// ============================================================
// Scoring Service — Computes reputation dimensions from
// ingested data and AI analysis results.
//
// Each dimension is scored 0-100 from deterministic signals:
// no AI call needed here — we use the already-analyzed data.
// ============================================================

export class ScoringService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Compute all 5 reputation dimensions for a builder.
   * Writes to reputation_scores table. Upserts skill_tags.
   */
  async computeReputation(builderId: string): Promise<DimensionScore[]> {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        repositories: {
          include: {
            analysis: true,
            languages: { select: { language: true, percentage: true } },
            commits: { orderBy: { committedAt: 'desc' }, take: 100, select: { committedAt: true } },
            contributors: { select: { githubLogin: true, contributions: true, isOwner: true } },
          },
        },
        linkedInData: true,
        twitterData: true,
        hackathonEntries: true,
        resumeData: true,
      },
    });

    if (!builder) throw new NotFoundError('Builder', builderId);

    const repos = builder.repositories;

    if (repos.length === 0) {
      logger.info({ builderId }, 'No analyzed repos — skipping reputation compute');
      return [];
    }

    const { linkedInData, twitterData, hackathonEntries, resumeData } = builder;

    const dimensions = ['TECHNICAL_DEPTH', 'EXECUTION_ABILITY', 'CONSISTENCY', 'COLLABORATION_QUALITY', 'INNOVATION'] as const;

    const githubScores: Record<string, DimensionScore> = {
      TECHNICAL_DEPTH: this.computeTechnicalDepth(repos),
      EXECUTION_ABILITY: this.computeExecutionAbility(repos),
      CONSISTENCY: this.computeConsistency(repos),
      COLLABORATION_QUALITY: this.computeCollaborationQuality(repos),
      INNOVATION: this.computeInnovation(repos),
    };

    const sourceCount = [
      linkedInData,
      twitterData,
      hackathonEntries.length > 0,
      resumeData,
    ].filter(Boolean).length;

    const scores: DimensionScore[] = dimensions.map((dim) => {
      const base = githubScores[dim];

      const linkedInBonus = this.computeLinkedInBonus(linkedInData, dim);
      const hackathonBonus = this.computeHackathonBonus(hackathonEntries, dim);
      const twitterBonus = this.computeTwitterBonus(twitterData, dim);
      const resumeBonus = this.computeResumeBonus(resumeData, dim);

      const totalBonus = linkedInBonus.bonus + hackathonBonus.bonus + twitterBonus.bonus + resumeBonus.bonus;
      const finalScore = Math.min(100, Math.round(base.score + totalBonus));
      const finalConfidence = Math.min(1.0, base.confidence + sourceCount * 0.1);
      const allSignals = [
        ...base.signals,
        ...linkedInBonus.signals,
        ...hackathonBonus.signals,
        ...twitterBonus.signals,
        ...resumeBonus.signals,
      ];

      return {
        dimension: dim,
        score: finalScore,
        confidence: finalConfidence,
        signals: allSignals,
        trend: base.trend,
      };
    });

    // Batch all 5 dimension upserts in a single transaction to reduce lock contention
    await this.prisma.$transaction(
      scores.map((score) =>
        this.prisma.reputationScore.upsert({
          where: { builderId_dimension: { builderId, dimension: score.dimension as ReputationDimension } },
          create: {
            builderId,
            dimension: score.dimension as ReputationDimension,
            score: score.score,
            confidence: score.confidence,
            signals: score.signals,
            trend: score.trend,
          },
          update: {
            score: score.score,
            confidence: score.confidence,
            signals: score.signals,
            trend: score.trend,
            computedAt: new Date(),
          },
        })
      )
    );

    // Upsert aggregated skill tags from all repo analyses
    await this.aggregateSkillTags(builderId, repos);

    logger.info({ builderId, scores: scores.map((s) => `${s.dimension}:${s.score}`) }, 'Reputation computed');
    return scores;
  }

  /**
   * Get existing reputation scores for a builder.
   */
  async getReputation(builderId: string) {
    const scores = await this.prisma.reputationScore.findMany({
      where: { builderId },
      orderBy: { dimension: 'asc' },
    });

    const overallScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
        : 0;

    return { overallScore, dimensions: scores };
  }

  // -------------------------------------------------------
  // Dimension Computations
  // -------------------------------------------------------

  private computeTechnicalDepth(repos: RepoWithAnalysis[]): DimensionScore {
    const analyses = repos.map((r) => r.analysis).filter(Boolean);

    // Language diversity — available from all repos regardless of AI analysis
    const allLanguages = new Set([
      ...repos.flatMap((r) => r.languages.map((l) => l.language)),
      ...repos.map((r) => r.primaryLanguage).filter(Boolean) as string[],
    ]);
    const langDiversityScore = Math.min(25, allLanguages.size * 3);

    // Repo volume signal
    const repoVolumeScore = Math.min(20, repos.length * 1.5);

    // AI boost — only if analysis records exist
    let aiScore = 0;
    if (analyses.length > 0) {
      const avgComplexity = avg(analyses.map((a) => a!.architectureComplexity));
      const avgQuality = avg(analyses.map((a) => a!.codeQualitySignals));
      aiScore = avgComplexity * 3 + avgQuality * 3;
    }

    const score = Math.min(100, Math.round(langDiversityScore + repoVolumeScore + aiScore));

    const signals: string[] = [
      `${repos.length} repositories in profile`,
      `${allLanguages.size} programming languages used`,
    ];
    if (analyses.length > 0) {
      signals.push(`${analyses.length} repos AI-analyzed`);
    }

    // Confidence: repos give a behavioral baseline; AI analysis adds certainty
    const baseConfidence = Math.min(0.6, repos.length / 10);
    const aiConfidence = Math.min(0.4, analyses.length / 5);
    return {
      dimension: 'TECHNICAL_DEPTH',
      score,
      confidence: Math.min(1, baseConfidence + aiConfidence),
      signals,
      trend: 'STABLE',
    };
  }

  private computeExecutionAbility(repos: RepoWithAnalysis[]): DimensionScore {
    const analyses = repos.map((r) => r.analysis).filter(Boolean);

    // Behavioral signals — available without AI
    const deployedCount = repos.filter(
      (r) => r.hasDeployment || r.analysis?.deploymentDetected
    ).length;
    const totalStars = repos.reduce((s, r) => s + r.stars, 0);
    const totalForks = repos.reduce((s, r) => s + r.forks, 0);

    const deploymentScore = Math.min(30, deployedCount * 6);
    const repoCountScore = Math.min(20, repos.length * 1.5);
    const socialProof = Math.min(20, Math.log10(totalStars + totalForks + 1) * 8);

    // AI boost
    let aiScore = 0;
    if (analyses.length > 0) {
      const avgMaturity = avg(analyses.map((a) => a!.executionMaturity));
      aiScore = avgMaturity * 3;
    }

    const score = Math.min(100, Math.round(deploymentScore + repoCountScore + socialProof + aiScore));

    const signals: string[] = [
      `${repos.length} repositories maintained`,
      `${deployedCount} deployed projects`,
      `${totalStars} total stars earned`,
    ];
    if (analyses.length > 0) signals.push(`AI maturity avg: ${avg(analyses.map(a => a!.executionMaturity)).toFixed(1)}/10`);

    const baseConfidence = Math.min(0.6, repos.length / 8);
    const aiConfidence = Math.min(0.4, analyses.length / 5);
    return {
      dimension: 'EXECUTION_ABILITY',
      score,
      confidence: Math.min(1, baseConfidence + aiConfidence),
      signals,
      trend: 'STABLE',
    };
  }

  private computeConsistency(repos: RepoWithAnalysis[]): DimensionScore {
    const allCommits = repos.flatMap((r) => r.commits);
    if (allCommits.length === 0) return this.zeroScore('CONSISTENCY');

    // Determine active months
    const monthSet = new Set(
      allCommits.map((c) => {
        const d = new Date(c.committedAt);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );

    const activeMonths = monthSet.size;

    // Determine streak (consecutive months with commits)
    const sortedMonths = Array.from(monthSet).sort();
    const streak = this.computeMonthStreak(sortedMonths);

    const commitFrequencyScore = Math.min(40, activeMonths * 2);
    const streakScore = Math.min(40, streak * 5);
    const volumeScore = Math.min(20, Math.log10(allCommits.length + 1) * 10);

    const score = Math.min(100, Math.round(commitFrequencyScore + streakScore + volumeScore));

    const signals: string[] = [
      `${activeMonths} active months`,
      `${streak} month streak`,
      `${allCommits.length} commits analyzed`,
    ];

    return {
      dimension: 'CONSISTENCY',
      score,
      confidence: Math.min(1, allCommits.length / 50),
      signals,
      trend: 'STABLE',
    };
  }

  private computeCollaborationQuality(repos: RepoWithAnalysis[]): DimensionScore {
    const allContributors = repos.flatMap((r) => r.contributors);
    const uniqueCollaborators = new Set(
      allContributors.filter((c) => !c.isOwner).map((c) => c.githubLogin)
    );

    const reposWithCollaborators = repos.filter(
      (r) => r.contributors.some((c) => !c.isOwner)
    ).length;

    const totalContributions = allContributors
      .filter((c) => !c.isOwner)
      .reduce((s, c) => s + c.contributions, 0);

    const collaboratorScore = Math.min(40, uniqueCollaborators.size * 4);
    const teamworkScore = Math.min(30, reposWithCollaborators * 5);
    const contributionScore = Math.min(30, Math.log10(totalContributions + 1) * 12);
    // Public portfolio signal — having repos others can see and fork is a collaboration signal
    const publicPortfolioScore = Math.min(10, repos.length * 0.5);

    const score = Math.min(100, Math.round(collaboratorScore + teamworkScore + contributionScore + publicPortfolioScore));

    const signals: string[] = [
      `${uniqueCollaborators.size} unique collaborators`,
      `${reposWithCollaborators} collaborative projects`,
      `${repos.length} public repositories`,
    ];
    if (totalContributions > 0) {
      signals.push(`${totalContributions} external contributions received`);
    }

    // Confidence: even solo devs get a baseline from having a public profile
    // External collaborators increase confidence further
    const baseConfidence = Math.min(0.4, repos.length / 15);
    const collabConfidence = Math.min(0.6, uniqueCollaborators.size / 5);
    return {
      dimension: 'COLLABORATION_QUALITY',
      score,
      confidence: Math.min(1, baseConfidence + collabConfidence),
      signals,
      trend: 'STABLE',
    };
  }

  private computeInnovation(repos: RepoWithAnalysis[]): DimensionScore {
    const analyses = repos.map((r) => r.analysis).filter(Boolean);

    // Topic diversity — available from all repos regardless of AI analysis
    const allTopics = new Set(repos.flatMap((r) => r.topics));
    const topicDiversityScore = Math.min(25, allTopics.size * 2);

    // Variety of languages signals breadth of exploration
    const allLanguages = new Set([
      ...repos.flatMap((r) => r.languages.map((l) => l.language)),
      ...repos.map((r) => r.primaryLanguage).filter(Boolean) as string[],
    ]);
    const langVarietyScore = Math.min(20, allLanguages.size * 2);

    // AI boost
    let aiScore = 0;
    if (analyses.length > 0) {
      const avgOriginality = avg(analyses.map((a) => a!.originalityScore));
      const allDomains = new Set(analyses.flatMap((a) => a!.probableDomains));
      aiScore = avgOriginality * 4 + Math.min(15, allDomains.size * 3);
    }

    const score = Math.min(100, Math.round(topicDiversityScore + langVarietyScore + aiScore));

    const signals: string[] = [
      `${allTopics.size} unique topic tags`,
      `${allLanguages.size} languages explored`,
    ];
    if (analyses.length > 0) {
      const avgOriginality = avg(analyses.map((a) => a!.originalityScore));
      signals.push(`AI originality avg: ${avgOriginality.toFixed(1)}/10`);
    }

    const baseConfidence = Math.min(0.5, repos.length / 10);
    const aiConfidence = Math.min(0.5, analyses.length / 5);
    return {
      dimension: 'INNOVATION',
      score,
      confidence: Math.min(1, baseConfidence + aiConfidence),
      signals,
      trend: 'STABLE',
    };
  }

  // -------------------------------------------------------
  // Multi-Source Bonus Functions
  // -------------------------------------------------------

  private computeLinkedInBonus(
    data: LinkedInData | null,
    dimension: string
  ): { bonus: number; signals: string[] } {
    if (!data) return { bonus: 0, signals: [] };
    const signals: string[] = [];
    let bonus = 0;

    if (dimension === 'TECHNICAL_DEPTH') {
      const expBonus = data.yearsExperience >= 3 ? 5 : 2;
      const skillsBonus = data.skills.length >= 5 ? 3 : 0;
      bonus = expBonus + skillsBonus;
      if (expBonus > 0) signals.push(`LinkedIn: ${data.yearsExperience} years experience`);
      if (skillsBonus > 0) signals.push(`LinkedIn: ${data.skills.length} endorsed skills`);
    } else if (dimension === 'EXECUTION_ABILITY') {
      const roleBonus = data.currentRole ? 5 : 0;
      const eduBonus = data.educationLevel && ['BACHELOR', 'MASTER', 'PHD'].includes(data.educationLevel) ? 2 : 0;
      bonus = roleBonus + eduBonus;
      if (roleBonus > 0) signals.push(`LinkedIn: ${data.currentRole}`);
    } else if (dimension === 'CONSISTENCY') {
      bonus = Math.min(8, Math.round(data.yearsExperience * 0.8));
      if (bonus > 0) signals.push(`LinkedIn: ${data.yearsExperience} years consistent career`);
    }

    return { bonus, signals };
  }

  private computeHackathonBonus(
    entries: HackathonEntry[],
    dimension: string
  ): { bonus: number; signals: string[] } {
    if (entries.length === 0) return { bonus: 0, signals: [] };
    const signals: string[] = [];
    const wins = entries.filter((e) => e.placement && /1st|winner|first|champion/i.test(e.placement)).length;
    let bonus = 0;

    if (dimension === 'EXECUTION_ABILITY') {
      bonus = Math.min(12, entries.length * 2 + wins * 3);
      signals.push(`${entries.length} hackathon${entries.length > 1 ? 's' : ''} participated`);
      if (wins > 0) signals.push(`${wins} hackathon win${wins > 1 ? 's' : ''}`);
    } else if (dimension === 'INNOVATION') {
      bonus = Math.min(10, Math.round(entries.length * 1.5) + wins * 2);
      signals.push(`Hackathon participation signals innovation`);
    } else if (dimension === 'TECHNICAL_DEPTH') {
      bonus = Math.min(5, entries.length);
    }

    return { bonus, signals };
  }

  private computeTwitterBonus(
    data: TwitterData | null,
    dimension: string
  ): { bonus: number; signals: string[] } {
    if (!data) return { bonus: 0, signals: [] };
    const signals: string[] = [];
    let bonus = 0;

    if (dimension === 'COLLABORATION_QUALITY') {
      bonus = Math.min(8, Math.round(Math.log10(data.followerCount + 1) * 4));
      if (bonus > 0) signals.push(`Twitter: ${data.followerCount.toLocaleString()} followers`);
    } else if (dimension === 'INNOVATION') {
      bonus = data.accountAgeYears >= 2 ? 3 : 0;
      if (bonus > 0) signals.push(`Twitter: established tech presence`);
    }

    return { bonus, signals };
  }

  private computeResumeBonus(
    data: ResumeData | null,
    dimension: string
  ): { bonus: number; signals: string[] } {
    if (!data) return { bonus: 0, signals: [] };
    const signals: string[] = [];
    let bonus = 0;

    if (dimension === 'TECHNICAL_DEPTH') {
      const skillsBonus = Math.min(8, Math.round(data.parsedSkills.length * 0.5));
      const stackBonus = data.parsedTechStack.length >= 5 ? 4 : 0;
      bonus = skillsBonus + stackBonus;
      if (skillsBonus > 0) signals.push(`Resume: ${data.parsedSkills.length} skills identified`);
      if (stackBonus > 0) signals.push(`Resume: ${data.parsedTechStack.length} technologies`);
    } else if (dimension === 'EXECUTION_ABILITY') {
      const expBonus = Math.min(6, Math.round(data.yearsExperience * 0.8));
      const eduBonus = data.educationLevel && ['BACHELOR', 'MASTER', 'PHD'].includes(data.educationLevel) ? 3 : 0;
      bonus = expBonus + eduBonus;
      if (expBonus > 0) signals.push(`Resume: ${data.yearsExperience} years of experience`);
    } else if (dimension === 'CONSISTENCY') {
      bonus = data.yearsExperience >= 2 ? 4 : 0;
      if (bonus > 0) signals.push(`Resume confirms consistent career`);
    }

    return { bonus, signals };
  }

  // -------------------------------------------------------
  // Skill Tag Aggregation
  // -------------------------------------------------------

  private async aggregateSkillTags(builderId: string, repos: RepoWithAnalysis[]) {
    const skillMap = new Map<string, { category: string; confidence: number; sources: string[] }>();

    // Skills from AI analysis
    for (const repo of repos) {
      if (!repo.analysis) continue;
      for (const skill of repo.analysis.inferredSkills) {
        const existing = skillMap.get(skill.toLowerCase());
        if (existing) {
          existing.confidence = Math.min(1, existing.confidence + 0.15);
          existing.sources.push(repo.fullName);
        } else {
          skillMap.set(skill.toLowerCase(), {
            category: 'LANGUAGE',
            confidence: 0.6,
            sources: [repo.fullName],
          });
        }
      }
    }

    // Languages from repo data
    const langCounts = new Map<string, number>();
    for (const repo of repos) {
      for (const lang of repo.languages) {
        langCounts.set(lang.language, (langCounts.get(lang.language) ?? 0) + lang.percentage);
      }
    }

    for (const [lang, totalPct] of langCounts) {
      const confidence = Math.min(0.95, totalPct / 100);
      skillMap.set(lang.toLowerCase(), {
        category: 'LANGUAGE',
        confidence,
        sources: [`${Math.round(totalPct)}% of codebase`],
      });
    }

    // Replace skill tags atomically: delete existing then bulk-insert new set.
    // Eliminates N individual upserts (one per skill) which cause lock contention.
    if (skillMap.size > 0) {
      await this.prisma.$transaction([
        this.prisma.skillTag.deleteMany({ where: { builderId } }),
        this.prisma.skillTag.createMany({
          data: Array.from(skillMap.entries()).map(([name, data]) => ({
            builderId,
            name,
            category: data.category as any,
            confidence: data.confidence,
            inferredFrom: data.sources,
          })),
          skipDuplicates: true,
        }),
      ]);
    }
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------

  private computeMonthStreak(sortedMonths: string[]): number {
    if (sortedMonths.length === 0) return 0;
    let maxStreak = 1;
    let current = 1;
    for (let i = 1; i < sortedMonths.length; i++) {
      const [py, pm] = sortedMonths[i - 1].split('-').map(Number);
      const [cy, cm] = sortedMonths[i].split('-').map(Number);
      const diff = (cy - py) * 12 + (cm - pm);
      if (diff === 1) {
        current++;
        maxStreak = Math.max(maxStreak, current);
      } else {
        current = 1;
      }
    }
    return maxStreak;
  }

  private zeroScore(dimension: string): DimensionScore {
    return {
      dimension: dimension as DimensionScore['dimension'],
      score: 0,
      confidence: 0,
      signals: ['Insufficient data'],
      trend: 'STABLE',
    };
  }
}

// -------------------------------------------------------
// Type helpers
// -------------------------------------------------------

type RepoWithAnalysis = {
  id: string;
  fullName: string;
  stars: number;
  forks: number;
  hasDeployment: boolean;
  topics: string[];
  primaryLanguage: string | null;
  languages: { language: string; percentage: number }[];
  commits: { committedAt: Date }[];
  contributors: { githubLogin: string; contributions: number; isOwner: boolean }[];
  analysis: {
    architectureComplexity: number;
    codeQualitySignals: number;
    executionMaturity: number;
    originalityScore: number;
    inferredSkills: string[];
    probableDomains: string[];
    builderSummary: string;
    deploymentDetected: boolean;
  } | null;
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
