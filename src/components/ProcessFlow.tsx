import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from '../store/useAppStore';
import { layoutTasks } from '../utils/flowLayout';
import { TaskNode } from './TaskNode';
import './ProcessFlow.css';

// Stable reference — re-creating nodeTypes each render triggers a
// React Flow warning and unnecessary work.
const nodeTypes: NodeTypes = {
  task: TaskNode,
};

interface Props {
  phaseId: string | null;
}

export function ProcessFlow({ phaseId }: Props) {
  const file = useAppStore((s) => s.file);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);

  // Re-layout whenever the tasks or the active phase change. Laying out
  // happens via dagre on every file/phase change — fine up to a few
  // hundred tasks; if we need more we can memoise per-phase.
  const { nodes, edges } = useMemo(() => {
    if (!file) return { nodes: [], edges: [] };
    return layoutTasks(file.tasks, phaseId);
  }, [file, phaseId]);

  // Selection is stored centrally; mirror it onto the nodes so React
  // Flow renders the selected visual state.
  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedTaskId,
      })),
    [nodes, selectedTaskId],
  );

  if (!file || nodes.length === 0) {
    return (
      <div className="process-flow-empty">
        No tasks to show in this phase.
      </div>
    );
  }

  return (
    <div className="process-flow">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => selectTask(node.id)}
        onPaneClick={() => selectTask(null)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}
