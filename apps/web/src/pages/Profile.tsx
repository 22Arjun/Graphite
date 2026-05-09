import React from 'react';
import { motion } from 'framer-motion';
import {
  Hexagon,
  Github,
  Wallet,
  Calendar,
  TrendingUp,
  ExternalLink,
  Sparkles,
  Copy,
} from 'lucide-react';
import { MOCK_BUILDER } from '@/lib/mock-data';
import ReputationRadar from '@/components/ReputationRadar';
import ScoreRing from '@/components/ScoreRing';
import DimensionBar from '@/components/DimensionBar';
import SkillTagCloud from '@/components/SkillTagCloud';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5 },
  }),
};

const Profile: React.FC = () => {
  const builder = MOCK_BUILDER;
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
        </motion.div>

        {/* Profile header card */}
        <motion.div custom={1} variants={fadeIn} className="graphite-card p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar & name */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary border-2 border-primary/20">
                {builder.display_name.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{builder.display_name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Github className="h-3 w-3" />
                    @{builder.github_username}
                  </span>
                  <button
                    onClick={copyWallet}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Wallet className="h-3 w-3" />
                    {builder.wallet_address.slice(0, 6)}...{builder.wallet_address.slice(-4)}
                    <Copy className="h-2.5 w-2.5" />
                  </button>
                  {copied && <span className="text-[10px] text-primary">Copied</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-2 max-w-md">{builder.bio}</p>
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
                <div className="text-xl font-bold font-mono text-foreground">{builder.github_stats.contribution_streak}</div>
                <div className="text-[10px] text-muted-foreground">Day streak</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-foreground">{builder.github_stats.active_days_last_year}</div>
                <div className="text-[10px] text-muted-foreground">Active days</div>
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
                Based on {builder.reputation.signal_count} signals
              </p>
              <div className="text-[10px] font-mono text-muted-foreground/50 mt-2">
                Last computed: {new Date(builder.reputation.last_computed).toLocaleDateString()}
              </div>
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
              <p className="text-sm text-secondary-foreground leading-relaxed">
                {builder.ai_summary}
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground/50">
                <span className="font-mono">AI-generated</span>
                <span>|</span>
                <span>Updated {new Date(builder.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Dimension breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Reputation Dimensions</h3>
              <div className="space-y-3">
                {builder.reputation.dimensions.map((dim) => (
                  <DimensionBar key={dim.dimension} dimension={dim} />
                ))}
              </div>
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
