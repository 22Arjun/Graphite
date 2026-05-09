import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RecommendationService } from './recommendation.service.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Recommendation Routes — /api/recommendation/*
// ============================================================

export default async function recommendationRoutes(fastify: FastifyInstance) {
  const service = new RecommendationService(fastify.prisma);

  // -------------------------------------------------------
  // GET /api/recommendation/collaborators
  // -------------------------------------------------------
  fastify.get<{ Querystring: { limit?: string } }>(
    '/collaborators',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const limit = Math.min(20, Math.max(1, parseInt(request.query.limit ?? '5', 10)));
      const recommendations = await service.getCollaboratorRecommendations(user.sub, limit);
      return reply.status(200).send({ success: true, data: recommendations });
    }
  );
}
