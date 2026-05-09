import { nanoid } from 'nanoid';
import type { PrismaClient } from '@prisma/client';
import * as pdfParseModule from 'pdf-parse';
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = (pdfParseModule as any).default ?? pdfParseModule;
import { FormAnalysisService } from './forms.analysis.service.js';
import { CloudinaryService } from './forms.cloudinary.service.js';
import { EmailService } from './forms.email.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, ForbiddenError, AppError } from '../../lib/errors.js';
import type { CreateFormInput, UpdateFormInput, SendEmailInput, SubmitFormInput } from './forms.schema.js';

export class FormsService {
  private readonly analysisService: FormAnalysisService;
  private readonly cloudinaryService: CloudinaryService;
  private readonly emailService: EmailService;

  constructor(private readonly prisma: PrismaClient) {
    this.analysisService = new FormAnalysisService(prisma);
    this.cloudinaryService = new CloudinaryService();
    this.emailService = new EmailService();
  }

  // -------------------------------------------------------
  // Form CRUD
  // -------------------------------------------------------

  async createForm(builderId: string, input: CreateFormInput) {
    const token = nanoid(12);
    const form = await this.prisma.profileRequest.create({
      data: {
        builderId,
        token,
        title: input.title ?? null,
        description: input.description ?? null,
        requiredFields: input.requiredFields,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
    logger.info({ builderId, token, formId: form.id }, 'Profile request form created');
    return form;
  }

  async listForms(builderId: string) {
    return this.prisma.profileRequest.findMany({
      where: { builderId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { submissions: true } },
      },
    });
  }

  async getForm(builderId: string, formId: string) {
    const form = await this.prisma.profileRequest.findUnique({
      where: { id: formId },
      include: { _count: { select: { submissions: true } } },
    });
    if (!form) throw new NotFoundError('ProfileRequest', formId);
    if (form.builderId !== builderId) throw new ForbiddenError();
    return form;
  }

  async updateForm(builderId: string, formId: string, input: UpdateFormInput) {
    const form = await this.prisma.profileRequest.findUnique({ where: { id: formId } });
    if (!form) throw new NotFoundError('ProfileRequest', formId);
    if (form.builderId !== builderId) throw new ForbiddenError();

    return this.prisma.profileRequest.update({
      where: { id: formId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.requiredFields !== undefined && { requiredFields: input.requiredFields }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }),
      },
    });
  }

  async deleteForm(builderId: string, formId: string) {
    const form = await this.prisma.profileRequest.findUnique({ where: { id: formId } });
    if (!form) throw new NotFoundError('ProfileRequest', formId);
    if (form.builderId !== builderId) throw new ForbiddenError();
    await this.prisma.profileRequest.delete({ where: { id: formId } });
  }

  // -------------------------------------------------------
  // Email
  // -------------------------------------------------------

  async sendEmail(builderId: string, formId: string, input: SendEmailInput) {
    const form = await this.prisma.profileRequest.findUnique({ where: { id: formId } });
    if (!form) throw new NotFoundError('ProfileRequest', formId);
    if (form.builderId !== builderId) throw new ForbiddenError();

    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
      select: { displayName: true, githubProfile: { select: { name: true, username: true } } },
    });

    const senderName =
      builder?.displayName ||
      builder?.githubProfile?.name ||
      builder?.githubProfile?.username ||
      'Someone on Graphite';

    const formUrl = `${env.APP_BASE_URL}/form/${form.token}`;
    await this.emailService.sendFormInvitation({
      to: input.emails,
      senderName,
      formUrl,
      personalMessage: input.personalMessage,
    });
  }

  // -------------------------------------------------------
  // Submissions
  // -------------------------------------------------------

  async listSubmissions(builderId: string, formId: string) {
    const form = await this.prisma.profileRequest.findUnique({ where: { id: formId } });
    if (!form) throw new NotFoundError('ProfileRequest', formId);
    if (form.builderId !== builderId) throw new ForbiddenError();

    return this.prisma.formSubmission.findMany({
      where: { requestId: formId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        githubUsername: true,
        twitterHandle: true,
        linkedInUrl: true,
        analysisStatus: true,
        resumeUrl: true,
        submittedAt: true,
      },
    });
  }

  async getSubmission(builderId: string, submissionId: string) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: { request: { select: { builderId: true } } },
    });
    if (!submission) throw new NotFoundError('FormSubmission', submissionId);
    if (submission.request.builderId !== builderId) throw new ForbiddenError();
    return submission;
  }

  async reanalyzeSubmission(builderId: string, submissionId: string) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: { request: { select: { builderId: true } } },
    });
    if (!submission) throw new NotFoundError('FormSubmission', submissionId);
    if (submission.request.builderId !== builderId) throw new ForbiddenError();

    await this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: { analysisStatus: 'PENDING', analysisResult: undefined },
    });

    this.analysisService.analyzeSubmission(submissionId).catch((err) => {
      logger.error({ err, submissionId }, 'Re-analysis failed');
    });
  }

  // -------------------------------------------------------
  // Public
  // -------------------------------------------------------

  async getPublicForm(token: string) {
    const form = await this.prisma.profileRequest.findUnique({ where: { token } });
    if (!form) throw new NotFoundError('ProfileRequest', token);
    if (!form.isActive) throw new AppError('This form is no longer active', 410, 'FORM_INACTIVE');
    if (form.expiresAt && form.expiresAt < new Date()) {
      throw new AppError('This form has expired', 410, 'FORM_EXPIRED');
    }

    return {
      id: form.id,
      token: form.token,
      title: form.title,
      description: form.description,
      isActive: form.isActive,
      requiredFields: form.requiredFields,
    };
  }

  async submitForm(
    token: string,
    input: SubmitFormInput,
    resumeBuffer?: Buffer,
    resumeFilename?: string
  ) {
    const form = await this.prisma.profileRequest.findUnique({ where: { token } });
    if (!form) throw new NotFoundError('ProfileRequest', token);
    if (!form.isActive) throw new AppError('This form is no longer active', 410, 'FORM_INACTIVE');
    if (form.expiresAt && form.expiresAt < new Date()) {
      throw new AppError('This form has expired', 410, 'FORM_EXPIRED');
    }

    let resumeUrl: string | null = null;
    let resumeText: string | null = null;

    if (resumeBuffer && resumeBuffer.length > 0) {
      try {
        [resumeUrl, resumeText] = await Promise.all([
          this.cloudinaryService.uploadResumePdf(resumeBuffer, resumeFilename ?? 'resume.pdf'),
          pdfParse(resumeBuffer).then((r) => r.text?.trim() || null),
        ]);
      } catch (err) {
        logger.warn({ err }, 'Resume upload/parse failed — continuing without resume');
      }
    }

    const submission = await this.prisma.formSubmission.create({
      data: {
        requestId: form.id,
        fullName: input.fullName || null,
        email: input.email || null,
        linkedInUrl: input.linkedInUrl || null,
        twitterHandle: input.twitterHandle ? input.twitterHandle.replace(/^@/, '') : null,
        githubUsername: input.githubUsername || null,
        projectLinks: input.projectLinks as any,
        hackathons: input.hackathons as any,
        extraLinks: input.extraLinks as any,
        resumeUrl,
        resumeText,
      },
    });

    // Fire-and-forget analysis
    this.analysisService.analyzeSubmission(submission.id).catch((err) => {
      logger.error({ err, submissionId: submission.id }, 'Async form analysis failed');
    });

    logger.info({ formId: form.id, submissionId: submission.id }, 'Form submitted');
    return submission;
  }
}
