import { z } from 'zod';

const REQUIRED_FIELD_VALUES = [
  'fullName', 'email', 'linkedin', 'twitter', 'github',
  'resume', 'projectLinks', 'hackathons',
] as const;

export const createFormSchema = z.object({
  title: z.string().max(200).nullish(),
  description: z.string().max(2000).nullish(),
  requiredFields: z.array(z.enum(REQUIRED_FIELD_VALUES)).default([]),
  expiresAt: z.string().datetime().nullish(),
});

export const updateFormSchema = createFormSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const sendEmailSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(10),
  personalMessage: z.string().max(500).optional(),
});

export const submitFormSchema = z.object({
  fullName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  linkedInUrl: z.string().url().optional().or(z.literal('')),
  twitterHandle: z.string().max(50).optional(),
  githubUsername: z.string().max(100).optional(),
  projectLinks: z
    .array(z.object({ url: z.string().url(), title: z.string().max(200).optional() }))
    .max(10)
    .default([]),
  hackathons: z
    .array(z.object({
      name: z.string().max(200),
      year: z.coerce.number().int().min(2000).max(2100),
      placement: z.string().max(100).optional(),
      prize: z.string().max(200).optional(),
      projectUrl: z.string().url().optional().or(z.literal('')),
    }))
    .max(20)
    .default([]),
  extraLinks: z
    .array(z.object({ url: z.string().url(), label: z.string().max(100).optional() }))
    .max(10)
    .default([]),
});

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type SubmitFormInput = z.infer<typeof submitFormSchema>;
