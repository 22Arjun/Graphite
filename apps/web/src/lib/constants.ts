// ============================================================
// Graphite Constants
// ============================================================

export const APP_NAME = 'Graphite';
export const APP_TAGLINE = 'Builder Reputation Graph';
export const APP_DESCRIPTION = 'AI-powered multidimensional builder intelligence from fragmented developer signals.';

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Profile', path: '/profile', icon: 'User' },
  { label: 'Repositories', path: '/repositories', icon: 'GitBranch' },
  { label: 'Graph', path: '/graph', icon: 'Share2' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
] as const;

export const ANALYSIS_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'muted-foreground' },
  ingesting: { label: 'Ingesting', color: 'accent' },
  analyzing: { label: 'Analyzing', color: 'node-secondary' },
  completed: { label: 'Completed', color: 'primary' },
  failed: { label: 'Failed', color: 'destructive' },
} as const;

export const DIMENSION_COLORS: Record<string, string> = {
  technical_depth: 'hsl(160 84% 39%)',
  execution_ability: 'hsl(200 80% 55%)',
  collaboration_quality: 'hsl(38 92% 50%)',
  consistency: 'hsl(280 65% 60%)',
  innovation: 'hsl(340 75% 55%)',
};

export const LANGUAGE_COLORS: Record<string, string> = {
  Rust: '#dea584',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Solidity: '#AA6746',
  Go: '#00ADD8',
  C: '#555555',
  'C++': '#f34b7d',
  Java: '#b07219',
  Other: '#6e7681',
};
