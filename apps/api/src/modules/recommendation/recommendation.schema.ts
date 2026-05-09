import { z } from 'zod';

export const collaboratorRecommendationSchema = z.object({
  builderId: z.string().uuid(),
  displayName: z.string().nullable(),
  walletAddress: z.string(),
  githubUsername: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  matchScore: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  sharedDomains: z.array(z.string()),
  complementarySkills: z.array(z.string()),
  overallScore: z.number(),
});

export type CollaboratorRecommendation = z.infer<typeof collaboratorRecommendationSchema>;
