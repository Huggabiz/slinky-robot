import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { layoutTasks, type LayoutResult } from '../utils/flowLayout';
import { computePerspective, type PerspectiveInfo } from '../utils/perspective';
import { collapseIrrelevantTasks, COLLAPSED_PREFIX } from '../utils/collapseIrrelevant';
import { DEFAULT_LAB_CONFIG } from '../utils/flowLab';
import './BookFlowDiagram.css';

interface Props {
  phaseId: string;
  phaseName: string;
  // When set, tasks whose ID is in this set get a department-coloured
  // highlight ring so the reader can see which steps belong to the
  // active filter. Null = no highlighting (unfiltered view).
  highlightTaskIds?: Set<string> | null;
  // When set, the diagram collapses tasks NOT in this set into
  // "other tasks" placeholders (simplified per-team flow).
  collapseRelevantIds?: Set<string> | null;
}

// Static SVG rendering of a phase's flow diagram for the book view.
// Runs the same ELK layout as ProcessFlow but renders plain SVG
// elements instead of React Flow — lighter, printable, no interactivity.
export function BookFlowDiagram({
  phaseId,
  phaseName,
  highlightTaskIds,
  collapseRelevantIds,
}: Props) {
  const file = useAppStore((s) => s.file);
  const [layout, setLayout] = useState<LayoutResult | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const tasks =
      collapseRelevantIds && collapseRelevantIds.size > 0
        ? collapseIrrelevantTasks(file, phaseId, collapseRelevantIds)
        : file.tasks;
    layoutTasks(tasks, phaseId, DEFAULT_LAB_CONFIG)
      .then((result) => {
        if (!cancelled) setLayout(result);
      })
      .catch(() => {
        if (!cancelled) setLayout(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file, phaseId, collapseRelevantIds]);

  // Always compute allDepartments perspective for the book view.
  const perspMap = useMemo(() => {
    if (!file) return new Map<string, PerspectiveInfo>();
    return computePerspective(file, { type: 'allDepartments' });
  }, [file]);

  // Departments represented in this phase's tasks (accountable or
  // contributor). Used for the colour legend under the diagram.
  const legendDepts = useMemo(() => {
    if (!file) return [] as { id: string; name: string; colour: string }[];
    const roleToDeptId = new Map<string, string>();
    for (const role of file.roles) {
      if (role.departmentId) roleToDeptId.set(role.name, role.departmentId);
    }
    const used = new Set<string>();
    for (const t of file.tasks) {
      if (t.phaseId !== phaseId) continue;
      const acctDept = roleToDeptId.get(t.accountable);
      if (acctDept) used.add(acctDept);
      for (const c of t.contributors) {
        const cDept = roleToDeptId.get(c);
        if (cDept) used.add(cDept);
      }
    }
    return file.departments
      .filter((d) => used.has(d.id) && d.colour)
      .map((d) => ({ id: d.id, name: d.name, colour: d.colour as string }));
  }, [file, phaseId]);

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
      <h3 className="book-flow-title">{phaseName} Task Flow</h3>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ maxHeight: Math.min(svgHeight, 800) }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="book-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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

              // Collapsed placeholder: muted dashed box with label.
              if (task.id.startsWith(COLLAPSED_PREFIX)) {
                return (
                  <g key={n.id} transform={`translate(${n.position.x}, ${n.position.y})`}>
                    <rect
                      width={w}
                      height={h}
                      rx={4}
                      ry={4}
                      fill="#f4f4f4"
                      stroke="#bbb"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                    <text
                      x={w / 2}
                      y={h / 2}
                      fontSize={11}
                      fill="#888"
                      fontStyle="italic"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {task.name}
                    </text>
                  </g>
                );
              }

              const persp = perspMap.get(task.id ?? n.id);
              const fillColour = persp?.colour
                ? `${persp.colour}30`
                : 'white';
              const strokeColour = persp?.colour ?? '#ccc';
              const contribDots = persp?.contributorColours ?? [];
              const highlighted =
                highlightTaskIds != null &&
                highlightTaskIds.has(task.id);
              // Glow colour matches the task's accountable department
              // so the highlight reads as "this department's work".
              const glowColour = persp?.colour ?? '#06b6d4';
              return (
                <g key={n.id} transform={`translate(${n.position.x}, ${n.position.y})`}>
                  {/* Department-coloured highlight ring when the task
                      matches the active book filter. Drawn 5px outside
                      the node so it doesn't merge with the node border. */}
                  {highlighted && (
                    <rect
                      x={-5}
                      y={-5}
                      width={w + 10}
                      height={h + 10}
                      rx={8}
                      ry={8}
                      fill="none"
                      stroke={glowColour}
                      strokeWidth={3}
                      filter="url(#book-glow)"
                    />
                  )}
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
                  {wrapText(task.name || '(untitled)', 26, 2).map(
                    (line, li) => (
                      <text
                        key={li}
                        x={8}
                        y={30 + li * 14}
                        fontSize={11}
                        fontWeight={600}
                        fill="#1a1a1a"
                      >
                        {line}
                      </text>
                    ),
                  )}
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
                  {/* Meeting icon — top right, white pill bg. */}
                  {task.isMeetingTask && (
                    <g>
                      <rect
                        x={w - 22}
                        y={2}
                        width={18}
                        height={18}
                        rx={5}
                        ry={5}
                        fill="white"
                        stroke="rgba(0,0,0,0.1)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={w - 13}
                        y={11}
                        fontSize={11}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >📅</text>
                    </g>
                  )}
                  {/* Deliverable icon — bottom right, white pill bg. */}
                  {task.deliverableTargets?.length > 0 && (
                    <g>
                      <rect
                        x={w - 22}
                        y={h - 20}
                        width={18}
                        height={18}
                        rx={5}
                        ry={5}
                        fill="white"
                        stroke="rgba(0,0,0,0.1)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={w - 13}
                        y={h - 11}
                        fontSize={11}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >📄</text>
                    </g>
                  )}
                  {/* Contributor department dots — white pill for legibility
                     on coloured cell backgrounds. */}
                  {contribDots.length > 0 && (() => {
                    const dotR = 3;
                    const dotGap = 3;
                    const dotW = dotR * 2;
                    const pillPadX = 5;
                    const pillPadY = 2;
                    const dotsW =
                      contribDots.length * dotW +
                      (contribDots.length - 1) * dotGap;
                    const pillW = dotsW + pillPadX * 2;
                    const pillH = dotW + pillPadY * 2;
                    const pillX = w / 2 - pillW / 2;
                    const pillY = h - pillH / 2 - 1;
                    return (
                      <g>
                        <rect
                          x={pillX}
                          y={pillY}
                          width={pillW}
                          height={pillH}
                          rx={pillH / 2}
                          ry={pillH / 2}
                          fill="white"
                          stroke="rgba(0,0,0,0.1)"
                          strokeWidth={1}
                        />
                        {contribDots.map((c, i) => (
                          <circle
                            key={i}
                            cx={pillX + pillPadX + dotR + i * (dotW + dotGap)}
                            cy={pillY + pillH / 2}
                            r={dotR}
                            fill={c}
                          />
                        ))}
                      </g>
                    );
                  })()}
                </g>
              );
            })}
        </g>
      </svg>
      {legendDepts.length > 0 && (
        <ul className="book-flow-legend">
          {legendDepts.map((d) => (
            <li key={d.id}>
              <span
                className="book-flow-legend-swatch"
                style={{ backgroundColor: d.colour }}
                aria-hidden
              />
              {d.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Word-wrap text into up to `maxLines` lines of roughly `charsPerLine`
// characters each. The last line gets an ellipsis if there's still
// overflow. Splits on spaces; falls back to a hard cut if a single
// word exceeds the line width.
function wrapText(
  text: string,
  charsPerLine: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        lines.push(word.slice(0, charsPerLine));
        current = word.slice(charsPerLine);
      }
    }
    if (lines.length === maxLines) {
      const remaining = [current, ...words.slice(words.indexOf(word) + 1)]
        .join(' ')
        .trim();
      if (remaining) {
        lines[maxLines - 1] =
          remaining.length > charsPerLine
            ? remaining.slice(0, charsPerLine - 1) + '…'
            : remaining;
      }
      return lines;
    }
  }
  if (current) lines.push(current);
  return lines;
}
