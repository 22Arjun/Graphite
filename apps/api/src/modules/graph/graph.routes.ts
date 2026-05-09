import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GraphService } from './graph.service.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Graph Routes — /api/graph/*
// ============================================================

export default async function graphRoutes(fastify: FastifyInstance) {
  const service = new GraphService(fastify.prisma);

  // -------------------------------------------------------
  // GET /api/graph/builder — Get builder's collaboration graph
  // -------------------------------------------------------
  fastify.get(
    '/builder',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const graph = await service.getBuilderGraph(user.sub);
      return reply.status(200).send({ success: true, data: graph });
    }
  );

  // -------------------------------------------------------
  // POST /api/graph/build — Trigger graph edge computation
  // -------------------------------------------------------
  fastify.post(
    '/build',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;

      service.buildGraph(user.sub).catch((err) => {
        fastify.log.error({ err, builderId: user.sub }, 'Async graph build failed');
      });

      return reply.status(202).send({
        success: true,
        data: { message: 'Graph computation started' },
      });
    }
  );
}
