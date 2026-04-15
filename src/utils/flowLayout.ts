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
 * ELK is async — the caller must await this and guard against stale
 * results if its inputs change before the promise resolves.
 *
 * Edge paths are returned as pre-computed SVG `d` strings with rounded
 * corners at every bend, sized by `config.cornerRadius`. This is why
 * edges use the custom 'orth' type and the OrthEdge renderer rather
 * than React Flow's built-ins.
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

  const elkGraph: ElkGraphInput = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // ELK uses compass directions; map our TB/LR control to DOWN/RIGHT.
      'elk.direction': config.rankdir === 'TB' ? 'DOWN' : 'RIGHT',
      // Orthogonal routing gives lane-based edges that avoid passing
      // through unrelated nodes.
      'elk.edgeRouting': 'ORTHOGONAL',
      // Explicit crossing minimisation — LAYER_SWEEP is the default
      // but making it visible here documents the intent.
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // BRANDES_KOEPF keeps nodes on tidier vertical lines than
      // NETWORK_SIMPLEX and is closer to the book's grid look.
      'elk.layered.nodePlacement.strategy': config.nodePlacement,
      // Prefer routing edges as straight vertical lines where
      // possible, which keeps columns from drifting apart when lanes
      // squeeze through a narrow gap.
      'elk.layered.nodePlacement.favorStraightEdges': String(
        config.favorStraightEdges,
      ),
      // Node spacing within a layer.
      'elk.spacing.nodeNode': String(config.nodesep),
      // Vertical spacing between layers.
      'elk.layered.spacing.nodeNodeBetweenLayers': String(config.ranksep),
      // Keep edges close to nodes and packed tight so lanes don't
      // bump columns apart — user requirement: grid > lane breathing.
      'elk.layered.spacing.edgeNodeBetweenLayers': '16',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
      // Preserve input order where possible — keeps left-to-right
      // sibling ordering stable across re-layouts.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Don't merge parallel edges into a single bundle.
      'elk.layered.mergeEdges': 'false',
    },
    children: filtered.map((task) => ({
      id: task.id,
      width: config.nodeWidth,
      height: config.nodeHeight,
    })),
    edges: [],
  };

  for (const task of filtered) {
    for (const prereqId of task.prerequisites) {
      if (taskIdSet.has(prereqId)) {
        elkGraph.edges.push({
          id: `${prereqId}->${task.id}`,
          sources: [prereqId],
          targets: [task.id],
        });
      }
    }
  }

  const laid = (await elk.layout(elkGraph)) as ElkLayoutOutput;

  const taskById = new Map(filtered.map((t) => [t.id, t]));

  // ELK returns top-left (x, y) for each child, matching React Flow's
  // convention — no offset conversion needed.
  const nodes: Node<TaskNodeData>[] = (laid.children ?? []).map((child) => {
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
  for (const elkEdge of laid.edges ?? []) {
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
