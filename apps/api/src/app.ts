import Fastify from 'fastify';
import fastifySensible from '@fastify/sensible';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';

// Plugins
import prismaPlugin from './plugins/prisma.js';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import builderRoutes from './modules/builder/builder.routes.js';
import ingestionRoutes from './modules/ingestion/ingestion.routes.js';
import analysisRoutes from './modules/analysis/analysis.routes.js';
import scoringRoutes from './modules/scoring/scoring.routes.js';
import graphRoutes from './modules/graph/graph.routes.js';
import recommendationRoutes from './modules/recommendation/recommendation.routes.js';
import sourcesRoutes from './modules/sources/sources.routes.js';

// ============================================================
// Fastify Application Factory
// ============================================================

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    trustProxy: true,
    requestTimeout: 30_000,
  });

  // -------------------------------------------------------
  // Global error handler
  // -------------------------------------------------------
  app.setErrorHandler((error, request, reply) => {
    // Handle our custom AppError types
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof AppError && 'details' in error
            ? { details: (error as any).details }
            : {}),
        },
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation,
        },
      });
    }

    // Unhandled errors
    request.log.error(error, 'Unhandled error');

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
      },
    });
  });

  // -------------------------------------------------------
  // Not found handler
  // -------------------------------------------------------
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // -------------------------------------------------------
  // Register plugins
  // -------------------------------------------------------
  await app.register(corsPlugin);

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Graphite API',
        description: 'AI-powered Builder Reputation Graph — REST API',
        version: '1.0.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'auth', description: 'Authentication — wallet sign-in, GitHub OAuth' },
        { name: 'builder', description: 'Builder profile, repositories, stats' },
        { name: 'ingestion', description: 'GitHub ingestion pipeline and job management' },
        { name: 'analysis', description: 'AI repository analysis' },
        { name: 'scoring', description: 'Reputation dimension scoring' },
        { name: 'graph', description: 'Collaboration graph' },
        { name: 'recommendation', description: 'Collaborator recommendations' },
        { name: 'sources', description: 'External reputation sources — LinkedIn, Twitter, Hackathons, Resume' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    staticCSP: true,
  });

  await app.register(fastifySensible);
  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  // -------------------------------------------------------
  // Health check
  // -------------------------------------------------------
  app.get('/health', async (_request, reply) => {
    // Quick DB check
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return reply.status(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch {
      return reply.status(503).send({
        status: 'degraded',
        message: 'Database connection failed',
      });
    }
  });

  // -------------------------------------------------------
  // Register route modules
  // -------------------------------------------------------
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(builderRoutes, { prefix: '/api/builder' });
  await app.register(ingestionRoutes, { prefix: '/api/ingestion' });
  await app.register(analysisRoutes, { prefix: '/api/analysis' });
  await app.register(scoringRoutes, { prefix: '/api/scoring' });
  await app.register(graphRoutes, { prefix: '/api/graph' });
  await app.register(recommendationRoutes, { prefix: '/api/recommendation' });
  await app.register(sourcesRoutes, { prefix: '/api/sources' });

  return app;
}
