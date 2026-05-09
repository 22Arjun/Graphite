import { z } from 'zod';

// ============================================================
// Ingestion Request/Response Schemas
// ============================================================

export const triggerIngestionSchema = z.object({
  fullSync: z.boolean().default(false), // If true, re-ingest all repos
});
export type TriggerIngestionInput = z.infer<typeof triggerIngestionSchema>;

export const triggerRepoAnalysisSchema = z.object({
  repositoryId: z.string().uuid(),
});
export type TriggerRepoAnalysisInput = z.infer<typeof triggerRepoAnalysisSchema>;

export interface IngestionStatusResponse {
  jobId: string;
  status: string;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface IngestionSummary {
  totalRepos: number;
  newRepos: number;
  updatedRepos: number;
  totalCommits: number;
  totalContributors: number;
  uniqueLanguages: number;
  durationMs: number;
}
