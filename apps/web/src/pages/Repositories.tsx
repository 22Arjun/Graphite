import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hexagon, Search, RefreshCw, CheckCircle2, Clock, AlertCircle, Loader2, Play } from 'lucide-react';
import RepoCard from '@/components/RepoCard';
import type { AnalysisStatus } from '@/lib/types';
import { api, ingestionApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5 },
  }),
};

const statusFilters: { label: string; value: AnalysisStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Analyzing', value: 'analyzing' },
  { label: 'Pending', value: 'pending' },
];

// Map API repository data to mock-compatible shape
function mapRepoData(apiRepo: any) {
  return {
    id: apiRepo.id,
    github_id: apiRepo.githubId ?? 0,
    name: apiRepo.name,
    full_name: apiRepo.fullName ?? apiRepo.name,
    description: apiRepo.description ?? null,
    url: apiRepo.url ?? '#',
    homepage: apiRepo.homepage ?? null,
    stars: apiRepo.stars ?? 0,
    forks: apiRepo.forks ?? 0,
    watchers: apiRepo.watchers ?? 0,
    language: apiRepo.primaryLanguage ?? null,
    // Convert API languages array to object
    languages: Array.isArray(apiRepo.languages)
      ? apiRepo.languages.reduce((acc: any, l: any) => {
          acc[l.language] = l.bytes;
          return acc;
        }, {})
      : {},
    topics: apiRepo.topics ?? [],
    is_fork: apiRepo.isFork ?? false,
    created_at: apiRepo.createdAt ?? '',
    updated_at: apiRepo.updatedAt ?? '',
    pushed_at: apiRepo.pushedAt ?? '',
    analysis_status: apiRepo.analysisStatus?.toLowerCase() ?? 'pending',
    analysis: apiRepo.analysis
      ? {
          id: apiRepo.analysis.id ?? '',
          repo_id: apiRepo.id,
          architecture_complexity: apiRepo.analysis.architectureComplexity ?? 0,
          code_quality_signals: apiRepo.analysis.codeQualitySignals ?? 0,
          execution_maturity: apiRepo.analysis.executionMaturity ?? 0,
          originality_score: apiRepo.analysis.originalityScore ?? 0,
          inferred_skills: apiRepo.analysis.inferredSkills ?? [],
          probable_domains: apiRepo.analysis.probableDomains ?? [],
          builder_summary: apiRepo.analysis.builderSummary ?? '',
          key_patterns: apiRepo.analysis.keyPatterns ?? [],
          deployment_detected: apiRepo.analysis.deploymentDetected ?? false,
          test_coverage_signals: apiRepo.analysis.testCoverageSignals ?? 'none',
          analyzed_at: apiRepo.analysis.analyzedAt ?? '',
        }
      : undefined,
  };
}

const Repositories: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | 'all'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeRepo = useMutation({
    mutationFn: (_repoId: string) => ingestionApi.trigger(),
    onSuccess: () => {
      toast({ title: 'Sync started', description: 'Re-analyzing your GitHub repos. Scores will update shortly.' });
    },
    onError: () => {
      toast({ title: 'Failed to start sync', variant: 'destructive' });
    },
  });

  const analyzeAll = useMutation({
    mutationFn: () => ingestionApi.trigger(),
    onSuccess: () => {
      toast({ title: 'Sync started', description: 'Re-analyzing your GitHub repos. Scores will update shortly.' });
    },
    onError: () => {
      toast({ title: 'Failed to start sync', variant: 'destructive' });
    },
  });

  const { data: apiRepos, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: async () => {
      const response: any = await api.get('/builder/repositories?limit=100');
      return response.data ?? [];
    },
    retry: false,
  });

  const allRepos = Array.isArray(apiRepos) ? apiRepos.map(mapRepoData) : [];

  const repos = allRepos.filter((repo) => {
    const matchesSearch =
      !search ||
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || repo.analysis_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: allRepos.length,
    completed: allRepos.filter((r) => r.analysis_status === 'completed').length,
    analyzing: allRepos.filter((r) => r.analysis_status === 'analyzing').length,
    pending: allRepos.filter((r) => r.analysis_status === 'pending').length,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* Header */}
        <motion.div custom={0} variants={fadeIn} className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                <h1 className="text-xl font-bold text-foreground">Repositories</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                GitHub repositories ingested for AI analysis. Each repo contributes to your reputation profile.
              </p>
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Syncing live data...</span>
                </div>
              )}
            </div>
            {statusCounts.pending + statusCounts.analyzing > 0 || allRepos.some(r => r.analysis_status === 'failed') ? (
              <button
                onClick={() => analyzeAll.mutate()}
                disabled={analyzeAll.isPending}
                className="shrink-0 flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {analyzeAll.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Play className="h-3 w-3" />}
                Re-analyze All
              </button>
            ) : null}
          </div>
        </motion.div>

        {/* Pipeline status */}
        <motion.div custom={1} variants={fadeIn} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Repos', value: allRepos.length, icon: Hexagon, color: 'text-foreground' },
            { label: 'Analyzed', value: statusCounts.completed, icon: CheckCircle2, color: 'text-primary' },
            { label: 'In Progress', value: statusCounts.analyzing, icon: RefreshCw, color: 'text-node-secondary' },
            { label: 'Pending', value: statusCounts.pending, icon: Clock, color: 'text-muted-foreground' },
          ].map((stat) => (
            <div key={stat.label} className="graphite-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div custom={2} variants={fadeIn} className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-1 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all"
            />
          </div>
          <div className="flex gap-1">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === filter.value
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-transparent'
                }`}
              >
                {filter.label}
                <span className="ml-1 font-mono opacity-60">
                  {statusCounts[filter.value as keyof typeof statusCounts] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Repo grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {repos.map((repo, i) => (
            <motion.div
              key={repo.id}
              custom={i + 3}
              variants={fadeIn}
            >
              <RepoCard repo={repo} onAnalyze={(id) => analyzeRepo.mutate(id)} />
            </motion.div>
          ))}
        </div>

        {!isLoading && allRepos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No repositories found</p>
            <p className="text-xs text-muted-foreground">
              Connect your GitHub and click "Sync &amp; Analyze" on the dashboard to ingest your repos.
            </p>
          </div>
        )}
        {!isLoading && allRepos.length > 0 && repos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No repositories match your filters.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Repositories;
