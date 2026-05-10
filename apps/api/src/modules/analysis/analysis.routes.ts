import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnalysisService } from './analysis.service.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import type { JwtPayload } from '../../lib/types.js';

export default async function analysisRoutes(fastify: FastifyInstance) {
  const service = new AnalysisService(fastify.prisma);

  // GET /api/analysis/status/:repositoryId
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
}
