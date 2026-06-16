import type { ProcessFile, Task } from '../types';
import { extractRoleRefs } from './roleRefs';
import { makeId } from './id';

/**
 * Given a relevance set (tasks where the selected role/department is
 * involved), rewrite the task list for a single phase so that
 * consecutive irrelevant tasks are collapsed into single placeholder
 * nodes.
 *
 * Buckets:
 *   RELEVANT  — the role is accountable, contributor, organiser, or @-referenced
 *   ADJACENT  — not relevant itself, but directly connected to a relevant task
 *   OTHER     — everything else
 *
 * Consecutive OTHER tasks in the same dependency chain are collapsed
 * into a single synthetic placeholder. The placeholder inherits the
 * group's incoming edges (from predecessors outside the group) and
 * outgoing edges (to successors outside the group), keeping the flow
 * connected. RELEVANT and ADJACENT tasks render normally.
 *
 * Returns a new task array (original tasks unchanged) with synthetic
 * placeholder tasks whose `id` starts with '__collapsed_'. The caller
 * can detect placeholders by this prefix.
 */

export const COLLAPSED_PREFIX = '__collapsed_';

export function isCollapsedTask(task: Task): boolean {
  return task.id.startsWith(COLLAPSED_PREFIX);
}

export function collapseIrrelevantTasks(
  file: ProcessFile,
  phaseId: string,
  relevantTaskIds: Set<string>,
): Task[] {
  const phaseTasks = file.tasks.filter((t) => t.phaseId === phaseId);
  if (phaseTasks.length === 0) return [];

  const phaseIdSet = new Set(phaseTasks.map((t) => t.id));

  // Build adjacency: tasks directly connected to a relevant task.
  const adjacentIds = new Set<string>();
  for (const t of phaseTasks) {
    if (!relevantTaskIds.has(t.id)) continue;
    // Predecessors of relevant tasks.
    for (const p of t.prerequisites) {
      if (phaseIdSet.has(p) && !relevantTaskIds.has(p)) {
        adjacentIds.add(p);
      }
    }
    // Successors of relevant tasks.
    for (const other of phaseTasks) {
      if (
        other.prerequisites.includes(t.id) &&
        !relevantTaskIds.has(other.id)
      ) {
        adjacentIds.add(other.id);
      }
    }
  }

  // Classify every task.
  type Bucket = 'relevant' | 'adjacent' | 'other';
  const bucket = new Map<string, Bucket>();
  for (const t of phaseTasks) {
    if (relevantTaskIds.has(t.id)) bucket.set(t.id, 'relevant');
    else if (adjacentIds.has(t.id)) bucket.set(t.id, 'adjacent');
    else bucket.set(t.id, 'other');
  }

  // Group consecutive "other" tasks into connected components.
  // Two "other" tasks are in the same group if one is a prerequisite
  // of the other (directly or transitively through other "other" tasks).
  const otherIds = phaseTasks
    .filter((t) => bucket.get(t.id) === 'other')
    .map((t) => t.id);
  const otherSet = new Set(otherIds);

  // Union-Find for grouping.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (c !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  for (const id of otherIds) parent.set(id, id);
  for (const t of phaseTasks) {
    if (!otherSet.has(t.id)) continue;
    for (const p of t.prerequisites) {
      if (otherSet.has(p)) union(t.id, p);
    }
  }

  // Collect groups.
  const groups = new Map<string, string[]>();
  for (const id of otherIds) {
    const root = find(id);
    let list = groups.get(root);
    if (!list) {
      list = [];
      groups.set(root, list);
    }
    list.push(id);
  }

  // Build the collapsed task list.
  const collapsedGroupOf = new Map<string, string>(); // original id → placeholder id
  const placeholders: Task[] = [];

  for (const [, members] of groups) {
    const placeholderId = COLLAPSED_PREFIX + makeId();
    for (const m of members) collapsedGroupOf.set(m, placeholderId);

    // Collect external prerequisites (edges into the group from outside).
    const externalPrereqs = new Set<string>();
    for (const m of members) {
      const task = phaseTasks.find((t) => t.id === m);
      if (!task) continue;
      for (const p of task.prerequisites) {
        if (!otherSet.has(p) && phaseIdSet.has(p)) {
          externalPrereqs.add(p);
        }
      }
    }

    placeholders.push({
      id: placeholderId,
      taskId: '',
      phaseId,
      processId: null,
      name: `${members.length} other task${members.length === 1 ? '' : 's'}`,
      activityType: '',
      dateType: 'NONE',
      description: '',
      deliverables: '',
      accountable: '',
      contributors: [],
      isMeetingTask: false,
      meetingOrganiser: null,
      pdmTemplate: null,
      abbr: null,
      keyDateRationale: null,
      function: '',
      prerequisites: [...externalPrereqs],
      deliverableTargets: [],
      extras: {},
    });
  }

  // Build the output: keep relevant + adjacent tasks, replace "other"
  // with placeholders (deduplicated — one per group).
  const result: Task[] = [];
  const addedPlaceholders = new Set<string>();

  for (const t of phaseTasks) {
    const b = bucket.get(t.id);
    if (b === 'relevant' || b === 'adjacent') {
      // Rewrite prerequisites: if a prereq was collapsed, point to
      // its placeholder instead.
      const rewrittenPrereqs = t.prerequisites.map((p) => {
        const ph = collapsedGroupOf.get(p);
        return ph ?? p;
      });
      result.push({ ...t, prerequisites: [...new Set(rewrittenPrereqs)] });
    } else {
      const ph = collapsedGroupOf.get(t.id);
      if (ph && !addedPlaceholders.has(ph)) {
        addedPlaceholders.add(ph);
        result.push(placeholders.find((p) => p.id === ph)!);
      }
    }
  }

  return result;
}

/**
 * Compute the set of relevant task IDs for a department or role
 * perspective, matching the same logic as computePerspective's
 * accountable/contributor/meetingOrganiser/referenced tiers.
 */
export function computeRelevantTaskIds(
  file: ProcessFile,
  filter: { type: 'department'; departmentId: string } | { type: 'role'; roleName: string },
): Set<string> {
  const activeNames = new Set<string>();

  if (filter.type === 'department') {
    for (const role of file.roles) {
      if (role.departmentId === filter.departmentId) {
        activeNames.add(role.name);
      }
    }
  } else {
    activeNames.add(filter.roleName);
  }

  const activeRoles = file.roles.filter((r) => activeNames.has(r.name));
  const relevant = new Set<string>();

  for (const task of file.tasks) {
    if (activeNames.has(task.accountable)) {
      relevant.add(task.id);
      continue;
    }
    if (task.contributors.some((c) => activeNames.has(c))) {
      relevant.add(task.id);
      continue;
    }
    if (
      task.meetingOrganiser !== null &&
      activeNames.has(task.meetingOrganiser)
    ) {
      relevant.add(task.id);
      continue;
    }
    const prose = [
      task.description,
      task.deliverables,
      task.keyDateRationale ?? '',
    ].join('\n\n');
    if (
      prose.includes('@') &&
      [...extractRoleRefs(prose, activeRoles)].some((n) => activeNames.has(n))
    ) {
      relevant.add(task.id);
    }
  }

  return relevant;
}
