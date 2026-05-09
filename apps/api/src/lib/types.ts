// ============================================================
// Shared Types — Backend API
// ============================================================

import type { FastifyRequest, FastifyReply } from 'fastify';

// --- Auth ---

export interface JwtPayload {
  sub: string; // builder.id (UUID)
  wallet: string; // wallet address
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JwtPayload;
}

// --- API Response Envelope ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// --- Pagination ---

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// --- GitHub OAuth ---

export interface GitHubOAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  private: boolean;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  size: number;
  default_branch: string;
  language: string | null;
  topics: string[];
  license: { spdx_id: string; name: string } | null;
  has_pages: boolean;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: { login: string; id: number } | null;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface GitHubContributorResponse {
  login: string;
  id: number;
  avatar_url: string;
  contributions: number;
}

export interface GitHubLanguagesResponse {
  [language: string]: number;
}

// --- Ingestion ---

export interface IngestionPipelineInput {
  builderId: string;
  githubUsername: string;
  accessToken: string;
}

export interface IngestionProgress {
  jobId: string;
  phase: 'repos' | 'languages' | 'commits' | 'contributors' | 'complete';
  progress: number; // 0-100
  message: string;
  reposProcessed?: number;
  totalRepos?: number;
}

// --- Route handler shorthand ---
export type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;
