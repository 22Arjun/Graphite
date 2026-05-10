import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { BuilderService } from './builder.service.js';
import { updateProfileSchema, getRepositoriesQuerySchema } from './builder.schema.js';
import { ValidationError, AppError } from '../../lib/errors.js';
import { uploadToCloudinary } from '../../lib/cloudinary.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Builder Routes — /api/builder/*
// All routes require authentication
// ============================================================

export default async function builderRoutes(fastify: FastifyInstance) {
  const builderService = new BuilderService(fastify.prisma);

  // Register multipart scoped to this plugin only (5 MB limit for avatars)
  await fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

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
  // POST /api/builder/profile/avatar — Upload profile photo
  // -------------------------------------------------------
  fastify.post('/profile/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload;

    const data = await request.file();
    if (!data) throw new AppError('No file uploaded', 400, 'NO_FILE');

    const mime = data.mimetype;
    if (!mime.startsWith('image/')) {
      throw new AppError('Only image files are allowed', 400, 'INVALID_FILE_TYPE');
    }

    const buffer = await data.toBuffer();
    if (buffer.length === 0) throw new AppError('Uploaded file is empty', 400, 'EMPTY_FILE');

    // Use a stable public_id so re-uploads overwrite the previous avatar in-place
    const publicId = `builder-${user.sub}`;
    const avatarUrl = await uploadToCloudinary(buffer, 'graphite/avatars', publicId);

    // Persist the URL to the database
    await fastify.prisma.builder.update({
      where: { id: user.sub },
      data: { avatarUrl },
    });

    return reply.status(200).send({
      success: true,
      data: { avatarUrl },
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
