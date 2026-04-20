import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from '../store/useAppStore';
import {
  layoutTasks,
  type LayoutResult,
  type TaskNodeData,
} from '../utils/flowLayout';
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
  const mode = useAppStore((s) => s.mode);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);
  const togglePrerequisite = useAppStore((s) => s.togglePrerequisite);
  const insertTaskOnEdge = useAppStore((s) => s.insertTaskOnEdge);

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

  // Colour minimap rectangles by the task's phase colour so the
  // navigator shows a recognisable mini process diagram rather than a
  // uniform blob. Phase colours are inline hex values and render
  // identically in both Navigate and Edit themes.
  const phaseColourById = useMemo(() => {
    const m = new Map<string, string>();
    if (!file) return m;
    for (const p of file.phases) {
      if (p.colour) m.set(p.id, p.colour);
    }
    return m;
  }, [file]);

  const minimapNodeColour = useCallback(
    (node: Node) => {
      const data = node.data as TaskNodeData | undefined;
      const phaseId = data?.task.phaseId;
      if (phaseId) {
        const c = phaseColourById.get(phaseId);
        if (c) return c;
      }
      return '#cbd5e1'; // neutral slate for uncoloured phases
    },
    [phaseColourById],
  );

  if (!file || layout.nodes.length === 0) {
    return (
      <div className="process-flow-empty">No tasks to show in this phase.</div>
    );
  }

  // In edit mode, Ctrl/Cmd+Click a node toggles it as a prereq of the
  // currently-selected task; normal click still selects. Edge-click
  // inserts a new task that splits the edge.
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (
        mode === 'edit' &&
        selectedTaskId &&
        selectedTaskId !== node.id &&
        (event.ctrlKey || event.metaKey)
      ) {
        togglePrerequisite(selectedTaskId, node.id);
        return;
      }
      selectTask(node.id);
    },
    [mode, selectedTaskId, selectTask, togglePrerequisite],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { source: string; target: string }) => {
      if (mode !== 'edit' || !phaseId) return;
      const newId = insertTaskOnEdge(edge.source, edge.target, phaseId);
      if (newId) selectTask(newId);
    },
    [mode, phaseId, insertTaskOnEdge, selectTask],
  );

  return (
    <div className="process-flow">
      <ReactFlow
        nodes={styledNodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={() => selectTask(null)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          zoomable
          pannable
          nodeColor={minimapNodeColour}
          nodeStrokeWidth={2}
          nodeStrokeColor="rgba(0,0,0,0.25)"
        />
      </ReactFlow>
    </div>
  );
}
