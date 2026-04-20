import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Task } from '../types';
import type { HighlightInfo } from './highlight';
import type { LabConfig } from './flowLab';

const elk = new ELK();

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  width: number;
  height: number;
  highlight?: HighlightInfo;
}

export interface OrthEdgeData extends Record<string, unknown> {
  path: string;
}

export interface LayoutResult {
  nodes: Node<TaskNodeData>[];
  edges: Edge<OrthEdgeData>[];
}

interface ElkInputPort {
  id: string;
  x: number;
  y: number;
  layoutOptions?: Record<string, string>;
}

interface ElkInputNode {
  id: string;
  width: number;
  height: number;
  layoutOptions?: Record<string, string>;
  ports?: ElkInputPort[];
}

interface ElkInputEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkGraphInput {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkInputNode[];
  edges: ElkInputEdge[];
}

interface ElkOutputPoint {
  x: number;
  y: number;
}

interface ElkOutputSection {
  startPoint: ElkOutputPoint;
  endPoint: ElkOutputPoint;
  bendPoints?: ElkOutputPoint[];
}

interface ElkOutputEdge {
  id: string;
  sources?: string[];
  targets?: string[];
  sections?: ElkOutputSection[];
}

interface ElkOutputNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface ElkLayoutOutput {
  children?: ElkOutputNode[];
  edges?: ElkOutputEdge[];
}

/**
 * Lay out the filtered task set using a single ELK pass with
 * orthogonal edge routing.
 *
 * After ELK produces the layout, two lightweight post-processing
 * steps run:
 *
 *   1. Global centring — translate every node and edge point by a
 *      uniform dx so the bounding-box midpoint sits at x=0.
 *
 *   2. Centre start/end (opt-in via config.centreStartEnd) — if the
 *      phase has a single-node first rank (START) and single-node
 *      last rank (END), shift those two nodes onto x=0 and rewrite
 *      ONLY the edges touching them. Every other node and edge is
 *      completely untouched — the layout is byte-for-byte identical
 *      to what ELK produced.
 *
 * NO second ELK pass. ELK's INTERACTIVE strategies don't truly pin
 * positions — they use them as hints and can reshuffle the layout.
 * This post-process is a pure geometric shift that guarantees the
 * rest of the layout stays exactly as BK produced it.
 */
export async function layoutTasks(
  tasks: Task[],
  phaseId: string | null,
  config: LabConfig,
): Promise<LayoutResult> {
  const filtered = phaseId
    ? tasks.filter((t) => t.phaseId === phaseId)
    : tasks;
  if (filtered.length === 0) {
    return { nodes: [], edges: [] };
  }

  const taskIdSet = new Set(filtered.map((t) => t.id));
  const taskById = new Map(filtered.map((t) => [t.id, t]));

  // Single ELK pass.
  const elkInput = buildElkInput(filtered, taskIdSet, config);
  const elkOutput = (await elk.layout(elkInput)) as ElkLayoutOutput;
  const children = elkOutput.children ?? [];
  if (children.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Step 1: compute global centring offset.
  const centres = children.map((c) => (c.x ?? 0) + config.nodeWidth / 2);
  const centringDx = -((Math.min(...centres) + Math.max(...centres)) / 2);

  // Step 2: compute per-node extra shifts for START/END centring.
  // Map is empty (no-op) when the option is off or no clear single
  // START/END pair exists.
  const nodeShifts = config.centreStartEnd
    ? computeStartEndShifts(children, config, centringDx)
    : new Map<string, number>();

  return buildResult(elkOutput, taskById, config, centringDx, nodeShifts);
}

/**
 * Determine how far START and END need to move (on top of the global
 * centring) to land at x=0. Returns an empty map if the phase doesn't
 * have a clear single-node first/last rank.
 */
function computeStartEndShifts(
  children: ElkOutputNode[],
  config: LabConfig,
  centringDx: number,
): Map<string, number> {
  const shifts = new Map<string, number>();

  const byY = new Map<number, ElkOutputNode[]>();
  for (const c of children) {
    const y = Math.round(c.y ?? 0);
    const bucket = byY.get(y) ?? [];
    bucket.push(c);
    byY.set(y, bucket);
  }
  const ys = [...byY.keys()].sort((a, b) => a - b);
  const topRank = byY.get(ys[0]) ?? [];
  const bottomRank = byY.get(ys[ys.length - 1]) ?? [];
  if (topRank.length !== 1 || bottomRank.length !== 1) return shifts;

  const startNode = topRank[0];
  const endNode = bottomRank[0];

  // After global centring, where do START and END end up?
  const startCentredX =
    (startNode.x ?? 0) + centringDx + config.nodeWidth / 2;
  const endCentredX =
    (endNode.x ?? 0) + centringDx + config.nodeWidth / 2;

  // Additional shift to bring each to x=0.
  if (Math.abs(startCentredX) > 0.5) shifts.set(startNode.id, -startCentredX);
  if (Math.abs(endCentredX) > 0.5) shifts.set(endNode.id, -endCentredX);

  return shifts;
}

/**
 * Convert ELK output into React Flow nodes + edges, applying:
 *   - a uniform `centringDx` to every position/point
 *   - per-node extra shifts from `nodeShifts` (only START/END)
 *
 * For edges touching a shifted node, only the endpoint and its
 * adjacent aligned bend point are moved. If the original edge was a
 * straight line (0 bends), two S-shape bends are inserted at the
 * midpoint Y to keep the path orthogonal.
 */
function buildResult(
  output: ElkLayoutOutput,
  taskById: Map<string, Task>,
  config: LabConfig,
  centringDx: number,
  nodeShifts: Map<string, number>,
): LayoutResult {
  const nodes: Node<TaskNodeData>[] = (output.children ?? []).map((child) => {
    const task = taskById.get(child.id);
    if (!task) throw new Error(`ELK returned unknown node ${child.id}`);
    const extraDx = nodeShifts.get(child.id) ?? 0;
    return {
      id: child.id,
      type: 'task',
      position: {
        x: (child.x ?? 0) + centringDx + extraDx,
        y: child.y ?? 0,
      },
      // Top-level width/height are what React Flow's MiniMap reads to
      // size its node rectangles. Without them the minimap renders a
      // blank viewport instead of a mini flow diagram.
      width: config.nodeWidth,
      height: config.nodeHeight,
      data: {
        task,
        width: config.nodeWidth,
        height: config.nodeHeight,
      },
    };
  });

  const edges: Edge<OrthEdgeData>[] = [];
  for (const elkEdge of output.edges ?? []) {
    const section = elkEdge.sections?.[0];
    if (!section) continue;

    const sourceId = portOwner(elkEdge.sources?.[0]);
    const targetId = portOwner(elkEdge.targets?.[0]);
    if (!sourceId || !targetId) continue;

    const dxSource = nodeShifts.get(sourceId) ?? 0;
    const dxTarget = nodeShifts.get(targetId) ?? 0;

    const points = buildEdgePoints(
      section,
      centringDx,
      dxSource,
      dxTarget,
    );

    edges.push({
      id: elkEdge.id,
      source: sourceId,
      target: targetId,
      type: 'orth',
      data: {
        path: roundedOrthogonalPath(points, config.cornerRadius),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: config.arrowSize,
        height: config.arrowSize,
      },
    });
  }

  return { nodes, edges };
}

/**
 * Reconstruct edge points from an ELK section, applying the global
 * centring shift plus optional per-endpoint shifts (for START/END
 * centring).
 *
 * Rules:
 * - Start point shifts by centringDx + dxSource.
 * - End point shifts by centringDx + dxTarget.
 * - First bend, if aligned with the original start X, shifts by
 *   dxSource (so the first vertical segment stays vertical).
 * - Last bend, if aligned with the original end X, shifts by
 *   dxTarget (same reason).
 * - All other bends get only centringDx (unchanged relative to the
 *   rest of the graph).
 * - If the edge had 0 bends (straight line) and either endpoint
 *   shifted, 2 S-shape bends are inserted with the horizontal kink
 *   TIGHT against the shifted node — not at the midpoint. This
 *   keeps the horizontal segment near the top (for START edges) or
 *   near the bottom (for END edges), minimising the chance it runs
 *   behind unrelated tasks in between.
 *
 * KINK_OFFSET_PX controls how far below/above the shifted node the
 * horizontal segment sits. 20 px is enough clearance for the corner
 * radius arc without looking separated.
 */
const KINK_OFFSET_PX = 20;

function buildEdgePoints(
  section: ElkOutputSection,
  centringDx: number,
  dxSource: number,
  dxTarget: number,
): { x: number; y: number }[] {
  const startX = section.startPoint.x + centringDx + dxSource;
  const startY = section.startPoint.y;
  const endX = section.endPoint.x + centringDx + dxTarget;
  const endY = section.endPoint.y;
  const bends = section.bendPoints ?? [];

  // Fast path: no per-node shifts — straight centring pass-through.
  if (dxSource === 0 && dxTarget === 0) {
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
    for (const bp of bends) {
      points.push({ x: bp.x + centringDx, y: bp.y });
    }
    points.push({ x: endX, y: endY });
    return points;
  }

  // Compute the tight kink Y used for both the 0-bend insert and the
  // 2-bend rewrite cases. Using the SAME formula in both cases means
  // every edge from a centred START ends up sharing a single kink Y
  // (startY + KINK_OFFSET_PX), so their horizontal segments line up
  // with each other instead of drifting to whatever Y ELK originally
  // chose for each.
  const computeTightKinkY = (): number => {
    let y: number;
    if (dxSource !== 0 && dxTarget === 0) {
      y = startY + KINK_OFFSET_PX;
    } else if (dxTarget !== 0 && dxSource === 0) {
      y = endY - KINK_OFFSET_PX;
    } else {
      y = startY + KINK_OFFSET_PX;
    }
    return Math.max(startY + 1, Math.min(endY - 1, y));
  };

  // Straight-line case: no bends originally, so insert a 2-bend
  // S-shape at the tight kink Y.
  if (bends.length === 0) {
    const kinkY = computeTightKinkY();
    return [
      { x: startX, y: startY },
      { x: startX, y: kinkY },
      { x: endX, y: kinkY },
      { x: endX, y: endY },
    ];
  }

  // 2-bend S-shape — the canonical case ELK produces for offset
  // endpoints with FIXED_POS N/S ports. We rewrite it entirely to
  // use the tight kink Y so both bends sit at the same Y (keeping
  // the middle segment horizontal, not slightly diagonal) AND every
  // edge from the same shifted endpoint shares that Y (so the
  // horizontal segments all line up).
  if (bends.length === 2 && (dxSource !== 0 || dxTarget !== 0)) {
    const kinkY = computeTightKinkY();
    return [
      { x: startX, y: startY },
      { x: startX, y: kinkY },
      { x: endX, y: kinkY },
      { x: endX, y: endY },
    ];
  }

  // Fallback for more complex bend counts (3+, e.g. routed around an
  // obstacle). Shift only the first (if source-aligned) and last (if
  // target-aligned) bends to keep the vertical endpoints vertical.
  // Also tighten the LEADING and TRAILING horizontal segments so they
  // share the same kink Y as simpler 2-bend siblings from the same
  // shifted endpoint — keeps everything fanning out / collapsing at
  // a single consistent Y.
  const origStartX = section.startPoint.x + centringDx;
  const origEndX = section.endPoint.x + centringDx;

  // Detect how many leading bends form the first horizontal run
  // (consecutive bends starting from bend 0 that share a Y). If
  // ≥ 2 bends share the first Y, we have a horizontal segment that
  // should be tightened. Only do this when the source was shifted.
  let leadingRunEndIdx = -1;
  if (dxSource !== 0 && bends.length >= 2) {
    const firstBendX = bends[0].x + centringDx;
    if (Math.abs(firstBendX - origStartX) < 0.5) {
      const firstY = bends[0].y;
      leadingRunEndIdx = 0;
      for (let i = 1; i < bends.length; i++) {
        if (Math.abs(bends[i].y - firstY) < 0.5) leadingRunEndIdx = i;
        else break;
      }
      // Only apply if there's an actual horizontal segment (≥ 2 bends).
      if (leadingRunEndIdx < 1) leadingRunEndIdx = -1;
    }
  }

  let trailingRunStartIdx = -1;
  if (dxTarget !== 0 && bends.length >= 2) {
    const lastIdx = bends.length - 1;
    const lastBendX = bends[lastIdx].x + centringDx;
    if (Math.abs(lastBendX - origEndX) < 0.5) {
      const lastY = bends[lastIdx].y;
      trailingRunStartIdx = lastIdx;
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (Math.abs(bends[i].y - lastY) < 0.5) trailingRunStartIdx = i;
        else break;
      }
      if (trailingRunStartIdx > lastIdx - 1) trailingRunStartIdx = -1;
    }
  }

  const leadingTightY =
    leadingRunEndIdx !== -1
      ? Math.max(startY + 1, Math.min(endY - 1, startY + KINK_OFFSET_PX))
      : null;
  const trailingTightY =
    trailingRunStartIdx !== -1
      ? Math.max(startY + 1, Math.min(endY - 1, endY - KINK_OFFSET_PX))
      : null;

  const points: { x: number; y: number }[] = [{ x: startX, y: startY }];
  for (let i = 0; i < bends.length; i++) {
    const bpX = bends[i].x + centringDx;
    let bpY = bends[i].y;

    // Tighten any bend that's part of the leading horizontal run.
    if (leadingTightY !== null && i <= leadingRunEndIdx) {
      bpY = leadingTightY;
    }
    // Same for the trailing horizontal run.
    if (trailingTightY !== null && i >= trailingRunStartIdx) {
      bpY = trailingTightY;
    }

    if (
      i === 0 &&
      dxSource !== 0 &&
      Math.abs(bpX - origStartX) < 0.5
    ) {
      points.push({ x: bpX + dxSource, y: bpY });
    } else if (
      i === bends.length - 1 &&
      dxTarget !== 0 &&
      Math.abs(bpX - origEndX) < 0.5
    ) {
      points.push({ x: bpX + dxTarget, y: bpY });
    } else {
      points.push({ x: bpX, y: bpY });
    }
  }
  points.push({ x: endX, y: endY });
  return points;
}

function portOwner(portRef: string | undefined): string | undefined {
  if (!portRef) return undefined;
  const dot = portRef.lastIndexOf('.');
  return dot === -1 ? portRef : portRef.slice(0, dot);
}

function buildElkInput(
  filtered: Task[],
  taskIdSet: Set<string>,
  config: LabConfig,
): ElkGraphInput {
  const children: ElkInputNode[] = filtered.map((task) => ({
    id: task.id,
    width: config.nodeWidth,
    height: config.nodeHeight,
    layoutOptions: {
      'elk.portConstraints': 'FIXED_POS',
    },
    ports: [
      {
        id: `${task.id}.n`,
        x: config.nodeWidth / 2,
        y: 0,
        layoutOptions: { 'elk.port.side': 'NORTH' },
      },
      {
        id: `${task.id}.s`,
        x: config.nodeWidth / 2,
        y: config.nodeHeight,
        layoutOptions: { 'elk.port.side': 'SOUTH' },
      },
    ],
  }));

  const edges: ElkInputEdge[] = [];
  for (const task of filtered) {
    for (const prereqId of task.prerequisites) {
      if (taskIdSet.has(prereqId)) {
        edges.push({
          id: `${prereqId}->${task.id}`,
          sources: [`${prereqId}.s`],
          targets: [`${task.id}.n`],
        });
      }
    }
  }

  const layoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': config.rankdir === 'TB' ? 'DOWN' : 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.strategy': config.nodePlacement,
    'elk.layered.nodePlacement.favorStraightEdges': String(
      config.favorStraightEdges,
    ),
    'elk.spacing.nodeNode': String(config.nodesep),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(config.ranksep),
    'elk.layered.spacing.edgeNodeBetweenLayers': '16',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.mergeEdges': 'false',
  };

  return {
    id: 'root',
    layoutOptions,
    children,
    edges,
  };
}

function roundedOrthogonalPath(
  points: { x: number; y: number }[],
  radius: number,
): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 === 0 || len2 === 0) {
      d += ` L ${cur.x} ${cur.y}`;
      continue;
    }

    const r = Math.min(radius, len1 / 2, len2 / 2);

    const ux1 = dx1 / len1;
    const uy1 = dy1 / len1;
    const ux2 = dx2 / len2;
    const uy2 = dy2 / len2;

    const arcStart = { x: cur.x - ux1 * r, y: cur.y - uy1 * r };
    const arcEnd = { x: cur.x + ux2 * r, y: cur.y + uy2 * r };

    d += ` L ${arcStart.x} ${arcStart.y}`;

    const cross = ux1 * uy2 - uy1 * ux2;
    const sweep = cross > 0 ? 1 : 0;
    d += ` A ${r} ${r} 0 0 ${sweep} ${arcEnd.x} ${arcEnd.y}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
