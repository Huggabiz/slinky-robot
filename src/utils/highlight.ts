import type { Task } from '../types';

// Role of a task relative to the currently-selected task:
//   self    — the selected task itself
//   future  — transitively depends on the selected task (downstream)
//   past    — the selected task transitively depends on it (upstream)
export type HighlightRole = 'self' | 'future' | 'past';

export interface HighlightInfo {
  role: HighlightRole;
  // Number of prerequisite hops from the selected task.
  // Self = 0; direct dependent/prereq = 1; and so on.
  distance: number;
  // Pre-computed opacity (0..1) derived from `distance` and the fade
  // setting, so the renderer can apply it without knowing the fade rule.
  opacity: number;
}

/**
 * Build a map of task id → highlight info given a selected task.
 *
 * Walks the dependency graph both ways from the selected task:
 *   - forward BFS finds every task that transitively depends on it
 *   - backward BFS finds every task the selected task transitively
 *     depends on
 *
 * Then assigns an opacity based on the fade setting:
 *   - fadeOver = null  → every tinted task gets opacity 1
 *   - fadeOver = N     → opacity = max(0, 1 − (dist − 1) / N)
 *                        so distances 1..N fade linearly from 1 → 0
 *                        and distances > N are omitted entirely
 *
 * Tasks that fall below opacity 0 (or are completely disconnected from
 * the selected task) aren't present in the returned map — the renderer
 * treats "no entry" as "no highlight".
 */
export function computeHighlights(
  tasks: Task[],
  selectedId: string | null,
  fadeOver: number | null,
): Map<string, HighlightInfo> {
  const result = new Map<string, HighlightInfo>();
  if (!selectedId) return result;
  const selected = tasks.find((t) => t.id === selectedId);
  if (!selected) return result;

  result.set(selectedId, { role: 'self', distance: 0, opacity: 1 });

  const opacityAt = (distance: number): number => {
    if (fadeOver === null) return 1;
    if (fadeOver <= 0) return 1;
    return Math.max(0, 1 - (distance - 1) / fadeOver);
  };

  // Forward BFS: tasks with the selected one as a prerequisite (direct
  // or transitive). Index by prerequisite for O(E) traversal.
  const byPrereq = new Map<string, Task[]>();
  for (const t of tasks) {
    for (const p of t.prerequisites) {
      const bucket = byPrereq.get(p) ?? [];
      bucket.push(t);
      byPrereq.set(p, bucket);
    }
  }

  bfsFrom(selectedId, (id) => byPrereq.get(id)?.map((t) => t.id) ?? [], {
    onVisit: (id, dist) => {
      if (id === selectedId) return;
      const opacity = opacityAt(dist);
      if (opacity > 0) {
        result.set(id, { role: 'future', distance: dist, opacity });
      }
    },
  });

  // Backward BFS: prerequisites of the selected task (transitively).
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  bfsFrom(selectedId, (id) => taskById.get(id)?.prerequisites ?? [], {
    onVisit: (id, dist) => {
      if (id === selectedId) return;
      const opacity = opacityAt(dist);
      if (opacity > 0) {
        // If a task somehow sits on both sides (shouldn't happen in a
        // DAG but guard anyway), the forward walk wins — keeping the
        // check here means backward doesn't overwrite.
        if (!result.has(id)) {
          result.set(id, { role: 'past', distance: dist, opacity });
        }
      }
    },
  });

  return result;
}

interface BfsCallbacks {
  onVisit: (id: string, distance: number) => void;
}

function bfsFrom(
  startId: string,
  neighbours: (id: string) => string[],
  { onVisit }: BfsCallbacks,
): void {
  const visited = new Set<string>([startId]);
  const queue: { id: string; distance: number }[] = [
    { id: startId, distance: 0 },
  ];
  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;
    onVisit(id, distance);
    for (const next of neighbours(id)) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, distance: distance + 1 });
    }
  }
}
