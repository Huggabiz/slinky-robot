import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAppStore } from '../store/useAppStore';
import {
  layoutTasks,
  layoutAllPhasesStacked,
  type LayoutResult,
  type TaskNodeData,
} from '../utils/flowLayout';
import { getPhasesOrdered } from '../types';
import { computeHighlights } from '../utils/highlight';
import {
  computePerspective,
  type PerspectiveFilter,
} from '../utils/perspective';
import {
  findPhaseById,
  findTaskByInternalId,
  type ProcessFile,
} from '../types';
// FLOW LAB: remove the LabConfig import and the labConfig prop below.
import type { LabConfig } from '../utils/flowLab';
import { TaskNode } from './TaskNode';
import { OrthEdge } from './OrthEdge';
import {
  CrossPhaseIndicator,
  type CrossPhaseData,
} from './CrossPhaseIndicator';
import { GateSeparator, type GateSeparatorData } from './GateSeparator';
import { ALL_PHASES_ID } from './PhaseSidebar';
import './ProcessFlow.css';

// Stable references — re-creating these each render triggers React
// Flow warnings and unnecessary work.
const nodeTypes: NodeTypes = {
  task: TaskNode,
  crossPhase: CrossPhaseIndicator,
  gateSeparator: GateSeparator,
};

const edgeTypes: EdgeTypes = {
  orth: OrthEdge,
};

const EMPTY_LAYOUT: LayoutResult = { nodes: [], edges: [] };

interface Props {
  phaseId: string | null;
  // FLOW LAB: labConfig is temporary.
  labConfig: LabConfig;
  // Dependency-highlight tool config.
  highlightEnabled: boolean;
  fadeOver: number | null;
  // Perspective lens config.
  perspectiveFilter: PerspectiveFilter | null;
  perspectiveHideOthers: boolean;
  // Search filter — dims non-matching nodes.
  searchQuery: string;
}

export function ProcessFlow(props: Props) {
  return (
    <ReactFlowProvider>
      <ProcessFlowInner {...props} />
    </ReactFlowProvider>
  );
}

function ProcessFlowInner({
  phaseId,
  labConfig,
  highlightEnabled,
  fadeOver,
  perspectiveFilter,
  perspectiveHideOthers,
  searchQuery,
}: Props) {
  const reactFlow = useReactFlow();
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds);
  const selectTask = useAppStore((s) => s.selectTask);
  const toggleSelectTask = useAppStore((s) => s.toggleSelectTask);
  const rangeSelectTask = useAppStore((s) => s.rangeSelectTask);
  const togglePrerequisite = useAppStore((s) => s.togglePrerequisite);
  const insertTaskOnEdge = useAppStore((s) => s.insertTaskOnEdge);

  const [layout, setLayout] = useState<LayoutResult>(EMPTY_LAYOUT);

  // Translate the ALL_PHASES sentinel into null at the layout boundary
  // so layoutTasks renders every phase's tasks together. Same null
  // value is used by cross-phase indicators below to skip their work
  // (every prereq is already on screen, so no off-screen markers).
  const layoutPhaseId = phaseId === ALL_PHASES_ID ? null : phaseId;

  useEffect(() => {
    if (!file) {
      setLayout(EMPTY_LAYOUT);
      return;
    }
    let cancelled = false;
    const promise =
      layoutPhaseId === null
        ? layoutAllPhasesStacked(
            file.tasks,
            getPhasesOrdered(file).map((p) => p.id),
            labConfig,
          )
        : layoutTasks(file.tasks, layoutPhaseId, labConfig);
    promise
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
  }, [file, layoutPhaseId, labConfig]);

  // Re-centre / re-fit whenever the layout changes (which happens on
  // phase switch, file edit, etc.). The short delay lets React Flow
  // process the new nodes before we ask it to compute bounds.
  const layoutIdRef = useRef(0);
  useEffect(() => {
    layoutIdRef.current += 1;
    const id = layoutIdRef.current;
    if (layout.nodes.length === 0) return;
    const timer = setTimeout(() => {
      if (id !== layoutIdRef.current) return;
      reactFlow.fitView({ padding: 0.15, duration: 200 });
    }, 50);
    return () => clearTimeout(timer);
  }, [layout, reactFlow]);

  // Dependency highlight pass. Cheap BFS across all tasks (not just the
  // filtered phase) so cross-phase prereq/dependent chains would also
  // colour correctly — even though we only render the active phase,
  // the map is keyed by task id so no harm done.
  const highlightMap = useMemo(() => {
    if (!highlightEnabled || !file) return null;
    return computeHighlights(file.tasks, selectedTaskId, fadeOver);
  }, [highlightEnabled, file, selectedTaskId, fadeOver]);

  // Perspective lens — compute once per filter/file change.
  const perspectiveMap = useMemo(() => {
    if (!perspectiveFilter || !file) return null;
    return computePerspective(file, perspectiveFilter, perspectiveHideOthers);
  }, [perspectiveFilter, perspectiveHideOthers, file]);

  // Search matching — when a query is active, non-matching nodes get
  // a 'searchDimmed' flag that TaskNode uses to reduce opacity.
  // Queries beginning with `@` search for tasks that reference a role
  // either structurally (accountable / contributors / meetingOrganiser)
  // or through an @mention in description/deliverables/keyDateRationale.
  const searchTrimmed = searchQuery.trim();
  const searchLower = searchTrimmed.toLowerCase();
  const roleSearchName = searchTrimmed.startsWith('@')
    ? searchTrimmed.slice(1).trim()
    : null;

  const roleRefMatchIds = useMemo(() => {
    if (!roleSearchName || !file) return null;
    const match = file.roles.find(
      (r) => r.name.toLowerCase() === roleSearchName.toLowerCase(),
    );
    if (!match) return new Set<string>();
    const ids = new Set<string>();
    for (const t of file.tasks) {
      if (
        t.accountable === match.name ||
        t.meetingOrganiser === match.name ||
        t.contributors.includes(match.name)
      ) {
        ids.add(t.id);
        continue;
      }
      const prose = [
        t.description,
        t.deliverables,
        t.keyDateRationale ?? '',
      ].join('\n\n');
      const pattern = new RegExp(
        `(^|[^A-Za-z0-9_])@${match.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`,
      );
      if (pattern.test(prose)) ids.add(t.id);
    }
    return ids;
  }, [roleSearchName, file]);

  const styledNodes = useMemo(
    () =>
      layout.nodes.map((n) => {
        const taskData = n.data as { task?: { id: string; name: string; taskId: string; description: string; deliverables: string; keyDateRationale: string | null } } | undefined;
        const task = taskData?.task;
        let searchMatch = true;
        if (searchLower && task) {
          if (roleRefMatchIds) {
            searchMatch = roleRefMatchIds.has(task.id);
          } else {
            const haystack =
              task.name.toLowerCase() +
              ' ' +
              task.taskId.toLowerCase() +
              ' ' +
              task.description.toLowerCase() +
              ' ' +
              task.deliverables.toLowerCase() +
              ' ' +
              (task.keyDateRationale ?? '').toLowerCase();
            searchMatch = haystack.includes(searchLower);
          }
        }
        return {
          ...n,
          selected: n.id === selectedTaskId || selectedTaskIds.has(n.id),
          data: {
            ...n.data,
            highlight: highlightMap?.get(n.id),
            perspective: perspectiveMap?.get(n.id),
            searchDimmed: searchLower.length > 0 && !searchMatch,
          },
        };
      }),
    [layout.nodes, selectedTaskId, selectedTaskIds, highlightMap, perspectiveMap, searchLower, roleRefMatchIds],
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
      // Guard: cross-phase indicator nodes don't have a .task property.
      const task = data?.task;
      if (!task) return '#e2e8f0';
      const c = phaseColourById.get(task.phaseId);
      return c ?? '#cbd5e1';
    },
    [phaseColourById],
  );

  // Node click behaviour varies by mode and modifier keys:
  //
  //   Navigate mode:
  //     - Click          → single-select
  //
  //   Edit mode:
  //     - Click          → single-select (clears multi)
  //     - Ctrl/Cmd+Click → toggle prereq of the primary selection
  //                         (if a single task is selected)
  //     - Shift+Click    → range-select (multi)
  //     - Alt+Click      → toggle in/out of multi-selection
  //
  // All callbacks MUST sit above the early return — rules of hooks.
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (mode === 'edit') {
        // Alt+Click: toggle multi-select membership.
        if (event.altKey) {
          toggleSelectTask(node.id);
          return;
        }
        // Shift+Click: range-select.
        if (event.shiftKey) {
          rangeSelectTask(node.id);
          return;
        }
        // Ctrl/Cmd+Click: toggle prerequisite of the primary selection.
        if (
          (event.ctrlKey || event.metaKey) &&
          selectedTaskId &&
          selectedTaskId !== node.id
        ) {
          togglePrerequisite(selectedTaskId, node.id);
          return;
        }
      }
      selectTask(node.id);
    },
    [
      mode,
      selectedTaskId,
      selectTask,
      toggleSelectTask,
      rangeSelectTask,
      togglePrerequisite,
    ],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { source: string; target: string }) => {
      // Edge-insert needs a concrete phase to drop the new task into.
      // In all-phases mode the user has to pick a milestone first.
      if (mode !== 'edit' || !phaseId || phaseId === ALL_PHASES_ID) return;
      const newId = insertTaskOnEdge(edge.source, edge.target, phaseId);
      if (newId) selectTask(newId);
    },
    [mode, phaseId, insertTaskOnEdge, selectTask],
  );

  // Cross-phase indicators: for tasks in the current phase that have
  // prerequisites or dependents in OTHER phases, add phantom indicator
  // nodes at the top/bottom of the canvas with faded dashed edges.
  // In all-phases mode every prereq/dependent is already on screen,
  // so the indicators are unnecessary.
  const crossPhaseResult = useMemo(() => {
    if (
      !file ||
      !phaseId ||
      phaseId === ALL_PHASES_ID ||
      layout.nodes.length === 0
    ) {
      return { nodes: [] as Node<CrossPhaseData>[], edges: [] as typeof layout.edges };
    }
    return buildCrossPhaseIndicators(file, phaseId, layout.nodes);
  }, [file, phaseId, layout.nodes]);

  // Gate separators — horizontal dashed lines above key-date tasks.
  const gateSeparatorNodes = useMemo(() => {
    if (!file || layout.nodes.length === 0) return [] as Node<GateSeparatorData>[];
    const gates: Node<GateSeparatorData>[] = [];
    const allXs = layout.nodes.map((n) => n.position.x);
    const allWidths = layout.nodes.map((n) => n.width ?? 200);
    const leftMost = Math.min(...allXs);
    const rightMost = Math.max(
      ...allXs.map((x, i) => x + allWidths[i]),
    );
    const gateWidth = rightMost - leftMost + 80;

    for (const n of layout.nodes) {
      const taskData = n.data as { task?: { dateType: string; abbr: string | null } } | undefined;
      const task = taskData?.task;
      if (!task) continue;
      if (task.dateType === 'KEY DATE' || task.dateType === 'MS DATE') {
        gates.push({
          id: `gate-${n.id}`,
          type: 'gateSeparator',
          position: {
            x: leftMost - 40,
            y: n.position.y - 16,
          },
          width: gateWidth,
          height: 1,
          data: {
            label: task.abbr ?? '',
          },
          selectable: false,
          draggable: false,
        });
      }
    }
    return gates;
  }, [file, layout.nodes]);

  const allNodes = useMemo(
    () => [...styledNodes, ...crossPhaseResult.nodes, ...gateSeparatorNodes],
    [styledNodes, crossPhaseResult.nodes, gateSeparatorNodes],
  );

  const allEdges = useMemo(
    () => [...layout.edges, ...crossPhaseResult.edges],
    [layout.edges, crossPhaseResult.edges],
  );

  if (!file || layout.nodes.length === 0) {
    return (
      <div className="process-flow-empty">No tasks to show in this phase.</div>
    );
  }

  return (
    <div className="process-flow">
      <ReactFlow
        nodes={allNodes}
        edges={allEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={() => selectTask(null)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
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

// ---- Cross-phase indicator builder ----

function buildCrossPhaseIndicators(
  file: ProcessFile,
  currentPhaseId: string,
  layoutNodes: Node<TaskNodeData>[],
): {
  nodes: Node<CrossPhaseData>[];
  edges: Edge[];
} {
  const nodes: Node<CrossPhaseData>[] = [];
  const edges: Edge[] = [];

  // Build a position lookup from the laid-out nodes.
  const posById = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  for (const n of layoutNodes) {
    posById.set(n.id, {
      x: n.position.x,
      y: n.position.y,
      w: n.width ?? 200,
      h: n.height ?? 96,
    });
  }

  // Bounding box for placement of phantom nodes.
  const allYs = layoutNodes.map((n) => n.position.y);
  const topY = allYs.length > 0 ? Math.min(...allYs) : 0;
  const bottomY =
    allYs.length > 0
      ? Math.max(...allYs) + (layoutNodes[0]?.height ?? 96)
      : 96;

  const currentPhaseTaskIds = new Set(
    file.tasks.filter((t) => t.phaseId === currentPhaseId).map((t) => t.id),
  );

  let phantomIdx = 0;

  for (const task of file.tasks) {
    if (task.phaseId !== currentPhaseId) continue;
    const taskPos = posById.get(task.id);
    if (!taskPos) continue;

    // Incoming: task has prereqs in OTHER phases.
    for (const prereqId of task.prerequisites) {
      if (currentPhaseTaskIds.has(prereqId)) continue;
      const prereqTask = findTaskByInternalId(file, prereqId);
      if (!prereqTask) continue;
      const prereqPhase = findPhaseById(file, prereqTask.phaseId);
      if (!prereqPhase) continue;

      const phantomId = `xp-in-${phantomIdx++}`;
      const indicatorWidth = 160;
      // Place the indicator above the target task, offset upward.
      nodes.push({
        id: phantomId,
        type: 'crossPhase',
        position: {
          x: taskPos.x + taskPos.w / 2 - indicatorWidth / 2,
          y: topY - 60,
        },
        width: indicatorWidth,
        height: 36,
        data: {
          label: `From ${prereqPhase.name}`,
          direction: 'incoming',
          phaseName: prereqPhase.name,
          taskName: `${prereqTask.taskId}: ${prereqTask.name || '(untitled)'}`,
        },
      });
      edges.push({
        id: `xp-edge-${phantomId}`,
        source: phantomId,
        target: task.id,
        type: 'default',
        animated: true,
        style: { stroke: '#94a3b8', strokeDasharray: '6 4', opacity: 0.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: '#94a3b8',
        },
      });
    }

    // Outgoing: other-phase tasks that have THIS task as a prereq.
    for (const otherTask of file.tasks) {
      if (otherTask.phaseId === currentPhaseId) continue;
      if (!otherTask.prerequisites.includes(task.id)) continue;
      const otherPhase = findPhaseById(file, otherTask.phaseId);
      if (!otherPhase) continue;

      const phantomId = `xp-out-${phantomIdx++}`;
      const indicatorWidth = 160;
      nodes.push({
        id: phantomId,
        type: 'crossPhase',
        position: {
          x: taskPos.x + taskPos.w / 2 - indicatorWidth / 2,
          y: bottomY + 30,
        },
        width: indicatorWidth,
        height: 36,
        data: {
          label: `To ${otherPhase.name}`,
          direction: 'outgoing',
          phaseName: otherPhase.name,
          taskName: `${otherTask.taskId}: ${otherTask.name || '(untitled)'}`,
        },
      });
      edges.push({
        id: `xp-edge-${phantomId}`,
        source: task.id,
        target: phantomId,
        type: 'default',
        animated: true,
        style: { stroke: '#94a3b8', strokeDasharray: '6 4', opacity: 0.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: '#94a3b8',
        },
      });
    }
  }

  return { nodes, edges };
}
