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
import { computeHighlights } from '../utils/highlight';
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
  // FLOW LAB: labConfig is temporary.
  labConfig: LabConfig;
  // Dependency-highlight tool config. When `enabled` is false the
  // highlight pass is skipped entirely.
  highlightEnabled: boolean;
  fadeOver: number | null;
}

export function ProcessFlow({
  phaseId,
  labConfig,
  highlightEnabled,
  fadeOver,
}: Props) {
  const file = useAppStore((s) => s.file);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);

  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);

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
        console.error('Layout failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [file, phaseId, labConfig]);

  // Dependency highlight pass. Cheap BFS across all tasks (not just the
  // filtered phase) so cross-phase prereq/dependent chains would also
  // colour correctly — even though we only render the active phase,
  // the map is keyed by task id so no harm done.
  const highlightMap = useMemo(() => {
    if (!highlightEnabled || !file) return null;
    return computeHighlights(file.tasks, selectedTaskId, fadeOver);
  }, [highlightEnabled, file, selectedTaskId, fadeOver]);

  // Selection is stored centrally; mirror it onto the nodes so React
  // Flow renders the selected visual state. Highlight info is injected
  // into data here so TaskNode can read it without a second hook.
  const styledNodes = useMemo(
    () =>
      layout.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedTaskId,
        data: {
          ...n.data,
          highlight: highlightMap?.get(n.id),
        },
      })),
    [layout.nodes, selectedTaskId, highlightMap],
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
