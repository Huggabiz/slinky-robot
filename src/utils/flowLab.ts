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
// ║  and revert the marked block to the in-comment "pre-lab"       ║
// ║  version:                                                      ║
// ║                                                                ║
// ║    - src/utils/flowLayout.ts                                   ║
// ║    - src/components/ProcessFlow.tsx                            ║
// ║    - src/components/TaskNode.tsx                               ║
// ║    - src/App.tsx                                               ║
// ║    - src/App.css                                               ║
// ╚════════════════════════════════════════════════════════════════╝

export type Rankdir = 'TB' | 'LR';
export type Ranker = 'network-simplex' | 'tight-tree' | 'longest-path';

export interface LabConfig {
  rankdir: Rankdir;
  ranker: Ranker;
  nodesep: number;
  ranksep: number;
  nodeWidth: number;
  nodeHeight: number;
  snapToGrid: boolean;
}

// Defaults chosen so grid unit ≈ nodeWidth × 1.4 — leaves a comfortable
// corridor between nodes for edges to route through, and gives a
// visually airy layout out of the gate.
export const DEFAULT_LAB_CONFIG: LabConfig = {
  rankdir: 'TB',
  ranker: 'network-simplex',
  nodesep: 80,
  ranksep: 80,
  nodeWidth: 200,
  nodeHeight: 92,
  snapToGrid: true,
};
