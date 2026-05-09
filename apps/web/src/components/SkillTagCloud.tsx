import React from 'react';
import type { SkillTag } from '@/lib/types';

interface SkillTagCloudProps {
  tags: SkillTag[];
  maxTags?: number;
}

const categoryStyles: Record<string, string> = {
  language: 'border-primary/30 text-primary bg-primary/5',
  framework: 'border-node-secondary/30 text-node-secondary bg-node-secondary/5',
  domain: 'border-accent/30 text-accent bg-accent/5',
  pattern: 'border-node-quaternary/30 text-node-quaternary bg-node-quaternary/5',
  tool: 'border-muted-foreground/30 text-secondary-foreground bg-surface-2',
};

const SkillTagCloud: React.FC<SkillTagCloudProps> = ({ tags, maxTags }) => {
  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const remaining = maxTags && tags.length > maxTags ? tags.length - maxTags : 0;

  return (
    <div className="flex flex-wrap gap-2">
      {displayTags.map((tag) => (
        <span
          key={tag.name}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${
            categoryStyles[tag.category] || categoryStyles.tool
          }`}
        >
          {tag.name}
          <span className="ml-0.5 font-mono text-[10px] opacity-60">
            {Math.round(tag.confidence * 100)}%
          </span>
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
          +{remaining} more
        </span>
      )}
    </div>
  );
};

export default SkillTagCloud;
