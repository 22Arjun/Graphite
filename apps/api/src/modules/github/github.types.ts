// ============================================================
// GitHub Service Types — Internal representations
// ============================================================

export interface NormalizedRepo {
  githubId: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  homepage: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  size: number;
  defaultBranch: string;
  primaryLanguage: string | null;
  topics: string[];
  licenseName: string | null;
  hasDeployment: boolean;
  pushedAt: Date | null;
  repoCreatedAt: Date;
  repoUpdatedAt: Date;
}

export interface NormalizedLanguage {
  language: string;
  bytes: number;
  percentage: number;
  color: string;
}

export interface NormalizedCommit {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorEmail: string | null;
  additions: number;
  deletions: number;
  committedAt: Date;
}

export interface NormalizedContributor {
  githubLogin: string;
  githubId: number;
  avatarUrl: string | null;
  contributions: number;
}

export interface RepoIngestionData {
  repo: NormalizedRepo;
  languages: NormalizedLanguage[];
  commits: NormalizedCommit[];
  contributors: NormalizedContributor[];
}

// Language color map for common languages
export const LANGUAGE_COLORS: Record<string, string> = {
  Rust: '#dea584',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Solidity: '#AA6746',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  PHP: '#4F5D95',
  Scala: '#c22d40',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};
