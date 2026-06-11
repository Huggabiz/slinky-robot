import type { ProcessFile, Task } from '../types';

/**
 * Topologically sort tasks within a phase so the reading order
 * respects prerequisites — a task never appears before the tasks it
 * depends on (within the same phase). Cross-phase prereqs are ignored
 * since they sit outside this phase's reading scope.
 *
 * Ties (tasks with no dependency between them) are broken by layout
 * position when available (Y then X — matching the visual flow), or
 * by taskId string using natural numeric order as a fallback.
 *
 * Kahn's algorithm: repeatedly pick the "ready" task with the lowest
 * sort key, emit it, remove its outgoing edges, repeat. If the graph
 * contains a cycle the unresolved tasks get appended at the end —
 * the book still renders.
 */
export function topoSortTasksInPhase(
  file: ProcessFile,
  phaseId: string,
  positionMap?: Map<string, { x: number; y: number }>,
): Task[] {
  const phaseTasks = file.tasks.filter((t) => t.phaseId === phaseId);
  if (phaseTasks.length === 0) return [];

  const idToTask = new Map(phaseTasks.map((t) => [t.id, t]));
  const phaseIds = new Set(idToTask.keys());

  // Build in-degree counts considering only within-phase prereqs.
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  for (const t of phaseTasks) {
    inDegree.set(t.id, 0);
    outEdges.set(t.id, []);
  }
  for (const t of phaseTasks) {
    for (const p of t.prerequisites) {
      if (phaseIds.has(p)) {
        inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
        outEdges.get(p)?.push(t.id);
      }
    }
  }

  // Tie-break: use layout position (Y then X) when available, fall
  // back to taskId for phases where layout hasn't been computed.
  const compareTask = (a: Task, b: Task): number => {
    if (positionMap) {
      const pa = positionMap.get(a.id);
      const pb = positionMap.get(b.id);
      if (pa && pb) {
        const dy = pa.y - pb.y;
        if (Math.abs(dy) > 5) return dy;
        const dx = pa.x - pb.x;
        if (Math.abs(dx) > 5) return dx;
      }
    }
    return naturalCompare(a.taskId, b.taskId);
  };

  // Ready queue: tasks with in-degree 0, kept sorted.
  const ready: Task[] = phaseTasks
    .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
    .sort(compareTask);

  const output: Task[] = [];
  const emitted = new Set<string>();

  while (ready.length > 0) {
    const next = ready.shift()!;
    output.push(next);
    emitted.add(next.id);
    const nextOuts = outEdges.get(next.id) ?? [];
    for (const childId of nextOuts) {
      const remaining = (inDegree.get(childId) ?? 0) - 1;
      inDegree.set(childId, remaining);
      if (remaining === 0) {
        const child = idToTask.get(childId);
        if (child && !emitted.has(childId)) {
          // Insert in taskId-sorted position.
          const idx = binaryInsertIndex(ready, child, compareTask);
          ready.splice(idx, 0, child);
        }
      }
    }
  }

  // Append any cyclic remnants so no tasks are lost.
  if (output.length < phaseTasks.length) {
    const leftover = phaseTasks
      .filter((t) => !emitted.has(t.id))
      .sort(compareTask);
    output.push(...leftover);
  }

  return output;
}

function binaryInsertIndex<T>(
  arr: T[],
  item: T,
  compare: (a: T, b: T) => number,
): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compare(arr[mid], item) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Natural string comparison that treats numeric segments as numbers
 * so "10.005" < "10.045" < "10.100" regardless of string width.
 */
function naturalCompare(a: string, b: string): number {
  const partsA = a.split(/(\d+)/).filter(Boolean);
  const partsB = b.split(/(\d+)/).filter(Boolean);
  const len = Math.min(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const pa = partsA[i];
    const pb = partsB[i];
    const na = Number(pa);
    const nb = Number(pb);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else if (pa !== pb) {
      return pa < pb ? -1 : 1;
    }
  }
  return partsA.length - partsB.length;
}
