import { z } from 'zod';

// ============================================================
// Builder Request Schemas
// ============================================================

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const getRepositoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'INGESTING', 'ANALYZING', 'COMPLETED', 'FAILED']).optional(),
  language: z.string().optional(),
  search: z.string().optional(),
});
export type GetRepositoriesQuery = z.infer<typeof getRepositoriesQuerySchema>;
