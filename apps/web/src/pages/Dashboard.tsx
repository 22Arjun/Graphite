import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  Star,
  GitFork,
  Code2,
  TrendingUp,
  ArrowRight,
  Hexagon,
  Sparkles,
  Loader2,
  Github,
  Play,
  Linkedin,
  Twitter,
  Trophy,
  FileText,
  Zap,
} from 'lucide-react';
import ReputationRadar from '@/components/ReputationRadar';
import ScoreRing from '@/components/ScoreRing';
import SkillTagCloud from '@/components/SkillTagCloud';
import { Button } from '@/components/ui/button';
import { api, ingestionApi } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const EMPTY_BUILDER = {
  display_name: '',
  wallet_address: '',
  github_username: null as string | null,
  bio: null as string | null,
  ai_summary: null as string | null,
  skill_tags: [] as any[],
  reputation: { overall_score: 0, signal_count: 0, dimensions: [] as any[] },
  github_stats: {
    total_repos: 0, total_stars: 0, total_forks: 0, total_commits: 0,
    top_languages: [] as any[],
  },
};

function mapBuilderData(apiData: any) {
  if (!apiData) return null;
  return {
    display_name: apiData.displayName || apiData.githubProfile?.name || apiData.githubProfile?.username || '',
    wallet_address: apiData.walletAddress ?? '',
    github_username: apiData.githubProfile?.username ?? null,
    bio: apiData.bio ?? null,
    ai_summary: apiData.aiSummary ?? null,
    skill_tags: (apiData.skillTags ?? []).map((t: any) => ({
      name: t.name,
      category: t.category?.toLowerCase() ?? 'language',
      confidence: t.confidence,
      inferred_from: t.inferredFrom ?? [],
    })),
    reputation: {
      overall_score: apiData.reputation?.overallScore ?? 0,
      signal_count: apiData.reputation?.signalCount ?? 0,
      dimensions: (apiData.reputation?.dimensions ?? []).map((d: any) => ({
        dimension: d.dimension?.toLowerCase(),
        score: d.score,
        confidence: d.confidence,
        signals: d.signals ?? [],
        trend: d.trend?.toLowerCase() ?? 'stable',
      })),
    },
    github_stats: {
      total_repos: apiData.githubStats?.totalRepos ?? 0,
      total_stars: apiData.githubStats?.totalStars ?? 0,
      total_forks: apiData.githubStats?.totalForks ?? 0,
      total_commits: apiData.githubStats?.totalCommits ?? 0,
      top_languages: apiData.githubStats?.topLanguages ?? [],
    },
    connected_sources: {
      github: !!(apiData.connectedSources?.github ?? apiData.githubProfile),
      linkedin: !!(apiData.connectedSources?.linkedin),
      twitter: !!(apiData.connectedSources?.twitter),
      hackathons: apiData.connectedSources?.hackathons ?? 0,
      resume: !!(apiData.connectedSources?.resume),
    },
  };
}

const Dashboard: React.FC = () => {
  const { builder: authBuilder, connectGitHub } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [isSyncing, setIsSyncing] = React.useState(false);
  // Timestamp captured when user triggers sync — used to detect when lastSyncedAt advances past it
  const [syncTriggeredAt, setSyncTriggeredAt] = React.useState<number | null>(null);

  // Show GitHub connected toast after OAuth redirect
  React.useEffect(() => {
    if (searchParams.get('github') === 'connected') {
      toast({ title: 'GitHub connected', description: 'Your GitHub account has been linked.' });
    }
  }, []);

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['builderProfile'],
    queryFn: async () => {
      const response: any = await api.get('/builder/profile');
      return response.data;
    },
    // Poll every 4s while sync is in flight; stop once lastSyncedAt advances past trigger time
    refetchInterval: isSyncing ? 4000 : false,
    retry: false,
  });

  // Detect sync completion: backend updates lastSyncedAt only after scoring is done
  React.useEffect(() => {
    if (!isSyncing || !syncTriggeredAt || !apiData?.githubProfile?.lastSyncedAt) return;
    const serverSyncedAt = new Date(apiData.githubProfile.lastSyncedAt).getTime();
    if (serverSyncedAt >= syncTriggeredAt) {
      setIsSyncing(false);
      setSyncTriggeredAt(null);
      toast({ title: 'Sync complete', description: 'Reputation scores have been updated.' });
    }
  }, [apiData?.githubProfile?.lastSyncedAt, isSyncing, syncTriggeredAt]);

  // Safety timeout: stop polling after 3 minutes regardless
  React.useEffect(() => {
    if (!isSyncing) return;
    const t = setTimeout(() => { setIsSyncing(false); setSyncTriggeredAt(null); }, 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [isSyncing]);

  const triggerIngestion = useMutation({
    mutationFn: () => ingestionApi.trigger(),
    onSuccess: () => {
      setSyncTriggeredAt(Date.now());
      setIsSyncing(true);
      toast({ title: 'Sync started', description: 'Analyzing your GitHub repos. Scores will appear shortly.' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Failed to start sync';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const builder = mapBuilderData(apiData) ?? EMPTY_BUILDER;

  const stats = [
    { label: 'Repositories', value: builder.github_stats.total_repos, icon: GitBranch, change: '' },
    { label: 'Total Stars', value: builder.github_stats.total_stars, icon: Star, change: '' },
    { label: 'Total Forks', value: builder.github_stats.total_forks, icon: GitFork, change: '' },
    { label: 'Commits', value: builder.github_stats.total_commits.toLocaleString(), icon: Code2, change: '' },
  ];

  const githubConnected = authBuilder?.githubConnected ?? apiData?.githubProfile != null;

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      >
        <motion.div custom={0} variants={fadeIn} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Overview of your builder intelligence and reputation signals.
          </p>
        </motion.div>

        {/* Loading indicator (subtle, doesn't change layout) */}
        {isLoading && (
          <motion.div custom={0.5} variants={fadeIn} className="mb-4 flex items-center gap-2 text-xs text-muted-foreground/60">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Syncing live data...</span>
          </motion.div>
        )}

        {/* GitHub connect banner (shown if GitHub not connected) */}
        {!githubConnected && (
          <motion.div custom={1} variants={fadeIn} className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Connect GitHub to unlock reputation analysis</p>
              <p className="text-xs text-muted-foreground mt-0.5">Link your GitHub account to ingest repositories and generate intelligence.</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={connectGitHub}>
              <Github className="h-4 w-4 mr-2" />
              Connect GitHub
            </Button>
          </motion.div>
        )}

        {/* Syncing banner */}
        {isSyncing && (
          <motion.div custom={1} variants={fadeIn} className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            <p className="text-sm text-foreground">Analyzing your GitHub repos — scores will update shortly.</p>
          </motion.div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i + 2}
              variants={fadeIn}
              className="graphite-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-mono text-primary">{stat.change}</span>
              </div>
              <div className="text-xl font-bold font-mono text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Reputation */}
          <motion.div custom={6} variants={fadeIn} className="lg:col-span-2 space-y-6">
            {/* Reputation overview */}
            <div className="graphite-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Reputation Intelligence
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Based on {builder.reputation.signal_count} analyzed signals
                  </p>
                </div>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-emerald-glow transition-colors"
                >
                  Full profile <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex flex-col items-center gap-4">
                  <ScoreRing score={builder.reputation.overall_score} size={140} strokeWidth={10} label="Overall Score" />
                </div>
                <div className="flex-1 flex justify-center">
                  <ReputationRadar dimensions={builder.reputation.dimensions} size={260} />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Inferred Skills</h3>
              <SkillTagCloud tags={builder.skill_tags} />
            </div>

            {/* Language distribution */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Language Distribution</h3>
              <div className="space-y-3">
                {builder.github_stats.top_languages.map((lang) => (
                  <div key={lang.language} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: lang.color }}
                    />
                    <span className="text-xs text-foreground w-20 shrink-0">{lang.language}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                      {lang.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right column - Activity & Quick actions */}
          <motion.div custom={7} variants={fadeIn} className="space-y-6">
            {/* Builder card */}
            <div className="graphite-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {(builder.display_name || builder.github_username || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {builder.display_name || builder.github_username || 'Unnamed Builder'}
                  </h3>
                  {builder.github_username && (
                    <p className="text-xs text-muted-foreground font-mono">
                      @{builder.github_username}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {builder.bio || 'No bio set.'}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground/60 font-mono">
                {builder.wallet_address && (
                  <span>{builder.wallet_address.slice(0, 4)}...{builder.wallet_address.slice(-4)}</span>
                )}
                {builder.github_stats.total_commits > 0 && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5 text-primary" />
                    {builder.github_stats.total_commits.toLocaleString()} commits
                  </span>
                )}
              </div>
            </div>

            {/* Boost Your Score */}
            {apiData && (
              <div className="graphite-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    Boost Your Score
                  </h3>
                  <span className="text-xs font-mono text-primary">
                    {[
                      builder.connected_sources.github,
                      builder.connected_sources.linkedin,
                      builder.connected_sources.twitter,
                      builder.connected_sources.hackathons > 0,
                      builder.connected_sources.resume,
                    ].filter(Boolean).length} / 5
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">Connect more sources for higher accuracy and confidence.</p>
                <div className="flex gap-1 mb-3">
                  {[
                    { key: 'github', color: 'bg-emerald-500' },
                    { key: 'linkedin', color: 'bg-blue-500' },
                    { key: 'twitter', color: 'bg-sky-500' },
                    { key: 'hackathons', color: 'bg-yellow-500' },
                    { key: 'resume', color: 'bg-purple-500' },
                  ].map((s) => {
                    const active = s.key === 'hackathons' ? builder.connected_sources.hackathons > 0 : !!(builder.connected_sources as any)[s.key];
                    return <div key={s.key} className={`flex-1 h-1.5 rounded-full ${active ? s.color : 'bg-surface-3'}`} />;
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!builder.connected_sources.linkedin && (
                    <Link to="/settings" className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/5 px-2.5 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                      <Linkedin className="h-2.5 w-2.5" />+ LinkedIn
                    </Link>
                  )}
                  {!builder.connected_sources.twitter && (
                    <Link to="/settings" className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/5 px-2.5 py-1 text-[10px] font-medium text-sky-400 hover:bg-sky-500/10 transition-colors">
                      <Twitter className="h-2.5 w-2.5" />+ Twitter
                    </Link>
                  )}
                  {builder.connected_sources.hackathons === 0 && (
                    <Link to="/settings" className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/5 px-2.5 py-1 text-[10px] font-medium text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                      <Trophy className="h-2.5 w-2.5" />+ Hackathons
                    </Link>
                  )}
                  {!builder.connected_sources.resume && (
                    <Link to="/settings" className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/5 px-2.5 py-1 text-[10px] font-medium text-purple-400 hover:bg-purple-500/10 transition-colors">
                      <FileText className="h-2.5 w-2.5" />+ Resume
                    </Link>
                  )}
                  {[
                    builder.connected_sources.linkedin,
                    builder.connected_sources.twitter,
                    builder.connected_sources.hackathons > 0,
                    builder.connected_sources.resume,
                  ].every(Boolean) && (
                    <p className="text-[10px] text-primary">All sources connected!</p>
                  )}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {githubConnected && (
                  <button
                    onClick={() => triggerIngestion.mutate()}
                    disabled={triggerIngestion.isPending || isSyncing}
                    className="w-full flex items-center justify-between rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-1.5">
                      <Play className="h-3 w-3" />
                      {isSyncing ? 'Analyzing...' : 'Sync & Analyze GitHub'}
                    </span>
                    {isSyncing
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ArrowRight className="h-3 w-3" />}
                  </button>
                )}
                {[
                  { label: 'View full profile', path: '/profile' },
                  { label: 'Browse repositories', path: '/repositories' },
                  { label: 'Explore collaboration graph', path: '/graph' },
                ].map((action) => (
                  <Link
                    key={action.path}
                    to={action.path}
                    className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-surface-3 hover:text-foreground transition-colors group"
                  >
                    {action.label}
                    <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Activity feed */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
              {builder.github_stats.total_repos > 0 ? (
                <div className="space-y-2">
                  {builder.github_stats.top_languages.slice(0, 3).map((lang: any) => (
                    <div key={lang.language} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lang.color }} />
                        <span className="text-foreground">{lang.language}</span>
                      </span>
                      <span className="font-mono text-muted-foreground">{lang.percentage}%</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground/50 pt-1">
                    {builder.github_stats.total_repos} repos · {builder.github_stats.total_commits.toLocaleString()} commits synced
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50">
                  No activity yet — sync your GitHub to see data here.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
