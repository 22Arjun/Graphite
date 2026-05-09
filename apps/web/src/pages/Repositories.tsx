import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Search, Filter, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { MOCK_REPOSITORIES } from '@/lib/mock-data';
import RepoCard from '@/components/RepoCard';
import type { AnalysisStatus } from '@/lib/types';

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

const Repositories: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | 'all'>('all');

  const repos = MOCK_REPOSITORIES.filter((repo) => {
    const matchesSearch =
      !search ||
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || repo.analysis_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: MOCK_REPOSITORIES.length,
    completed: MOCK_REPOSITORIES.filter((r) => r.analysis_status === 'completed').length,
    analyzing: MOCK_REPOSITORIES.filter((r) => r.analysis_status === 'analyzing').length,
    pending: MOCK_REPOSITORIES.filter((r) => r.analysis_status === 'pending').length,
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
          <div className="flex items-center gap-3 mb-1">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-foreground">Repositories</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            GitHub repositories ingested for AI analysis. Each repo contributes to your reputation profile.
          </p>
        </motion.div>

        {/* Pipeline status */}
        <motion.div custom={1} variants={fadeIn} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Repos', value: MOCK_REPOSITORIES.length, icon: Hexagon, color: 'text-foreground' },
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
              <RepoCard repo={repo} onAnalyze={(id) => console.log('Analyze:', id)} />
            </motion.div>
          ))}
        </div>

        {repos.length === 0 && (
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
