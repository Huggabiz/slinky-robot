import { BaseEdge, EdgeLabelRenderer, type EdgeProps, type Edge } from '@xyflow/react';
import { useAppStore } from '../store/useAppStore';
import type { OrthEdgeData } from '../utils/flowLayout';

type OrthEdgeType = Edge<OrthEdgeData, 'orth'>;

export function OrthEdge({
  id,
  data,
  markerEnd,
  style,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<OrthEdgeType>) {
  const path = data?.path ?? '';
  const mode = useAppStore((s) => s.mode);
  const editing = mode === 'edit';

  // Midpoint for the "+" label — approximate from source/target.
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {editing && (
        <EdgeLabelRenderer>
          <div
            className="orth-edge-insert"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px)`,
              pointerEvents: 'all',
            }}
            title="Click edge to insert a task"
          >
            +
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
