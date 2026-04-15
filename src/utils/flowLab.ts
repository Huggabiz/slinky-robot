// ╔════════════════════════════════════════════════════════════════╗
// ║  FLOW LAB — TEMPORARY SCAFFOLDING                              ║
// ║                                                                ║
// ║  This module and src/components/FlowLabPanel.(tsx|css) exist   ║
// ║  only to tune the flow layout during experimentation. When     ║
// ║  we're done tuning, delete:                                    ║
// ║                                                                ║
// ║    - src/utils/flowLab.ts            (this file)               ║
// ║    - src/components/FlowLabPanel.tsx                           ║
// ║    - src/components/FlowLabPanel.css                           ║
// ║                                                                ║
// ║  Then in the following files, find every "FLOW LAB" comment    ║
// ║  and revert the marked block by inlining the final values:     ║
// ║                                                                ║
// ║    - src/utils/flowLayout.ts                                   ║
// ║    - src/components/ProcessFlow.tsx                            ║
// ║    - src/App.tsx                                               ║
// ╚════════════════════════════════════════════════════════════════╝

export type Rankdir = 'TB' | 'LR';

// ELK's four node-placement strategies. BRANDES_KOEPF produces the
// tidiest orthogonal grids for DAGs; NETWORK_SIMPLEX optimises edge
// routing; LINEAR_SEGMENTS is a compromise; SIMPLE places nodes at
// uniform intervals without trying to straighten edges.
export type NodePlacement =
  | 'BRANDES_KOEPF'
  | 'NETWORK_SIMPLEX'
  | 'LINEAR_SEGMENTS'
  | 'SIMPLE';

export interface LabConfig {
  rankdir: Rankdir;
  nodePlacement: NodePlacement;
  favorStraightEdges: boolean;
  nodesep: number;
  ranksep: number;
  nodeWidth: number;
  nodeHeight: number;
  // Pixel radius applied at each orthogonal bend in an edge path.
  cornerRadius: number;
  // SVG marker size for edge arrowheads, in stroke-width units.
  arrowSize: number;
}

// Defaults chosen for a tidy grid-like layout with comfortable edge
// corridors and large, readable arrows. Tune these live via the
// FlowLabPanel and lock them in as the final inlined values when the
// lab is removed.
export const DEFAULT_LAB_CONFIG: LabConfig = {
  rankdir: 'TB',
  nodePlacement: 'BRANDES_KOEPF',
  favorStraightEdges: true,
  nodesep: 80,
  ranksep: 80,
  nodeWidth: 200,
  nodeHeight: 92,
  cornerRadius: 20,
  arrowSize: 32,
};
