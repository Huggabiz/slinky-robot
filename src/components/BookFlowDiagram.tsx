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
  // Maps a matched task's ID → the glow colour for its highlight ring.
  highlightColours?: Map<string, string> | null;
  // When set, the diagram collapses tasks NOT in this set into
  // "other tasks" placeholders (simplified per-team flow).
  collapseRelevantIds?: Set<string> | null;
  // Human-readable label for the glow ring in the legend (e.g.
  // "Category Management"). Shown only when highlightColours is active.
  glowLabel?: string | null;
}

// Static SVG rendering of a phase's flow diagram for the book view.
// Runs the same ELK layout as ProcessFlow but renders plain SVG
// elements instead of React Flow — lighter, printable, no interactivity.
export function BookFlowDiagram({
  phaseId,
  phaseName,
  highlightColours,
  collapseRelevantIds,
  glowLabel,
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

  // Departments represented in the *rendered* tasks (those that survived
  // simplification). When the simplified view hides a department's only
  // tasks, its swatch drops out of the legend so it doesn't mislead.
  const legendDepts = useMemo(() => {
    if (!file || !layout) return [] as { id: string; name: string; colour: string }[];
    const roleToDeptId = new Map<string, string>();
    for (const role of file.roles) {
      if (role.departmentId) roleToDeptId.set(role.name, role.departmentId);
    }
    // Collect IDs of tasks actually in the layout (excludes collapsed
    // placeholders — their synthetic ids start with COLLAPSED_PREFIX).
    const visibleIds = new Set<string>();
    for (const n of layout.nodes) {
      if (!n.id.startsWith(COLLAPSED_PREFIX)) visibleIds.add(n.id);
    }
    const used = new Set<string>();
    for (const t of file.tasks) {
      if (!visibleIds.has(t.id)) continue;
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
  }, [file, layout]);

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

  // The SVG is displayed at the book column width (~640px) but capped at
  // 800px tall. Estimate the on-screen scale so we can tell when the task
  // boxes would render too small to read. Below that, switch to a compact
  // mode that shows only the task id (the reader finds full detail in the
  // step cards that follow). Mirrors how the live flow stays legible.
  const DISPLAY_W = 640;
  const MAX_H = 800;
  const renderScale = Math.min(DISPLAY_W / svgWidth, MAX_H / svgHeight, 1);
  const nodeW = DEFAULT_LAB_CONFIG.nodeWidth;
  // Caption appears once boxes have shed their titles (standard box too
  // small to label), pointing the reader to the step cards below.
  const reducedDetail = nodeW * renderScale < 90;
  // Font enlargement applied to scaled-down boxes so retained text fills
  // the box rather than shrinking with it (capped).
  const boost = Math.max(1, Math.min(1 / renderScale, 3.2));

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

              // Collapsed placeholder: muted dashed box with label. Font
              // is boosted/fitted like the task boxes so it stays readable
              // when the diagram is scaled right down.
              if (task.id.startsWith(COLLAPSED_PREFIX)) {
                const plLabel = task.name || 'Other tasks';
                const plFont = Math.max(
                  8,
                  Math.min(
                    (w - 16) / Math.max(6, plLabel.length * 0.55),
                    h * 0.32,
                    13 * boost,
                  ),
                );
                return (
                  <g key={n.id} transform={`translate(${n.position.x}, ${n.position.y})`}>
                    <rect
                      width={w}
                      height={h}
                      rx={16}
                      ry={16}
                      fill="#f4f4f4"
                      stroke="#bbb"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                    <text
                      x={w / 2}
                      y={h / 2}
                      fontSize={plFont}
                      fill="#888"
                      fontStyle="italic"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {plLabel}
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
              // Glow colour comes from the active book filter (the selected
              // department/role), not the task's own accountable dept.
              const glowColour = highlightColours?.get(task.id) ?? null;
              return (
                <BookTaskBox
                  key={n.id}
                  x={n.position.x}
                  y={n.position.y}
                  w={w}
                  h={h}
                  taskId={task.taskId}
                  name={task.name}
                  activityType={task.activityType}
                  isMeetingTask={task.isMeetingTask}
                  hasDeliverables={task.deliverableTargets?.length > 0}
                  fillColour={fillColour}
                  strokeColour={strokeColour}
                  contribDots={contribDots}
                  glowColour={glowColour}
                  renderScale={renderScale}
                />
              );
            })}
        </g>
      </svg>
      {reducedDetail && (
        <p className="book-flow-compact-note">
          This phase has too many steps to label in full at page size —
          smaller boxes show only the task ID. Full detail for each step
          follows below.
        </p>
      )}
      {(legendDepts.length > 0 || (highlightColours && highlightColours.size > 0)) && (
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
          {highlightColours && highlightColours.size > 0 && (
            <li key="__glow" className="book-flow-legend-glow">
              <span
                className="book-flow-legend-glow-swatch"
                style={{
                  borderColor: [...highlightColours.values()][0],
                  boxShadow: `0 0 5px ${[...highlightColours.values()][0]}`,
                }}
                aria-hidden
              />
              Relevant to {glowLabel || 'filter'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// Adaptive task box for the book-view SVG. As the diagram is scaled down
// to fit the page, text would become illegible, so information is shed in
// priority order — keeping the most useful bits readable for as long as
// possible:
//   1. activity type + corner badges drop first (smallest boxes lose them)
//   2. then the title (wrapped, drops when there's no room for a line)
//   3. the task ID + contributor dots are the last to go (the ID becomes a
//      large centred "hero" so it stays readable; the dots keep the colour
//      coding). The reader finds full detail in the step cards below.
// Fonts are boosted inversely to the render scale so the retained text
// fills the box rather than shrinking with it. This affects ONLY the book
// view; the live process flow (TaskNode) is untouched.
const TASK_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function BookTaskBox({
  x,
  y,
  w,
  h,
  taskId,
  name,
  activityType,
  isMeetingTask,
  hasDeliverables,
  fillColour,
  strokeColour,
  contribDots,
  glowColour,
  renderScale,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  taskId: string;
  name: string;
  activityType: string;
  isMeetingTask: boolean;
  hasDeliverables: boolean;
  fillColour: string;
  strokeColour: string;
  contribDots: string[];
  glowColour: string | null;
  renderScale: number;
}) {
  const highlighted = glowColour != null;
  const rW = w * renderScale;
  // Enlarge fonts as the diagram shrinks (capped) so retained text stays
  // legible; never shrink below the design size when scaled up.
  const boost = Math.max(1, Math.min(1 / renderScale, 3.2));

  // Activity type + corner badges drop first. Contributor dots ALWAYS
  // show when present (their absence/presence flicker was confusing).
  const showType = rW >= 150;
  const showDots = contribDots.length > 0;

  const idHeaderFont = 9 * boost;
  const typeFont = 8 * boost;

  const dotR = Math.min(3 * boost, 7);
  const dotsBandH = showDots ? dotR * 2 + 6 : 0;

  const topPad = 6;
  const idLineH = idHeaderFont * 1.25;
  const titleTop = topPad + idLineH;
  const bottomReserve = (showType ? typeFont * 1.7 : 0) + dotsBandH;
  const titleAvailH = h - titleTop - bottomReserve - 2;
  const usableW = w - 16;

  // Fit the WHOLE title (no ellipsis): take the largest font up to a
  // modest rendered ceiling, shrinking and adding lines as needed. If it
  // still won't fit at a readable floor, drop the title and show the ID
  // as a hero instead — never truncate with an ellipsis.
  const maxTitleF = 11 / renderScale; // ~11px rendered ceiling
  const minTitleF = 6.5 / renderScale; // below this → hero ID
  const fullName = name || '(untitled)';
  const longestWord = Math.max(
    1,
    ...fullName.split(/\s+/).map((wd) => wd.length),
  );
  let titleFont = 0;
  let titleLines: string[] = [];
  if (titleAvailH >= minTitleF * 1.15) {
    const steps = 14;
    for (let k = 0; k <= steps; k++) {
      const F = maxTitleF - ((maxTitleF - minTitleF) * k) / steps;
      const cpl = Math.floor(usableW / (F * 0.52));
      if (cpl < 3 || longestWord > cpl) continue;
      const lines = wrapAll(fullName, cpl);
      if (lines.length * F * 1.15 <= titleAvailH) {
        titleFont = F;
        titleLines = lines;
        break;
      }
    }
  }
  const showTitle = titleLines.length > 0;
  const titleLineH = titleFont * 1.15;

  const dotsPill = (cy: number) => {
    const dotGap = dotR;
    const dotW = dotR * 2;
    const padX = dotR + 2;
    const padY = 2;
    const dotsW =
      contribDots.length * dotW + (contribDots.length - 1) * dotGap;
    const pillW = dotsW + padX * 2;
    const pillH = dotW + padY * 2;
    const pillX = w / 2 - pillW / 2;
    const pillY = cy - pillH / 2;
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
            cx={pillX + padX + dotR + i * (dotW + dotGap)}
            cy={pillY + pillH / 2}
            r={dotR}
            fill={c}
          />
        ))}
      </g>
    );
  };

  return (
    <g transform={`translate(${x}, ${y})`}>
      {highlighted && (
        <rect
          x={-5}
          y={-5}
          width={w + 10}
          height={h + 10}
          rx={8}
          ry={8}
          fill="none"
          stroke={glowColour ?? '#06b6d4'}
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

      {showTitle ? (
        <>
          <text
            x={8}
            y={topPad + idHeaderFont}
            fontSize={idHeaderFont}
            fill="#888"
            fontFamily={TASK_MONO}
          >
            {taskId}
          </text>
          {titleLines.map((line, li) => (
            <text
              key={li}
              x={8}
              y={titleTop + titleFont + li * titleLineH}
              fontSize={titleFont}
              fontWeight={600}
              fill="#1a1a1a"
            >
              {line}
            </text>
          ))}
          {showType && activityType && (
            <text
              x={8}
              y={h - 6}
              fontSize={typeFont}
              fill="#aaa"
              style={{ textTransform: 'uppercase' }}
            >
              {activityType}
            </text>
          )}
          {showType && isMeetingTask && (
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
              <text x={w - 13} y={11} fontSize={11} textAnchor="middle" dominantBaseline="central">📅</text>
            </g>
          )}
          {showType && hasDeliverables && (
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
              <text x={w - 13} y={h - 11} fontSize={11} textAnchor="middle" dominantBaseline="central">📄</text>
            </g>
          )}
          {showDots && dotsPill(h - (dotR + 3))}
        </>
      ) : (
        <>
          {(() => {
            const idStr = taskId || '—';
            const heroFont = Math.max(
              10,
              Math.min(h * 0.42, usableW / Math.max(4, idStr.length) / 0.62, 46),
            );
            const cy = showDots ? h / 2 - dotR : h / 2;
            return (
              <text
                x={w / 2}
                y={cy}
                fontSize={heroFont}
                fontWeight={700}
                fill="#1a1a1a"
                fontFamily={TASK_MONO}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {idStr}
              </text>
            );
          })()}
          {showDots && dotsPill(h - (dotR + 4))}
        </>
      )}
    </g>
  );
}

// Word-wrap text into as many lines as needed (NO line cap, NO ellipsis)
// of roughly `charsPerLine` characters each. A single word longer than
// the line width is hard-split. The caller decides whether the resulting
// line count fits the available height.
function wrapAll(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    let w = word;
    while (w.length > charsPerLine) {
      lines.push(w.slice(0, charsPerLine));
      w = w.slice(charsPerLine);
    }
    current = w;
  }
  if (current) lines.push(current);
  return lines;
}
