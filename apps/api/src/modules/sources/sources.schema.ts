import { z } from 'zod';

export const linkedInSchema = z.object({
  headline: z.string().max(200).optional(),
  currentRole: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(60).default(0),
  educationLevel: z
    .enum(['HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'PHD', 'BOOTCAMP', 'SELF_TAUGHT', 'OTHER'])
    .optional(),
  skills: z.array(z.string().max(60)).max(50).default([]),
  summary: z.string().max(2000).optional(),
});

export const twitterSchema = z.object({
  handle: z.string().min(1).max(50).transform((h) => h.replace(/^@/, '')),
});

export const hackathonSchema = z.object({
  name: z.string().min(1).max(200),
  year: z.coerce.number().int().min(2000).max(2100),
  placement: z.string().max(100).optional(),
  prize: z.string().max(200).optional(),
  projectName: z.string().max(200).optional(),
  projectUrl: z.string().url().optional().or(z.literal('')),
});

export const hackathonUpdateSchema = hackathonSchema.partial();

export type LinkedInInput = z.infer<typeof linkedInSchema>;
export type TwitterInput = z.infer<typeof twitterSchema>;
export type HackathonInput = z.infer<typeof hackathonSchema>;
