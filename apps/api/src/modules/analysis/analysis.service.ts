import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import type { AnalysisResult } from './analysis.schema.js';

// ============================================================
// Analysis Service — AI-powered repository analysis
// Uses Google Gemini to infer skills, architecture quality,
// and generate builder summaries from repository metadata.
// ============================================================

export class AnalysisService {
  private readonly genai: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaClient) {
    this.genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  /**
   * Analyze a single repository with AI.
   * Updates analysisStatus: PENDING → ANALYZING → COMPLETED/FAILED
   */
  async analyzeRepository(repositoryId: string): Promise<AnalysisResult> {
    const repo = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        languages: true,
        commits: { orderBy: { committedAt: 'desc' }, take: 20 },
        contributors: { orderBy: { contributions: 'desc' }, take: 10 },
      },
    });

    if (!repo) throw new NotFoundError('Repository', repositoryId);

    // Mark as ANALYZING
    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { analysisStatus: 'ANALYZING' },
    });

    try {
      const result = await this.runAIAnalysis(repo);

      // Persist analysis result + mark COMPLETED atomically so status never
      // diverges from the stored analysis data (partial writes caused re-analysis).
      await this.prisma.$transaction([
        this.prisma.repositoryAnalysis.upsert({
          where: { repositoryId },
          create: {
            repositoryId,
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
        }),
        this.prisma.repository.update({
          where: { id: repositoryId },
          data: { analysisStatus: 'COMPLETED' },
        }),
      ]);

      logger.info({ repositoryId, repo: repo.fullName }, 'Repository analysis completed');
      return result;
    } catch (err) {
      try {
        await this.prisma.repository.update({
          where: { id: repositoryId },
          data: { analysisStatus: 'FAILED' },
        });
      } catch { /* ignore DB error so we still rethrow the original */ }
      logger.error({ repositoryId, err }, 'Repository analysis failed');
      throw err;
    }
  }

  /**
   * Analyze all PENDING repositories for a builder.
   * Returns array of results (failures logged but not thrown).
   */
  async analyzeBuilderRepositories(
    builderId: string,
    onProgress?: (progress: number, current: number, total: number) => Promise<void>
  ): Promise<{ analyzed: number; failed: number }> {
    // Reset any repos stuck in ANALYZING from a prior crashed run
    await this.prisma.repository.updateMany({
      where: { builderId, analysisStatus: 'ANALYZING' },
      data: { analysisStatus: 'FAILED' },
    });

    const repos = await this.prisma.repository.findMany({
      where: {
        builderId,
        analysisStatus: { in: ['PENDING', 'FAILED'] },
      },
      select: { id: true, fullName: true },
    });

    let analyzed = 0;
    let failed = 0;
    const total = repos.length;

    for (const repo of repos) {
      try {
        await this.analyzeRepository(repo.id);
        analyzed++;
      } catch (err) {
        failed++;
        logger.error({ repoId: repo.id, repo: repo.fullName, err }, 'Failed to analyze repo');
      }

      // Report per-repo progress (5% → 95%)
      if (onProgress && total > 0) {
        const pct = Math.round(5 + ((analyzed + failed) / total) * 90);
        try {
          await onProgress(pct, analyzed + failed, total);
        } catch (progressErr) {
          // Non-fatal: progress update failure must not abort the analysis loop
          logger.warn({ err: progressErr }, 'Failed to update analysis progress');
        }
      }

      if (analyzed + failed < total) {
        await this.sleep(1000);
      }
    }

    return { analyzed, failed };
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

  private async runAIAnalysis(repo: {
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
    commits: { message: string; additions: number; deletions: number }[];
    contributors: { githubLogin: string; contributions: number; isOwner: boolean }[];
  }): Promise<AnalysisResult> {
    const languageList = repo.languages
      .map((l) => `${l.language} (${l.percentage.toFixed(1)}%)`)
      .join(', ');

    const recentCommitMessages = repo.commits
      .slice(0, 10)
      .map((c) => `- ${c.message.split('\n')[0].slice(0, 80)}`)
      .join('\n');

    const contributorCount = repo.contributors.length;

    const prompt = `Analyze this GitHub repository and return a JSON analysis.

Repository: ${repo.fullName}
Description: ${repo.description || 'No description'}
Primary Language: ${repo.primaryLanguage || 'Unknown'}
All Languages: ${languageList || 'Unknown'}
Topics: ${repo.topics.join(', ') || 'None'}
Stars: ${repo.stars} | Forks: ${repo.forks}
Commits: ${repo.commitCount} | Contributors: ${contributorCount}
Has Deployment: ${repo.hasDeployment}
License: ${repo.licenseName || 'None'}
Size (KB): ${repo.size}

Recent commit messages:
${recentCommitMessages || 'No commits available'}

Return ONLY valid JSON (no markdown, no code fences, no extra text) with this exact structure:
{
  "architectureComplexity": <1-10 integer>,
  "codeQualitySignals": <1-10 integer>,
  "executionMaturity": <1-10 integer>,
  "originalityScore": <1-10 integer>,
  "inferredSkills": [<array of skill strings, max 8>],
  "probableDomains": [<array of domain strings, max 4, e.g. "Web Development", "DeFi", "Infrastructure">],
  "builderSummary": "<2 sentence summary of what this builder built and their likely expertise>",
  "keyPatterns": [<array of engineering pattern strings, max 4, e.g. "REST API", "Event-driven", "Monorepo">],
  "deploymentDetected": <boolean>,
  "testCoverageSignals": "<one of: none, minimal, moderate, comprehensive>"
}

Scoring guide:
- architectureComplexity: 1=simple script, 5=standard app, 10=distributed system
- codeQualitySignals: 1=no structure, 5=decent patterns, 10=excellent practices
- executionMaturity: 1=prototype, 5=functional project, 10=production-deployed
- originalityScore: 1=tutorial copy, 5=standard project, 10=novel/unique approach`;

    const model = this.genai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    });

    const GEMINI_TIMEOUT_MS = 30_000;
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new AppError('Gemini API timeout after 30s', 504, 'AI_TIMEOUT')),
          GEMINI_TIMEOUT_MS
        )
      ),
    ]);
    const raw = result.response.text();

    if (!raw) throw new AppError('Empty Gemini response', 502, 'AI_EMPTY_RESPONSE');

    // Strip markdown code fences if Gemini wraps the JSON anyway
    const content = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();

    try {
      const parsed = JSON.parse(content);
      return {
        repositoryId: '',
        architectureComplexity: Math.min(10, Math.max(1, Math.round(parsed.architectureComplexity))),
        codeQualitySignals: Math.min(10, Math.max(1, Math.round(parsed.codeQualitySignals))),
        executionMaturity: Math.min(10, Math.max(1, Math.round(parsed.executionMaturity))),
        originalityScore: Math.min(10, Math.max(1, Math.round(parsed.originalityScore))),
        inferredSkills: Array.isArray(parsed.inferredSkills) ? parsed.inferredSkills.slice(0, 8) : [],
        probableDomains: Array.isArray(parsed.probableDomains) ? parsed.probableDomains.slice(0, 4) : [],
        builderSummary: String(parsed.builderSummary || ''),
        keyPatterns: Array.isArray(parsed.keyPatterns) ? parsed.keyPatterns.slice(0, 4) : [],
        deploymentDetected: Boolean(parsed.deploymentDetected ?? repo.hasDeployment),
        testCoverageSignals: ['none', 'minimal', 'moderate', 'comprehensive'].includes(parsed.testCoverageSignals)
          ? parsed.testCoverageSignals
          : 'none',
      };
    } catch {
      throw new AppError('Failed to parse Gemini analysis response', 502, 'AI_PARSE_ERROR');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
