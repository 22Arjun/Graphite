import { GitHubApiError, AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type {
  GitHubRepoResponse,
  GitHubCommitResponse,
  GitHubContributorResponse,
  GitHubLanguagesResponse,
} from '../../lib/types.js';
import type {
  NormalizedRepo,
  NormalizedLanguage,
  NormalizedCommit,
  NormalizedContributor,
  RepoIngestionData,
} from './github.types.js';
import { LANGUAGE_COLORS } from './github.types.js';

// ============================================================
// GitHub API Service
// Handles all GitHub REST API communication with:
// - Automatic pagination
// - Rate limit awareness
// - Data normalization
// - Error handling
// ============================================================

const GH_API_BASE = 'https://api.github.com';
const GH_API_VERSION = '2022-11-28';
const MAX_COMMITS_PER_REPO = 100; // Sample size for pattern analysis
const MAX_CONTRIBUTORS_PER_REPO = 50;

interface GitHubRequestOptions {
  accessToken: string;
  path: string;
  params?: Record<string, string | number>;
  method?: string;
}

interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

export class GitHubService {
  private rateLimitInfo: RateLimitInfo = { remaining: 5000, reset: 0, limit: 5000 };

  // -------------------------------------------------------
  // Core HTTP layer
  // -------------------------------------------------------

  private async request<T>(options: GitHubRequestOptions, timeoutMs = 20_000): Promise<T> {
    const { accessToken, path, params, method = 'GET' } = options;

    // Check rate limit before making request
    if (this.rateLimitInfo.remaining <= 5) {
      const resetTime = this.rateLimitInfo.reset * 1000;
      const waitMs = Math.max(0, resetTime - Date.now()) + 1000;

      if (waitMs > 0 && waitMs < 120_000) {
        logger.warn({ waitMs, remaining: this.rateLimitInfo.remaining }, 'Rate limit near, waiting...');
        await this.sleep(waitMs);
      } else if (waitMs >= 120_000) {
        throw new GitHubApiError(
          `Rate limit exceeded. Resets at ${new Date(resetTime).toISOString()}`,
          429,
          {}
        );
      }
    }

    const url = new URL(`${GH_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': GH_API_VERSION,
          'User-Agent': 'Graphite-API/0.1',
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new GitHubApiError(`Request timed out after ${timeoutMs}ms: ${path}`, 408, {});
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    // Update rate limit tracking
    this.rateLimitInfo = {
      remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '5000', 10),
      reset: parseInt(response.headers.get('x-ratelimit-reset') || '0', 10),
      limit: parseInt(response.headers.get('x-ratelimit-limit') || '5000', 10),
    };

    if (!response.ok) {
      const body = await response.text();
      throw new GitHubApiError(
        `${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
        response.status,
        {} as Record<string, string>
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Paginated fetch — follows Link headers
   */
  private async paginatedRequest<T>(options: GitHubRequestOptions, maxItems: number = 500): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = 100;

    while (results.length < maxItems) {
      const items = await this.request<T[]>({
        ...options,
        params: { ...options.params, per_page: perPage, page },
      });

      if (!items || items.length === 0) break;

      results.push(...items);

      if (items.length < perPage) break;
      page++;
    }

    return results.slice(0, maxItems);
  }

  // -------------------------------------------------------
  // Public API — Fetching
  // -------------------------------------------------------

  /**
   * Fetch all repositories for the authenticated user (public + private).
   * Uses /user/repos with the OAuth token so private repos are included.
   */
  async fetchUserRepos(accessToken: string, username: string): Promise<GitHubRepoResponse[]> {
    logger.info({ username }, 'Fetching repositories');

    return this.paginatedRequest<GitHubRepoResponse>({
      accessToken,
      path: `/user/repos`,
      params: { affiliation: 'owner', sort: 'pushed', direction: 'desc', visibility: 'all' },
    });
  }

  /**
   * Fetch language breakdown for a repository.
   */
  async fetchRepoLanguages(accessToken: string, fullName: string): Promise<GitHubLanguagesResponse> {
    return this.request<GitHubLanguagesResponse>({
      accessToken,
      path: `/repos/${fullName}/languages`,
    });
  }

  /**
   * Fetch recent commits (sampled) for contribution pattern analysis.
   */
  async fetchRepoCommits(
    accessToken: string,
    fullName: string,
    ownerLogin: string
  ): Promise<GitHubCommitResponse[]> {
    try {
      return await this.paginatedRequest<GitHubCommitResponse>(
        {
          accessToken,
          path: `/repos/${fullName}/commits`,
          params: { author: ownerLogin },
        },
        MAX_COMMITS_PER_REPO
      );
    } catch (err) {
      // Empty repos or repos with no commits by this author return 409
      if (err instanceof GitHubApiError && err.ghStatusCode === 409) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Fetch contributors for a repository.
   */
  async fetchRepoContributors(accessToken: string, fullName: string): Promise<GitHubContributorResponse[]> {
    try {
      return await this.paginatedRequest<GitHubContributorResponse>(
        {
          accessToken,
          path: `/repos/${fullName}/contributors`,
        },
        MAX_CONTRIBUTORS_PER_REPO
      );
    } catch (err) {
      // Some repos return 403 for contributor stats
      if (err instanceof GitHubApiError && (err.ghStatusCode === 403 || err.ghStatusCode === 404)) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Check if repo has GitHub Pages or Vercel/Netlify deployment signals.
   */
  async checkDeployment(accessToken: string, fullName: string, homepage: string | null): Promise<boolean> {
    // Homepage URL is a strong deployment signal
    if (homepage && homepage.length > 0) return true;

    try {
      const deployments = await this.request<{ id: number }[]>({
        accessToken,
        path: `/repos/${fullName}/deployments`,
        params: { per_page: 1 },
      });
      return deployments.length > 0;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------
  // Public API — Full Repo Ingestion
  // -------------------------------------------------------

  /**
   * Fully ingest a single repository: metadata + languages + commits + contributors.
   */
  async ingestRepository(
    accessToken: string,
    repoResponse: GitHubRepoResponse,
    ownerLogin: string
  ): Promise<RepoIngestionData> {
    const fullName = repoResponse.full_name;
    logger.info({ repo: fullName }, 'Ingesting repository');

    // Parallel fetch with allSettled — a single failing endpoint won't abort the others
    const [langResult, commitResult, contribResult, deployResult] = await Promise.allSettled([
      this.fetchRepoLanguages(accessToken, fullName),
      this.fetchRepoCommits(accessToken, fullName, ownerLogin),
      this.fetchRepoContributors(accessToken, fullName),
      this.checkDeployment(accessToken, fullName, repoResponse.homepage),
    ]);

    if (langResult.status === 'rejected')
      logger.warn({ repo: fullName, err: langResult.reason }, 'Language fetch failed, using empty');
    if (commitResult.status === 'rejected')
      logger.warn({ repo: fullName, err: commitResult.reason }, 'Commit fetch failed, using empty');
    if (contribResult.status === 'rejected')
      logger.warn({ repo: fullName, err: contribResult.reason }, 'Contributor fetch failed, using empty');

    const rawLanguages = langResult.status === 'fulfilled' ? langResult.value : {};
    const rawCommits   = commitResult.status === 'fulfilled' ? commitResult.value : [];
    const rawContributors = contribResult.status === 'fulfilled' ? contribResult.value : [];
    const hasDeployment   = deployResult.status === 'fulfilled' ? deployResult.value : false;

    // Normalize everything
    const repo = this.normalizeRepo(repoResponse, hasDeployment);
    const languages = this.normalizeLanguages(rawLanguages);
    const commits = this.normalizeCommits(rawCommits);
    const contributors = this.normalizeContributors(rawContributors);

    return { repo, languages, commits, contributors };
  }

  // -------------------------------------------------------
  // Normalization
  // -------------------------------------------------------

  normalizeRepo(raw: GitHubRepoResponse, hasDeployment: boolean): NormalizedRepo {
    return {
      githubId: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      description: raw.description,
      url: raw.html_url,
      homepage: raw.homepage,
      isPrivate: raw.private,
      isFork: raw.fork,
      isArchived: raw.archived,
      stars: raw.stargazers_count,
      forks: raw.forks_count,
      watchers: raw.watchers_count,
      openIssues: raw.open_issues_count,
      size: raw.size,
      defaultBranch: raw.default_branch,
      primaryLanguage: raw.language,
      topics: raw.topics || [],
      licenseName: raw.license?.spdx_id || null,
      hasDeployment: hasDeployment || raw.has_pages,
      pushedAt: raw.pushed_at ? new Date(raw.pushed_at) : null,
      repoCreatedAt: new Date(raw.created_at),
      repoUpdatedAt: new Date(raw.updated_at),
    };
  }

  normalizeLanguages(raw: GitHubLanguagesResponse): NormalizedLanguage[] {
    const total = Object.values(raw).reduce((sum, bytes) => sum + bytes, 0);
    if (total === 0) return [];

    return Object.entries(raw)
      .map(([language, bytes]) => ({
        language,
        bytes,
        percentage: Math.round((bytes / total) * 10000) / 100, // 2 decimal places
        color: LANGUAGE_COLORS[language] || '#6e7681',
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }

  normalizeCommits(raw: GitHubCommitResponse[]): NormalizedCommit[] {
    return raw.map((c) => ({
      sha: c.sha,
      message: c.commit.message.slice(0, 500), // Truncate long messages
      authorLogin: c.author?.login || null,
      authorEmail: c.commit.author.email,
      additions: c.stats?.additions || 0,
      deletions: c.stats?.deletions || 0,
      committedAt: new Date(c.commit.author.date),
    }));
  }

  normalizeContributors(raw: GitHubContributorResponse[]): NormalizedContributor[] {
    return raw.map((c) => ({
      githubLogin: c.login,
      githubId: c.id,
      avatarUrl: c.avatar_url,
      contributions: c.contributions,
    }));
  }

  // -------------------------------------------------------
  // Rate limit status
  // -------------------------------------------------------

  getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
