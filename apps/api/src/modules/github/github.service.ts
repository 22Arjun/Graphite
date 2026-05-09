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
  ProjectSignals,
} from './github.types.js';
import { LANGUAGE_COLORS } from './github.types.js';

const GH_API_BASE = 'https://api.github.com';
const GH_API_VERSION = '2022-11-28';
const GH_GRAPHQL_URL = 'https://api.github.com/graphql';

// Reduced from 100 — commit timestamps are the signal, not content
const MAX_COMMITS_PER_REPO = 30;
const MAX_CONTRIBUTORS_PER_REPO = 30;
// Maximum repos to deeply ingest per builder
const MAX_REPOS_TO_INGEST = 5;

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

  private async request<T>(options: GitHubRequestOptions, timeoutMs = 15_000): Promise<T> {
    const { accessToken, path, params, method = 'GET' } = options;

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

  private async paginatedRequest<T>(options: GitHubRequestOptions, maxItems: number = 100): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    const perPage = Math.min(100, maxItems);

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

  async fetchUserRepos(accessToken: string, username: string): Promise<GitHubRepoResponse[]> {
    logger.info({ username }, 'Fetching repositories');

    return this.paginatedRequest<GitHubRepoResponse>({
      accessToken,
      path: `/user/repos`,
      params: { affiliation: 'owner', sort: 'pushed', direction: 'desc', visibility: 'all' },
    });
  }

  /**
   * Fetch pinned repository names via GitHub GraphQL API.
   * Falls back to [] on any error — pinned data is a bonus, not required.
   */
  async fetchPinnedRepos(accessToken: string, username: string): Promise<string[]> {
    const query = `
      query($login: String!) {
        user(login: $login) {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes {
              ... on Repository { nameWithOwner }
            }
          }
        }
      }
    `;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(GH_GRAPHQL_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Graphite-API/0.1',
        },
        body: JSON.stringify({ query, variables: { login: username } }),
      });

      if (!response.ok) return [];

      const json = await response.json() as any;
      const nodes = json?.data?.user?.pinnedItems?.nodes ?? [];
      return nodes
        .filter((n: any) => n?.nameWithOwner)
        .map((n: any) => n.nameWithOwner as string);
    } catch {
      logger.warn({ username }, 'Pinned repos fetch failed, continuing without');
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Select up to `max` high-signal repos from the full list.
   * Priority: pinned → top-starred (non-fork) → recently active.
   */
  selectHighSignalRepos(
    allRepos: GitHubRepoResponse[],
    pinnedNames: string[],
    max: number = MAX_REPOS_TO_INGEST
  ): GitHubRepoResponse[] {
    const selected = new Map<number, GitHubRepoResponse>();

    const add = (r: GitHubRepoResponse) => {
      if (!selected.has(r.id) && selected.size < max) selected.set(r.id, r);
    };

    const pinnedSet = new Set(pinnedNames.map((n) => n.toLowerCase()));

    // 1. Pinned repos
    for (const r of allRepos) {
      if (pinnedSet.has(r.full_name.toLowerCase())) add(r);
    }

    // 2. Top starred non-fork repos
    const byStars = [...allRepos]
      .filter((r) => !r.fork && r.stargazers_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count);
    for (const r of byStars) add(r);

    // 3. Recently active (pushed within last 6 months), sorted by recency
    const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
    const recentlyActive = [...allRepos]
      .filter((r) => r.pushed_at && new Date(r.pushed_at).getTime() > sixMonthsAgo)
      .sort((a, b) => new Date(b.pushed_at!).getTime() - new Date(a.pushed_at!).getTime());
    for (const r of recentlyActive) add(r);

    return Array.from(selected.values());
  }

  /**
   * Detect project maturity signals from repo metadata — no API calls.
   */
  detectProjectSignals(repo: GitHubRepoResponse): ProjectSignals {
    const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
    const desc = (repo.description ?? '').toLowerCase();

    const hasDocker =
      topics.some((t) => ['docker', 'dockerfile', 'container', 'containers'].includes(t)) ||
      /docker|containerized|containerisation/.test(desc);

    const hasCICD =
      topics.some((t) =>
        ['ci', 'cd', 'github-actions', 'jenkins', 'circleci', 'travis', 'gitlab-ci'].includes(t)
      ) || /ci\/cd|pipeline|continuous integration|continuous deployment/.test(desc);

    const hasTests =
      topics.some((t) =>
        ['testing', 'jest', 'pytest', 'coverage', 'unit-testing', 'tdd', 'bdd'].includes(t)
      ) || /\btest[s]?\b|\btdd\b|\bcoverage\b/.test(desc);

    const isMonorepo =
      topics.some((t) => ['monorepo', 'nx', 'turborepo', 'lerna', 'pnpm-workspace'].includes(t)) ||
      /monorepo/.test(desc);

    const deploymentMaturity: ProjectSignals['deploymentMaturity'] =
      repo.homepage || repo.has_pages
        ? 'production'
        : hasDocker || hasCICD
        ? 'basic'
        : 'none';

    return { hasDocker, hasCICD, hasTests, isMonorepo, deploymentMaturity };
  }

  async fetchRepoLanguages(accessToken: string, fullName: string): Promise<GitHubLanguagesResponse> {
    return this.request<GitHubLanguagesResponse>({
      accessToken,
      path: `/repos/${fullName}/languages`,
    });
  }

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
      if (err instanceof GitHubApiError && err.ghStatusCode === 409) return [];
      throw err;
    }
  }

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
      if (err instanceof GitHubApiError && (err.ghStatusCode === 403 || err.ghStatusCode === 404)) {
        return [];
      }
      throw err;
    }
  }

  // -------------------------------------------------------
  // Lightweight Repo Ingestion (replaces ingestRepository)
  // -------------------------------------------------------

  /**
   * Ingest a single repo with high-signal metadata only.
   * Deployment detection is heuristic-only (no extra API call).
   * Commits are capped at MAX_COMMITS_PER_REPO for behavioral signals.
   * All sub-fetches run in parallel.
   */
  async ingestLightweightRepository(
    accessToken: string,
    repoResponse: GitHubRepoResponse,
    ownerLogin: string
  ): Promise<RepoIngestionData> {
    const fullName = repoResponse.full_name;
    logger.info({ repo: fullName }, 'Ingesting repository (lightweight)');

    const projectSignals = this.detectProjectSignals(repoResponse);

    const [langResult, commitResult, contribResult] = await Promise.allSettled([
      this.fetchRepoLanguages(accessToken, fullName),
      this.fetchRepoCommits(accessToken, fullName, ownerLogin),
      this.fetchRepoContributors(accessToken, fullName),
    ]);

    if (langResult.status === 'rejected')
      logger.warn({ repo: fullName, err: langResult.reason }, 'Language fetch failed');
    if (commitResult.status === 'rejected')
      logger.warn({ repo: fullName, err: commitResult.reason }, 'Commit fetch failed');
    if (contribResult.status === 'rejected')
      logger.warn({ repo: fullName, err: contribResult.reason }, 'Contributor fetch failed');

    const rawLanguages = langResult.status === 'fulfilled' ? langResult.value : {};
    const rawCommits   = commitResult.status === 'fulfilled' ? commitResult.value : [];
    const rawContributors = contribResult.status === 'fulfilled' ? contribResult.value : [];

    const hasDeployment = projectSignals.deploymentMaturity !== 'none';

    return {
      repo: this.normalizeRepo(repoResponse, hasDeployment),
      languages: this.normalizeLanguages(rawLanguages),
      commits: this.normalizeCommits(rawCommits),
      contributors: this.normalizeContributors(rawContributors),
      projectSignals,
    };
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
        percentage: Math.round((bytes / total) * 10000) / 100,
        color: LANGUAGE_COLORS[language] || '#6e7681',
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }

  normalizeCommits(raw: GitHubCommitResponse[]): NormalizedCommit[] {
    return raw.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0].slice(0, 200),
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

  getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
