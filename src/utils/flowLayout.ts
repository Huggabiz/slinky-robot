import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Task } from '../types';
import type { HighlightInfo } from './highlight';
import type { PerspectiveInfo } from './perspective';
import type { LabConfig } from './flowLab';

const elk = new ELK();

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  width: number;
  height: number;
  highlight?: HighlightInfo;
  perspective?: PerspectiveInfo;
  searchDimmed?: boolean;
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
 * Lay out every phase independently, then stack the results vertically
 * with a gap between them. Each phase keeps its own ELK layout shape
 * so the user can recognise its structure from the per-phase view.
 *
 * phaseOrder is the list of phase ids in display order. Tasks whose
 * phaseId doesn't appear in the list are silently ignored.
 */
export async function layoutAllPhasesStacked(
  tasks: Task[],
  phaseOrder: string[],
  config: LabConfig,
): Promise<LayoutResult> {
  const PHASE_GAP = 120;
  const byPhase = new Map<string, Task[]>();
  for (const t of tasks) {
    let list = byPhase.get(t.phaseId);
    if (!list) {
      list = [];
      byPhase.set(t.phaseId, list);
    }
    list.push(t);
  }

  const phaseResults = await Promise.all(
    phaseOrder
      .filter((pid) => (byPhase.get(pid)?.length ?? 0) > 0)
      .map((pid) => layoutTasks(tasks, pid, config).then((r) => ({ pid, r }))),
  );

  const allNodes: Node<TaskNodeData>[] = [];
  const allEdges: Edge<OrthEdgeData>[] = [];
  let yOffset = 0;

  for (const { r } of phaseResults) {
    if (r.nodes.length === 0) continue;

    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of r.nodes) {
      const top = n.position.y;
      const bottom = top + (n.height ?? 96);
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }

    const dy = yOffset - minY;
    for (const n of r.nodes) {
      allNodes.push({
        ...n,
        position: { x: n.position.x, y: n.position.y + dy },
      });
    }
    for (const e of r.edges) {
      const path = (e.data as { path?: string } | undefined)?.path;
      if (path) {
        const shifted = shiftSvgPathY(path, dy);
        allEdges.push({
          ...e,
          data: { ...e.data, path: shifted } as OrthEdgeData,
        });
      } else {
        allEdges.push(e);
      }
    }

    yOffset = maxY + dy + PHASE_GAP;
  }

  return { nodes: allNodes, edges: allEdges };
}

// Shift all Y coordinates in an SVG path built by roundedOrthogonalPath.
// The path contains M (moveto), L (lineto), and A (arc) commands.
// Each command type has a fixed parameter count, and we know which
// parameters are Y coordinates that need the offset applied.
function shiftSvgPathY(pathData: string, dy: number): string {
  if (dy === 0) return pathData;
  const tokens = pathData.match(/[MLA]|[\d.eE+-]+/g);
  if (!tokens) return pathData;

  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'M' || t === 'L') {
      out.push(t, tokens[i + 1], String(parseFloat(tokens[i + 2]) + dy));
      i += 3;
    } else if (t === 'A') {
      // A rx ry x-rotation large-arc-flag sweep-flag x y
      out.push(
        t,
        tokens[i + 1], tokens[i + 2], tokens[i + 3],
        tokens[i + 4], tokens[i + 5],
        tokens[i + 6],
        String(parseFloat(tokens[i + 7]) + dy),
      );
      i += 8;
    } else {
      out.push(t);
      i++;
    }
  }
  return out.join(' ');
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

  const edgePointArrays: { x: number; y: number }[][] = [];
  const edgeMeta: {
    id: string;
    sourceId: string;
    targetId: string;
  }[] = [];

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

    edgePointArrays.push(points);
    edgeMeta.push({ id: elkEdge.id, sourceId, targetId });
  }

  // Separate overlapping segments so parallel edges through the same
  // routing channel are visually distinct. Edges that share a source
  // or target node are allowed to overlap (they split/merge at that
  // node, so there's no ambiguity). Only edges with DIFFERENT
  // source AND target pairs are nudged apart.
  deoverlapEdgeSegments(edgePointArrays, edgeMeta, 12);

  const edges: Edge<OrthEdgeData>[] = edgePointArrays.map((points, i) => ({
    id: edgeMeta[i].id,
    source: edgeMeta[i].sourceId,
    target: edgeMeta[i].targetId,
    type: 'orth',
    data: {
      path: roundedOrthogonalPath(points, config.cornerRadius),
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: config.arrowSize,
      height: config.arrowSize,
      color: '#888',
    },
  }));

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
    'elk.spacing.edgeEdge': '18',
    'elk.spacing.edgeNode': '16',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(config.ranksep),
    'elk.layered.spacing.edgeNodeBetweenLayers': '16',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '18',
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

// Spread terminal points of edges that share a source or target node
// so arrowheads don't stack on top of each other. Only adjusts the
// last point (and its vertical neighbour) for shared targets, and the
// first point (and its vertical neighbour) for shared sources. The
// middle routing stays unchanged.
function spreadTerminalPoints(
  allPoints: { x: number; y: number }[][],
  meta: { sourceId: string; targetId: string }[],
  spacing: number,
): void {
  const bySource = new Map<string, number[]>();
  const byTarget = new Map<string, number[]>();
  for (let i = 0; i < meta.length; i++) {
    let s = bySource.get(meta[i].sourceId);
    if (!s) { s = []; bySource.set(meta[i].sourceId, s); }
    s.push(i);
    let t = byTarget.get(meta[i].targetId);
    if (!t) { t = []; byTarget.set(meta[i].targetId, t); }
    t.push(i);
  }

  // Spread the first points (source end) of edges leaving the same node.
  for (const indices of bySource.values()) {
    if (indices.length <= 1) continue;
    indices.sort((a, b) => {
      const la = allPoints[a][allPoints[a].length - 1];
      const lb = allPoints[b][allPoints[b].length - 1];
      return la.x - lb.x;
    });
    for (let k = 0; k < indices.length; k++) {
      const pts = allPoints[indices[k]];
      const dx = (k - (indices.length - 1) / 2) * spacing;
      pts[0].x += dx;
      if (pts.length >= 2 && Math.abs(pts[1].x - (pts[0].x - dx)) < 0.5) {
        pts[1].x += dx;
      }
    }
  }

  // Spread the last points (target end) of edges entering the same node.
  for (const indices of byTarget.values()) {
    if (indices.length <= 1) continue;
    indices.sort((a, b) => {
      const fa = allPoints[a][0];
      const fb = allPoints[b][0];
      return fa.x - fb.x;
    });
    for (let k = 0; k < indices.length; k++) {
      const pts = allPoints[indices[k]];
      const last = pts.length - 1;
      const dx = (k - (indices.length - 1) / 2) * spacing;
      pts[last].x += dx;
      if (last >= 1 && Math.abs(pts[last - 1].x - (pts[last].x - dx)) < 0.5) {
        pts[last - 1].x += dx;
      }
    }
  }
}

// Post-process: find edge segments (horizontal OR vertical) that
// share the same axis value and overlap on the other axis, then
// spread them apart so parallel edges through the same channel are
// visually distinct. Edges that share a source or target node are
// allowed to overlap — they fan out/in at the shared node, so
// there's no ambiguity. Only edges with DIFFERENT source AND target
// pairs are separated. Operates in-place on the point arrays.
function deoverlapEdgeSegments(
  allPoints: { x: number; y: number }[][],
  meta: { sourceId: string; targetId: string }[],
  spacing: number,
): void {
  interface Seg {
    edgeIdx: number;
    ptIdx: number;
    fixedVal: number;
    rangeMin: number;
    rangeMax: number;
    axis: 'h' | 'v';
  }

  const segments: Seg[] = [];
  for (let ei = 0; ei < allPoints.length; ei++) {
    const pts = allPoints[ei];
    for (let pi = 0; pi < pts.length - 1; pi++) {
      const dx = Math.abs(pts[pi].x - pts[pi + 1].x);
      const dy = Math.abs(pts[pi].y - pts[pi + 1].y);
      if (dy < 0.5 && dx > 1) {
        segments.push({
          edgeIdx: ei, ptIdx: pi,
          fixedVal: pts[pi].y,
          rangeMin: Math.min(pts[pi].x, pts[pi + 1].x),
          rangeMax: Math.max(pts[pi].x, pts[pi + 1].x),
          axis: 'h',
        });
      } else if (dx < 0.5 && dy > 1) {
        segments.push({
          edgeIdx: ei, ptIdx: pi,
          fixedVal: pts[pi].x,
          rangeMin: Math.min(pts[pi].y, pts[pi + 1].y),
          rangeMax: Math.max(pts[pi].y, pts[pi + 1].y),
          axis: 'v',
        });
      }
    }
  }

  // Two edges share an endpoint if they have the same source OR
  // the same target. Such pairs are allowed to overlap.
  const sharesEndpoint = (a: number, b: number): boolean =>
    meta[a].sourceId === meta[b].sourceId ||
    meta[a].targetId === meta[b].targetId;

  for (const axis of ['h', 'v'] as const) {
    const axisSeg = segments.filter((s) => s.axis === axis);
    axisSeg.sort((a, b) => a.fixedVal - b.fixedVal);

    const groups: Seg[][] = [];
    let cur: Seg[] = [];
    for (const seg of axisSeg) {
      if (cur.length > 0 && Math.abs(seg.fixedVal - cur[0].fixedVal) > 1) {
        groups.push(cur);
        cur = [];
      }
      cur.push(seg);
    }
    if (cur.length > 0) groups.push(cur);

    for (const group of groups) {
      if (group.length <= 1) continue;

      const used = new Set<number>();
      for (let i = 0; i < group.length; i++) {
        if (used.has(i)) continue;
        const cluster = [i];
        used.add(i);
        let changed = true;
        while (changed) {
          changed = false;
          for (let j = 0; j < group.length; j++) {
            if (used.has(j)) continue;
            const gj = group[j];
            if (
              cluster.some((ci) => {
                const gc = group[ci];
                if (gc.rangeMin >= gj.rangeMax || gj.rangeMin >= gc.rangeMax)
                  return false;
                // Skip if these edges share a source or target.
                if (sharesEndpoint(gc.edgeIdx, gj.edgeIdx)) return false;
                return true;
              })
            ) {
              cluster.push(j);
              used.add(j);
              changed = true;
            }
          }
        }

        if (cluster.length <= 1) continue;

        // Sort the cluster so each segment is placed on the side
        // that minimises detour. For horizontal segments that got
        // separated, sort by the average X of the source and target
        // endpoints of the entire edge — edges heading further
        // right sit on the right side of the cluster, edges heading
        // left sit on the left side. For vertical segments, sort by
        // the average Y of the full edge's endpoints. This keeps
        // lines on the side nearest their destination, reducing
        // unnecessary crossovers.
        cluster.sort((a, b) => {
          const ptsA = allPoints[group[a].edgeIdx];
          const ptsB = allPoints[group[b].edgeIdx];
          if (axis === 'h') {
            const avgA = (ptsA[0].x + ptsA[ptsA.length - 1].x) / 2;
            const avgB = (ptsB[0].x + ptsB[ptsB.length - 1].x) / 2;
            return avgA - avgB;
          }
          const avgA = (ptsA[0].y + ptsA[ptsA.length - 1].y) / 2;
          const avgB = (ptsB[0].y + ptsB[ptsB.length - 1].y) / 2;
          return avgA - avgB;
        });

        const baseVal = group[cluster[0]].fixedVal;
        for (let k = 0; k < cluster.length; k++) {
          const offset = (k - (cluster.length - 1) / 2) * spacing;
          const seg = group[cluster[k]];
          const pts = allPoints[seg.edgeIdx];
          if (axis === 'h') {
            pts[seg.ptIdx].y = baseVal + offset;
            pts[seg.ptIdx + 1].y = baseVal + offset;
          } else {
            pts[seg.ptIdx].x = baseVal + offset;
            pts[seg.ptIdx + 1].x = baseVal + offset;
          }
        }
      }
    }
  }
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
