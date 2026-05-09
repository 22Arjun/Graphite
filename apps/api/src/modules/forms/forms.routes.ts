import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { FormsService } from './forms.service.js';
import {
  createFormSchema,
  updateFormSchema,
  sendEmailSchema,
  submitFormSchema,
} from './forms.schema.js';
import type { JwtPayload } from '../../lib/types.js';
import { AppError } from '../../lib/errors.js';

// ============================================================
// Forms Routes — /api/forms/*
// Manages profile request forms, submissions, and AI analysis.
// ============================================================

export default async function formsRoutes(fastify: FastifyInstance) {
  await fastify.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  const service = new FormsService(fastify.prisma);

  // -------------------------------------------------------
  // Authenticated — submission endpoints (register BEFORE /:id)
  // -------------------------------------------------------

  fastify.get(
    '/submissions/:submissionId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { submissionId } = request.params as { submissionId: string };
      const submission = await service.getSubmission(user.sub, submissionId);
      return reply.status(200).send({ success: true, data: submission });
    }
  );

  fastify.post(
    '/submissions/:submissionId/reanalyze',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { submissionId } = request.params as { submissionId: string };
      await service.reanalyzeSubmission(user.sub, submissionId);
      return reply.status(202).send({ success: true, data: { message: 'Re-analysis started' } });
    }
  );

  // -------------------------------------------------------
  // Authenticated — form CRUD
  // -------------------------------------------------------

  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const body = createFormSchema.parse(request.body);
      const form = await service.createForm(user.sub, body);
      return reply.status(201).send({ success: true, data: form });
    }
  );

  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const forms = await service.listForms(user.sub);
      return reply.status(200).send({ success: true, data: forms });
    }
  );

  fastify.get(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const form = await service.getForm(user.sub, id);
      return reply.status(200).send({ success: true, data: form });
    }
  );

  fastify.patch(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = updateFormSchema.parse(request.body);
      const form = await service.updateForm(user.sub, id, body);
      return reply.status(200).send({ success: true, data: form });
    }
  );

  fastify.delete(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      await service.deleteForm(user.sub, id);
      return reply.status(200).send({ success: true, data: { message: 'Form deleted' } });
    }
  );

  fastify.post(
    '/:id/send-email',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const body = sendEmailSchema.parse(request.body);
      await service.sendEmail(user.sub, id, body);
      return reply.status(200).send({ success: true, data: { message: 'Email sent' } });
    }
  );

  fastify.get(
    '/:id/submissions',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      const submissions = await service.listSubmissions(user.sub, id);
      return reply.status(200).send({ success: true, data: submissions });
    }
  );

  // -------------------------------------------------------
  // Public — no authentication required
  // -------------------------------------------------------

  fastify.get(
    '/public/:token',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.params as { token: string };
      const form = await service.getPublicForm(token);
      return reply.status(200).send({ success: true, data: form });
    }
  );

  fastify.post(
    '/public/:token/submit',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.params as { token: string };

      const fields: Record<string, string> = {};
      let resumeBuffer: Buffer | undefined;
      let resumeFilename: string | undefined;

      // Parse multipart: collect all field values + optional file
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.mimetype !== 'application/pdf') {
            throw new AppError('Only PDF files are accepted', 400, 'INVALID_FILE_TYPE');
          }
          resumeBuffer = await part.toBuffer();
          resumeFilename = part.filename;
        } else {
          fields[part.fieldname] = part.value as string;
        }
      }

      // Parse JSON array fields that were stringified by the client
      const parseJsonField = (key: string, fallback: unknown[] = []) => {
        try {
          const val = fields[key];
          return val ? JSON.parse(val) : fallback;
        } catch {
          return fallback;
        }
      };

      const rawInput = {
        fullName: fields.fullName,
        email: fields.email,
        linkedInUrl: fields.linkedInUrl,
        twitterHandle: fields.twitterHandle,
        githubUsername: fields.githubUsername,
        projectLinks: parseJsonField('projectLinks'),
        hackathons: parseJsonField('hackathons'),
        extraLinks: parseJsonField('extraLinks'),
      };

      const input = submitFormSchema.parse(rawInput);
      const submission = await service.submitForm(token, input, resumeBuffer, resumeFilename);

      return reply.status(201).send({ success: true, data: { id: submission.id, message: 'Profile submitted successfully' } });
    }
  );
}
