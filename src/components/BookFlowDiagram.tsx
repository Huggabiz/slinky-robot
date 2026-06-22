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

  // Gather names / ids / placeholder labels + key-date gate lines.
  const taskNames: string[] = [];
  const taskIds: string[] = [];
  const placeholderLabels: string[] = [];
  const gateLines: { y: number; label: string }[] = [];
  for (const n of layout.nodes) {
    if (n.type !== 'task') continue;
    const t = (n.data as {
      task?: {
        id: string;
        taskId: string;
        name: string;
        dateType?: string;
        abbr?: string | null;
      };
    })?.task;
    if (!t) continue;
    if (t.id.startsWith(COLLAPSED_PREFIX)) {
      placeholderLabels.push(t.name || 'Other tasks');
      continue;
    }
    taskNames.push(t.name || '(untitled)');
    taskIds.push(t.taskId || '—');
    if (t.dateType === 'KEY DATE' || t.dateType === 'MS DATE') {
      gateLines.push({
        y: n.position.y + (n.height ?? DEFAULT_LAB_CONFIG.nodeHeight) / 2,
        label: t.abbr ?? '',
      });
    }
  }

  const nodeW = DEFAULT_LAB_CONFIG.nodeWidth;
  const nodeH = DEFAULT_LAB_CONFIG.nodeHeight;
  const usableW = nodeW - 16;

  // Task ID sits ABOVE the box, left-aligned, sized so the LONGEST id is
  // ~45% of the box width (so it stays left of the top-entering arrow).
  // Independent of render scale.
  const maxIdLen = Math.max(1, ...taskIds.map((str) => str.length));
  const idGap = 3;
  const commonIdFont = Math.max(
    7,
    Math.min(22, (0.45 * nodeW) / (maxIdLen * 0.6)),
  );

  // Pad the top enough that the id above the first rank isn't clipped.
  const pad = Math.max(20, commonIdFont + idGap + 4);
  const svgWidth = maxX - minX + pad * 2;
  const svgHeight = maxY - minY + pad * 2;
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;

  // On-screen scale (book column ~640px wide, capped 800px tall).
  const DISPLAY_W = 640;
  const MAX_H = 800;
  const renderScale = Math.min(DISPLAY_W / svgWidth, MAX_H / svgHeight, 1);
  const boost = Math.max(1, Math.min(1 / renderScale, 3.2));

  const dotR = Math.min(3 * boost, 7);
  // The contributor-dot pill straddles the box's bottom edge (centred on
  // it), so only its top half intrudes into the interior — reserve just
  // that, leaving more room for the name.
  const dotsBandH = dotR + 4;
  const badgeSize = Math.min(18 * boost, 30);

  // Dedupe identical gate lines, then vertically separate any that land on
  // the same row (same date) so their abbreviation labels don't stack.
  // Separation must clear the label height (which sits above its line).
  const gateSep = 14 * boost + 8;
  const gatesByRow = new Map<number, string[]>();
  const seenGate = new Set<string>();
  for (const g of gateLines) {
    const row = Math.round(g.y);
    const key = `${row}|${g.label}`;
    if (seenGate.has(key)) continue;
    seenGate.add(key);
    const arr = gatesByRow.get(row);
    if (arr) arr.push(g.label);
    else gatesByRow.set(row, [g.label]);
  }
  const finalGateLines: { y: number; label: string }[] = [];
  for (const [row, labels] of gatesByRow) {
    labels.forEach((label, i) => {
      finalGateLines.push({
        y: row + (i - (labels.length - 1) / 2) * gateSep,
        label,
      });
    });
  }

  // Reserve space to the RIGHT of the tasks for the abbreviation labels,
  // and extend the gate lines into it, so a label never sits under the
  // rightmost (full-width) task.
  const gateLabelFont = 9 * boost;
  const maxAbbrLen = finalGateLines.reduce(
    (m, g) => Math.max(m, g.label.length),
    0,
  );
  const gateLabelW = maxAbbrLen * gateLabelFont * 0.6;
  const gateRightPad = gateLabelW > 0 ? gateLabelW + 14 : 0;
  const gateLineX2 = maxX + (gateLabelW > 0 ? gateLabelW + 12 : 10);
  const viewBoxWidth = svgWidth + gateRightPad;

  // Common name font: the largest at which the MOST demanding (longest)
  // name fits the FULL box interior. The name now owns the whole box (the
  // id moved out and the activity type is gone), so it can be larger.
  // Every box uses this one font — constant size, maximal box usage.
  const nameTopPad = 5;
  const nameAvailH = nodeH - nameTopPad - dotsBandH - 4;
  const nameCeil = 13 / renderScale;
  const nameHardFloor = 5 / renderScale;
  const fitNameFont = (name: string): number => {
    const longestWord = Math.max(
      1,
      ...name.split(/\s+/).map((wd) => wd.length),
    );
    const steps = 16;
    for (let k = 0; k <= steps; k++) {
      const F = nameCeil - ((nameCeil - nameHardFloor) * k) / steps;
      const cpl = Math.floor(usableW / (F * 0.52));
      if (cpl < 3 || longestWord > cpl) continue;
      if (wrapAll(name, cpl).length * F * 1.15 <= nameAvailH) return F;
    }
    return nameHardFloor;
  };
  const commonNameFont =
    taskNames.length > 0 ? Math.min(...taskNames.map(fitNameFont)) : nameCeil;

  // Common placeholder font sized so the LONGEST label fits uniformly.
  const maxPlLen = Math.max(1, ...placeholderLabels.map((str) => str.length));
  const commonPlaceholderFont = Math.max(
    8,
    Math.min(usableW / (maxPlLen * 0.55), nodeH * 0.32, 13 * boost),
  );

  const boxStyle: BoxStyle = {
    commonIdFont,
    idGap,
    commonNameFont,
    nameTopPad,
    dotR,
    dotsBandH,
    badgeSize,
    usableW,
  };

  return (
    <div className="book-flow-diagram">
      <h3 className="book-flow-title">{phaseName} Task Flow</h3>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${svgHeight}`}
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
          {/* Key-date gate lines first, at the very back: a red dashed
              line across the full width at each key-date task's centre,
              mirroring the live process flow's gate separators. */}
          {finalGateLines.map((g, i) => (
            <g key={`gate-${i}`}>
              <line
                x1={minX - 10}
                y1={g.y}
                x2={gateLineX2}
                y2={g.y}
                stroke="#e74c3c"
                strokeWidth={Math.max(1.5, 2 * boost)}
                strokeDasharray={`${6 * boost} ${4 * boost}`}
                opacity={0.5}
              />
              {g.label && (
                <text
                  x={maxX + 10}
                  y={g.y - 4 * boost}
                  fontSize={gateLabelFont}
                  fill="#e74c3c"
                  opacity={0.85}
                  fontWeight={600}
                  textAnchor="start"
                  style={{ textTransform: 'uppercase' }}
                >
                  {g.label}
                </text>
              )}
            </g>
          ))}
          {/* Edges next so they render behind nodes. */}
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

              // Collapsed placeholder: muted dashed box with label, sized
              // with the diagram-common placeholder font so they all match.
              if (task.id.startsWith(COLLAPSED_PREFIX)) {
                const plLabel = task.name || 'Other tasks';
                const plFont = commonPlaceholderFont;
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
              const meetingColour = persp?.meetingOrganiserColour ?? null;
              return (
                <BookTaskBox
                  key={n.id}
                  x={n.position.x}
                  y={n.position.y}
                  w={w}
                  h={h}
                  taskId={task.taskId}
                  name={task.name}
                  isMeetingTask={task.isMeetingTask}
                  meetingColour={meetingColour}
                  hasDeliverables={task.deliverableTargets?.length > 0}
                  fillColour={fillColour}
                  strokeColour={strokeColour}
                  contribDots={contribDots}
                  glowColour={glowColour}
                  style={boxStyle}
                />
              );
            })}
        </g>
      </svg>
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

// Task box for the book-view SVG. The task ID sits ABOVE the box
// (left-aligned, ~45% of the box width so it stays left of the
// top-entering arrow); the name owns the whole box interior at a single
// page-common font; contributor dots sit at the bottom. Activity type is
// not shown. Affects ONLY the book view; the live flow (TaskNode) is
// untouched.
const TASK_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// Diagram-wide box metrics + fonts, computed once so EVERY box in a flow
// chart uses the same sizes.
interface BoxStyle {
  commonIdFont: number;
  idGap: number;
  commonNameFont: number;
  nameTopPad: number;
  dotR: number;
  dotsBandH: number;
  badgeSize: number;
  usableW: number;
}

function BookTaskBox({
  x,
  y,
  w,
  h,
  taskId,
  name,
  isMeetingTask,
  meetingColour,
  hasDeliverables,
  fillColour,
  strokeColour,
  contribDots,
  glowColour,
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  taskId: string;
  name: string;
  isMeetingTask: boolean;
  meetingColour: string | null;
  hasDeliverables: boolean;
  fillColour: string;
  strokeColour: string;
  contribDots: string[];
  glowColour: string | null;
  style: BoxStyle;
}) {
  const highlighted = glowColour != null;
  const {
    commonIdFont,
    idGap,
    commonNameFont,
    nameTopPad,
    dotR,
    dotsBandH,
    badgeSize,
    usableW,
  } = style;
  const showDots = contribDots.length > 0;

  // Name fills the box at the page-common font, wrapped and vertically
  // centred between the top padding and the dots band.
  const cpl = Math.max(3, Math.floor(usableW / (commonNameFont * 0.52)));
  const nameLines = wrapAll(name || '(untitled)', cpl);
  const lineH = commonNameFont * 1.15;
  const areaTop = nameTopPad;
  const areaBot = h - (showDots ? dotsBandH : 4);
  const blockH = nameLines.length * lineH;
  const blockTop = areaTop + Math.max(0, (areaBot - areaTop - blockH) / 2);

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

  const badgeFont = badgeSize * 0.62;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Task ID above the box, left-aligned. */}
      <text
        x={0}
        y={-idGap}
        fontSize={commonIdFont}
        fontWeight={700}
        fill="#444"
        fontFamily={TASK_MONO}
      >
        {taskId || '—'}
      </text>

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
      {/* Opaque white mask first so the key-date gate line behind the
          box doesn't bleed through the translucent department-colour
          fill (same fix as the navigate view's solid node backing). */}
      <rect width={w} height={h} rx={4} ry={4} fill="white" />
      <rect
        width={w}
        height={h}
        rx={4}
        ry={4}
        fill={fillColour}
        stroke={strokeColour}
        strokeWidth={1.5}
      />

      {nameLines.map((line, li) => (
        <text
          key={li}
          x={w / 2}
          y={blockTop + commonNameFont + li * lineH}
          fontSize={commonNameFont}
          fontWeight={600}
          fill="#1a1a1a"
          textAnchor="middle"
        >
          {line}
        </text>
      ))}

      {isMeetingTask && (
        <g>
          {/* Calendar badge tinted with the meeting organiser's dept
              colour (when known) so the organising department reads
              alongside the other role colours. */}
          <rect
            x={w - badgeSize - 3}
            y={3}
            width={badgeSize}
            height={badgeSize}
            rx={5}
            ry={5}
            fill={meetingColour ?? 'white'}
            stroke={meetingColour ?? 'rgba(0,0,0,0.1)'}
            strokeWidth={meetingColour ? 1 : 0.5}
          />
          <text
            x={w - 3 - badgeSize / 2}
            y={3 + badgeSize / 2}
            fontSize={badgeFont}
            textAnchor="middle"
            dominantBaseline="central"
          >
            📅
          </text>
        </g>
      )}
      {hasDeliverables && (
        <g>
          <rect
            x={w - badgeSize - 3}
            y={h - badgeSize - 3}
            width={badgeSize}
            height={badgeSize}
            rx={5}
            ry={5}
            fill="white"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth={0.5}
          />
          <text
            x={w - 3 - badgeSize / 2}
            y={h - 3 - badgeSize / 2}
            fontSize={badgeFont}
            textAnchor="middle"
            dominantBaseline="central"
          >
            📄
          </text>
        </g>
      )}
      {/* Pill centred on the bottom edge so it straddles it. */}
      {showDots && dotsPill(h)}
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
