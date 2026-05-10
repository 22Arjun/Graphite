import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import type { AnalysisResult } from './analysis.schema.js';

// ============================================================
// Analysis Service
//
// Two separate, decoupled Gemini calls:
//   1. analyzeRepositoriesBatch  — repo scoring only (synchronous during sync)
//   2. generateBuilderSummary    — builder summary only (fire-and-forget, 6 s after scoring)
//
// Splitting prevents the combined prompt from hitting maxOutputTokens and
// gives a 6-second gap between calls to clear the free-tier 15 RPM window.
// ============================================================

export class AnalysisService {
  private readonly genai: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaClient) {
    this.genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  // -------------------------------------------------------
  // 1. Repo analysis — called synchronously during ingestion
  // -------------------------------------------------------

  async analyzeRepositoriesBatch(builderId: string, repoIds: string[]): Promise<void> {
    if (repoIds.length === 0) return;

    const repos = await this.prisma.repository.findMany({
      where: { id: { in: repoIds }, builderId },
      include: {
        languages: true,
        commits: { orderBy: { committedAt: 'desc' }, take: 10 },
        contributors: { orderBy: { contributions: 'desc' }, take: 5 },
      },
    });

    if (repos.length === 0) return;

    await this.prisma.repository.updateMany({
      where: { id: { in: repos.map((r) => r.id) } },
      data: { analysisStatus: 'ANALYZING' },
    });

    try {
      const repoResults = await this.runRepoAnalysis(repos);

      await this.prisma.$transaction([
        ...repoResults.map((result, i) =>
          this.prisma.repositoryAnalysis.upsert({
            where: { repositoryId: repos[i].id },
            create: {
              repositoryId: repos[i].id,
              architectureComplexity: result.architectureComplexity,
              codeQualitySignals: result.codeQualitySignals,
              executionMaturity: result.executionMaturity,
              originalityScore: result.originalityScore,
              inferredSkills: result.inferredSkills,
              probableDomains: result.probableDomains,
              builderSummary: '',
              keyPatterns: result.keyPatterns,
              deploymentDetected: result.deploymentDetected,
              testCoverageSignals: result.testCoverageSignals,
              modelVersion: 'gemini-2.0-flash',
            },
            update: {
              architectureComplexity: result.architectureComplexity,
              codeQualitySignals: result.codeQualitySignals,
              executionMaturity: result.executionMaturity,
              originalityScore: result.originalityScore,
              inferredSkills: result.inferredSkills,
              probableDomains: result.probableDomains,
              keyPatterns: result.keyPatterns,
              deploymentDetected: result.deploymentDetected,
              testCoverageSignals: result.testCoverageSignals,
              analyzedAt: new Date(),
              modelVersion: 'gemini-2.0-flash',
            },
          })
        ),
        this.prisma.repository.updateMany({
          where: { id: { in: repos.map((r) => r.id) } },
          data: { analysisStatus: 'COMPLETED' },
        }),
      ]);

      logger.info({ builderId, repos: repos.length }, 'Repo analysis saved');
    } catch (err) {
      await this.prisma.repository.updateMany({
        where: { id: { in: repos.map((r) => r.id) } },
        data: { analysisStatus: 'FAILED' },
      });
      throw err;
    }
  }

  // -------------------------------------------------------
  // 2. Builder summary — called fire-and-forget after scoring
  //    Always produces something: AI text or template fallback.
  // -------------------------------------------------------

  async generateBuilderSummary(builderId: string): Promise<void> {
    const ctx = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        githubProfile: { select: { username: true, bio: true, followers: true, publicRepos: true } },
        linkedInData: true,
        twitterData: true,
        hackathonEntries: { orderBy: { year: 'desc' }, take: 5 },
        resumeData: true,
        repositories: {
          where: { analysisStatus: 'COMPLETED' },
          include: {
            analysis: { select: { inferredSkills: true, probableDomains: true } },
          },
          orderBy: { stars: 'desc' },
          take: 5,
        },
      },
    });

    if (!ctx) return;

    // Aggregate skills and domains across analyzed repos
    const skills = [
      ...new Set(
        ctx.repositories.flatMap((r) => (r.analysis as any)?.inferredSkills ?? []) as string[]
      ),
    ].slice(0, 8);
    const domains = [
      ...new Set(
        ctx.repositories.flatMap((r) => (r.analysis as any)?.probableDomains ?? []) as string[]
      ),
    ].slice(0, 4);

    let summary = '';

    try {
      summary = await this.callGeminiForSummary(ctx, skills, domains);
      logger.info({ builderId }, 'AI builder summary generated');
    } catch (err) {
      logger.warn({ builderId, err }, 'Gemini summary failed — falling back to template');
    }

    if (!summary) {
      summary = buildTemplateSummary(ctx, skills, domains);
      logger.info({ builderId }, 'Template builder summary generated');
    }

    if (summary) {
      await this.prisma.builder.update({
        where: { id: builderId },
        data: { aiSummary: summary },
      });
    }
  }

  /**
   * Get analysis status/result for a repository.
   */
  async getAnalysis(repositoryId: string) {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: { analysis: true },
    });

    if (!repo) throw new NotFoundError('Repository', repositoryId);

    return { repositoryId, status: repo.analysisStatus, analysis: repo.analysis };
  }

  // -------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------

  private async runRepoAnalysis(
    repos: {
      id: string;
      name: string;
      fullName: string;
      description: string | null;
      primaryLanguage: string | null;
      topics: string[];
      stars: number;
      forks: number;
      commitCount: number;
      hasDeployment: boolean;
      size: number;
      licenseName: string | null;
      languages: { language: string; percentage: number }[];
      commits: { message: string }[];
      contributors: { githubLogin: string; contributions: number; isOwner: boolean }[];
    }[]
  ): Promise<AnalysisResult[]> {
    const repoSummaries = repos.map((repo, i) => {
      const langs = repo.languages
        .map((l) => `${l.language} (${l.percentage.toFixed(1)}%)`)
        .join(', ');
      const commits = repo.commits
        .slice(0, 5)
        .map((c) => `- ${c.message.split('\n')[0].slice(0, 60)}`)
        .join('\n');
      return `Repository ${i + 1}: ${repo.fullName}
Description: ${repo.description || 'None'}
Language: ${repo.primaryLanguage || 'Unknown'} | Languages: ${langs || 'Unknown'}
Topics: ${repo.topics.join(', ') || 'None'}
Stars: ${repo.stars} | Forks: ${repo.forks} | Commits: ${repo.commitCount} | Deployed: ${repo.hasDeployment}
Recent commits:\n${commits || 'None'}`;
    });

    const prompt = `Analyze these ${repos.length} GitHub repositories and return a JSON object.

${repoSummaries.join('\n\n')}

Return ONLY valid JSON with this exact structure:
{
  "repositories": [
    {
      "architectureComplexity": <1-10 integer>,
      "codeQualitySignals": <1-10 integer>,
      "executionMaturity": <1-10 integer>,
      "originalityScore": <1-10 integer>,
      "inferredSkills": [up to 8 skill strings],
      "probableDomains": [up to 4 domain strings],
      "keyPatterns": [up to 4 pattern strings],
      "deploymentDetected": <boolean>,
      "testCoverageSignals": "none or minimal or moderate or comprehensive"
    }
  ]
}

The array must have exactly ${repos.length} objects in the same order provided.
Scoring: architectureComplexity (1=script,10=distributed), codeQualitySignals (1=messy,10=excellent), executionMaturity (1=prototype,10=production), originalityScore (1=tutorial clone,10=novel).`;

    const raw = await this.callGeminiWithRetry(prompt);
    const text = raw.response.text();
    if (!text) throw new AppError('Empty Gemini response', 502, 'AI_EMPTY_RESPONSE');

    let parsed: any;
    try {
      const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();
      try {
        parsed = JSON.parse(clean);
      } catch {
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      }
    } catch (err) {
      logger.warn({ err }, 'Gemini repo analysis parse failed — using defaults');
    }

    const items: any[] = Array.isArray(parsed?.repositories) ? parsed.repositories : [];

    return repos.map((repo, i) => {
      const item = items[i];
      if (!item || typeof item !== 'object') return defaultAnalysis(repo.id, repo.hasDeployment);
      return {
        repositoryId: repo.id,
        architectureComplexity: clamp(Math.round(item.architectureComplexity ?? 3), 1, 10),
        codeQualitySignals: clamp(Math.round(item.codeQualitySignals ?? 3), 1, 10),
        executionMaturity: clamp(Math.round(item.executionMaturity ?? 2), 1, 10),
        originalityScore: clamp(Math.round(item.originalityScore ?? 3), 1, 10),
        inferredSkills: Array.isArray(item.inferredSkills) ? item.inferredSkills.slice(0, 8) : [],
        probableDomains: Array.isArray(item.probableDomains) ? item.probableDomains.slice(0, 4) : [],
        builderSummary: '',
        keyPatterns: Array.isArray(item.keyPatterns) ? item.keyPatterns.slice(0, 4) : [],
        deploymentDetected: Boolean(item.deploymentDetected ?? repo.hasDeployment),
        testCoverageSignals: ['none', 'minimal', 'moderate', 'comprehensive'].includes(
          item.testCoverageSignals
        )
          ? item.testCoverageSignals
          : 'none',
      };
    });
  }

  /**
   * Call Gemini with a tiny focused prompt to generate the builder summary.
   * This is a plain-text call — no JSON required, much smaller, far less likely to be rate-limited.
   */
  private async callGeminiForSummary(
    ctx: {
      githubProfile: { username: string; bio: string | null; followers: number; publicRepos: number } | null;
      linkedInData: {
        currentRole: string | null; company: string | null; yearsExperience: number;
        skills: string[]; summary: string | null;
      } | null;
      twitterData: { handle: string; followerCount: number; bio: string | null } | null;
      hackathonEntries: { name: string; year: number; placement: string | null }[];
      resumeData: {
        currentRole: string | null; yearsExperience: number;
        parsedTechStack: string[]; summary: string | null;
      } | null;
    },
    skills: string[],
    domains: string[]
  ): Promise<string> {
    const lines: string[] = [];

    if (ctx.githubProfile) {
      const g = ctx.githubProfile;
      lines.push(
        `GitHub: @${g.username}${g.bio ? `, bio: "${g.bio}"` : ''}, ${g.publicRepos} public repos, ${g.followers} followers`
      );
    }
    if (ctx.linkedInData) {
      const li = ctx.linkedInData;
      const parts = [
        li.currentRole && `Role: ${li.currentRole}`,
        li.company && `at ${li.company}`,
        li.yearsExperience > 0 && `${li.yearsExperience}+ years experience`,
        li.skills.length > 0 && `Skills: ${li.skills.slice(0, 6).join(', ')}`,
        li.summary && `Summary: "${li.summary.slice(0, 200)}"`,
      ].filter(Boolean);
      if (parts.length > 0) lines.push(`LinkedIn: ${parts.join(' | ')}`);
    }
    if (ctx.twitterData) {
      const tw = ctx.twitterData;
      lines.push(
        `X/Twitter: @${tw.handle}, ${tw.followerCount.toLocaleString()} followers${tw.bio ? `, bio: "${tw.bio}"` : ''}`
      );
    }
    if (ctx.hackathonEntries.length > 0) {
      const hacks = ctx.hackathonEntries
        .map((h) => `${h.name} ${h.year}${h.placement ? ` (${h.placement})` : ''}`)
        .join(', ');
      lines.push(`Hackathons: ${hacks}`);
    }
    if (ctx.resumeData) {
      const r = ctx.resumeData;
      const parts = [
        r.currentRole && `Role: ${r.currentRole}`,
        r.yearsExperience > 0 && `${r.yearsExperience}+ years experience`,
        r.parsedTechStack.length > 0 && `Stack: ${r.parsedTechStack.slice(0, 6).join(', ')}`,
        r.summary && `Summary: "${r.summary.slice(0, 200)}"`,
      ].filter(Boolean);
      if (parts.length > 0) lines.push(`Resume: ${parts.join(' | ')}`);
    }
    if (skills.length > 0) lines.push(`Inferred skills from repos: ${skills.join(', ')}`);
    if (domains.length > 0) lines.push(`Primary domains: ${domains.join(', ')}`);

    if (lines.length === 0) throw new Error('No context available');

    const prompt = `Write a 3-4 sentence professional summary for this software developer in third person. Be specific about their technical identity, what they build, and standout qualities. Use only the information provided.

${lines.join('\n')}

Return ONLY the summary paragraph. No labels, no markdown, no intro.`;

    const model = this.genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.45, maxOutputTokens: 350 },
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Summary call timed out after 30s')), 30_000)
      ),
    ]);

    const text = result.response.text().trim();
    if (!text || text.length < 30) throw new Error('Summary response too short');
    return text;
  }

  private async callGeminiWithRetry(prompt: string, maxRetries = 3): Promise<any> {
    const model = this.genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new AppError('Gemini API timeout after 60s', 504, 'AI_TIMEOUT')),
              60_000
            )
          ),
        ]);
      } catch (err: any) {
        const is429 =
          err?.status === 429 || /429|RESOURCE_EXHAUSTED/i.test(err?.message ?? '');
        if (is429 && attempt < maxRetries) {
          // 4 s per slot at 15 RPM; use 5 s to be safe, then double each retry
          const waitMs = Math.pow(2, attempt) * 5_000;
          logger.warn({ attempt, waitMs }, 'Gemini rate limited — backing off');
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }
  }
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function defaultAnalysis(repositoryId: string, hasDeployment: boolean): AnalysisResult {
  return {
    repositoryId,
    architectureComplexity: 3,
    codeQualitySignals: 3,
    executionMaturity: hasDeployment ? 5 : 2,
    originalityScore: 3,
    inferredSkills: [],
    probableDomains: [],
    builderSummary: '',
    keyPatterns: [],
    deploymentDetected: hasDeployment,
    testCoverageSignals: 'none',
  };
}

/**
 * Template-based summary built entirely from structured data — no AI required.
 * Used as fallback when Gemini is unavailable.
 */
function buildTemplateSummary(
  ctx: {
    githubProfile: { username: string; publicRepos: number; followers: number } | null;
    linkedInData: {
      currentRole: string | null; company: string | null; yearsExperience: number;
    } | null;
    resumeData: { currentRole: string | null; yearsExperience: number; parsedTechStack: string[] } | null;
    hackathonEntries: { name: string }[];
  },
  skills: string[],
  domains: string[]
): string {
  const name = ctx.githubProfile?.username ?? 'This developer';
  const role =
    ctx.linkedInData?.currentRole ?? ctx.resumeData?.currentRole ?? 'software developer';
  const company = ctx.linkedInData?.company;
  const years =
    (ctx.linkedInData?.yearsExperience ?? 0) > 0
      ? ctx.linkedInData!.yearsExperience
      : (ctx.resumeData?.yearsExperience ?? 0) > 0
      ? ctx.resumeData!.yearsExperience
      : 0;

  let s = `${name} is a ${role}`;
  if (years > 0) s += ` with ${years}+ years of experience`;
  if (company) s += ` at ${company}`;
  s += '.';

  if (skills.length > 0) {
    s += ` Their repositories demonstrate expertise in ${skills.slice(0, 5).join(', ')}.`;
  }

  if (domains.length > 0) {
    s += ` They primarily build in the ${domains.join(' and ')} space.`;
  }

  if (ctx.hackathonEntries.length > 0) {
    s += ` They have competed in ${ctx.hackathonEntries.length} hackathon${ctx.hackathonEntries.length > 1 ? 's' : ''}, including ${ctx.hackathonEntries[0].name}.`;
  }

  if (ctx.githubProfile && ctx.githubProfile.followers > 50) {
    s += ` Their GitHub profile has ${ctx.githubProfile.followers.toLocaleString()} followers across ${ctx.githubProfile.publicRepos} public repositories.`;
  }

  return s;
}
