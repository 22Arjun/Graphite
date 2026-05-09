import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';
import type { JwtPayload } from '../lib/types.js';

// ============================================================
// Auth Plugin — JWT verification + request decorator
// ============================================================

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  // Decorator for protected routes
  fastify.decorate('authenticate', async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });
}

export default fp(authPlugin, {
  name: 'auth',
});
