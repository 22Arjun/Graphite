import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Hexagon,
  Github,
  Wallet,
  TrendingUp,
  Sparkles,
  Copy,
  Loader2,
  Linkedin,
  Twitter,
  Trophy,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import ReputationRadar from '@/components/ReputationRadar';
import ScoreRing from '@/components/ScoreRing';
import DimensionBar from '@/components/DimensionBar';
import SkillTagCloud from '@/components/SkillTagCloud';
import { api } from '@/lib/api';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5 },
  }),
};

const EMPTY_BUILDER = {
  display_name: '',
  wallet_address: '',
  github_username: null as string | null,
  bio: null as string | null,
  ai_summary: null as string | null,
  updated_at: null as string | null,
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
    updated_at: apiData.updatedAt ?? null,
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

const Profile: React.FC = () => {
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['builderProfile'],
    queryFn: async () => {
      const response: any = await api.get('/builder/profile');
      return response.data;
    },
    retry: false,
  });

  const builder = mapBuilderData(apiData) ?? EMPTY_BUILDER;
  const [copied, setCopied] = React.useState(false);

  const copyWallet = () => {
    navigator.clipboard.writeText(builder.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {/* Page header */}
        <motion.div custom={0} variants={fadeIn} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-foreground">Builder Profile</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete reputation intelligence and builder analysis.
          </p>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Syncing live data...</span>
            </div>
          )}
        </motion.div>

        {/* Profile header card */}
        <motion.div custom={1} variants={fadeIn} className="graphite-card p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar & name */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border-2 border-primary/20">
                {(builder.display_name || builder.github_username || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {builder.display_name || builder.github_username || 'Unnamed Builder'}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  {builder.github_username && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Github className="h-3 w-3" />
                      @{builder.github_username}
                    </span>
                  )}
                  {builder.wallet_address && (
                    <button
                      onClick={copyWallet}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Wallet className="h-3 w-3" />
                      {builder.wallet_address.slice(0, 6)}...{builder.wallet_address.slice(-4)}
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {copied && <span className="text-[10px] text-primary">Copied</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-2 max-w-md">
                  {builder.bio || 'No bio set.'}
                </p>
                {/* Source badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {builder.connected_sources.github && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <Github className="h-2.5 w-2.5" />GitHub
                    </span>
                  )}
                  {builder.connected_sources.linkedin && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                      <Linkedin className="h-2.5 w-2.5" />LinkedIn
                    </span>
                  )}
                  {builder.connected_sources.twitter && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                      <Twitter className="h-2.5 w-2.5" />Twitter
                    </span>
                  )}
                  {builder.connected_sources.hackathons > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                      <Trophy className="h-2.5 w-2.5" />{builder.connected_sources.hackathons} Hackathon{builder.connected_sources.hackathons > 1 ? 's' : ''}
                    </span>
                  )}
                  {builder.connected_sources.resume && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                      <FileText className="h-2.5 w-2.5" />Resume
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex gap-6 md:ml-auto">
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-foreground">{builder.github_stats.total_repos}</div>
                <div className="text-[10px] text-muted-foreground">Repos</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-foreground">{builder.github_stats.total_stars}</div>
                <div className="text-[10px] text-muted-foreground">Stars</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-foreground">{builder.github_stats.total_forks}</div>
                <div className="text-[10px] text-muted-foreground">Forks</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-foreground">{builder.github_stats.total_commits.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">Commits</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - AI Summary & Radar */}
          <motion.div custom={2} variants={fadeIn} className="lg:col-span-1 space-y-6">
            {/* Overall Score */}
            <div className="graphite-card p-6 flex flex-col items-center">
              <ScoreRing score={builder.reputation.overall_score} size={160} strokeWidth={10} />
              <h3 className="text-sm font-semibold text-foreground mt-4">Overall Reputation</h3>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {builder.reputation.signal_count > 0
                  ? `Based on ${Object.values(builder.connected_sources).filter(Boolean).length} sources · ${builder.reputation.signal_count} signals`
                  : 'Run analysis to compute score'}
              </p>
            </div>

            {/* Radar */}
            <div className="graphite-card p-6 flex flex-col items-center">
              <h3 className="text-sm font-semibold text-foreground mb-4">Dimension Radar</h3>
              <ReputationRadar dimensions={builder.reputation.dimensions} size={240} />
            </div>

            {/* Skills */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Inferred Skills</h3>
              <SkillTagCloud tags={builder.skill_tags} />
            </div>
          </motion.div>

          {/* Right column - Dimensions & AI Summary */}
          <motion.div custom={3} variants={fadeIn} className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            <div className="graphite-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">AI Builder Summary</h3>
              </div>
              {builder.ai_summary ? (
                <p className="text-sm text-secondary-foreground leading-relaxed">
                  {builder.ai_summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground/50 italic">
                  AI summary will appear here after your repositories are analyzed.
                </p>
              )}
              {builder.updated_at && (
                <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground/50">
                  <span className="font-mono">AI-generated</span>
                  <span>|</span>
                  <span>Updated {new Date(builder.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Dimension breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Reputation Dimensions</h3>
              {builder.reputation.dimensions.length > 0 ? (
                <div className="space-y-3">
                  {builder.reputation.dimensions.map((dim: any) => (
                    <DimensionBar key={dim.dimension} dimension={dim} />
                  ))}
                </div>
              ) : (
                <div className="graphite-card p-5 text-center text-xs text-muted-foreground/50">
                  Sync your GitHub and run analysis to see your reputation breakdown.
                </div>
              )}
            </div>

            {/* Language distribution */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Language Distribution</h3>
              {/* Language bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3 mb-4">
                {builder.github_stats.top_languages.map((lang) => (
                  <div
                    key={lang.language}
                    className="h-full"
                    style={{
                      width: `${lang.percentage}%`,
                      backgroundColor: lang.color,
                    }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {builder.github_stats.top_languages.map((lang) => (
                  <div key={lang.language} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lang.color }}
                    />
                    <span className="text-xs text-foreground">{lang.language}</span>
                    <span className="text-xs font-mono text-muted-foreground ml-auto">
                      {lang.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Profile;
