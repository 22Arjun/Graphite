import React from 'react';
import type { AnalysisStatus } from '@/lib/types';

const statusConfig: Record<AnalysisStatus, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  pending: {
    label: 'Pending',
    dotClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted-foreground/10',
  },
  ingesting: {
    label: 'Ingesting',
    dotClass: 'bg-accent',
    textClass: 'text-accent',
    bgClass: 'bg-accent/10',
  },
  analyzing: {
    label: 'Analyzing',
    dotClass: 'bg-node-secondary',
    textClass: 'text-node-secondary',
    bgClass: 'bg-node-secondary/10',
  },
  completed: {
    label: 'Completed',
    dotClass: 'bg-primary',
    textClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
  failed: {
    label: 'Failed',
    dotClass: 'bg-destructive',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
};

interface StatusBadgeProps {
  status: AnalysisStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  const isAnimated = status === 'ingesting' || status === 'analyzing';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.textClass} ${config.bgClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass} ${isAnimated ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
