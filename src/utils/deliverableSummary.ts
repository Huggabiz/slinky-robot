import type { ProcessFile } from '../types';

export interface PhaseDeliverableRow {
  itemId: string;
  itemName: string;
  requiredState: string;
  stateIndex: number;
  totalStates: number;
}

// For a given phase, walk every task's deliverableTargets and find the
// furthest-along state each deliverable item needs to reach. "Furthest"
// is determined by position in the item's ordered states array — a
// higher index = further along the progression ladder.
//
// Returns one row per deliverable item that has at least one target in
// the phase, sorted by item name.
export function getPhaseDeliverableSummary(
  file: ProcessFile,
  phaseId: string,
): PhaseDeliverableRow[] {
  const itemById = new Map(file.deliverableItems.map((i) => [i.id, i]));
  const phaseTasks = file.tasks.filter((t) => t.phaseId === phaseId);

  // itemId → highest state index seen so far.
  const best = new Map<string, { state: string; index: number }>();

  for (const task of phaseTasks) {
    for (const dt of task.deliverableTargets) {
      const item = itemById.get(dt.itemId);
      if (!item) continue;
      const idx = item.states.indexOf(dt.state);
      if (idx === -1) continue;
      const prev = best.get(dt.itemId);
      if (!prev || idx > prev.index) {
        best.set(dt.itemId, { state: dt.state, index: idx });
      }
    }
  }

  const rows: PhaseDeliverableRow[] = [];
  for (const [itemId, { state, index }] of best) {
    const item = itemById.get(itemId);
    if (!item) continue;
    rows.push({
      itemId,
      itemName: item.name,
      requiredState: state,
      stateIndex: index,
      totalStates: item.states.length,
    });
  }

  rows.sort((a, b) => a.itemName.localeCompare(b.itemName));
  return rows;
}
