import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { TaskNodeData } from '../utils/flowLayout';
import type { HighlightInfo } from '../utils/highlight';
import './TaskNode.css';

// Typed Node alias so NodeProps picks up our custom data payload.
type TaskFlowNode = Node<TaskNodeData, 'task'>;

// Colours for the dependency-highlight tool. Kept in sync with the
// legend swatches in FlowToolbar.css.
//   self   — cyan   (selected task)
//   past   — green  (prerequisites / upstream)
//   future — blue   (dependents   / downstream)
const HIGHLIGHT_COLOURS: Record<
  HighlightInfo['role'],
  { r: number; g: number; b: number }
> = {
  self: { r: 6, g: 182, b: 212 },
  past: { r: 16, g: 185, b: 129 },
  future: { r: 59, g: 130, b: 246 },
};

function highlightStyle(info: HighlightInfo | undefined): CSSProperties {
  if (!info) return {};
  const c = HIGHLIGHT_COLOURS[info.role];
  // Self always gets full tint; other roles fade with distance.
  const alpha = info.role === 'self' ? 1 : info.opacity;
  return {
    borderColor: `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`,
    backgroundColor: `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.15})`,
  };
}

// FLOW LAB: node dimensions come from data.width/height which are
// driven by the lab config. To revert, hard-code style width/height
// back to constants and drop width/height from TaskNodeData.
export function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  const task = data.task;
  const hl = data.highlight;
  const baseStyle: CSSProperties = {
    width: data.width,
    minHeight: data.height,
  };
  const style: CSSProperties = { ...baseStyle, ...highlightStyle(hl) };
  return (
    <div
      className={selected ? 'task-node task-node-selected' : 'task-node'}
      style={style}
    >
      <Handle type="target" position={Position.Top} />
      <div className="task-node-header">
        <span className="task-node-id">{task.taskId}</span>
        {task.abbr && <span className="task-node-abbr">{task.abbr}</span>}
      </div>
      <div className="task-node-name">{task.name || '(untitled)'}</div>
      {task.activityType && (
        <div className="task-node-type">{task.activityType}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
