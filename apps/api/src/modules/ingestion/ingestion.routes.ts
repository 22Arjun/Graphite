import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IngestionService } from './ingestion.service.js';
import { triggerIngestionSchema } from './ingestion.schema.js';
import { ValidationError } from '../../lib/errors.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Ingestion Routes — /api/ingestion/*
// All routes require authentication
// ============================================================

export default async function ingestionRoutes(fastify: FastifyInstance) {
  const ingestionService = new IngestionService(fastify.prisma);

  // Apply auth to all routes in this module
  fastify.addHook('preHandler', fastify.authenticate);

  // -------------------------------------------------------
  // POST /api/ingestion/trigger — Start GitHub ingestion
  // -------------------------------------------------------
  fastify.post('/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    const parsed = triggerIngestionSchema.safeParse(request.body || {});
    if (!parsed.success) {
      throw new ValidationError('Invalid request body');
    }

    const result = await ingestionService.triggerIngestion(user.sub, parsed.data.fullSync);

    return reply.status(202).send({
      success: true,
      data: {
        jobId: result.jobId,
        message: 'Ingestion pipeline started. Poll /api/ingestion/jobs/:jobId for status.',
      },
    });
  });

  // -------------------------------------------------------
  // GET /api/ingestion/jobs — List builder's ingestion jobs
  // -------------------------------------------------------
  fastify.get('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    const jobs = await ingestionService.getBuilderJobs(user.sub);

    return reply.status(200).send({
      success: true,
      data: jobs,
    });
  });

  // -------------------------------------------------------
  // GET /api/ingestion/jobs/:jobId — Get job status
  // -------------------------------------------------------
  fastify.get(
    '/jobs/:jobId',
    async (
      request: FastifyRequest<{ Params: { jobId: string } }>,
      reply: FastifyReply
    ) => {
      const { jobId } = request.params;
      const job = await ingestionService.getJobStatus(jobId);

      return reply.status(200).send({
        success: true,
        data: job,
      });
    }
  );
}
