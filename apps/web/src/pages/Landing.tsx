import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import {
  Hexagon,
  GitBranch,
  Brain,
  Share2,
  Shield,
  Zap,
  ChevronRight,
  ArrowRight,
  Cpu,
  Rocket,
  Users,
  Activity,
  Lightbulb,
} from 'lucide-react';
import NetworkBackground from '@/components/NetworkBackground';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const Landing: React.FC = () => {
  const { connected } = useWallet();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (connected) {
      navigate('/dashboard');
    }
  }, [connected, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <NetworkBackground nodeCount={40} />
      <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)' }} />

      {/* Hero Section */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <motion.div
          className="max-w-3xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {/* Badge */}
          <motion.div custom={0} variants={fadeUp} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Builder Intelligence
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
          >
            Map the{' '}
            <span className="graphite-glow-text">signal</span>
            <br />
            behind every builder
          </motion.h1>

          {/* Subheading */}
          <motion.p
            custom={2}
            variants={fadeUp}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            Graphite analyzes fragmented developer signals across GitHub, wallets, and
            hackathons to generate multidimensional reputation intelligence.
          </motion.p>

          {/* CTA */}
          <motion.div custom={3} variants={fadeUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <WalletMultiButton />
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How it works
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </motion.div>

          {/* Trust signals */}
          <motion.div custom={4} variants={fadeUp} className="mt-12 flex items-center justify-center gap-6 text-[11px] text-muted-foreground/50">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> Wallet-verified identity
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> AI-powered analysis
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" /> GitHub signal ingestion
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              From noise to <span className="text-primary">intelligence</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
              Four-stage pipeline that transforms raw developer signals into actionable reputation intelligence.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: GitBranch,
                step: '01',
                title: 'Ingest',
                desc: 'Connect GitHub and wallets. We pull repositories, commits, collaborators, and on-chain activity.',
              },
              {
                icon: Brain,
                step: '02',
                title: 'Analyze',
                desc: 'AI models evaluate architecture complexity, code quality, execution maturity, and originality.',
              },
              {
                icon: Hexagon,
                step: '03',
                title: 'Score',
                desc: 'Multidimensional reputation scoring across 5 axes: Technical, Execution, Collaboration, Consistency, Innovation.',
              },
              {
                icon: Share2,
                step: '04',
                title: 'Graph',
                desc: 'Build collaboration networks, find complementary builders, and surface team recommendations.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="graphite-card p-5 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-mono text-primary/50">{item.step}</span>
                  <div className="h-9 w-9 rounded-lg bg-surface-2 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Reputation Dimensions */}
      <section className="relative z-10 py-24 px-4 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Five dimensions of <span className="text-primary">builder intelligence</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
              Not just code stats. Graphite models the full picture of a builder's capabilities and trajectory.
            </p>
          </motion.div>

          <div className="space-y-3">
            {[
              { icon: Cpu, label: 'Technical Depth', desc: 'Language mastery, systems design, framework expertise', color: 'hsl(160, 84%, 39%)', score: 88 },
              { icon: Rocket, label: 'Execution Ability', desc: 'Shipping velocity, deployment track record, CI/CD maturity', color: 'hsl(200, 80%, 55%)', score: 85 },
              { icon: Users, label: 'Collaboration Quality', desc: 'PR reviews, team dynamics, open-source contribution patterns', color: 'hsl(38, 92%, 50%)', score: 76 },
              { icon: Activity, label: 'Consistency', desc: 'Sustained engagement, commit frequency, long-term maintenance', color: 'hsl(280, 65%, 60%)', score: 79 },
              { icon: Lightbulb, label: 'Innovation', desc: 'Novel architectures, experimental repos, creative problem solving', color: 'hsl(340, 75%, 55%)', score: 72 },
            ].map((dim, i) => (
              <motion.div
                key={dim.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex items-center gap-4 rounded-lg border border-border/50 bg-surface-1 p-4 group hover:border-primary/20 transition-all"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${dim.color}15` }}
                >
                  <dim.icon className="h-5 w-5" style={{ color: dim.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">{dim.label}</h4>
                  <p className="text-xs text-muted-foreground">{dim.desc}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <div className="w-32 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${dim.score}%`, backgroundColor: dim.color }}
                    />
                  </div>
                  <span className="text-sm font-bold font-mono w-8 text-right" style={{ color: dim.color }}>
                    {dim.score}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24 px-4 border-t border-border/30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Start building your reputation graph
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Connect your wallet, link your GitHub, and let AI map your builder intelligence.
          </p>
          <WalletMultiButton />
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-foreground">Graphite</span>
          </div>
          <p className="text-xs text-muted-foreground/50">
            AI-powered builder reputation intelligence. Built for the Solana ecosystem.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
