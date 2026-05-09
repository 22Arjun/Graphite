import React from 'react';
import { GitBranch, RefreshCw, Users, Github, User } from 'lucide-react';
import type { ActivityEvent } from '@/lib/types';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  repo_analyzed: GitBranch,
  reputation_computed: RefreshCw,
  collaborator_found: Users,
  github_connected: Github,
  profile_updated: User,
};

interface ActivityTimelineProps {
  events: ActivityEvent[];
  maxEvents?: number;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ events, maxEvents }) => {
  const display = maxEvents ? events.slice(0, maxEvents) : events;

  return (
    <div className="space-y-0">
      {display.map((event, i) => {
        const Icon = iconMap[event.type] || RefreshCw;
        const isLast = i === display.length - 1;
        return (
          <div key={event.id} className="flex gap-3 group">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border group-hover:border-primary/30 transition-colors">
                <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border/50 my-1" />}
            </div>
            {/* Content */}
            <div className={`pb-5 pt-1 ${isLast ? '' : ''}`}>
              <p className="text-sm font-medium text-foreground leading-tight">{event.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>
              <span className="text-[10px] font-mono text-muted-foreground/60 mt-1 block">
                {timeAgo(event.timestamp)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityTimeline;
