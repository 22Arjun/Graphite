import React from 'react';
import { Star, GitFork, ExternalLink, Globe } from 'lucide-react';
import type { Repository } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { LANGUAGE_COLORS } from '@/lib/constants';

interface RepoCardProps {
  repo: Repository;
  onAnalyze?: (repoId: string) => void;
}

const RepoCard: React.FC<RepoCardProps> = ({ repo, onAnalyze }) => {
  const langEntries = Object.entries(repo.languages);
  const totalBytes = langEntries.reduce((sum, [, b]) => sum + b, 0);

  return (
    <div className="graphite-card p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{repo.name}</h3>
            {repo.is_fork && (
              <span className="text-[10px] text-muted-foreground border border-border rounded px-1">fork</span>
            )}
          </div>
          {repo.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {repo.description}
            </p>
          )}
        </div>
        <StatusBadge status={repo.analysis_status} />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {repo.language && (
          <span className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: LANGUAGE_COLORS[repo.language] || LANGUAGE_COLORS.Other }}
            />
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          {repo.stars}
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="h-3 w-3" />
          {repo.forks}
        </span>
      </div>

      {/* Language bar */}
      {totalBytes > 0 && (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          {langEntries.map(([lang, bytes]) => (
            <div
              key={lang}
              className="h-full transition-all"
              style={{
                width: `${(bytes / totalBytes) * 100}%`,
                backgroundColor: LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.Other,
              }}
            />
          ))}
        </div>
      )}

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {repo.topics.slice(0, 5).map((topic) => (
            <span
              key={topic}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Analysis preview */}
      {repo.analysis && (
        <div className="border-t border-border/50 pt-3 mt-1">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Arch', value: repo.analysis.architecture_complexity },
              { label: 'Quality', value: repo.analysis.code_quality_signals },
              { label: 'Mature', value: repo.analysis.execution_maturity },
              { label: 'Original', value: repo.analysis.originality_score },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-sm font-bold font-mono text-foreground">{item.value}</div>
                <div className="text-[10px] text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          GitHub
        </a>
        {repo.homepage && (
          <a
            href={repo.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Globe className="h-3 w-3" />
            Live
          </a>
        )}
        {(repo.analysis_status === 'pending' || repo.analysis_status === 'failed') && onAnalyze && (
          <button
            onClick={() => onAnalyze(repo.id)}
            className="ml-auto text-xs font-medium text-primary hover:text-emerald-glow transition-colors"
          >
            Analyze
          </button>
        )}
      </div>
    </div>
  );
};

export default RepoCard;
