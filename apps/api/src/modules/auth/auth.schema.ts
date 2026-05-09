import { z } from 'zod';

// ============================================================
// Auth Request/Response Schemas
// ============================================================

export const walletAuthSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string().min(1),
  message: z.string().min(1),
});
export type WalletAuthInput = z.infer<typeof walletAuthSchema>;

export const githubCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type GitHubCallbackInput = z.infer<typeof githubCallbackSchema>;

export const refreshTokenSchema = z.object({
  token: z.string().min(1),
});

// Response types
export interface AuthResponse {
  token: string;
  builder: {
    id: string;
    walletAddress: string;
    displayName: string | null;
    githubConnected: boolean;
  };
}

export interface GitHubConnectResponse {
  connected: boolean;
  username: string;
  avatarUrl: string | null;
}
