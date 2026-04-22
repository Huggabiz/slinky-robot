import type { NodeProps, Node } from '@xyflow/react';
import './GateSeparator.css';

export interface GateSeparatorData extends Record<string, unknown> {
  label: string;
}

type GateSeparatorNode = Node<GateSeparatorData, 'gateSeparator'>;

// A thin decorative node that renders as a horizontal dashed line
// spanning the layout width, placed just above key-date tasks.
// Non-interactive — no handles, no click behaviour.
export function GateSeparator({ data }: NodeProps<GateSeparatorNode>) {
  return (
    <div className="gate-separator">
      <div className="gate-separator-line" />
      {data.label && (
        <span className="gate-separator-label">{data.label}</span>
      )}
    </div>
  );
}
