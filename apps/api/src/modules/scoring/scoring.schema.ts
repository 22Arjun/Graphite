import { z } from 'zod';

export const dimensionScoreSchema = z.object({
  dimension: z.enum([
    'TECHNICAL_DEPTH',
    'EXECUTION_ABILITY',
    'COLLABORATION_QUALITY',
    'CONSISTENCY',
    'INNOVATION',
  ]),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
  trend: z.enum(['RISING', 'STABLE', 'DECLINING']),
});

export type DimensionScore = z.infer<typeof dimensionScoreSchema>;
