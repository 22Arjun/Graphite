import React from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}

const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  color,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = ((100 - score) / 100) * circumference;
  const center = size / 2;

  const getColor = () => {
    if (color) return color;
    if (score >= 80) return 'hsl(var(--primary))';
    if (score >= 60) return 'hsl(var(--node-secondary))';
    if (score >= 40) return 'hsl(var(--accent))';
    return 'hsl(var(--destructive))';
  };

  const ringColor = getColor();

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--surface-3))"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold font-mono text-foreground">{score}</span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      )}
    </div>
  );
};

export default ScoreRing;
