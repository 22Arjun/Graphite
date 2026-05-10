import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

async function corsPlugin(fastify: FastifyInstance) {
  const allowedOrigins = new Set([
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
  ]);

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin) || origin.endsWith('.vercel.app')) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}

export default fp(corsPlugin, { name: 'cors' });
