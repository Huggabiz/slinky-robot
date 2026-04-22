import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { layoutTasks, type LayoutResult } from '../utils/flowLayout';
import { computePerspective, type PerspectiveInfo } from '../utils/perspective';
import { DEFAULT_LAB_CONFIG } from '../utils/flowLab';
import './BookFlowDiagram.css';

interface Props {
  phaseId: string;
}

// Static SVG rendering of a phase's flow diagram for the book view.
// Runs the same ELK layout as ProcessFlow but renders plain SVG
// elements instead of React Flow — lighter, printable, no interactivity.
export function BookFlowDiagram({ phaseId }: Props) {
  const file = useAppStore((s) => s.file);
  const [layout, setLayout] = useState<LayoutResult | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    layoutTasks(file.tasks, phaseId, DEFAULT_LAB_CONFIG)
      .then((result) => {
        if (!cancelled) setLayout(result);
      })
      .catch(() => {
        if (!cancelled) setLayout(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file, phaseId]);

  // Always compute allDepartments perspective for the book view.
  const perspMap = useMemo(() => {
    if (!file) return new Map<string, PerspectiveInfo>();
    return computePerspective(file, { type: 'allDepartments' }, false);
  }, [file]);

  if (!layout || layout.nodes.length === 0) return null;

  // Compute bounding box.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of layout.nodes) {
    const w = n.width ?? 200;
    const h = n.height ?? 96;
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
    if (n.position.x + w > maxX) maxX = n.position.x + w;
    if (n.position.y + h > maxY) maxY = n.position.y + h;
  }

  const pad = 20;
  const svgWidth = maxX - minX + pad * 2;
  const svgHeight = maxY - minY + pad * 2;
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;

  return (
    <div className="book-flow-diagram">
      <h3 className="book-flow-title">Task Flow Diagram</h3>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ maxHeight: Math.min(svgHeight, 800) }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="book-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="#666" />
          </marker>
        </defs>

        <g transform={`translate(${offsetX}, ${offsetY})`}>
          {/* Edges first so they render behind nodes. */}
          {layout.edges.map((edge) => {
            const pathData =
              (edge.data as { path?: string } | undefined)?.path ?? '';
            if (!pathData) return null;
            return (
              <path
                key={edge.id}
                d={pathData}
                fill="none"
                stroke="#999"
                strokeWidth={1.5}
                markerEnd="url(#book-arrow)"
              />
            );
          })}

          {/* Nodes. */}
          {layout.nodes
            .filter((n) => n.type === 'task')
            .map((n) => {
              const w = n.width ?? 200;
              const h = n.height ?? 96;
              const taskData = n.data as {
                task?: {
                  id: string;
                  taskId: string;
                  name: string;
                  activityType: string;
                  isMeetingTask: boolean;
                  deliverableTargets: unknown[];
                };
              } | undefined;
              const task = taskData?.task;
              if (!task) return null;
              const persp = perspMap.get(task.id ?? n.id);
              const fillColour = persp?.colour
                ? `${persp.colour}30`
                : 'white';
              const strokeColour = persp?.colour ?? '#ccc';
              const contribDots = persp?.contributorColours ?? [];
              return (
                <g key={n.id} transform={`translate(${n.position.x}, ${n.position.y})`}>
                  <rect
                    width={w}
                    height={h}
                    rx={4}
                    ry={4}
                    fill={fillColour}
                    stroke={strokeColour}
                    strokeWidth={1.5}
                  />
                  <text
                    x={8}
                    y={14}
                    fontSize={9}
                    fill="#888"
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  >
                    {task.taskId}
                  </text>
                  <text
                    x={8}
                    y={32}
                    fontSize={11}
                    fontWeight={600}
                    fill="#1a1a1a"
                  >
                    {truncate(task.name || '(untitled)', 28)}
                  </text>
                  {task.activityType && (
                    <text
                      x={8}
                      y={h - 8}
                      fontSize={8}
                      fill="#aaa"
                      style={{ textTransform: 'uppercase' }}
                    >
                      {task.activityType}
                    </text>
                  )}
                  {/* Meeting icon — top right */}
                  {task.isMeetingTask && (
                    <text x={w - 16} y={14} fontSize={11}>📅</text>
                  )}
                  {/* Deliverable icon — bottom right */}
                  {task.deliverableTargets?.length > 0 && (
                    <text x={w - 16} y={h - 6} fontSize={11}>📄</text>
                  )}
                  {/* Contributor department dots */}
                  {contribDots.length > 0 && (
                    <g transform={`translate(${w / 2 - (contribDots.length * 9) / 2}, ${h - 2})`}>
                      {contribDots.map((c, i) => (
                        <circle
                          key={i}
                          cx={i * 9 + 3}
                          cy={0}
                          r={3}
                          fill={c}
                        />
                      ))}
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}
