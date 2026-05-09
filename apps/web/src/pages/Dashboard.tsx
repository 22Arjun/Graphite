import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GitBranch,
  Star,
  GitFork,
  Code2,
  TrendingUp,
  ArrowRight,
  Hexagon,
  Sparkles,
  Clock,
} from 'lucide-react';
import { MOCK_BUILDER, MOCK_ACTIVITY, MOCK_JOBS } from '@/lib/mock-data';
import ReputationRadar from '@/components/ReputationRadar';
import ScoreRing from '@/components/ScoreRing';
import ActivityTimeline from '@/components/ActivityTimeline';
import SkillTagCloud from '@/components/SkillTagCloud';
import { Progress } from '@/components/ui/progress';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const Dashboard: React.FC = () => {
  const builder = MOCK_BUILDER;

  const stats = [
    { label: 'Repositories', value: builder.github_stats.total_repos, icon: GitBranch, change: '+3' },
    { label: 'Total Stars', value: builder.github_stats.total_stars, icon: Star, change: '+28' },
    { label: 'Total Forks', value: builder.github_stats.total_forks, icon: GitFork, change: '+12' },
    { label: 'Total Commits', value: builder.github_stats.total_commits.toLocaleString(), icon: Code2, change: '+142' },
  ];

  const activeJobs = MOCK_JOBS.filter((j) => j.status === 'processing' || j.status === 'queued');

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

        {/* Active jobs banner */}
        {activeJobs.length > 0 && (
          <motion.div custom={1} variants={fadeIn} className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-foreground">Analysis in progress</span>
            </div>
            {activeJobs.map((job) => (
              <div key={job.id} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="capitalize">{job.type.replace(/_/g, ' ')}</span>
                  <span className="font-mono">{job.progress}%</span>
                </div>
                <Progress value={job.progress} className="h-1.5" />
              </div>
            ))}
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
                  {builder.display_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{builder.display_name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    @{builder.github_username}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {builder.bio}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground/60 font-mono">
                <span>{builder.wallet_address.slice(0, 4)}...{builder.wallet_address.slice(-4)}</span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-2.5 w-2.5 text-primary" />
                  {builder.github_stats.contribution_streak}d streak
                </span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="graphite-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'View full profile', path: '/profile', icon: '→' },
                  { label: 'Analyze repositories', path: '/repositories', icon: '→' },
                  { label: 'Explore collaboration graph', path: '/graph', icon: '→' },
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
              <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
              <ActivityTimeline events={MOCK_ACTIVITY} maxEvents={5} />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
