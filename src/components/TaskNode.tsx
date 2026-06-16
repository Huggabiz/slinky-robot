import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { TaskNodeData } from '../utils/flowLayout';
import type { HighlightInfo } from '../utils/highlight';
import type { PerspectiveInfo } from '../utils/perspective';
import { isCollapsedTask } from '../utils/collapseIrrelevant';
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

// Border weight counter-scaled against the canvas zoom so the visible
// stroke stays ~2px regardless of how far the user zooms out. --rf-zoom
// is set imperatively by ProcessFlow on the flow container.
const PERSP_BORDER_WIDTH = 'clamp(1.5px, calc(2px / var(--rf-zoom, 1)), 18px)';

// Involvement level → background fill alpha (hex suffix). Fill intensity
// is the primary, zoom-robust signal: the "heat" of a card tells you
// your involvement level at a glance even when borders are too small to
// read. Strongest = accountable, fading down to referenced.
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
          backgroundColor: colour + '70', // ~44%
          borderStyle: 'solid',
          borderWidth: PERSP_BORDER_WIDTH,
        },
        className: '',
      };
    case 'contributor':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '3D', // ~24%
          borderStyle: 'solid',
          borderWidth: PERSP_BORDER_WIDTH,
        },
        className: '',
      };
    case 'meetingOrganiser':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '1F', // ~12%
          borderStyle: 'solid',
          borderWidth: PERSP_BORDER_WIDTH,
        },
        className: '',
      };
    case 'referenced':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '0D', // ~5%
          borderStyle: 'dotted',
          borderWidth: PERSP_BORDER_WIDTH,
        },
        className: '',
      };
    case 'none':
      return { style: {}, className: '' };
  }
}

export function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  const task = data.task;

  // Collapsed placeholder: muted dashed card with just the label.
  if (isCollapsedTask(task)) {
    return (
      <div
        className="task-node task-node-collapsed"
        style={{ width: data.width, minHeight: data.height }}
      >
        <Handle type="target" position={Position.Top} />
        <div className="task-node-collapsed-label">
          {task.name || 'Other tasks'}
        </div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

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
    data.searchDimmed ? 'task-node-search-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const contributorDots = persp?.contributorColours ?? [];

  return (
    <div className={classes} style={style}>
      <Handle type="target" position={Position.Top} />
      <>
        {/* Calendar icon — top right */}
          {task.isMeetingTask && (
            <span className="task-node-badge task-node-badge-tr" title="Meeting task">
              📅
            </span>
          )}
          {/* Deliverable icon — bottom right */}
          {task.deliverableTargets.length > 0 && (
            <span
              className="task-node-badge task-node-badge-br"
              title={`${task.deliverableTargets.length} deliverable target${task.deliverableTargets.length > 1 ? 's' : ''}`}
            >
              📄
            </span>
          )}
          <div className="task-node-header">
            <span className="task-node-id">{task.taskId}</span>
            {task.abbr && (
              <span
                className={`task-node-abbr${task.isMeetingTask ? ' task-node-abbr-shifted' : ''}`}
              >
                {task.abbr}
              </span>
            )}
          </div>
          <div className="task-node-name">
            {task.name || '(untitled)'}
          </div>
          <div className="task-node-footer">
            {task.activityType && (
              <span className="task-node-type">{task.activityType}</span>
            )}
          </div>
          {contributorDots.length > 0 && (
            <div className="task-node-contrib-dots">
              {contributorDots.map((c, i) => (
                <span
                  key={i}
                  className="task-node-contrib-dot"
                  style={{ backgroundColor: c }}
                  title="Contributing department"
                />
              ))}
            </div>
          )}
      </>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
