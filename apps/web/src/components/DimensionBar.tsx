import React from 'react';
import { Cpu, Rocket, Users, Activity, Lightbulb, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { DimensionScore } from '@/lib/types';
import { DIMENSION_COLORS } from '@/lib/constants';
import { DIMENSION_META } from '@/lib/mock-data';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Cpu,
  Rocket,
  Users,
  Activity,
  Lightbulb,
};

const trendIcons = {
  rising: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

interface DimensionBarProps {
  dimension: DimensionScore;
}

const DimensionBar: React.FC<DimensionBarProps> = ({ dimension }) => {
  const meta = DIMENSION_META[dimension.dimension];
  const color = DIMENSION_COLORS[dimension.dimension];
  const Icon = iconMap[meta?.icon || 'Activity'];
  const TrendIcon = trendIcons[dimension.trend];

  return (
    <div className="group rounded-lg border border-border/50 bg-surface-1 p-4 hover:border-primary/20 transition-all">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{meta?.label}</h4>
            <p className="text-[11px] text-muted-foreground leading-tight">{meta?.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <TrendIcon
              className={`h-3 w-3 ${
                dimension.trend === 'rising'
                  ? 'text-primary'
                  : dimension.trend === 'declining'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            />
            <span className="text-[10px] text-muted-foreground capitalize">{dimension.trend}</span>
          </div>
          <span className="text-lg font-bold font-mono" style={{ color }}>
            {dimension.score}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${dimension.score}%`, backgroundColor: color }}
        />
      </div>

      {/* Signals */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {dimension.signals.map((signal, i) => (
          <span
            key={i}
            className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {signal}
          </span>
        ))}
      </div>

      {/* Confidence */}
      <div className="mt-2 text-[10px] text-muted-foreground/60 font-mono">
        Confidence: {Math.round(dimension.confidence * 100)}%
      </div>
    </div>
  );
};

export default DimensionBar;
