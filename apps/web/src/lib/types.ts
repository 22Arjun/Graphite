// ============================================================
// Graphite Core Types - Builder Reputation Graph
// ============================================================

// --- Reputation Dimensions ---
export type ReputationDimension =
  | 'technical_depth'
  | 'execution_ability'
  | 'collaboration_quality'
  | 'consistency'
  | 'innovation';

export interface DimensionScore {
  dimension: ReputationDimension;
  score: number; // 0-100
  confidence: number; // 0-1
  signals: string[];
  trend: 'rising' | 'stable' | 'declining';
}

export interface ReputationProfile {
  overall_score: number;
  dimensions: DimensionScore[];
  last_computed: string;
  signal_count: number;
}

// --- Connected Sources ---
export interface ConnectedSources {
  github: boolean;
  linkedin: boolean;
  twitter: boolean;
  hackathons: number;
  resume: boolean;
}

// --- Builder Profile ---
export interface BuilderProfile {
  id: string;
  wallet_address: string;
  github_username: string | null;
  github_avatar: string | null;
  display_name: string;
  bio: string | null;
  ai_summary: string;
  skill_tags: SkillTag[];
  reputation: ReputationProfile;
  github_stats: GitHubStats;
  connected_sources: ConnectedSources;
  analysis_status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

export interface SkillTag {
  name: string;
  category: 'language' | 'framework' | 'domain' | 'pattern' | 'tool';
  confidence: number;
  inferred_from: string[];
}

export interface GitHubStats {
  total_repos: number;
  total_stars: number;
  total_forks: number;
  total_commits: number;
  top_languages: LanguageStat[];
  contribution_streak: number;
  active_days_last_year: number;
}

export interface LanguageStat {
  language: string;
  percentage: number;
  bytes: number;
  color: string;
}

// --- Repository ---
export type AnalysisStatus = 'pending' | 'ingesting' | 'analyzing' | 'completed' | 'failed';

export interface Repository {
  id: string;
  github_id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  homepage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  language: string | null;
  languages: Record<string, number>;
  topics: string[];
  is_fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  analysis_status: AnalysisStatus;
  analysis?: RepositoryAnalysis;
}

export interface RepositoryAnalysis {
  id: string;
  repo_id: string;
  architecture_complexity: number; // 1-10
  code_quality_signals: number; // 1-10
  execution_maturity: number; // 1-10
  originality_score: number; // 1-10
  inferred_skills: string[];
  probable_domains: string[];
  builder_summary: string;
  key_patterns: string[];
  deployment_detected: boolean;
  test_coverage_signals: 'none' | 'minimal' | 'moderate' | 'comprehensive';
  analyzed_at: string;
}

// --- Collaboration Graph ---
export interface GraphNode {
  id: string;
  label: string;
  type: 'builder' | 'repository' | 'organization' | 'skill';
  avatar?: string;
  score?: number;
  size?: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: 'collaborated' | 'contributed' | 'forked' | 'starred' | 'skill_match';
  label?: string;
}

export interface CollaborationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
}

export interface GraphCluster {
  id: string;
  label: string;
  node_ids: string[];
  dominant_skill?: string;
}

// --- Collaborator Recommendation ---
export interface CollaboratorRecommendation {
  builder: BuilderProfile;
  match_score: number;
  reasons: string[];
  complementary_skills: string[];
  shared_interests: string[];
}

// --- Activity / Timeline ---
export interface ActivityEvent {
  id: string;
  type: 'repo_analyzed' | 'profile_updated' | 'github_connected' | 'reputation_computed' | 'collaborator_found';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// --- Analysis Job ---
export interface AnalysisJob {
  id: string;
  builder_id: string;
  type: 'github_ingest' | 'repo_analysis' | 'reputation_compute' | 'graph_build';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  started_at: string | null;
  completed_at: string | null;
  error?: string;
}
