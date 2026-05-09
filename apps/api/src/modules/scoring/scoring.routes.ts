import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ScoringService } from './scoring.service.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Scoring Routes — /api/scoring/*
// ============================================================

export default async function scoringRoutes(fastify: FastifyInstance) {
  const service = new ScoringService(fastify.prisma);

  // -------------------------------------------------------
  // POST /api/scoring/compute — Trigger reputation recomputation
  // -------------------------------------------------------
  fastify.post(
    '/compute',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;

      service.computeReputation(user.sub).catch((err) => {
        fastify.log.error({ err, builderId: user.sub }, 'Async scoring failed');
      });

      return reply.status(202).send({
        success: true,
        data: { message: 'Reputation computation started' },
      });
    }
  );

  // -------------------------------------------------------
  // GET /api/scoring/dimensions — Get current reputation scores
  // -------------------------------------------------------
  fastify.get(
    '/dimensions',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const result = await service.getReputation(user.sub);
      return reply.status(200).send({ success: true, data: result });
    }
  );
}
