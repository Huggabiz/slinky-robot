import { BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';
import type { OrthEdgeData } from '../utils/flowLayout';

// Custom edge that renders a pre-computed rounded orthogonal path from
// ELK's bend points. Standard React Flow edge renderers compute a path
// from sourceX/Y and targetX/Y — we ignore those and use data.path,
// which was stitched in flowLayout.ts during the ELK pass.
type OrthEdgeType = Edge<OrthEdgeData, 'orth'>;

export function OrthEdge({
  id,
  data,
  markerEnd,
  style,
}: EdgeProps<OrthEdgeType>) {
  const path = data?.path ?? '';
  return (
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
  );
}
