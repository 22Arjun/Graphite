import React, { useMemo, useState, useCallback } from 'react';
import type { CollaborationGraph, GraphNode } from '@/lib/types';

interface GraphCanvasProps {
  graph: CollaborationGraph;
  width?: number;
  height?: number;
}

const NODE_COLORS: Record<string, string> = {
  builder: 'hsl(160, 84%, 39%)',
  repository: 'hsl(200, 80%, 55%)',
  organization: 'hsl(38, 92%, 50%)',
  skill: 'hsl(280, 65%, 60%)',
};

const NODE_BG: Record<string, string> = {
  builder: 'hsl(160, 84%, 39%, 0.15)',
  repository: 'hsl(200, 80%, 55%, 0.15)',
  organization: 'hsl(38, 92%, 50%, 0.15)',
  skill: 'hsl(280, 65%, 60%, 0.15)',
};

// Simple force-directed layout simulation
function computeLayout(graph: CollaborationGraph, width: number, height: number) {
  const positions: Record<string, { x: number; y: number }> = {};
  const cx = width / 2;
  const cy = height / 2;
  const nodeCount = graph.nodes.length;

  // Initial circular layout
  graph.nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodeCount;
    const r = Math.min(width, height) * 0.32;
    positions[node.id] = {
      x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
      y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
    };
  });

  // Simple force simulation (few iterations)
  for (let iter = 0; iter < 50; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const a = graph.nodes[i];
        const b = graph.nodes[j];
        const dx = positions[b.id].x - positions[a.id].x;
        const dy = positions[b.id].y - positions[a.id].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        positions[a.id].x -= fx;
        positions[a.id].y -= fy;
        positions[b.id].x += fx;
        positions[b.id].y += fy;
      }
    }

    // Attraction along edges
    for (const edge of graph.edges) {
      const a = positions[edge.source];
      const b = positions[edge.target];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 120) * 0.01 * edge.weight;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.x += fx;
      a.y += fy;
      b.x -= fx;
      b.y -= fy;
    }

    // Center gravity
    graph.nodes.forEach((node) => {
      positions[node.id].x += (cx - positions[node.id].x) * 0.01;
      positions[node.id].y += (cy - positions[node.id].y) * 0.01;
    });
  }

  // Clamp positions
  graph.nodes.forEach((node) => {
    const padding = 40;
    positions[node.id].x = Math.max(padding, Math.min(width - padding, positions[node.id].x));
    positions[node.id].y = Math.max(padding, Math.min(height - padding, positions[node.id].y));
  });

  return positions;
}

const GraphCanvas: React.FC<GraphCanvasProps> = ({ graph, width = 700, height = 500 }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const positions = useMemo(() => computeLayout(graph, width, height), [graph, width, height]);

  const getNodeSize = useCallback((node: GraphNode) => {
    return node.size || 16;
  }, []);

  const isConnected = useCallback(
    (nodeId: string) => {
      if (!hoveredNode && !selectedNode) return true;
      const active = hoveredNode || selectedNode;
      if (nodeId === active) return true;
      return graph.edges.some(
        (e) =>
          (e.source === active && e.target === nodeId) ||
          (e.target === active && e.source === nodeId)
      );
    },
    [hoveredNode, selectedNode, graph.edges]
  );

  const isEdgeConnected = useCallback(
    (source: string, target: string) => {
      if (!hoveredNode && !selectedNode) return true;
      const active = hoveredNode || selectedNode;
      return source === active || target === active;
    },
    [hoveredNode, selectedNode]
  );

  const activeNode = selectedNode || hoveredNode;
  const activeNodeData = activeNode ? graph.nodes.find((n) => n.id === activeNode) : null;

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        onClick={() => setSelectedNode(null)}
      >
        {/* Edges */}
        {graph.edges.map((edge) => {
          const source = positions[edge.source];
          const target = positions[edge.target];
          if (!source || !target) return null;
          const connected = isEdgeConnected(edge.source, edge.target);
          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="hsl(var(--edge-color))"
              strokeWidth={Math.max(1, edge.weight * 2)}
              opacity={connected ? 0.5 : 0.08}
              strokeDasharray={edge.type === 'skill_match' ? '4 4' : undefined}
              className="transition-opacity duration-300"
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const s = getNodeSize(node);
          const color = NODE_COLORS[node.type];
          const bgColor = NODE_BG[node.type];
          const connected = isConnected(node.id);
          const isActive = node.id === activeNode;

          return (
            <g
              key={node.id}
              className="cursor-pointer transition-opacity duration-300"
              opacity={connected ? 1 : 0.15}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(node.id === selectedNode ? null : node.id);
              }}
            >
              {/* Glow ring */}
              {isActive && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={s + 6}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.4}
                  className="animate-pulse"
                />
              )}
              {/* Background circle */}
              <circle cx={pos.x} cy={pos.y} r={s} fill={bgColor} stroke={color} strokeWidth={1.5} />
              {/* Inner circle */}
              <circle cx={pos.x} cy={pos.y} r={s * 0.4} fill={color} opacity={0.8} />
              {/* Label */}
              <text
                x={pos.x}
                y={pos.y + s + 14}
                textAnchor="middle"
                className="text-[10px] font-medium fill-muted-foreground pointer-events-none"
              >
                {node.label.length > 14 ? node.label.slice(0, 12) + '..' : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Node info tooltip */}
      {activeNodeData && (
        <div className="absolute top-3 right-3 graphite-card p-3 min-w-[180px]">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: NODE_COLORS[activeNodeData.type] }}
            />
            <span className="text-xs font-medium text-muted-foreground capitalize">
              {activeNodeData.type}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{activeNodeData.label}</p>
          {activeNodeData.score !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              Reputation: <span className="font-mono text-primary">{activeNodeData.score}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Connections:{' '}
            <span className="font-mono">
              {graph.edges.filter(
                (e) => e.source === activeNodeData.id || e.target === activeNodeData.id
              ).length}
            </span>
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 px-1">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GraphCanvas;
