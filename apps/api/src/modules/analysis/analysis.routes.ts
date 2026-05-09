import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalysisService } from './analysis.service.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Analysis Routes — /api/analysis/*
// ============================================================

export default async function analysisRoutes(fastify: FastifyInstance) {
  const service = new AnalysisService(fastify.prisma);

  // -------------------------------------------------------
  // POST /api/analysis/trigger/:repositoryId
  // -------------------------------------------------------
  fastify.post<{ Params: { repositoryId: string } }>(
    '/trigger/:repositoryId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      // Verify this repo belongs to the authenticated builder
      const repo = await fastify.prisma.repository.findUnique({
        where: { id: request.params.repositoryId },
        select: { builderId: true, analysisStatus: true },
      });

      if (!repo) throw new NotFoundError('Repository', request.params.repositoryId);
      if (repo.builderId !== user.sub) throw new ForbiddenError();

      // Fire async — don't await
      service.analyzeRepository(request.params.repositoryId).catch((err) => {
        fastify.log.error({ err, repositoryId: request.params.repositoryId }, 'Async analysis failed');
      });

      return reply.status(202).send({
        success: true,
        data: { message: 'Analysis started', repositoryId: request.params.repositoryId },
      });
    }
  );

  // -------------------------------------------------------
  // GET /api/analysis/status/:repositoryId
  // -------------------------------------------------------
  fastify.get<{ Params: { repositoryId: string } }>(
    '/status/:repositoryId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;

      const repo = await fastify.prisma.repository.findUnique({
        where: { id: request.params.repositoryId },
        select: { builderId: true },
      });

      if (!repo) throw new NotFoundError('Repository', request.params.repositoryId);
      if (repo.builderId !== user.sub) throw new ForbiddenError();

      const result = await service.getAnalysis(request.params.repositoryId);
      return reply.status(200).send({ success: true, data: result });
    }
  );

  // -------------------------------------------------------
  // POST /api/analysis/trigger-all — Analyze all pending repos
  // -------------------------------------------------------
  fastify.post(
    '/trigger-all',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;

      // Fire async
      service.analyzeBuilderRepositories(user.sub).catch((err) => {
        fastify.log.error({ err, builderId: user.sub }, 'Bulk analysis failed');
      });

      return reply.status(202).send({
        success: true,
        data: { message: 'Bulk analysis started for all pending repositories' },
      });
    }
  );
}
