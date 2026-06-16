import type { NodeProps, Node } from '@xyflow/react';
import type { TaskNodeData } from '../utils/flowLayout';
import './CollapsedNode.css';

type CollapsedFlowNode = Node<TaskNodeData, 'task'>;

// Renders a muted placeholder for a group of collapsed tasks.
// Uses the same 'task' node type so React Flow's layout treats it
// identically to a real task card — same dimensions, same ports.
// Distinguished visually by a dashed border and muted text.
export function CollapsedNode({ data }: NodeProps<CollapsedFlowNode>) {
  const task = data.task;
  return (
    <div
      className="collapsed-node"
      style={{ width: data.width, minHeight: data.height }}
    >
      <div className="collapsed-node-label">
        {task.name || 'Other tasks'}
      </div>
    </div>
  );
}
