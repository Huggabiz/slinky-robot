import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { Task } from '../types';

// Data payload stored on each flow node. Keeps the full Task so the
// custom node renderer has everything it needs without a second lookup.
export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
}

// Dimensions used both for dagre's layout hinting and the fixed CSS box
// on TaskNode. Keep them in sync with TaskNode.css or dagre's spacing
// will drift from what's rendered.
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 92;

export interface LayoutResult {
  nodes: Node<TaskNodeData>[];
  edges: Edge[];
}

/**
 * Build a top-to-bottom hierarchical layout of tasks using dagre.
 *
 * When `phaseId` is provided, only tasks in that phase are laid out and
 * only prerequisite edges with both endpoints inside the filtered set
 * are rendered. Cross-phase links are intentionally hidden here (we'll
 * re-surface them later as "incoming from…" badges on the detail panel).
 */
export function layoutTasks(
  tasks: Task[],
  phaseId: string | null,
): LayoutResult {
  const filtered = phaseId
    ? tasks.filter((t) => t.phaseId === phaseId)
    : tasks;
  const taskIdSet = new Set(filtered.map((t) => t.id));

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'TB',
    nodesep: 36,
    ranksep: 56,
    marginx: 24,
    marginy: 24,
  });

  for (const task of filtered) {
    graph.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
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

  const nodes: Node<TaskNodeData>[] = filtered.map((task) => {
    const pos = graph.node(task.id);
    // dagre reports centre coordinates; React Flow expects top-left.
    return {
      id: task.id,
      type: 'task',
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: { task },
    };
  });

  const edges: Edge[] = edgePairs.map(({ from, to }) => ({
    id: `${from}->${to}`,
    source: from,
    target: to,
    type: 'smoothstep',
  }));

  return { nodes, edges };
}
