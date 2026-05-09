import type { PrismaClient, Prisma } from '@prisma/client';
import type { JobType, JobStatus } from '@prisma/client';
import { logger } from '../../lib/logger.js';

// ============================================================
// Job Queue — Database-backed async job management
//
// Queue-ready design: currently uses Prisma polling,
// designed to be swapped for BullMQ/Redis with zero
// interface changes when scaling is needed.
// ============================================================

export interface CreateJobInput {
  builderId: string;
  jobType: JobType;
  payload?: Record<string, unknown>;
}

export interface JobRecord {
  id: string;
  builderId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  payload: unknown;
  result: unknown;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export class JobQueue {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new job in QUEUED state.
   */
  async createJob(input: CreateJobInput): Promise<JobRecord> {
    const job = await this.prisma.ingestionJob.create({
      data: {
        builderId: input.builderId,
        jobType: input.jobType,
        status: 'QUEUED',
        progress: 0,
        payload: input.payload ? (input.payload as Prisma.InputJsonValue) : undefined,
      },
    });

    logger.info({ jobId: job.id, type: input.jobType }, 'Job created');
    return job as JobRecord;
  }

  /**
   * Transition job to PROCESSING state.
   */
  async startJob(jobId: string): Promise<void> {
    await this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Update job progress (0-100).
   */
  async updateProgress(jobId: string, progress: number, result?: Record<string, unknown>): Promise<void> {
    await this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        progress: Math.min(100, Math.max(0, progress)),
        ...(result ? { result: result as Prisma.InputJsonValue } : {}),
      },
    });
  }

  /**
   * Mark job as completed.
   */
  async completeJob(jobId: string, result?: Record<string, unknown>): Promise<void> {
    await this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        result: result ? (result as Prisma.InputJsonValue) : undefined,
      },
    });

    logger.info({ jobId }, 'Job completed');
  }

  /**
   * Mark job as failed.
   */
  async failJob(jobId: string, error: string): Promise<void> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
      select: { attempts: true, maxAttempts: true },
    });

    const shouldRetry = job && job.attempts < job.maxAttempts;

    await this.prisma.ingestionJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? 'QUEUED' : 'FAILED',
        error,
        completedAt: shouldRetry ? null : new Date(),
      },
    });

    if (shouldRetry) {
      logger.warn({ jobId, attempts: job!.attempts }, 'Job failed, will retry');
    } else {
      logger.error({ jobId, error }, 'Job failed permanently');
    }
  }

  /**
   * Get job status.
   */
  async getJob(jobId: string): Promise<JobRecord | null> {
    const job = await this.prisma.ingestionJob.findUnique({
      where: { id: jobId },
    });
    return job as JobRecord | null;
  }

  /**
   * Get active/recent jobs for a builder.
   * Also expires any stale PROCESSING jobs so the frontend always sees accurate state.
   */
  async getBuilderJobs(builderId: string, limit: number = 10): Promise<JobRecord[]> {
    await this.expireStaleJobs(builderId);

    const jobs = await this.prisma.ingestionJob.findMany({
      where: { builderId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return jobs as JobRecord[];
  }

  /**
   * Force-fail all stuck PROCESSING jobs for a builder immediately.
   * Used by the reset endpoint so the user can retry without waiting.
   */
  async resetStuckJobs(builderId: string): Promise<number> {
    const result = await this.prisma.ingestionJob.updateMany({
      where: {
        builderId,
        status: { in: ['PROCESSING', 'QUEUED'] },
      },
      data: {
        status: 'FAILED',
        error: 'Manually reset by user',
        completedAt: new Date(),
      },
    });
    logger.info({ builderId, count: result.count }, 'Stuck jobs reset');
    return result.count;
  }

  /**
   * Check if a builder has an active ingestion job.
   */
  async hasActiveJob(builderId: string, jobType: JobType): Promise<boolean> {
    await this.expireStaleJobs(builderId);

    const count = await this.prisma.ingestionJob.count({
      where: {
        builderId,
        jobType,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });
    return count > 0;
  }

  /**
   * Expire any PROCESSING jobs that have been running for >15 minutes.
   */
  private async expireStaleJobs(builderId: string): Promise<void> {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);
    await this.prisma.ingestionJob.updateMany({
      where: {
        builderId,
        status: 'PROCESSING',
        startedAt: { lt: staleThreshold },
      },
      data: {
        status: 'FAILED',
        error: 'Job timed out — took longer than 15 minutes',
        completedAt: new Date(),
      },
    });
  }
}
