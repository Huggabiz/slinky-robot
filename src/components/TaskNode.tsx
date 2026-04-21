import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { TaskNodeData } from '../utils/flowLayout';
import type { HighlightInfo } from '../utils/highlight';
import type { PerspectiveInfo } from '../utils/perspective';
import './TaskNode.css';

type TaskFlowNode = Node<TaskNodeData, 'task'>;

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
  const alpha = info.role === 'self' ? 1 : info.opacity;
  return {
    borderColor: `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`,
    backgroundColor: `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.15})`,
  };
}

const FALLBACK_COLOUR = '#6366f1';

function perspectiveStyle(info: PerspectiveInfo | undefined): {
  style: CSSProperties;
  className: string;
} {
  if (!info) return { style: {}, className: '' };
  const colour = info.colour ?? FALLBACK_COLOUR;

  switch (info.role) {
    case 'accountable':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '30',
          borderStyle: 'solid',
        },
        className: '',
      };
    case 'contributor':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '15',
          borderStyle: 'dashed',
        },
        className: '',
      };
    case 'meetingOrganiser':
      return {
        style: {
          borderColor: colour,
          backgroundColor: 'transparent',
          borderStyle: 'solid',
        },
        className: '',
      };
    case 'none':
      return {
        style: {},
        className: info.hideOthers
          ? 'task-node-hidden'
          : 'task-node-desaturated',
      };
  }
}

export function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  const task = data.task;
  const hl = data.highlight;
  const persp = data.perspective;

  const baseStyle: CSSProperties = {
    width: data.width,
    minHeight: data.height,
  };

  // Perspective overrides highlight when both are active.
  const perspResult = perspectiveStyle(persp);
  const hlStyle = persp ? {} : highlightStyle(hl);

  const style: CSSProperties = {
    ...baseStyle,
    ...hlStyle,
    ...perspResult.style,
  };

  const classes = [
    'task-node',
    selected ? 'task-node-selected' : '',
    perspResult.className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style}>
      <Handle type="target" position={Position.Top} />
      {perspResult.className === 'task-node-hidden' ? (
        // Empty rectangle — no text content.
        <div className="task-node-hidden-inner" />
      ) : (
        <>
          <div className="task-node-header">
            <span className="task-node-id">{task.taskId}</span>
            {task.abbr && (
              <span className="task-node-abbr">{task.abbr}</span>
            )}
          </div>
          <div className="task-node-name">
            {task.name || '(untitled)'}
          </div>
          <div className="task-node-footer">
            {task.activityType && (
              <span className="task-node-type">{task.activityType}</span>
            )}
            <span className="task-node-icons">
              {task.isMeetingTask && (
                <span className="task-node-icon" title="Meeting task">
                  📅
                </span>
              )}
              {task.deliverableTargets.length > 0 && (
                <span
                  className="task-node-icon"
                  title={`${task.deliverableTargets.length} deliverable target${task.deliverableTargets.length > 1 ? 's' : ''}`}
                >
                  📄
                </span>
              )}
            </span>
          </div>
        </>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
