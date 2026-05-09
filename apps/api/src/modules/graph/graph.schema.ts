import { z } from 'zod';

export const graphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['builder', 'repository', 'skill']),
  label: z.string(),
  score: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const graphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  weight: z.number(),
  edgeType: z.string(),
});

export const graphResponseSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphResponse = z.infer<typeof graphResponseSchema>;
