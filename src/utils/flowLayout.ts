import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Task } from '../types';
import type { HighlightInfo } from './highlight';
// FLOW LAB: drop the LabConfig import and the config parameter when
// the lab is removed; bake its final values into the function body.
import type { LabConfig } from './flowLab';

const elk = new ELK();

// Data on each flow node. width/height travel with the node so the
// rendered TaskNode can size itself to match what ELK was told to expect.
// `highlight` is injected after layout by ProcessFlow from the selected-
// task dependency walk; TaskNode reads it to tint itself.
export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  width: number;
  height: number;
  highlight?: HighlightInfo;
}

// Data on each flow edge. path is the pre-computed rounded orthogonal
// SVG path string — OrthEdge hands it to BaseEdge directly.
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

// ELK's published .d.ts doesn't describe `sections` on output edges,
// so we define the output shape we actually depend on.
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
 * Lay out the filtered task set using ELK's layered algorithm with
 * orthogonal edge routing.
 *
 * Every node carries two FIXED_POS ports — one at top-centre, one at
 * bottom-centre. All incoming edges attach at the NORTH port and all
 * outgoing edges leave from the SOUTH port, so connections bunch at
 * a single point on each side of a node rather than spreading along
 * the edge. (Req: "connection points can be more closely bunched".)
 *
 * After the ELK pass there are two light post-processing steps:
 *
 *   1. If `config.snapToGrid` is on, X positions are rewritten onto a
 *      single grid shared by every rank, centred on x=0. Odd-count
 *      ranks use integer offsets (… -1, 0, 1 …); even-count ranks use
 *      half-step offsets (… -1.5, -0.5, 0.5, 1.5 …). Because the grid
 *      axis is global, single-node ranks (START, END) land at x=0 and
 *      single-chain descendants whose rank midpoint is at index 0 also
 *      land at x=0 — which is what produces 0-bend straight edges for
 *      aligned subsequent flow steps. Edge endpoints shift in lockstep
 *      with their source/target; bend points sharing an X with an
 *      endpoint shift with it. After the shift the path is simplified
 *      to drop any bend points that became collinear with their
 *      neighbours (which happens when the snap aligns endpoints).
 *
 *   2. Only when snap is OFF: the whole graph is translated so its
 *      horizontal bounding-box midpoint sits at x=0. When snap is on
 *      the snap already centres every rank on x=0 so the graph's
 *      overall centre is also at 0, and this step is skipped.
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

  const elkGraph = buildElkInput(filtered, taskIdSet, config);
  const output = (await elk.layout(elkGraph)) as ElkLayoutOutput;
  const children = output.children ?? [];
  if (children.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Map of nodeId → original (pre-snap) top-left X, needed later for
  // translating edge endpoints.
  const originalX = new Map<string, number>();
  for (const c of children) {
    originalX.set(c.id, c.x ?? 0);
  }

  // Compute the target top-left X for each node.
  //
  // When snap is on: positions are on a shared grid centred on x=0,
  // so START/END and every middle-index chain node end up at x=0.
  // When snap is off: preserve ELK's output and translate the whole
  // graph so its bounding-box midpoint sits at x=0.
  const targetX = new Map<string, number>();
  if (config.snapToGrid) {
    const gridUnit = config.nodeWidth + config.nodesep;
    const ranks = new Map<number, ElkOutputNode[]>();
    for (const c of children) {
      // Round to guard against float drift from ELK's layout output.
      const y = Math.round(c.y ?? 0);
      const bucket = ranks.get(y) ?? [];
      bucket.push(c);
      ranks.set(y, bucket);
    }
    for (const [, rankNodes] of ranks) {
      // Preserve left→right order ELK chose (BK's alignment hints).
      rankNodes.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const n = rankNodes.length;
      const firstOffset = -(n - 1) / 2;
      for (let i = 0; i < n; i++) {
        // centre is at (firstOffset + i) * gridUnit from the shared
        // axis at x=0; top-left is centre - width/2.
        const centreX = (firstOffset + i) * gridUnit;
        targetX.set(rankNodes[i].id, centreX - config.nodeWidth / 2);
      }
    }
  } else {
    const xs = children.map((c) => (c.x ?? 0) + config.nodeWidth / 2);
    const centringDx = -((Math.min(...xs) + Math.max(...xs)) / 2);
    for (const c of children) {
      targetX.set(c.id, (c.x ?? 0) + centringDx);
    }
  }

  // Assemble React Flow nodes with the combined offsets applied.
  const nodes: Node<TaskNodeData>[] = children.map((child) => {
    const task = taskById.get(child.id);
    if (!task) {
      throw new Error(`ELK returned unknown node ${child.id}`);
    }
    return {
      id: child.id,
      type: 'task',
      position: { x: targetX.get(child.id) ?? 0, y: child.y ?? 0 },
      data: {
        task,
        width: config.nodeWidth,
        height: config.nodeHeight,
      },
    };
  });

  // Build edges. Every output edge's startPoint and endPoint need to
  // move in lockstep with its source and target node; bend points
  // aligned with an endpoint move with it.
  const edges: Edge<OrthEdgeData>[] = [];
  for (const elkEdge of output.edges ?? []) {
    const section = elkEdge.sections?.[0];
    if (!section) continue;

    const sourceId = portOwner(elkEdge.sources?.[0]);
    const targetId = portOwner(elkEdge.targets?.[0]);
    if (!sourceId || !targetId) continue;

    const dxSource =
      (targetX.get(sourceId) ?? 0) - (originalX.get(sourceId) ?? 0);
    const dxTarget =
      (targetX.get(targetId) ?? 0) - (originalX.get(targetId) ?? 0);

    const rawStart = section.startPoint;
    const rawEnd = section.endPoint;

    const shiftedPoints: { x: number; y: number }[] = [];
    shiftedPoints.push({ x: rawStart.x + dxSource, y: rawStart.y });

    for (const bp of section.bendPoints ?? []) {
      // Attribute each bend to whichever endpoint it shares an X with
      // (orthogonal routes have vertical segments at both ends, so the
      // first/last bends typically sit on the same X as start/end).
      const alignedSource = Math.abs(bp.x - rawStart.x) < 0.5;
      const alignedTarget = Math.abs(bp.x - rawEnd.x) < 0.5;
      if (alignedSource) {
        shiftedPoints.push({ x: bp.x + dxSource, y: bp.y });
      } else if (alignedTarget) {
        shiftedPoints.push({ x: bp.x + dxTarget, y: bp.y });
      } else {
        // Intermediate bend — rare for pure orthogonal routes. Nudge
        // by the average of the two deltas so it tracks the overall
        // drift rather than snapping to either end.
        shiftedPoints.push({
          x: bp.x + (dxSource + dxTarget) / 2,
          y: bp.y,
        });
      }
    }

    shiftedPoints.push({ x: rawEnd.x + dxTarget, y: rawEnd.y });

    // Drop bend points that became collinear with their neighbours
    // after shifting. This is what turns a 2-bend S-shape into a
    // 0-bend straight line when snap aligns endpoints.
    const simplified = simplifyOrthogonalPath(shiftedPoints);

    edges.push({
      id: elkEdge.id,
      source: sourceId,
      target: targetId,
      type: 'orth',
      data: {
        path: roundedOrthogonalPath(simplified, config.cornerRadius),
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

// Port IDs look like "nodeId.n" / "nodeId.s". Strip the suffix to get
// the owning node ID. ELK returns port refs in the sources/targets
// arrays; React Flow's edges identify nodes, not ports.
function portOwner(portRef: string | undefined): string | undefined {
  if (!portRef) return undefined;
  const dot = portRef.lastIndexOf('.');
  return dot === -1 ? portRef : portRef.slice(0, dot);
}

/**
 * Drop interior points that are collinear with their neighbours
 * along either axis. Used after the edge-shift step so a 2-bend
 * S-shape collapses to a 0-bend straight line whenever the snap
 * aligned the source and target — and, more generally, any extra
 * bend points that the shift rendered redundant.
 */
function simplifyOrthogonalPath(
  points: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const tol = 0.5;
  const result: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const onSameY =
      Math.abs(prev.y - cur.y) < tol && Math.abs(cur.y - next.y) < tol;
    const onSameX =
      Math.abs(prev.x - cur.x) < tol && Math.abs(cur.x - next.x) < tol;
    if (!(onSameX || onSameY)) {
      result.push(cur);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function buildElkInput(
  filtered: Task[],
  taskIdSet: Set<string>,
  config: LabConfig,
): ElkGraphInput {
  // Every node gets FIXED_POS N and S ports at top-centre and
  // bottom-centre. Edges attach at those fixed points regardless of
  // how many share a node, which is the "bunched connection points"
  // behaviour.
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
    // Keep edges close to nodes and packed tight so lanes don't bump
    // columns apart — user requirement: grid > lane breathing.
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

/**
 * Build an SVG path string from a list of points, with rounded corners
 * at each bend.
 *
 * For every (prev, bend, next) triple we shorten the two adjacent
 * segments by `radius` and connect them with an elliptical arc. The
 * radius is clamped to half the shorter adjacent segment so a corner
 * never overshoots into the next bend.
 *
 * Sweep direction is derived from the cross product of the two unit
 * vectors: in SVG's y-down coordinate frame, a positive cross product
 * means the turn is clockwise, which needs sweep-flag 1.
 */
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
