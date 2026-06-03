import React, { useRef, useState, useEffect } from 'react';

interface Status {
  id: string;
  name: string;
  color: string;
  type?: 'not_started' | 'active' | 'closed' | 'done';
}

interface Transition {
  id: string;
  name: string;
  from: string;
  to: string;
  allowed_roles: string[];
}

interface GlobalTransition {
  id: string;
  name: string;
  to: string;
  allowed_roles: string[];
}

interface Position {
  x: number;
  y: number;
}

interface WorkflowCanvasProps {
  statuses: Status[];
  transitions: Transition[];
  globalTransitions: GlobalTransition[];
  initialStatusId: string;
  nodePositions: Record<string, Position>;
  onNodeDrag: (nodeId: string, pos: Position) => void;
  selectedNodeId: string | null;
  selectedTransitionId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectTransition: (id: string | null, fromCanvas?: boolean) => void;
  isAddingTransition: boolean;
  addingTransitionFromId: string | null;
  onAddTransitionSelect: (statusId: string) => void;
  t: (key: string, options?: any) => string;
}

const NODE_WIDTH = 170;
const NODE_HEIGHT = 62;
const START_SIZE = 56;

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  statuses,
  transitions,
  globalTransitions,
  initialStatusId,
  nodePositions,
  onNodeDrag,
  selectedNodeId,
  selectedTransitionId,
  onSelectNode,
  onSelectTransition,
  isAddingTransition,
  addingTransitionFromId,
  onAddTransitionSelect,
  t
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panOffset, setPanOffset] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Position>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ pointer: Position; nodePos: Position }>({ pointer: { x: 0, y: 0 }, nodePos: { x: 0, y: 0 } });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hoveredTransitionId, setHoveredTransitionId] = useState<string | null>(null);

  // Background grid panning handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking directly on container background (the grid canvas), initiate panning
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    } else if (draggedNodeId) {
      const dx = e.clientX - dragStartRef.current.pointer.x;
      const dy = e.clientY - dragStartRef.current.pointer.y;
      onNodeDrag(draggedNodeId, {
        x: Math.max(20, Math.round(dragStartRef.current.nodePos.x + dx)),
        y: Math.max(20, Math.round(dragStartRef.current.nodePos.y + dy))
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      containerRef.current?.releasePointerCapture(e.pointerId);
    } else if (draggedNodeId) {
      setDraggedNodeId(null);
    }
  };

  // Node Drag handlers
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    onSelectTransition(null);
    onSelectNode(nodeId);

    if (isAddingTransition) {
      onAddTransitionSelect(nodeId);
      return;
    }

    const currentPos = nodePositions[nodeId] || { x: 100, y: 100 };
    dragStartRef.current = {
      pointer: { x: e.clientX, y: e.clientY },
      nodePos: { ...currentPos }
    };
    setDraggedNodeId(nodeId);
  };

  // Helper: calculate boundary ports and choose the closest paths
  const getPortCoordinates = (nodeId: string, isStart = false) => {
    const pos = nodePositions[nodeId] || { x: 150, y: 150 };
    const w = isStart ? START_SIZE : NODE_WIDTH;
    const h = isStart ? START_SIZE : NODE_HEIGHT;

    return {
      center: { x: pos.x + w / 2, y: pos.y + h / 2 },
      top: { x: pos.x + w / 2, y: pos.y },
      bottom: { x: pos.x + w / 2, y: pos.y + h },
      left: { x: pos.x, y: pos.y + h / 2 },
      right: { x: pos.x + w, y: pos.y + h / 2 }
    };
  };

  // Calculate orthogonal (straight-line) path between two nodes — Jira style
  const calculatePath = (fromId: string, toId: string, isFromStart = false) => {
    const fromPorts = getPortCoordinates(fromId, isFromStart);
    const toPorts = getPortCoordinates(toId);

    const dx = toPorts.center.x - fromPorts.center.x;
    const dy = toPorts.center.y - fromPorts.center.y;

    let start: Position;
    let end: Position;

    // Decide ports based on relative direction, then pull back by ARROW_GAP
    // so the stroke stops at the arrow's base and the marker tip reaches the border
    const ARROW_GAP = 4; // Shorten the path by 4px from borders

    if (Math.abs(dx) > Math.abs(dy)) {
      const sx = dx > 0 ? 1 : -1;
      const sp = dx > 0 ? fromPorts.right : fromPorts.left;
      const ep = dx > 0 ? toPorts.left : toPorts.right;
      start = { x: sp.x + sx * ARROW_GAP, y: sp.y };
      end = { x: ep.x - sx * ARROW_GAP, y: ep.y };
    } else {
      const sy = dy > 0 ? 1 : -1;
      const sp = dy > 0 ? fromPorts.bottom : fromPorts.top;
      const ep = dy > 0 ? toPorts.top : toPorts.bottom;
      start = { x: sp.x, y: sp.y + sy * ARROW_GAP };
      end = { x: ep.x, y: ep.y - sy * ARROW_GAP };
    }

    // Orthogonal Z-shaped path
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    let d: string;
    let corner1: Position;
    let corner2: Position;

    if (Math.abs(dx) > Math.abs(dy)) {
      corner1 = { x: midX, y: start.y };
      corner2 = { x: midX, y: end.y };
      d = `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`;
    } else {
      corner1 = { x: start.x, y: midY };
      corner2 = { x: end.x, y: midY };
      d = `M ${start.x} ${start.y} V ${midY} H ${end.x} V ${end.y}`;
    }

    // Midpoints of each segment for tag placement
    const firstSegMid: Position = { x: (start.x + corner1.x) / 2, y: (start.y + corner1.y) / 2 };
    const midSegMid: Position = { x: (corner1.x + corner2.x) / 2, y: (corner1.y + corner2.y) / 2 };
    const lastSegMid: Position = { x: (corner2.x + end.x) / 2, y: (corner2.y + end.y) / 2 };

    return { d, start, end, corner1, corner2, firstSegMid, midSegMid, lastSegMid };
  };

  // Group transitions: merge bidirectional pairs into one visual connection
  const getConnectionGroups = () => {
    const groups: Array<{
      key: string;
      from: string;
      to: string;
      forward: typeof transitions[0];
      reverse: typeof transitions[0] | null;
    }> = [];
    const processed = new Set<string>();

    transitions.forEach(tr => {
      if (processed.has(tr.id)) return;
      const reverse = transitions.find(
        r => r.from === tr.to && r.to === tr.from && !processed.has(r.id)
      );
      if (reverse) {
        groups.push({ key: `pair_${tr.from}_${tr.to}`, from: tr.from, to: tr.to, forward: tr, reverse });
        processed.add(tr.id);
        processed.add(reverse.id);
      } else {
        groups.push({ key: tr.id, from: tr.from, to: tr.to, forward: tr, reverse: null });
        processed.add(tr.id);
      }
    });
    return groups;
  };

  const getCategoryColor = (type?: string) => {
    switch (type) {
      case 'not_started':
        return '#94a3b8';
      case 'closed':
        return '#22c55e';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div
      className="workflow-canvas-container"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Instruction Overlay when in Transition Mode */}
      {isAddingTransition && (
        <div className="canvas-instruction-overlay">
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff4d4f', animation: 'ping 1s infinite' }} />
          {!addingTransitionFromId
            ? t('workflow.connect.select_start')
            : t('workflow.connect.select_end')}
        </div>
      )}

      {/* Grid Canvas Content */}
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          position: 'relative',
          width: '2000px',
          height: '2000px',
          pointerEvents: 'none'
        }}
      >
        {/* SVG Connectors Layer */}
        <svg className="workflow-svg-layer">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--transition-normal)" />
            </marker>
            <marker id="arrow-hover" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--transition-hover)" />
            </marker>
            <marker id="arrow-selected" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--transition-selected)" />
            </marker>
          </defs>

          {/* START connection */}
          {initialStatusId && nodePositions['__start__'] && nodePositions[initialStatusId] && (() => {
              const path = calculatePath('__start__', initialStatusId, true);
              return (
                <path
                  d={path.d}
                  fill="none"
                  stroke="var(--transition-normal)"
                  strokeWidth={2.5}
                  markerEnd="url(#arrow)"
                  style={{ strokeDasharray: '4 4' }}
                />
              );
            })()}

            {/* Transitions – orthogonal paths */}
            {(() => {
              const groups = getConnectionGroups()
                .filter(g => nodePositions[g.from] && nodePositions[g.to])
                .map(group => {
                  const path = calculatePath(group.from, group.to);
                  const forwardSelected = selectedTransitionId === group.forward.id;
                  const reverseSelected = group.reverse ? selectedTransitionId === group.reverse.id : false;
                  
                  const forwardHovered = hoveredTransitionId === group.forward.id;
                  const reverseHovered = group.reverse ? hoveredTransitionId === group.reverse.id : false;

                  const isAnySelected = forwardSelected || reverseSelected;
                  const isAnyHovered = forwardHovered || reverseHovered;

                  // Determine markers based on active directions
                  let markerEnd: string | undefined = undefined;
                  let markerStart: string | undefined = undefined;

                  if (forwardSelected) {
                    markerEnd = 'url(#arrow-selected)';
                    markerStart = undefined;
                  } else if (reverseSelected) {
                    markerEnd = undefined;
                    markerStart = 'url(#arrow-selected)';
                  } else if (forwardHovered) {
                    markerEnd = 'url(#arrow-hover)';
                    markerStart = undefined;
                  } else if (reverseHovered) {
                    markerEnd = undefined;
                    markerStart = 'url(#arrow-hover)';
                  } else {
                    markerEnd = 'url(#arrow)';
                    markerStart = group.reverse ? 'url(#arrow)' : undefined;
                  }

                  return { group, path, isAnySelected, isAnyHovered, markerEnd, markerStart };
                });

              // Sort groups: normal (0) < hovered (1) < selected (2) so active lines are drawn on top
              const sortedGroups = groups.slice().sort((a, b) => {
                const aVal = a.isAnySelected ? 2 : (a.isAnyHovered ? 1 : 0);
                const bVal = b.isAnySelected ? 2 : (b.isAnyHovered ? 1 : 0);
                return aVal - bVal;
              });

              return sortedGroups.map(({ group, path, isAnySelected, isAnyHovered, markerEnd, markerStart }) => (
                <g 
                  key={group.key} 
                  style={{ pointerEvents: 'auto' }}
                  onMouseEnter={() => setHoveredTransitionId(group.forward.id)}
                  onMouseLeave={() => setHoveredTransitionId(null)}
                >
                  <path
                    d={path.d}
                    className={`transition-line ${isAnySelected ? 'selected' : ''} ${isAnyHovered ? 'hovered' : ''}`}
                    markerEnd={markerEnd}
                    markerStart={markerStart}
                  />
                  <path
                    d={path.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={15}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(null);
                      onSelectTransition(group.forward.id, true);
                    }}
                  />
                </g>
              ));
            })()}

            {/* Global Transitions (Any -> Target) */}
            {globalTransitions.map((gt) => {
              if (!nodePositions[gt.to]) return null;
              const targetPos = nodePositions[gt.to];
              const isSelected = selectedTransitionId === gt.id;
              const isHovered = hoveredTransitionId === gt.id;
              const bubbleX = targetPos.x + NODE_WIDTH / 2;
              const bubbleY = targetPos.y - 45;

              return (
                <g 
                  key={gt.id} 
                  style={{ pointerEvents: 'auto' }}
                  onMouseEnter={() => setHoveredTransitionId(gt.id)}
                  onMouseLeave={() => setHoveredTransitionId(null)}
                >
                  <path
                    d={`M ${bubbleX} ${bubbleY + 10} L ${bubbleX} ${targetPos.y - 4}`}
                    fill="none"
                    stroke={isSelected 
                      ? 'var(--transition-selected)' 
                      : isHovered 
                        ? 'var(--transition-hover)' 
                        : 'var(--transition-normal)'}
                    strokeWidth={2.5}
                    markerEnd={isSelected 
                      ? 'url(#arrow-selected)' 
                      : isHovered 
                        ? 'url(#arrow-hover)' 
                        : 'url(#arrow)'}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(null);
                      onSelectTransition(gt.id, true);
                    }}
                  />
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(null);
                      onSelectTransition(gt.id, true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      x={bubbleX - 45}
                      y={bubbleY - 10}
                      width={90}
                      height={20}
                      rx={10}
                      fill={isSelected ? 'var(--transition-selected)' : isHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)'}
                      stroke={isSelected ? 'var(--transition-selected)' : isHovered ? 'var(--transition-hover)' : 'var(--border-color)'}
                      strokeWidth={isHovered ? 1.8 : 1.2}
                    />
                    <text
                      x={bubbleX}
                      y={bubbleY + 4}
                      textAnchor="middle"
                      fill={isSelected ? '#fff' : isHovered ? 'var(--transition-hover)' : 'var(--primary)'}
                      fontSize={10}
                      fontWeight={700}
                    >
                      {t('workflow.all_statuses')}
                    </text>
                    {gt.name && (
                      <text
                        x={bubbleX}
                        y={bubbleY - 14}
                        textAnchor="middle"
                        fill={isSelected ? 'var(--transition-selected)' : isHovered ? 'var(--transition-hover)' : 'var(--text-secondary)'}
                        fontSize={10}
                        fontWeight={500}
                      >
                        {gt.name}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
        </svg>

        {/* HTML Nodes Layer */}
        <div className="workflow-nodes-layer">
          {/* START Node */}
          {nodePositions['__start__'] && (
            <div
              className={`workflow-start-node ${selectedNodeId === '__start__' ? 'selected' : ''}`}
              style={{
                left: `${nodePositions['__start__'].x}px`,
                top: `${nodePositions['__start__'].y}px`
              }}
              onPointerDown={(e) => handleNodePointerDown(e, '__start__')}
            >
              {t('workflow.start_node')}
            </div>
          )}

          {/* Status Nodes */}
          {statuses.map((status) => {
            const pos = nodePositions[status.id] || { x: 100, y: 100 };
            const isSelected = selectedNodeId === status.id;
            const isInitial = status.id === initialStatusId;
            const isSource = addingTransitionFromId === status.id;

            return (
              <div
                key={status.id}
                className={`workflow-node ${isSelected ? 'selected' : ''}`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  borderLeft: `5px solid ${status.color}`,
                  background: isSource ? 'rgba(99, 102, 241, 0.05)' : undefined
                }}
                onPointerDown={(e) => handleNodePointerDown(e, status.id)}
              >
                {isInitial && <div className="node-initial-badge">{t('workflow.initial_badge')}</div>}
                <div className="node-header">
                  <span
                    className="node-category"
                    style={{
                      background: `${getCategoryColor(status.type)}15`,
                      color: getCategoryColor(status.type)
                    }}
                  >
                    {status.type || 'active'}
                  </span>
                </div>
                <div className="node-title" title={status.name}>
                  {status.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* SVG Tags Layer (above nodes, z-index: 3) */}
        <svg className="workflow-tags-layer">
          {(() => {
            const groups = getConnectionGroups()
              .filter(g => nodePositions[g.from] && nodePositions[g.to])
              .map(group => {
                const path = calculatePath(group.from, group.to);
                const forwardSelected = selectedTransitionId === group.forward.id;
                const reverseSelected = group.reverse ? selectedTransitionId === group.reverse.id : false;
                const fromStatus = statuses.find(s => s.id === group.from);
                const toStatus = statuses.find(s => s.id === group.to);
                // Bidirectional: tags on first & last segments to avoid overlap
                // Single direction: tag on middle segment
                const forwardLabelPos = group.reverse ? path.lastSegMid : path.midSegMid;
                const reverseLabelPos = group.reverse ? path.firstSegMid : null;
                return { group, forwardSelected, reverseSelected, fromStatus, toStatus, forwardLabelPos, reverseLabelPos };
              });

            const renderTag = (
              tr: typeof transitions[0],
              pos: Position,
              isSelected: boolean,
              defaultLabel: string
            ) => {
              const label = tr.name || defaultLabel;
              const charWidth = 6.5;
              const padding = 18;
              const tagW = Math.max(label.length * charWidth + padding, 36);
              const tagH = 22;
              const isHovered = hoveredTransitionId === tr.id;
              return (
                <g
                  key={tr.id}
                  className="transition-tag"
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(null);
                    onSelectTransition(tr.id, true);
                  }}
                  onMouseEnter={() => setHoveredTransitionId(tr.id)}
                  onMouseLeave={() => setHoveredTransitionId(null)}
                >
                  <rect
                    x={pos.x - tagW / 2}
                    y={pos.y - tagH / 2}
                    width={tagW}
                    height={tagH}
                    rx={tagH / 2}
                    fill={isSelected ? 'var(--transition-selected)' : isHovered ? 'var(--bg-card-hover)' : 'var(--bg-card)'}
                    stroke={isSelected ? 'var(--transition-selected)' : isHovered ? 'var(--transition-hover)' : 'var(--border-color)'}
                    strokeWidth={isHovered ? 1.8 : 1.2}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 3.5}
                    textAnchor="middle"
                    fill={isSelected ? '#fff' : isHovered ? 'var(--transition-hover)' : 'var(--text-secondary)'}
                    fontSize={10}
                    fontWeight={isSelected || isHovered ? 600 : 500}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {label}
                  </text>
                </g>
              );
            };

            return groups.map(({ group, forwardSelected, reverseSelected, fromStatus, toStatus, forwardLabelPos, reverseLabelPos }) => (
              <g key={`tags_${group.key}`}>
                {renderTag(
                  group.forward,
                  forwardLabelPos,
                  forwardSelected,
                  toStatus?.name || '→'
                )}
                {group.reverse && reverseLabelPos && renderTag(
                  group.reverse,
                  reverseLabelPos,
                  reverseSelected,
                  fromStatus?.name || '←'
                )}
              </g>
            ));
          })()}
        </svg>
      </div>
    </div>
  );
};
