import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IngestionService } from './ingestion.service.js';
import type { JwtPayload } from '../../lib/types.js';

export default async function ingestionRoutes(fastify: FastifyInstance) {
  const service = new IngestionService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /api/ingestion/trigger — run full sync synchronously (required for serverless)
  fastify.post('/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    try {
      await service.triggerSync(user.sub);
    } catch (err) {
      fastify.log.error({ builderId: user.sub, err }, 'GitHub sync failed');
      return reply.status(500).send({ success: false, error: { code: 'SYNC_FAILED', message: 'GitHub sync failed' } });
    }

    return reply.status(200).send({
      success: true,
      data: { message: 'GitHub sync complete.' },
    });
  });
}
