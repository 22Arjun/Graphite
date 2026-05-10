import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import type { AnalysisResult } from './analysis.schema.js';

// ============================================================
// Analysis Service — AI-powered repository analysis
// Uses a single batched Gemini call for all repos to avoid
// per-repo rate-limit delays.
// ============================================================

export class AnalysisService {
  private readonly genai: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaClient) {
    this.genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  /**
   * Analyze a batch of repositories in a single Gemini call.
   * Much faster than one-call-per-repo because there are no rate-limit gaps.
   */
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

    // Mark all as ANALYZING
    await this.prisma.repository.updateMany({
      where: { id: { in: repos.map((r) => r.id) } },
      data: { analysisStatus: 'ANALYZING' },
    });

    try {
      const results = await this.runBatchAIAnalysis(repos);

      // Persist all results in a single transaction
      await this.prisma.$transaction([
        ...results.map((result, i) =>
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
              builderSummary: result.builderSummary,
              keyPatterns: result.keyPatterns,
              deploymentDetected: result.deploymentDetected,
              testCoverageSignals: result.testCoverageSignals,
              modelVersion: 'gemini-1.5-flash',
            },
            update: {
              architectureComplexity: result.architectureComplexity,
              codeQualitySignals: result.codeQualitySignals,
              executionMaturity: result.executionMaturity,
              originalityScore: result.originalityScore,
              inferredSkills: result.inferredSkills,
              probableDomains: result.probableDomains,
              builderSummary: result.builderSummary,
              keyPatterns: result.keyPatterns,
              deploymentDetected: result.deploymentDetected,
              testCoverageSignals: result.testCoverageSignals,
              analyzedAt: new Date(),
              modelVersion: 'gemini-1.5-flash',
            },
          })
        ),
        this.prisma.repository.updateMany({
          where: { id: { in: repos.map((r) => r.id) } },
          data: { analysisStatus: 'COMPLETED' },
        }),
      ]);

      logger.info({ builderId, count: repos.length }, 'Batch repository analysis completed');
    } catch (err) {
      await this.prisma.repository.updateMany({
        where: { id: { in: repos.map((r) => r.id) } },
        data: { analysisStatus: 'FAILED' },
      });
      throw err;
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

    return {
      repositoryId,
      status: repo.analysisStatus,
      analysis: repo.analysis,
    };
  }

  // -------------------------------------------------------
  // AI Analysis
  // -------------------------------------------------------

  private async runBatchAIAnalysis(repos: {
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
  }[]): Promise<AnalysisResult[]> {
    const repoSummaries = repos.map((repo, i) => {
      const langs = repo.languages.map((l) => `${l.language} (${l.percentage.toFixed(1)}%)`).join(', ');
      const commits = repo.commits
        .slice(0, 5)
        .map((c) => `- ${c.message.split('\n')[0].slice(0, 60)}`)
        .join('\n');

      return `
--- Repository ${i + 1}: ${repo.fullName} ---
Description: ${repo.description || 'None'}
Language: ${repo.primaryLanguage || 'Unknown'} | All: ${langs || 'Unknown'}
Topics: ${repo.topics.join(', ') || 'None'}
Stars: ${repo.stars} | Forks: ${repo.forks} | Commits: ${repo.commitCount}
Contributors: ${repo.contributors.length} | Deployed: ${repo.hasDeployment} | Size: ${repo.size}KB
Recent commits:
${commits || 'None'}`;
    });

    const prompt = `Analyze these ${repos.length} GitHub repositories and return a JSON array with exactly ${repos.length} analysis objects (one per repository, in the same order).

${repoSummaries.join('\n')}

Return ONLY a valid JSON array (no markdown, no code fences) where each element has this exact structure:
{
  "architectureComplexity": <1-10>,
  "codeQualitySignals": <1-10>,
  "executionMaturity": <1-10>,
  "originalityScore": <1-10>,
  "inferredSkills": [<max 8 skill strings>],
  "probableDomains": [<max 4 domain strings>],
  "builderSummary": "<2 sentence summary>",
  "keyPatterns": [<max 4 pattern strings>],
  "deploymentDetected": <boolean>,
  "testCoverageSignals": "<none|minimal|moderate|comprehensive>"
}

Scoring: architectureComplexity (1=script, 10=distributed), codeQualitySignals (1=messy, 10=excellent), executionMaturity (1=prototype, 10=production), originalityScore (1=tutorial, 10=novel).`;

    const raw = await this.callGeminiWithRetry(prompt);
    const text = raw.response.text();
    if (!text) throw new AppError('Empty Gemini response', 502, 'AI_EMPTY_RESPONSE');

    const content = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();

    let parsed: any[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const result = JSON.parse(jsonStr);
      parsed = Array.isArray(result) ? result : [];
    } catch (err) {
      logger.warn({ err }, 'Batch Gemini parse failed — repos will be scored from metadata only');
      // Return empty — repos stay ANALYZING and scoring will use behavioral signals only
      return repos.map((repo) => defaultAnalysis(repo.id, repo.hasDeployment));
    }

    return repos.map((repo, i) => {
      const item = parsed[i];
      if (!item || typeof item !== 'object') return defaultAnalysis(repo.id, repo.hasDeployment);
      return {
        repositoryId: repo.id,
        architectureComplexity: clamp(Math.round(item.architectureComplexity), 1, 10),
        codeQualitySignals: clamp(Math.round(item.codeQualitySignals), 1, 10),
        executionMaturity: clamp(Math.round(item.executionMaturity), 1, 10),
        originalityScore: clamp(Math.round(item.originalityScore), 1, 10),
        inferredSkills: Array.isArray(item.inferredSkills) ? item.inferredSkills.slice(0, 8) : [],
        probableDomains: Array.isArray(item.probableDomains) ? item.probableDomains.slice(0, 4) : [],
        builderSummary: String(item.builderSummary || ''),
        keyPatterns: Array.isArray(item.keyPatterns) ? item.keyPatterns.slice(0, 4) : [],
        deploymentDetected: Boolean(item.deploymentDetected ?? repo.hasDeployment),
        testCoverageSignals: ['none', 'minimal', 'moderate', 'comprehensive'].includes(item.testCoverageSignals)
          ? item.testCoverageSignals
          : 'none',
      };
    });
  }

  private async callGeminiWithRetry(prompt: string, maxRetries = 3): Promise<any> {
    const model = this.genai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
    });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new AppError('Gemini API timeout after 45s', 504, 'AI_TIMEOUT')),
              45_000
            )
          ),
        ]);
      } catch (err: any) {
        const is429 = err?.status === 429 || /429|RESOURCE_EXHAUSTED/i.test(err?.message ?? '');
        if (is429 && attempt < maxRetries) {
          const waitMs = Math.pow(2, attempt + 1) * 4000;
          logger.warn({ attempt, waitMs }, 'Gemini rate limited — backing off');
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }
  }
}

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
