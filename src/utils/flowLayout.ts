import ELK from 'elkjs/lib/elk.bundled.js';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Task } from '../types';
// FLOW LAB: drop the LabConfig import and the config parameter when
// the lab is removed; bake its final values into the function body.
import type { LabConfig } from './flowLab';

const elk = new ELK();

// Data on each flow node. width/height travel with the node so the
// rendered TaskNode can size itself to match what ELK was told to expect.
export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  width: number;
  height: number;
}

// Data on each flow edge. path is the pre-computed rounded orthogonal
// SVG path string stitched from ELK's bend points — the OrthEdge
// component hands this to BaseEdge directly.
export interface OrthEdgeData extends Record<string, unknown> {
  path: string;
}

export interface LayoutResult {
  nodes: Node<TaskNodeData>[];
  edges: Edge<OrthEdgeData>[];
}

interface ElkInputNode {
  id: string;
  width: number;
  height: number;
  // x/y are only set when feeding positions back to ELK in the
  // interactive (pass 2) mode.
  x?: number;
  y?: number;
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

// ELK's published .d.ts doesn't describe `sections` on output edges
// even though the runtime provides them, so we define the output shape
// we actually depend on and cast the layout result to it.
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
 * When `config.snapToGrid` is true the layout runs in two passes:
 *   1. Pass 1 uses the chosen node-placement strategy to get ELK's
 *      natural positions and layering.
 *   2. X positions are snapped to a grid centred on x=0 (integer
 *      offsets for odd-count ranks, half-step for even). Single-node
 *      ranks (START, END) therefore land dead centre and line up with
 *      each other automatically.
 *   3. Pass 2 re-runs ELK in INTERACTIVE mode with the snapped
 *      positions as fixed inputs, so only the edge routing phase does
 *      real work. The result has locked-column nodes AND properly
 *      routed obstacle-aware edges.
 *
 * When `config.snapToGrid` is false the layout is a single ELK pass
 * with the chosen placement strategy.
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

  // Pass 1: ELK with the user's chosen node-placement strategy.
  const pass1Input = buildElkInput(filtered, taskIdSet, config, false, null);
  const pass1Output = (await elk.layout(pass1Input)) as ElkLayoutOutput;

  if (!config.snapToGrid) {
    return extractLayoutResult(pass1Output, filtered, config);
  }

  // Snap X positions and keep Y from pass 1 (y already represents the
  // layer y-axis so it doesn't need adjustment).
  const snapped = snapNodePositions(pass1Output, config);
  if (snapped.size === 0) {
    return extractLayoutResult(pass1Output, filtered, config);
  }

  // Pass 2: ELK in interactive mode with positions fixed to the snap.
  const pass2Input = buildElkInput(filtered, taskIdSet, config, true, snapped);
  const pass2Output = (await elk.layout(pass2Input)) as ElkLayoutOutput;
  return extractLayoutResult(pass2Output, filtered, config);
}

/**
 * Build an ELK input graph. When `interactive` is true the returned
 * options use ELK's INTERACTIVE strategies for layering, cycle
 * breaking, crossing minimisation, and node placement, and the
 * node children carry the position hints from the `positions` map —
 * ELK will honour those coordinates throughout.
 */
function buildElkInput(
  filtered: Task[],
  taskIdSet: Set<string>,
  config: LabConfig,
  interactive: boolean,
  positions: Map<string, { x: number; y: number }> | null,
): ElkGraphInput {
  const children: ElkInputNode[] = filtered.map((task) => {
    const node: ElkInputNode = {
      id: task.id,
      width: config.nodeWidth,
      height: config.nodeHeight,
    };
    const hint = positions?.get(task.id);
    if (hint) {
      node.x = hint.x;
      node.y = hint.y;
    }
    return node;
  });

  const edges: ElkInputEdge[] = [];
  for (const task of filtered) {
    for (const prereqId of task.prerequisites) {
      if (taskIdSet.has(prereqId)) {
        edges.push({
          id: `${prereqId}->${task.id}`,
          sources: [prereqId],
          targets: [task.id],
        });
      }
    }
  }

  const layoutOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': config.rankdir === 'TB' ? 'DOWN' : 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.spacing.nodeNode': String(config.nodesep),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(config.ranksep),
    // Keep edges close to nodes and packed tight so lanes don't bump
    // columns apart — user requirement: grid > lane breathing.
    'elk.layered.spacing.edgeNodeBetweenLayers': '16',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.mergeEdges': 'false',
  };

  if (interactive) {
    // Respect provided positions across every phase so the snapped
    // x values survive through the final placement step.
    layoutOptions['elk.layered.layering.strategy'] = 'INTERACTIVE';
    layoutOptions['elk.layered.cycleBreaking.strategy'] = 'INTERACTIVE';
    layoutOptions['elk.layered.crossingMinimization.strategy'] = 'INTERACTIVE';
    layoutOptions['elk.layered.nodePlacement.strategy'] = 'INTERACTIVE';
  } else {
    layoutOptions['elk.layered.nodePlacement.strategy'] = config.nodePlacement;
    layoutOptions['elk.layered.crossingMinimization.strategy'] = 'LAYER_SWEEP';
    layoutOptions['elk.layered.nodePlacement.favorStraightEdges'] = String(
      config.favorStraightEdges,
    );
  }

  return {
    id: 'root',
    layoutOptions,
    children,
    edges,
  };
}

/**
 * Snap ELK's output X positions to a shared grid centred on x=0.
 *
 * - Nodes are bucketed into ranks by the y coordinate ELK assigned
 *   (rounded to guard against float drift).
 * - Within each rank, nodes keep their left→right order from pass 1.
 * - Odd-count ranks get integer grid offsets  (… -1, 0, 1 …).
 * - Even-count ranks get half-step offsets    (… -1.5, -0.5, 0.5, 1.5 …).
 * - Single-node ranks therefore land at x=0, aligning START and END
 *   automatically without any additional centring logic.
 *
 * Y positions are unchanged — ELK's layered ranking already puts
 * every rank on a uniform vertical grid via `ranksep`.
 *
 * The returned map uses the node's top-left coordinate (React Flow
 * convention) not its centre.
 */
function snapNodePositions(
  output: ElkLayoutOutput,
  config: LabConfig,
): Map<string, { x: number; y: number }> {
  const children = output.children ?? [];
  if (children.length === 0) return new Map();

  const ranks = new Map<number, ElkOutputNode[]>();
  for (const c of children) {
    const y = Math.round(c.y ?? 0);
    const bucket = ranks.get(y) ?? [];
    bucket.push(c);
    ranks.set(y, bucket);
  }

  const gridUnitX = config.nodeWidth + config.nodesep;
  const positions = new Map<string, { x: number; y: number }>();

  for (const [y, rankNodes] of ranks) {
    rankNodes.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const n = rankNodes.length;
    const firstOffset = -(n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const offset = (firstOffset + i) * gridUnitX;
      // node.x in React Flow is top-left; grid is centred on x=0, so
      // top-left = offset − width/2.
      const x = offset - config.nodeWidth / 2;
      positions.set(rankNodes[i].id, { x, y });
    }
  }

  return positions;
}

/**
 * Turn an ELK layout output into the React Flow nodes + edges the
 * ProcessFlow component consumes. Shared between both passes.
 */
function extractLayoutResult(
  output: ElkLayoutOutput,
  filtered: Task[],
  config: LabConfig,
): LayoutResult {
  const taskById = new Map(filtered.map((t) => [t.id, t]));

  const nodes: Node<TaskNodeData>[] = (output.children ?? []).map((child) => {
    const task = taskById.get(child.id);
    if (!task) {
      // Shouldn't happen — ELK only returns children we passed in.
      throw new Error(`ELK returned unknown node ${child.id}`);
    }
    return {
      id: child.id,
      type: 'task',
      position: { x: child.x ?? 0, y: child.y ?? 0 },
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

    const points: { x: number; y: number }[] = [
      { x: section.startPoint.x, y: section.startPoint.y },
    ];
    for (const bp of section.bendPoints ?? []) {
      points.push({ x: bp.x, y: bp.y });
    }
    points.push({ x: section.endPoint.x, y: section.endPoint.y });

    edges.push({
      id: elkEdge.id,
      source: elkEdge.sources?.[0] ?? '',
      target: elkEdge.targets?.[0] ?? '',
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
      // Degenerate — fall back to a sharp corner.
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
