import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
// Lazy-loaded to avoid DOMMatrix crash in serverless environments at import time
let _pdfParse: ((buffer: Buffer) => Promise<{ text: string }>) | null = null;
async function pdfParse(buffer: Buffer): Promise<{ text: string }> {
  if (!_pdfParse) {
    const m = await import('pdf-parse');
    _pdfParse = (m as any).default ?? m;
  }
  return _pdfParse!(buffer);
}
import { SourcesService } from './sources.service.js';
import { linkedInSchema, twitterSchema, hackathonSchema, hackathonUpdateSchema } from './sources.schema.js';
import type { JwtPayload } from '../../lib/types.js';
import { AppError } from '../../lib/errors.js';

// ============================================================
// Sources Routes — /api/sources/*
// Manages all external reputation sources for the builder.
// ============================================================

export default async function sourcesRoutes(fastify: FastifyInstance) {
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB max
  });

  const service = new SourcesService(fastify.prisma);

  // -------------------------------------------------------
  // GET /api/sources/summary
  // -------------------------------------------------------
  fastify.get(
    '/summary',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const summary = await service.getSummary(user.sub);
      return reply.status(200).send({ success: true, data: summary });
    }
  );

  // -------------------------------------------------------
  // LinkedIn
  // -------------------------------------------------------

  fastify.post(
    '/linkedin',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const body = linkedInSchema.parse(request.body);
      const result = await service.upsertLinkedIn(user.sub, body);
      return reply.status(200).send({ success: true, data: result });
    }
  );

  fastify.get(
    '/linkedin',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const data = await service.getLinkedIn(user.sub);
      return reply.status(200).send({ success: true, data });
    }
  );

  fastify.delete(
    '/linkedin',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      await service.deleteLinkedIn(user.sub);
      return reply.status(200).send({ success: true, data: { message: 'LinkedIn data removed' } });
    }
  );

  // -------------------------------------------------------
  // Twitter / X
  // -------------------------------------------------------

  fastify.post(
    '/twitter',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const body = twitterSchema.parse(request.body);
      const result = await service.upsertTwitter(user.sub, body);
      return reply.status(200).send({ success: true, data: result });
    }
  );

  fastify.get(
    '/twitter',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const data = await service.getTwitter(user.sub);
      return reply.status(200).send({ success: true, data });
    }
  );

  fastify.delete(
    '/twitter',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      await service.deleteTwitter(user.sub);
      return reply.status(200).send({ success: true, data: { message: 'Twitter data removed' } });
    }
  );

  // -------------------------------------------------------
  // Hackathons
  // -------------------------------------------------------

  fastify.post(
    '/hackathon',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const body = hackathonSchema.parse(request.body);
      const result = await service.addHackathon(user.sub, body);
      return reply.status(201).send({ success: true, data: result });
    }
  );

  fastify.get(
    '/hackathon',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const entries = await service.getHackathons(user.sub);
      return reply.status(200).send({ success: true, data: entries });
    }
  );

  fastify.put(
    '/hackathon/:id',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = hackathonUpdateSchema.parse(request.body);
      const result = await service.updateHackathon(user.sub, id, body);
      return reply.status(200).send({ success: true, data: result });
    }
  );

  fastify.delete(
    '/hackathon/:id',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      await service.deleteHackathon(user.sub, id);
      return reply.status(200).send({ success: true, data: { message: 'Hackathon entry removed' } });
    }
  );

  // -------------------------------------------------------
  // Resume
  // -------------------------------------------------------

  fastify.post(
    '/resume',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;

      const data = await request.file();
      if (!data) throw new AppError('No file uploaded', 400, 'NO_FILE');
      if (data.mimetype !== 'application/pdf') {
        throw new AppError('Only PDF files are accepted', 400, 'INVALID_FILE_TYPE');
      }

      const buffer = await data.toBuffer();
      if (buffer.length === 0) throw new AppError('Empty file uploaded', 400, 'EMPTY_FILE');

      let pdfText: string;
      try {
        const parsed = await pdfParse(buffer);
        pdfText = parsed.text;
      } catch {
        throw new AppError('Failed to extract text from PDF', 422, 'PDF_PARSE_ERROR');
      }

      if (!pdfText || pdfText.trim().length < 50) {
        throw new AppError('PDF contains too little text to parse', 422, 'INSUFFICIENT_TEXT');
      }

      await service.parseAndSaveResume(user.sub, pdfText);
      const result = await service.getResume(user.sub);
      return reply.status(200).send({ success: true, data: result });
    }
  );

  fastify.get(
    '/resume',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const data = await service.getResume(user.sub);
      return reply.status(200).send({ success: true, data });
    }
  );

  fastify.delete(
    '/resume',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      await service.deleteResume(user.sub);
      return reply.status(200).send({ success: true, data: { message: 'Resume data removed' } });
    }
  );
}
