import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { TaskNodeData } from '../utils/flowLayout';
import type { PerspectiveInfo } from '../utils/perspective';
import { isCollapsedTask } from '../utils/collapseIrrelevant';
import './TaskNode.css';

type TaskFlowNode = Node<TaskNodeData, 'task'>;

const FALLBACK_COLOUR = '#6366f1';

// Border weight counter-scaled against the canvas zoom so the visible
// stroke stays ~2px regardless of how far the user zooms out. --rf-zoom
// is set imperatively by ProcessFlow on the flow container.
const PERSP_BORDER_WIDTH = 'clamp(1.5px, calc(2px / var(--rf-zoom, 1)), 18px)';

// Involvement level → card treatment. Accountable and contributor
// share the strong dept-colour fill (contributor distinguished by a
// dashed border); referenced gets a faint fill + dashed border.
// Meeting organiser does NOT tint the card — instead the calendar
// badge background is coloured (handled in the component body), which
// reads cleaner. perspectiveStyle returns the card style; the caller
// derives the badge colour separately.
function perspectiveStyle(info: PerspectiveInfo | undefined): {
  style: CSSProperties;
} {
  if (!info) return { style: {} };
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
      };
    case 'contributor':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '70', // same fill as accountable
          borderStyle: 'dashed', // distinguished by dashed border
          borderWidth: PERSP_BORDER_WIDTH,
        },
      };
    case 'meetingOrganiser':
      // Card left untouched; the calendar badge carries the signal.
      return { style: {} };
    case 'referenced':
      return {
        style: {
          borderColor: colour,
          backgroundColor: colour + '0D', // ~5%
          borderStyle: 'dashed',
          borderWidth: PERSP_BORDER_WIDTH,
        },
      };
    case 'none':
      return { style: {} };
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

  const persp = data.perspective;

  const baseStyle: CSSProperties = {
    width: data.width,
    minHeight: data.height,
  };

  const perspResult = perspectiveStyle(persp);

  const style: CSSProperties = {
    ...baseStyle,
    ...perspResult.style,
  };

  const classes = [
    'task-node',
    selected ? 'task-node-selected' : '',
    data.searchDimmed ? 'task-node-search-dimmed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const contributorDots = persp?.contributorColours ?? [];

  // Tint the calendar badge with the organising department's colour:
  //  - in a dept/role lens, when THIS filter's role is the organiser
  //    (uses the lens colour);
  //  - in allDepartments mode, always, using the organiser's own dept
  //    colour (surfaced as meetingOrganiserColour) so it sits alongside
  //    the other role colours.
  const meetingBadgeColour =
    persp?.role === 'meetingOrganiser'
      ? persp.colour ?? FALLBACK_COLOUR
      : persp?.meetingOrganiserColour ?? null;

  return (
    <div className={classes} style={style}>
      <Handle type="target" position={Position.Top} />
      <>
        {/* Calendar icon — top right */}
          {task.isMeetingTask && (
            <span
              className={`task-node-badge task-node-badge-tr${meetingBadgeColour ? ' task-node-badge-highlight' : ''}`}
              style={
                meetingBadgeColour
                  ? { backgroundColor: meetingBadgeColour, borderColor: meetingBadgeColour }
                  : undefined
              }
              title={meetingBadgeColour ? 'Meeting organiser' : 'Meeting task'}
            >
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
