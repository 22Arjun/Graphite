import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

// ============================================================
// Prisma Plugin — Attaches PrismaClient to Fastify instance
// ============================================================

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function prismaPlugin(fastify: FastifyInstance) {
  // Cap the connection pool for Supabase free tier (max 15 connections via pgBouncer).
  // Without this Prisma opens 10+ connections and starves out transactions mid-ingestion.
  const dbUrl = new URL(env.DATABASE_URL);
  if (!dbUrl.searchParams.has('connection_limit')) dbUrl.searchParams.set('connection_limit', '3');
  if (!dbUrl.searchParams.has('pool_timeout')) dbUrl.searchParams.set('pool_timeout', '20');

  const prisma = new PrismaClient({
    datasourceUrl: dbUrl.toString(),
    log:
      env.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
  });

  if (env.NODE_ENV === 'development') {
    prisma.$on('query' as never, (e: any) => {
      if (e.duration > 200) {
        fastify.log.warn({ duration: e.duration, query: e.query }, 'Slow query detected');
      }
    });
  }

  await prisma.$connect();
  fastify.log.info('Database connected via Prisma');

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Disconnecting Prisma...');
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});
