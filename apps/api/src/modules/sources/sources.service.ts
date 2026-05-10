import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PrismaClient } from '@prisma/client';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, AppError, ForbiddenError } from '../../lib/errors.js';
import type { LinkedInInput, TwitterInput, HackathonInput } from './sources.schema.js';

// ============================================================
// Sources Service — Manages all external reputation sources:
// LinkedIn (manual), Twitter/X (handle fetch), Hackathons
// (manual CRUD), Resume (PDF upload → Gemini parse).
// Each source feeds bonus signals into scoring.service.ts.
// ============================================================

export class SourcesService {
  private readonly genai: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaClient) {
    this.genai = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------

  async getSummary(builderId: string) {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      include: {
        githubProfile: { select: { username: true, lastSyncedAt: true } },
        linkedInData: { select: { currentRole: true, company: true, yearsExperience: true } },
        twitterData: { select: { handle: true, followerCount: true, fetchedAt: true } },
        hackathonEntries: { select: { id: true } },
        resumeData: { select: { currentRole: true, parsedAt: true, parsedSkills: true } },
      },
    });

    if (!builder) throw new NotFoundError('Builder', builderId);

    return {
      github: builder.githubProfile
        ? { connected: true, username: builder.githubProfile.username, lastSyncedAt: builder.githubProfile.lastSyncedAt }
        : { connected: false },
      linkedin: builder.linkedInData
        ? { connected: true, currentRole: builder.linkedInData.currentRole, company: builder.linkedInData.company, yearsExperience: builder.linkedInData.yearsExperience }
        : { connected: false },
      twitter: builder.twitterData
        ? { connected: true, handle: builder.twitterData.handle, followerCount: builder.twitterData.followerCount, fetchedAt: builder.twitterData.fetchedAt }
        : { connected: false },
      hackathons: { connected: builder.hackathonEntries.length > 0, count: builder.hackathonEntries.length },
      resume: builder.resumeData
        ? { connected: true, currentRole: builder.resumeData.currentRole, skillCount: builder.resumeData.parsedSkills.length, parsedAt: builder.resumeData.parsedAt }
        : { connected: false },
    };
  }

  // -------------------------------------------------------
  // LinkedIn
  // -------------------------------------------------------

  async upsertLinkedIn(builderId: string, data: LinkedInInput) {
    const result = await this.prisma.linkedInData.upsert({
      where: { builderId },
      create: { builderId, ...data },
      update: { ...data },
    });
    logger.info({ builderId }, 'LinkedIn data saved');
    return result;
  }

  async getLinkedIn(builderId: string) {
    return this.prisma.linkedInData.findUnique({ where: { builderId } });
  }

  async deleteLinkedIn(builderId: string) {
    await this.prisma.linkedInData.deleteMany({ where: { builderId } });
  }

  // -------------------------------------------------------
  // Twitter / X
  // -------------------------------------------------------

  async upsertTwitter(builderId: string, input: TwitterInput) {
    const fetched = await this.fetchTwitterProfile(input.handle);

    const result = await this.prisma.twitterData.upsert({
      where: { builderId },
      create: { builderId, ...fetched },
      update: { ...fetched, updatedAt: new Date() },
    });

    logger.info({ builderId, handle: input.handle, followerCount: fetched.followerCount }, 'Twitter data saved');
    return result;
  }

  async getTwitter(builderId: string) {
    return this.prisma.twitterData.findUnique({ where: { builderId } });
  }

  async deleteTwitter(builderId: string) {
    await this.prisma.twitterData.deleteMany({ where: { builderId } });
  }

  private async fetchTwitterProfile(handle: string): Promise<{
    handle: string;
    followerCount: number;
    followingCount: number;
    tweetCount: number;
    accountAgeYears: number;
    bio: string | null;
    fetchedAt: Date;
  }> {
    if (!env.TWITTER_BEARER_TOKEN) {
      logger.warn({ handle }, 'No TWITTER_BEARER_TOKEN — storing handle with zero metrics');
      return { handle, followerCount: 0, followingCount: 0, tweetCount: 0, accountAgeYears: 0, bio: null, fetchedAt: new Date() };
    }

    try {
      const url = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=public_metrics,created_at,description`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        logger.warn({ handle, status: res.status }, 'Twitter API returned non-OK status — using zero metrics');
        return { handle, followerCount: 0, followingCount: 0, tweetCount: 0, accountAgeYears: 0, bio: null, fetchedAt: new Date() };
      }

      const json: any = await res.json();
      const user = json?.data;
      if (!user) {
        return { handle, followerCount: 0, followingCount: 0, tweetCount: 0, accountAgeYears: 0, bio: null, fetchedAt: new Date() };
      }

      const createdAt = user.created_at ? new Date(user.created_at) : null;
      const accountAgeYears = createdAt
        ? (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
        : 0;

      return {
        handle,
        followerCount: user.public_metrics?.followers_count ?? 0,
        followingCount: user.public_metrics?.following_count ?? 0,
        tweetCount: user.public_metrics?.tweet_count ?? 0,
        accountAgeYears: Math.round(accountAgeYears * 10) / 10,
        bio: user.description ?? null,
        fetchedAt: new Date(),
      };
    } catch (err) {
      logger.warn({ handle, err }, 'Twitter fetch failed — storing handle with zero metrics');
      return { handle, followerCount: 0, followingCount: 0, tweetCount: 0, accountAgeYears: 0, bio: null, fetchedAt: new Date() };
    }
  }

  // -------------------------------------------------------
  // Hackathons
  // -------------------------------------------------------

  async addHackathon(builderId: string, data: HackathonInput) {
    return this.prisma.hackathonEntry.create({
      data: { builderId, ...data, projectUrl: data.projectUrl || null },
    });
  }

  async getHackathons(builderId: string) {
    return this.prisma.hackathonEntry.findMany({
      where: { builderId },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateHackathon(builderId: string, entryId: string, data: Partial<HackathonInput>) {
    const entry = await this.prisma.hackathonEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError('HackathonEntry', entryId);
    if (entry.builderId !== builderId) throw new ForbiddenError();

    return this.prisma.hackathonEntry.update({
      where: { id: entryId },
      data: { ...data, projectUrl: data.projectUrl === '' ? null : data.projectUrl },
    });
  }

  async deleteHackathon(builderId: string, entryId: string) {
    const entry = await this.prisma.hackathonEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundError('HackathonEntry', entryId);
    if (entry.builderId !== builderId) throw new ForbiddenError();
    await this.prisma.hackathonEntry.delete({ where: { id: entryId } });
  }

  // -------------------------------------------------------
  // Resume
  // -------------------------------------------------------

  async parseAndSaveResume(builderId: string, pdfText: string, resumeUrl?: string): Promise<void> {
    const parsed = await this.parseResumeWithGemini(pdfText);

    await this.prisma.resumeData.upsert({
      where: { builderId },
      create: {
        builderId,
        resumeUrl: resumeUrl ?? null,
        parsedSkills: parsed.skills,
        parsedTechStack: parsed.techStack,
        yearsExperience: parsed.yearsExperience,
        educationLevel: parsed.educationLevel as any ?? null,
        currentRole: parsed.currentRole ?? null,
        summary: parsed.summary ?? null,
        rawText: pdfText.slice(0, 50_000), // cap stored raw text
        parsedAt: new Date(),
      },
      update: {
        resumeUrl: resumeUrl ?? undefined,
        parsedSkills: parsed.skills,
        parsedTechStack: parsed.techStack,
        yearsExperience: parsed.yearsExperience,
        educationLevel: parsed.educationLevel as any ?? null,
        currentRole: parsed.currentRole ?? null,
        summary: parsed.summary ?? null,
        rawText: pdfText.slice(0, 50_000),
        parsedAt: new Date(),
      },
    });

    logger.info({ builderId, skills: parsed.skills.length, years: parsed.yearsExperience }, 'Resume parsed and saved');
  }

  async getResume(builderId: string) {
    return this.prisma.resumeData.findUnique({ where: { builderId } });
  }

  async deleteResume(builderId: string) {
    await this.prisma.resumeData.deleteMany({ where: { builderId } });
  }

  private async parseResumeWithGemini(text: string): Promise<{
    skills: string[];
    techStack: string[];
    yearsExperience: number;
    educationLevel: string | null;
    currentRole: string | null;
    summary: string | null;
  }> {
    const prompt = `Extract structured professional data from this resume text. Return ONLY valid JSON, no markdown.

Resume text:
${text.slice(0, 8000)}

Return this exact JSON structure:
{
  "skills": [<array of specific skills, max 30, e.g. "TypeScript", "Smart Contracts", "System Design">],
  "techStack": [<array of technologies/tools only, max 20, e.g. "React", "Rust", "PostgreSQL">],
  "yearsExperience": <integer 0-50, total professional experience>,
  "educationLevel": <one of: "HIGH_SCHOOL", "ASSOCIATE", "BACHELOR", "MASTER", "PHD", "BOOTCAMP", "SELF_TAUGHT", "OTHER", or null>,
  "currentRole": <string or null, e.g. "Senior Software Engineer">,
  "summary": <1-2 sentence professional summary or null>
}`;

    try {
      const model = this.genai.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      });

      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new AppError('Gemini timeout', 504, 'AI_TIMEOUT')), 30_000)
        ),
      ]);

      const raw = result.response.text().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();
      const parsed = JSON.parse(raw);

      return {
        skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 30) : [],
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack.slice(0, 20) : [],
        yearsExperience: Math.min(50, Math.max(0, Math.round(parsed.yearsExperience ?? 0))),
        educationLevel: parsed.educationLevel ?? null,
        currentRole: parsed.currentRole ? String(parsed.currentRole) : null,
        summary: parsed.summary ? String(parsed.summary) : null,
      };
    } catch (err) {
      logger.error({ err }, 'Gemini resume parse failed — returning empty data');
      return { skills: [], techStack: [], yearsExperience: 0, educationLevel: null, currentRole: null, summary: null };
    }
  }
}
