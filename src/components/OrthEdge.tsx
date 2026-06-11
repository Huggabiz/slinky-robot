import { BaseEdge, type EdgeProps, type Edge } from '@xyflow/react';
import type { OrthEdgeData } from '../utils/flowLayout';

type OrthEdgeType = Edge<OrthEdgeData, 'orth'>;

export function OrthEdge({
  id,
  data,
  markerEnd,
  style,
}: EdgeProps<OrthEdgeType>) {
  const path = data?.path ?? '';
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />;
}
