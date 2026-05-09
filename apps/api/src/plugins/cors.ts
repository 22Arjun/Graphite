import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyCors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
}

export default fp(corsPlugin, { name: 'cors' });
