import React, { useMemo } from 'react';

interface NetworkBackgroundProps {
  nodeCount?: number;
  className?: string;
}

const NetworkBackground: React.FC<NetworkBackgroundProps> = ({ nodeCount = 30, className = '' }) => {
  const { nodes, edges } = useMemo(() => {
    const n = Array.from({ length: nodeCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: 1 + Math.random() * 2,
      opacity: 0.1 + Math.random() * 0.3,
      delay: Math.random() * 5,
    }));

    const e: { from: number; to: number; opacity: number }[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dx = n[i].x - n[j].x;
        const dy = n[i].y - n[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20 && Math.random() > 0.4) {
          e.push({ from: i, to: j, opacity: Math.max(0.03, 0.12 - dist * 0.005) });
        }
      }
    }

    return { nodes: n, edges: e };
  }, [nodeCount]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {edges.map((edge, i) => (
          <line
            key={i}
            x1={nodes[edge.from].x}
            y1={nodes[edge.from].y}
            x2={nodes[edge.to].x}
            y2={nodes[edge.to].y}
            stroke="hsl(var(--primary))"
            strokeWidth={0.08}
            opacity={edge.opacity}
          />
        ))}
        {nodes.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.r * 0.15}
            fill="hsl(var(--primary))"
            opacity={node.opacity}
          >
            <animate
              attributeName="opacity"
              values={`${node.opacity};${node.opacity * 0.3};${node.opacity}`}
              dur={`${3 + node.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
    </div>
  );
};

export default NetworkBackground;
