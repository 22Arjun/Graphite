import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Hexagon,
  Users,
  ArrowRight,
  Sparkles,
  Target,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MOCK_GRAPH, MOCK_RECOMMENDATIONS } from '@/lib/mock-data';
import GraphCanvas from '@/components/GraphCanvas';

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5 },
  }),
};

const Graph: React.FC = () => {
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

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
            <h1 className="text-xl font-bold text-foreground">Collaboration Graph</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Network visualization of your collaboration patterns and AI-powered team recommendations.
          </p>
        </motion.div>

        {/* Graph stats */}
        <motion.div custom={1} variants={fadeIn} className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Nodes', value: MOCK_GRAPH.nodes.length, icon: Hexagon },
            { label: 'Connections', value: MOCK_GRAPH.edges.length, icon: ArrowRight },
            { label: 'Clusters', value: MOCK_GRAPH.clusters.length, icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="graphite-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-xl font-bold font-mono text-foreground">{stat.value}</div>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Graph visualization */}
          <motion.div custom={2} variants={fadeIn} className="xl:col-span-2">
            <div className="graphite-card p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Network Map</h2>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Click nodes to inspect | Hover to highlight connections
                </span>
              </div>
              <div className="w-full overflow-x-auto">
                <div className="min-w-[600px]">
                  <GraphCanvas graph={MOCK_GRAPH} width={680} height={480} />
                </div>
              </div>
            </div>

            {/* Clusters */}
            <div className="graphite-card p-5 mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Detected Clusters</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MOCK_GRAPH.clusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="rounded-lg bg-surface-2 border border-border/50 p-3"
                  >
                    <h4 className="text-xs font-semibold text-foreground">{cluster.label}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {cluster.node_ids.length} members
                      {cluster.dominant_skill && ` | ${cluster.dominant_skill}`}
                    </p>
                    <div className="flex mt-2 -space-x-1.5">
                      {cluster.node_ids.slice(0, 4).map((nid) => {
                        const node = MOCK_GRAPH.nodes.find((n) => n.id === nid);
                        return (
                          <div
                            key={nid}
                            className="h-6 w-6 rounded-full bg-surface-3 border border-surface-1 flex items-center justify-center text-[8px] font-bold text-muted-foreground"
                            title={node?.label}
                          >
                            {node?.label.charAt(0)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Recommendations */}
          <motion.div custom={3} variants={fadeIn} className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">AI Recommendations</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Builders with complementary skills and shared interests.
            </p>

            {MOCK_RECOMMENDATIONS.map((rec) => {
              const isExpanded = expandedRec === rec.builder.id;
              return (
                <div key={rec.builder.id} className="graphite-card overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => setExpandedRec(isExpanded ? null : rec.builder.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {rec.builder.display_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground truncate">
                            {rec.builder.display_name}
                          </h3>
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold font-mono text-primary">
                            {rec.match_score}%
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          @{rec.builder.github_username}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                      {/* Match reasons */}
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Why this match
                        </h4>
                        <div className="space-y-1">
                          {rec.reasons.map((reason, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-secondary-foreground">
                              <Target className="h-3 w-3 text-primary shrink-0" />
                              {reason}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Complementary skills */}
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Complementary Skills
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {rec.complementary_skills.map((skill) => (
                            <span
                              key={skill}
                              className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Shared interests */}
                      <div>
                        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Shared Interests
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {rec.shared_interests.map((interest) => (
                            <span
                              key={interest}
                              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Builder summary */}
                      <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3">
                        {rec.builder.ai_summary}
                      </p>

                      {/* Score */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono pt-1">
                        <span>Rep: {rec.builder.reputation.overall_score}/100</span>
                        <span>Match: {rec.match_score}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Graph;
