import dagre from '@dagrejs/dagre';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Task } from '../types';
// FLOW LAB: remove the LabConfig import and the config parameter on
// layoutTasks when the lab is removed.
import type { LabConfig } from './flowLab';

// Data payload stored on each flow node. Keeps the full Task so the
// custom node renderer has everything it needs without a second lookup.
// width/height echo the current lab nodeWidth/nodeHeight so the node
// component can size itself to match what dagre was told to expect.
export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: Node<TaskNodeData>[];
  edges: Edge[];
}

/**
 * Build a top-to-bottom hierarchical layout of tasks using dagre.
 *
 * When `phaseId` is provided, only tasks in that phase are laid out and
 * only prerequisite edges with both endpoints inside the filtered set
 * are rendered. Cross-phase links are intentionally hidden here.
 *
 * FLOW LAB: the `config` parameter is part of the lab. To revert,
 * delete the parameter and inline DEFAULT_LAB_CONFIG's values below.
 */
export function layoutTasks(
  tasks: Task[],
  phaseId: string | null,
  config: LabConfig,
): LayoutResult {
  const filtered = phaseId
    ? tasks.filter((t) => t.phaseId === phaseId)
    : tasks;
  const taskIdSet = new Set(filtered.map((t) => t.id));

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: config.rankdir,
    ranker: config.ranker,
    nodesep: config.nodesep,
    ranksep: config.ranksep,
    marginx: 24,
    marginy: 24,
  });

  for (const task of filtered) {
    graph.setNode(task.id, {
      width: config.nodeWidth,
      height: config.nodeHeight,
    });
  }

  const edgePairs: { from: string; to: string }[] = [];
  for (const task of filtered) {
    for (const prereqId of task.prerequisites) {
      if (taskIdSet.has(prereqId)) {
        graph.setEdge(prereqId, task.id);
        edgePairs.push({ from: prereqId, to: task.id });
      }
    }
  }

  dagre.layout(graph);

  let nodes: Node<TaskNodeData>[] = filtered.map((task) => {
    const pos = graph.node(task.id);
    // dagre returns centre coordinates; React Flow expects top-left.
    return {
      id: task.id,
      type: 'task',
      position: {
        x: pos.x - config.nodeWidth / 2,
        y: pos.y - config.nodeHeight / 2,
      },
      data: {
        task,
        width: config.nodeWidth,
        height: config.nodeHeight,
      },
    };
  });

  // FLOW LAB: grid snap is opt-in via config. To revert, remove this
  // block and the snapNodesToGrid helper below.
  if (config.snapToGrid) {
    nodes = snapNodesToGrid(
      nodes,
      config.nodeWidth + config.nodesep,
      config.nodeWidth,
    );
  }

  const edges: Edge[] = edgePairs.map(({ from, to }) => ({
    id: `${from}->${to}`,
    source: from,
    target: to,
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
    },
  }));

  return { nodes, edges };
}

/**
 * Snap node x positions to a shared grid centred on the graph.
 *
 * - Nodes are bucketed into ranks by their dagre-assigned y.
 * - Within each rank, nodes keep their left→right order from dagre.
 * - Odd-count ranks get integer grid offsets: -1, 0, 1 × gridUnit.
 * - Even-count ranks get half-step offsets: -1.5, -0.5, 0.5, 1.5 × gridUnit.
 * - Single-node ranks land at the graph horizontal centre, so START
 *   and END milestones line up automatically without extra logic.
 *
 * Y positions are left untouched — dagre's ranksep already produces a
 * regular vertical grid.
 *
 * FLOW LAB: helper only used by the lab's grid-snap toggle. Remove
 * with the rest of the lab code.
 */
function snapNodesToGrid(
  nodes: Node<TaskNodeData>[],
  gridUnitX: number,
  nodeWidth: number,
): Node<TaskNodeData>[] {
  if (nodes.length === 0) return nodes;

  const ranks = new Map<number, Node<TaskNodeData>[]>();
  for (const n of nodes) {
    // Round to guard against float drift from dagre's layout output.
    const y = Math.round(n.position.y);
    const bucket = ranks.get(y) ?? [];
    bucket.push(n);
    ranks.set(y, bucket);
  }

  // Centre the snapped grid on the bounding-box midpoint so the
  // overall position stays close to dagre's original output (less
  // visual jump when the toggle flips).
  const centres = nodes.map((n) => n.position.x + nodeWidth / 2);
  const minX = Math.min(...centres);
  const maxX = Math.max(...centres);
  const graphCentreX = (minX + maxX) / 2;

  const result: Node<TaskNodeData>[] = [];
  for (const [y, rankNodes] of ranks) {
    rankNodes.sort((a, b) => a.position.x - b.position.x);
    const n = rankNodes.length;
    const firstOffset = -(n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const offset = (firstOffset + i) * gridUnitX;
      result.push({
        ...rankNodes[i],
        position: {
          x: graphCentreX + offset - nodeWidth / 2,
          y,
        },
      });
    }
  }
  return result;
}
