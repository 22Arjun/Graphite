import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

interface GitHubPublicData {
  login: string;
  name: string | null;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  topRepos: { name: string; language: string | null; stars: number; description: string | null }[];
  topLanguages: string[];
}

export interface FormAnalysisResult {
  overallScore: number;
  dimensions: {
    technicalDepth: { score: number; reasoning: string };
    executionAbility: { score: number; reasoning: string };
    consistency: { score: number; reasoning: string };
    collaborationQuality: { score: number; reasoning: string };
    innovation: { score: number; reasoning: string };
  };
  skills: string[];
  techStack: string[];
  summary: string;
  strengths: string[];
  growthAreas: string[];
  experienceLevel: 'Junior' | 'Mid' | 'Senior' | 'Staff' | 'Principal';
  githubInsights: Record<string, unknown> | null;
}

export class FormAnalysisService {
  private readonly genai: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaClient) {
    this.genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  async analyzeSubmission(submissionId: string): Promise<void> {
    try {
      await this.prisma.formSubmission.update({
        where: { id: submissionId },
        data: { analysisStatus: 'ANALYZING' },
      });

      const submission = await this.prisma.formSubmission.findUnique({
        where: { id: submissionId },
      });

      if (!submission) {
        logger.warn({ submissionId }, 'Submission not found for analysis');
        return;
      }

      const github = submission.githubUsername
        ? await this.fetchGitHubData(submission.githubUsername)
        : null;

      const prompt = this.buildPrompt(submission, github);
      const result = await this.callGemini(prompt);

      await this.prisma.formSubmission.update({
        where: { id: submissionId },
        data: {
          analysisStatus: 'COMPLETED',
          analysisResult: result as any,
        },
      });

      logger.info({ submissionId, overallScore: result.overallScore }, 'Form submission analyzed');
    } catch (err) {
      logger.error({ err, submissionId }, 'Form submission analysis failed');
      await this.prisma.formSubmission.update({
        where: { id: submissionId },
        data: { analysisStatus: 'FAILED' },
      }).catch(() => {});
    }
  }

  private async fetchGitHubData(username: string): Promise<GitHubPublicData | null> {
    try {
      const headers = { 'User-Agent': 'Graphite-API/1.0', Accept: 'application/vnd.github+json' };
      const signal = AbortSignal.timeout(10_000);

      const [profileRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, signal }),
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=stars&per_page=8`, { headers, signal }),
      ]);

      if (!profileRes.ok) {
        logger.warn({ username, status: profileRes.status }, 'GitHub user fetch failed');
        return null;
      }

      const profile: any = await profileRes.json();
      const repos: any[] = reposRes.ok ? await reposRes.json() : [];

      const topRepos = repos.map((r) => ({
        name: r.name,
        language: r.language ?? null,
        stars: r.stargazers_count ?? 0,
        description: r.description ?? null,
      }));

      const langCounts: Record<string, number> = {};
      for (const r of repos) {
        if (r.language) langCounts[r.language] = (langCounts[r.language] ?? 0) + 1;
      }
      const topLanguages = Object.entries(langCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([l]) => l);

      return {
        login: profile.login,
        name: profile.name ?? null,
        bio: profile.bio ?? null,
        publicRepos: profile.public_repos ?? 0,
        followers: profile.followers ?? 0,
        following: profile.following ?? 0,
        topRepos,
        topLanguages,
      };
    } catch (err) {
      logger.warn({ username, err }, 'GitHub public data fetch failed — skipping');
      return null;
    }
  }

  private buildPrompt(submission: any, github: GitHubPublicData | null): string {
    const sections: string[] = [];

    sections.push(`You are an expert technical talent analyst. Analyze the following profile and return a comprehensive reputation assessment as ONLY valid JSON — no markdown, no explanation.`);

    sections.push(`## Submitted Profile

Name: ${submission.fullName ?? 'Not provided'}
Email: ${submission.email ?? 'Not provided'}
LinkedIn: ${submission.linkedInUrl ?? 'Not provided'}
Twitter/X: ${submission.twitterHandle ? `@${submission.twitterHandle}` : 'Not provided'}
GitHub: ${submission.githubUsername ?? 'Not provided'}`);

    if (github) {
      const repoList = github.topRepos
        .map((r) => `  - ${r.name} (${r.language ?? 'unknown'}, ${r.stars}⭐): ${r.description ?? 'no description'}`)
        .join('\n');

      sections.push(`## GitHub Public Data
Username: @${github.login}
Name: ${github.name ?? 'N/A'}
Bio: ${github.bio ?? 'N/A'}
Public Repositories: ${github.publicRepos}
Followers: ${github.followers}
Top Languages: ${github.topLanguages.join(', ') || 'None detected'}
Top Repositories:
${repoList || '  None'}`);
    }

    const projectLinks: any[] = JSON.parse(JSON.stringify(submission.projectLinks ?? []));
    if (projectLinks.length > 0) {
      sections.push(`## Live Projects
${projectLinks.map((p: any) => `  - ${p.title ?? p.url}: ${p.url}`).join('\n')}`);
    }

    const hackathons: any[] = JSON.parse(JSON.stringify(submission.hackathons ?? []));
    if (hackathons.length > 0) {
      sections.push(`## Hackathon History
${hackathons.map((h: any) => `  - ${h.name} (${h.year})${h.placement ? ` — ${h.placement}` : ''}${h.prize ? `, Prize: ${h.prize}` : ''}`).join('\n')}`);
    }

    const extraLinks: any[] = JSON.parse(JSON.stringify(submission.extraLinks ?? []));
    if (extraLinks.length > 0) {
      sections.push(`## Additional Links
${extraLinks.map((l: any) => `  - ${l.label ?? 'Link'}: ${l.url}`).join('\n')}`);
    }

    if (submission.resumeText && submission.resumeText.length > 50) {
      sections.push(`## Resume / CV (extracted text — first 5000 chars)
${submission.resumeText.slice(0, 5000)}`);
    }

    sections.push(`## Required JSON Output

Return ONLY this exact JSON structure, no markdown fences:
{
  "overallScore": <integer 0-100, overall reputation score>,
  "dimensions": {
    "technicalDepth": {
      "score": <integer 0-100>,
      "reasoning": <1-2 sentence explanation>
    },
    "executionAbility": {
      "score": <integer 0-100>,
      "reasoning": <1-2 sentence explanation>
    },
    "consistency": {
      "score": <integer 0-100>,
      "reasoning": <1-2 sentence explanation>
    },
    "collaborationQuality": {
      "score": <integer 0-100>,
      "reasoning": <1-2 sentence explanation>
    },
    "innovation": {
      "score": <integer 0-100>,
      "reasoning": <1-2 sentence explanation>
    }
  },
  "skills": [<array of up to 20 specific skills inferred from the profile>],
  "techStack": [<array of up to 12 technologies/tools only>],
  "summary": <2-3 sentence professional summary>,
  "strengths": [<array of 3-5 key strengths>],
  "growthAreas": [<array of 2-3 areas for improvement>],
  "experienceLevel": <one of: "Junior", "Mid", "Senior", "Staff", "Principal">,
  "githubInsights": ${github ? `{
    "topLanguage": "${github.topLanguages[0] ?? 'Unknown'}",
    "publicRepos": ${github.publicRepos},
    "followers": ${github.followers},
    "projectCount": ${github.topRepos.length}
  }` : 'null'}
}

Score guidelines: 0-30 = beginner, 31-50 = developing, 51-70 = solid, 71-85 = strong, 86-100 = exceptional.
Base scores on actual evidence from the profile. If data is sparse, scores should reflect that uncertainty.`);

    return sections.join('\n\n');
  }

  private async callGemini(prompt: string): Promise<FormAnalysisResult> {
    const model = this.genai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.15, maxOutputTokens: 1200 },
    });

    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new AppError('Gemini timeout', 504, 'AI_TIMEOUT')), 45_000)
          ),
        ]);

        const raw = result.response
          .text()
          .replace(/^```(?:json)?\n?/i, '')
          .replace(/\n?```$/m, '')
          .trim();

        const parsed = JSON.parse(raw);
        return this.normalizeResult(parsed);
      } catch (err: any) {
        const is429 = err?.status === 429 || /429|RESOURCE_EXHAUSTED/i.test(err?.message ?? '');
        if (is429 && attempt < 3) {
          const waitMs = Math.pow(2, attempt + 1) * 4000;
          logger.warn({ attempt, waitMs }, 'Gemini 429 — retrying form analysis');
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw new AppError('Gemini call exhausted retries', 502, 'AI_FAILED');
  }

  private normalizeResult(parsed: any): FormAnalysisResult {
    const clamp = (n: unknown) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
    const dimKeys = ['technicalDepth', 'executionAbility', 'consistency', 'collaborationQuality', 'innovation'] as const;
    const dimensions = {} as FormAnalysisResult['dimensions'];

    for (const key of dimKeys) {
      dimensions[key] = {
        score: clamp(parsed.dimensions?.[key]?.score),
        reasoning: String(parsed.dimensions?.[key]?.reasoning ?? ''),
      };
    }

    return {
      overallScore: clamp(parsed.overallScore),
      dimensions,
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 20).map(String) : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack.slice(0, 12).map(String) : [],
      summary: String(parsed.summary ?? ''),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5).map(String) : [],
      growthAreas: Array.isArray(parsed.growthAreas) ? parsed.growthAreas.slice(0, 3).map(String) : [],
      experienceLevel: ['Junior', 'Mid', 'Senior', 'Staff', 'Principal'].includes(parsed.experienceLevel)
        ? parsed.experienceLevel
        : 'Mid',
      githubInsights: parsed.githubInsights ?? null,
    };
  }
}
