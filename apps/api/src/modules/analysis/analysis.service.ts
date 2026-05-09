import OpenAI from 'openai';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import type { AnalysisResult } from './analysis.schema.js';

// ============================================================
// Analysis Service — AI-powered repository analysis
// Uses OpenAI to infer skills, architecture quality, and
// generate builder summaries from repository metadata.
// ============================================================

export class AnalysisService {
  private readonly openai: OpenAI;

  constructor(private readonly prisma: PrismaClient) {
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
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

      // Persist analysis
      await this.prisma.repositoryAnalysis.upsert({
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
          modelVersion: 'gpt-4o-mini-v1',
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
          modelVersion: 'gpt-4o-mini-v1',
        },
      });

      // Mark COMPLETED
      await this.prisma.repository.update({
        where: { id: repositoryId },
        data: { analysisStatus: 'COMPLETED' },
      });

      logger.info({ repositoryId, repo: repo.fullName }, 'Repository analysis completed');
      return result;
    } catch (err) {
      await this.prisma.repository.update({
        where: { id: repositoryId },
        data: { analysisStatus: 'FAILED' },
      });
      logger.error({ repositoryId, err }, 'Repository analysis failed');
      throw err;
    }
  }

  /**
   * Analyze all PENDING repositories for a builder.
   * Returns array of results (failures logged but not thrown).
   */
  async analyzeBuilderRepositories(builderId: string): Promise<{ analyzed: number; failed: number }> {
    const repos = await this.prisma.repository.findMany({
      where: {
        builderId,
        analysisStatus: { in: ['PENDING', 'FAILED'] },
      },
      select: { id: true, fullName: true },
    });

    let analyzed = 0;
    let failed = 0;

    for (const repo of repos) {
      try {
        await this.analyzeRepository(repo.id);
        analyzed++;
        // Respect OpenAI rate limits
        await this.sleep(500);
      } catch (err) {
        failed++;
        logger.error({ repoId: repo.id, repo: repo.fullName, err }, 'Failed to analyze repo');
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

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:
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

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AppError('Empty AI response', 502, 'AI_EMPTY_RESPONSE');

    try {
      const parsed = JSON.parse(content.trim());
      return {
        repositoryId: '', // filled by caller
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
      throw new AppError('Failed to parse AI analysis response', 502, 'AI_PARSE_ERROR');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
