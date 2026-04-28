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
  // When true, after ELK's first pass a second INTERACTIVE pass pins
  // every node's position to where pass 1 put it, EXCEPT for the
  // single-node first rank (START) and single-node last rank (END),
  // which are forced onto the horizontal centre axis. ELK then
  // re-routes only the edges touching those two so the rest of the
  // layout stays exactly as BK + favour-straight-edges produced it.
  centreStartEnd: boolean;
  nodesep: number;
  ranksep: number;
  nodeWidth: number;
  nodeHeight: number;
  // Pixel radius applied at each orthogonal bend in an edge path.
  cornerRadius: number;
  // SVG marker size for edge arrowheads, in stroke-width units.
  arrowSize: number;
}

// Defaults match the settings the user landed on as a working baseline:
// BK placement with favour-straight-edges on, equal node/rank spacing,
// and the centre-start-end post-process enabled.
export const DEFAULT_LAB_CONFIG: LabConfig = {
  rankdir: 'TB',
  nodePlacement: 'BRANDES_KOEPF',
  favorStraightEdges: true,
  centreStartEnd: true,
  nodesep: 50,
  ranksep: 50,
  nodeWidth: 200,
  nodeHeight: 96,
  cornerRadius: 12,
  arrowSize: 32,
};
