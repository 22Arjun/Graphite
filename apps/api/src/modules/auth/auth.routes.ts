import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { walletAuthSchema, githubCallbackSchema } from './auth.schema.js';
import { ValidationError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import type { JwtPayload } from '../../lib/types.js';

// ============================================================
// Auth Routes — /api/auth/*
// ============================================================

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify);

  // -------------------------------------------------------
  // POST /api/auth/wallet — Authenticate via signed message
  // -------------------------------------------------------
  fastify.post('/wallet', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = walletAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', {
        fields: parsed.error.issues.map((i) => i.message),
      });
    }

    const result = await authService.authenticateWallet(parsed.data);
    return reply.status(200).send({ success: true, data: result });
  });

  // -------------------------------------------------------
  // GET /api/auth/github — Redirect to GitHub OAuth (server-side nav)
  // -------------------------------------------------------
  fastify.get(
    '/github',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const url = authService.getGitHubAuthUrl(user.sub);
      return reply.redirect(url);
    }
  );

  // -------------------------------------------------------
  // GET /api/auth/github/url — Return OAuth URL as JSON
  // Frontend calls this with Bearer token, then redirects browser to the returned URL
  // -------------------------------------------------------
  fastify.get(
    '/github/url',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const url = authService.getGitHubAuthUrl(user.sub);
      return reply.status(200).send({ success: true, data: { url } });
    }
  );

  // -------------------------------------------------------
  // GET /api/auth/github/callback — Handle OAuth callback
  // -------------------------------------------------------
  fastify.get(
    '/github/callback',
    async (
      request: FastifyRequest<{
        Querystring: { code?: string; state?: string; error?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { code, state: builderId, error } = request.query;

      if (error) {
        return reply.redirect(
          `${env.FRONTEND_URL}/settings?error=github_denied`
        );
      }

      if (!code || !builderId) {
        return reply.redirect(
          `${env.FRONTEND_URL}/settings?error=invalid_callback`
        );
      }

      try {
        await authService.handleGitHubCallback(code, builderId);
        return reply.redirect(
          `${env.FRONTEND_URL}/dashboard?github=connected`
        );
      } catch (err) {
        fastify.log.error(err, 'GitHub OAuth callback failed');
        return reply.redirect(
          `${env.FRONTEND_URL}/settings?error=github_failed`
        );
      }
    }
  );

  // -------------------------------------------------------
  // GET /api/auth/me — Get current authenticated builder
  // -------------------------------------------------------
  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;

      const builder = await fastify.prisma.builder.findUnique({
        where: { id: user.sub },
        include: {
          githubProfile: {
            select: {
              username: true,
              avatarUrl: true,
              name: true,
              publicRepos: true,
              lastSyncedAt: true,
            },
          },
        },
      });

      if (!builder) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Builder not found' },
        });
      }

      return reply.status(200).send({ success: true, data: builder });
    }
  );
}
