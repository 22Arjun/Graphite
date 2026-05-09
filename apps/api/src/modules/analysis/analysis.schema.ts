import { z } from 'zod';

export const triggerAnalysisSchema = z.object({
  repositoryId: z.string().uuid(),
});

export const analysisResultSchema = z.object({
  repositoryId: z.string().uuid(),
  architectureComplexity: z.number().min(1).max(10),
  codeQualitySignals: z.number().min(1).max(10),
  executionMaturity: z.number().min(1).max(10),
  originalityScore: z.number().min(1).max(10),
  inferredSkills: z.array(z.string()),
  probableDomains: z.array(z.string()),
  builderSummary: z.string(),
  keyPatterns: z.array(z.string()),
  deploymentDetected: z.boolean(),
  testCoverageSignals: z.enum(['none', 'minimal', 'moderate', 'comprehensive']),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
