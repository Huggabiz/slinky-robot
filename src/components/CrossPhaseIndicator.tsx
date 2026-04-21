import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import './CrossPhaseIndicator.css';

export interface CrossPhaseData extends Record<string, unknown> {
  label: string;
  direction: 'incoming' | 'outgoing';
  phaseName: string;
  taskName: string;
}

type CrossPhaseNode = Node<CrossPhaseData, 'crossPhase'>;

// Small indicator node rendered at the top (incoming) or bottom
// (outgoing) of the flow canvas to show where a cross-phase
// prerequisite or dependent lives. Faded appearance so it doesn't
// compete with real task nodes.
export function CrossPhaseIndicator({
  data,
}: NodeProps<CrossPhaseNode>) {
  const arrow = data.direction === 'incoming' ? '←' : '→';
  return (
    <div className={`cross-phase-indicator cross-phase-${data.direction}`}>
      {data.direction === 'incoming' && (
        <Handle type="source" position={Position.Bottom} />
      )}
      <span className="cross-phase-arrow">{arrow}</span>
      <span className="cross-phase-label">
        <span className="cross-phase-phase">{data.phaseName}</span>
        <span className="cross-phase-task">{data.taskName}</span>
      </span>
      {data.direction === 'outgoing' && (
        <Handle type="target" position={Position.Top} />
      )}
    </div>
  );
}
