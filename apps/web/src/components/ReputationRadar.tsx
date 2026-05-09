import React, { useMemo } from 'react';
import type { DimensionScore } from '@/lib/types';
import { DIMENSION_COLORS } from '@/lib/constants';
import { DIMENSION_META } from '@/lib/mock-data';

interface ReputationRadarProps {
  dimensions: DimensionScore[];
  size?: number;
}

const ReputationRadar: React.FC<ReputationRadarProps> = ({ dimensions, size = 280 }) => {
  const center = size / 2;
  const radius = (size / 2) * 0.75;
  const levels = [20, 40, 60, 80, 100];
  const count = dimensions.length;

  const points = useMemo(() => {
    return dimensions.map((dim, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const r = (dim.score / 100) * radius;
      return {
        x: center + r * Math.cos(angle),
        y: center + r * Math.sin(angle),
        labelX: center + (radius + 28) * Math.cos(angle),
        labelY: center + (radius + 28) * Math.sin(angle),
        dim,
        angle,
      };
    });
  }, [dimensions, center, radius, count]);

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Grid levels */}
        {levels.map((level) => {
          const r = (level / 100) * radius;
          const gridPoints = Array.from({ length: count }, (_, i) => {
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={gridPoints}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth={level === 100 ? 1 : 0.5}
              opacity={level === 100 ? 0.6 : 0.3}
            />
          );
        })}

        {/* Axis lines */}
        {points.map((p, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(p.angle)}
            y2={center + radius * Math.sin(p.angle)}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}

        {/* Data polygon - fill */}
        <polygon
          points={polygonPoints}
          fill="hsl(var(--primary) / 0.12)"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
        />

        {/* Data points */}
        {points.map((p, i) => {
          const color = DIMENSION_COLORS[p.dim.dimension] || 'hsl(var(--primary))';
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={5} fill={color} opacity={0.9} />
              <circle cx={p.x} cy={p.y} r={3} fill={color} />
            </g>
          );
        })}

        {/* Labels */}
        {points.map((p, i) => {
          const meta = DIMENSION_META[p.dim.dimension];
          const color = DIMENSION_COLORS[p.dim.dimension] || 'hsl(var(--foreground))';
          const isLeft = p.labelX < center;
          const isTop = p.labelY < center;
          return (
            <g key={`label-${i}`}>
              <text
                x={p.labelX}
                y={p.labelY - 6}
                textAnchor={Math.abs(p.labelX - center) < 10 ? 'middle' : isLeft ? 'end' : 'start'}
                dominantBaseline={Math.abs(p.labelY - center) < 10 ? 'middle' : isTop ? 'auto' : 'hanging'}
                className="text-[10px] font-medium fill-secondary-foreground"
              >
                {meta?.label || p.dim.dimension}
              </text>
              <text
                x={p.labelX}
                y={p.labelY + 8}
                textAnchor={Math.abs(p.labelX - center) < 10 ? 'middle' : isLeft ? 'end' : 'start'}
                dominantBaseline={Math.abs(p.labelY - center) < 10 ? 'middle' : isTop ? 'auto' : 'hanging'}
                className="text-[11px] font-bold font-mono"
                fill={color}
              >
                {p.dim.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ReputationRadar;
