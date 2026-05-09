import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BuilderService } from './builder.service.js';
import { updateProfileSchema, getRepositoriesQuerySchema } from './builder.schema.js';
import { ValidationError } from '../../lib/errors.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Builder Routes — /api/builder/*
// All routes require authentication
// ============================================================

export default async function builderRoutes(fastify: FastifyInstance) {
  const builderService = new BuilderService(fastify.prisma);

  // Apply auth to all routes in this module
  fastify.addHook('preHandler', fastify.authenticate);

  // -------------------------------------------------------
  // GET /api/builder/profile — Get current builder's profile
  // -------------------------------------------------------
  fastify.get('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    const profile = await builderService.getProfile(user.sub);

    return reply.status(200).send({
      success: true,
      data: profile,
    });
  });

  // -------------------------------------------------------
  // PATCH /api/builder/profile — Update profile
  // -------------------------------------------------------
  fastify.patch('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', {
        fields: parsed.error.issues.map((i) => i.message),
      });
    }

    const profile = await builderService.updateProfile(user.sub, parsed.data);

    return reply.status(200).send({
      success: true,
      data: profile,
    });
  });

  // -------------------------------------------------------
  // GET /api/builder/repositories — List repos with filtering
  // -------------------------------------------------------
  fastify.get('/repositories', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    const parsed = getRepositoriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters');
    }

    const { page, limit, status, language, search } = parsed.data;
    const result = await builderService.getRepositories(
      user.sub,
      { page, limit },
      { status, language, search }
    );

    return reply.status(200).send({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
      },
    });
  });

  // -------------------------------------------------------
  // GET /api/builder/stats — Aggregated GitHub stats
  // -------------------------------------------------------
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;
    const stats = await builderService.getGitHubStats(user.sub);

    return reply.status(200).send({
      success: true,
      data: stats,
    });
  });
}
