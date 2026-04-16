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
  // Only set when feeding positions back to ELK for the interactive
  // second pass.
  x?: number;
  y?: number;
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
 * Lay out the filtered task set using ELK's layered algorithm with
 * orthogonal edge routing.
 *
 * Every node exposes two FIXED_POS ports (top-centre and bottom-
 * centre). All incoming edges attach at the top port, all outgoing at
 * the bottom port, so connections bunch at a single attach point per
 * node side.
 *
 * When `config.snapToGrid` is true the layout runs in TWO ELK PASSES:
 *
 *   Pass 1 — run ELK with the user-selected node-placement strategy
 *     (BK by default) to get sensible initial positions and layering.
 *
 *   Snap — rewrite each node's X onto a grid centred on x=0. Odd-count
 *     ranks use integer offsets (… -1, 0, 1 …); even-count ranks use
 *     half-step offsets (… -1.5, -0.5, 0.5, 1.5 …). Single-node ranks
 *     (START, END) land at x=0 and align automatically.
 *
 *   Pass 2 — run ELK again with INTERACTIVE strategies for layering,
 *     cycle breaking, crossing minimisation, and node placement, AND
 *     with each node's x/y set to its snapped position. ELK respects
 *     those positions throughout and only does real work on edge
 *     routing — so edges emerge as proper orthogonal paths that avoid
 *     passing through unrelated nodes. No post-hoc edge shifting,
 *     which means no diagonal artefacts and no through-node crossings.
 *
 * When `config.snapToGrid` is false, only pass 1 runs; the whole
 * graph is then translated so its horizontal bounding-box midpoint
 * sits at x=0.
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

  // Pass 1: normal ELK with chosen placement strategy.
  const pass1Input = buildElkInput(filtered, taskIdSet, config, null, false);
  const pass1Output = (await elk.layout(pass1Input)) as ElkLayoutOutput;
  const pass1Children = pass1Output.children ?? [];
  if (pass1Children.length === 0) {
    return { nodes: [], edges: [] };
  }

  if (!config.snapToGrid) {
    // Snap off: just centre the whole graph and use pass 1's edges.
    const centres = pass1Children.map(
      (c) => (c.x ?? 0) + config.nodeWidth / 2,
    );
    const centringDx = -((Math.min(...centres) + Math.max(...centres)) / 2);
    return extractLayoutResult(pass1Output, taskById, config, centringDx);
  }

  // Compute snapped positions on the shared x=0 grid.
  const snapped = computeSnappedPositions(pass1Children, config);

  // Pass 2: ELK in interactive mode. Positions are fixed via x/y
  // hints + INTERACTIVE strategies; ELK only re-routes edges.
  const pass2Input = buildElkInput(filtered, taskIdSet, config, snapped, true);
  const pass2Output = (await elk.layout(pass2Input)) as ElkLayoutOutput;
  return extractLayoutResult(pass2Output, taskById, config, 0);
}

function computeSnappedPositions(
  children: ElkOutputNode[],
  config: LabConfig,
): Map<string, { x: number; y: number }> {
  const ranks = new Map<number, ElkOutputNode[]>();
  for (const c of children) {
    // Round Y to guard against float drift in ELK's layered output.
    const y = Math.round(c.y ?? 0);
    const bucket = ranks.get(y) ?? [];
    bucket.push(c);
    ranks.set(y, bucket);
  }

  const gridUnit = config.nodeWidth + config.nodesep;
  const snapped = new Map<string, { x: number; y: number }>();

  for (const [rankY, rankNodes] of ranks) {
    rankNodes.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const n = rankNodes.length;
    const firstOffset = -(n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const centreX = (firstOffset + i) * gridUnit;
      // top-left (React Flow convention) = centre − width/2
      const topLeftX = centreX - config.nodeWidth / 2;
      snapped.set(rankNodes[i].id, { x: topLeftX, y: rankY });
    }
  }

  return snapped;
}

/**
 * Convert ELK output into React Flow nodes + edges, applying an
 * optional global x-offset (`centringDx`) to every node and edge
 * point. Edge paths are emitted orthogonally; no post-shift hackery.
 */
function extractLayoutResult(
  output: ElkLayoutOutput,
  taskById: Map<string, Task>,
  config: LabConfig,
  centringDx: number,
): LayoutResult {
  const nodes: Node<TaskNodeData>[] = (output.children ?? []).map((child) => {
    const task = taskById.get(child.id);
    if (!task) {
      throw new Error(`ELK returned unknown node ${child.id}`);
    }
    return {
      id: child.id,
      type: 'task',
      position: {
        x: (child.x ?? 0) + centringDx,
        y: child.y ?? 0,
      },
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

    const points: { x: number; y: number }[] = [
      { x: section.startPoint.x + centringDx, y: section.startPoint.y },
    ];
    for (const bp of section.bendPoints ?? []) {
      points.push({ x: bp.x + centringDx, y: bp.y });
    }
    points.push({ x: section.endPoint.x + centringDx, y: section.endPoint.y });

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

// Port IDs look like "nodeId.n" / "nodeId.s". Strip the suffix to get
// the owning node ID. ELK returns port refs in the sources/targets
// arrays; React Flow's edges identify nodes, not ports.
function portOwner(portRef: string | undefined): string | undefined {
  if (!portRef) return undefined;
  const dot = portRef.lastIndexOf('.');
  return dot === -1 ? portRef : portRef.slice(0, dot);
}

function buildElkInput(
  filtered: Task[],
  taskIdSet: Set<string>,
  config: LabConfig,
  positionHints: Map<string, { x: number; y: number }> | null,
  interactive: boolean,
): ElkGraphInput {
  // Every node gets FIXED_POS N and S ports at top-centre and
  // bottom-centre. Edges attach at those fixed points regardless of
  // how many share a node, which is the "bunched connection points"
  // behaviour.
  const children: ElkInputNode[] = filtered.map((task) => {
    const node: ElkInputNode = {
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
    };
    const hint = positionHints?.get(task.id);
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
    'elk.spacing.nodeNode': String(config.nodesep),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(config.ranksep),
    // Keep edges close to nodes and packed tight so lanes don't bump
    // columns apart — user requirement: grid > lane breathing.
    'elk.layered.spacing.edgeNodeBetweenLayers': '16',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
    'elk.layered.mergeEdges': 'false',
  };

  if (interactive) {
    // Lock every structural decision to the provided x/y positions so
    // ELK only does edge routing this pass. Without all four phases on
    // INTERACTIVE, crossing-min or node-placement could still reshuffle
    // the x coordinates we carefully snapped.
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
    layoutOptions['elk.layered.considerModelOrder.strategy'] =
      'NODES_AND_EDGES';
  }

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
