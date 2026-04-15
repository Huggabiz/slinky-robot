import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from '../store/useAppStore';
import { layoutTasks, type LayoutResult } from '../utils/flowLayout';
// FLOW LAB: remove the LabConfig import and the labConfig prop below.
import type { LabConfig } from '../utils/flowLab';
import { TaskNode } from './TaskNode';
import { OrthEdge } from './OrthEdge';
import './ProcessFlow.css';

// Stable references — re-creating these each render triggers React
// Flow warnings and unnecessary work.
const nodeTypes: NodeTypes = {
  task: TaskNode,
};

const edgeTypes: EdgeTypes = {
  orth: OrthEdge,
};

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };

interface Props {
  phaseId: string | null;
  // FLOW LAB: labConfig is temporary. To revert, drop this prop and
  // inline DEFAULT_LAB_CONFIG at the layoutTasks call site.
  labConfig: LabConfig;
}

export function ProcessFlow({ phaseId, labConfig }: Props) {
  const file = useAppStore((s) => s.file);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);

  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);

  // ELK layout is async. Recompute whenever the file, active phase,
  // or lab config changes. The cancellation flag ensures a stale
  // layout can't overwrite a fresher one when the user is dragging
  // a slider rapidly — only the most-recent run's result sticks.
  useEffect(() => {
    if (!file) {
      setLayout(EMPTY_LAYOUT);
      return;
    }
    let cancelled = false;
    layoutTasks(file.tasks, phaseId, labConfig)
      .then((result) => {
        if (cancelled) return;
        setLayout(result);
      })
      .catch((err) => {
        if (cancelled) return;
        // Surface layout errors to the dev console but keep the last
        // good layout on screen so the app stays usable.
        console.error('Layout failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [file, phaseId, labConfig]);

  // Selection is stored centrally; mirror it onto the nodes so React
  // Flow renders the selected visual state.
  const styledNodes = useMemo(
    () =>
      layout.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedTaskId,
      })),
    [layout.nodes, selectedTaskId],
  );

  if (!file || layout.nodes.length === 0) {
    return (
      <div className="process-flow-empty">No tasks to show in this phase.</div>
    );
  }

  return (
    <div className="process-flow">
      <ReactFlow
        nodes={styledNodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
