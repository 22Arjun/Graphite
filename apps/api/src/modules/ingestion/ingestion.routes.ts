import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IngestionService } from './ingestion.service.js';
import type { JwtPayload } from '../../lib/types.js';

export default async function ingestionRoutes(fastify: FastifyInstance) {
  const service = new IngestionService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /api/ingestion/trigger — kick off async sync, return immediately
  fastify.post('/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    // Fire and forget — frontend polls /api/scoring/dimensions for results
    service.triggerSync(user.sub).catch((err) => {
      fastify.log.error({ builderId: user.sub, err }, 'GitHub sync failed');
    });

    return reply.status(202).send({
      success: true,
      data: { message: 'GitHub sync started. Scores will appear at /api/scoring/dimensions shortly.' },
    });
  });
}
