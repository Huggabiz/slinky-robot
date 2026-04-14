import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { TaskNodeData } from '../utils/flowLayout';
import './TaskNode.css';

// Typed Node alias so NodeProps picks up our custom data payload.
type TaskFlowNode = Node<TaskNodeData, 'task'>;

// FLOW LAB: node dimensions come from data.width/height which are
// driven by the lab config. To revert, hard-code style width/height
// back to constants and drop width/height from TaskNodeData.
export function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  const task = data.task;
  return (
    <div
      className={selected ? 'task-node task-node-selected' : 'task-node'}
      style={{ width: data.width, minHeight: data.height }}
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
