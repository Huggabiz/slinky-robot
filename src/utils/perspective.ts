import type { ProcessFile } from '../types';
import { extractRoleRefs } from './roleRefs';

export type PerspectiveFilter =
  | { type: 'department'; departmentId: string }
  | { type: 'role'; roleName: string }
  | { type: 'allDepartments' }
  | { type: 'dates' }
  | { type: 'deliverables' };

export interface PerspectiveInfo {
  // Hierarchy order (strongest → weakest involvement):
  //   accountable > contributor > meetingOrganiser > referenced > none
  // 'referenced' means the role is mentioned via @Name in the task's
  // prose but isn't structurally involved. Only assigned for
  // 'department' and 'role' filters; allDepartments / dates /
  // deliverables don't surface this tier (it isn't meaningful in
  // those modes).
  role: 'accountable' | 'contributor' | 'meetingOrganiser' | 'referenced' | 'none';
  colour: string | null;
  hideOthers: boolean;
  // For 'allDepartments' mode: colours of departments that contribute
  // to this task (shown as small dots below the node).
  contributorColours?: string[];
}

/**
 * Build a map of task id → perspective info for the given filter.
 *
 * Modes:
 *   department   — highlights tasks where any role in that dept is involved
 *   role         — highlights tasks where that specific role is involved
 *   allDepts     — colours EVERY task by its accountable's department colour,
 *                  with contributor dept colours as dots
 *   dates        — highlights tasks with dateType !== 'NONE'
 *   deliverables — highlights tasks that have deliverableTargets
 *
 * Hierarchy (highest wins): accountable > contributor > meetingOrganiser > none
 */
export function computePerspective(
  file: ProcessFile,
  filter: PerspectiveFilter | null,
  hideOthers: boolean,
): Map<string, PerspectiveInfo> {
  const map = new Map<string, PerspectiveInfo>();
  if (!filter) return map;

  if (filter.type === 'allDepartments') {
    return computeAllDepartments(file, hideOthers);
  }
  if (filter.type === 'dates') {
    return computeDates(file, hideOthers);
  }
  if (filter.type === 'deliverables') {
    return computeDeliverables(file, hideOthers);
  }

  // Department or role filter.
  let activeNames: Set<string>;
  let colour: string | null = null;

  if (filter.type === 'department') {
    const dept = file.departments.find(
      (d) => d.id === filter.departmentId,
    );
    if (!dept) return map;
    colour = dept.colour;
    activeNames = new Set(
      file.roles
        .filter((r) => r.departmentId === filter.departmentId)
        .map((r) => r.name),
    );
  } else {
    activeNames = new Set([filter.roleName]);
    const role = file.roles.find((r) => r.name === filter.roleName);
    if (role?.departmentId) {
      const dept = file.departments.find(
        (d) => d.id === role.departmentId,
      );
      colour = dept?.colour ?? null;
    }
  }

  if (activeNames.size === 0) return map;

  // Pre-build a roles array containing only the active names so the
  // @-reference scan ignores everything else. activeNames is already
  // restricted to the filter's department or single role.
  const activeRoles = file.roles.filter((r) => activeNames.has(r.name));

  for (const task of file.tasks) {
    const isAccountable = activeNames.has(task.accountable);
    const isContributor = task.contributors.some((c) =>
      activeNames.has(c),
    );
    const isMeetingOrganiser =
      task.meetingOrganiser !== null &&
      activeNames.has(task.meetingOrganiser);

    if (isAccountable) {
      map.set(task.id, { role: 'accountable', colour, hideOthers });
      continue;
    }
    if (isContributor) {
      map.set(task.id, { role: 'contributor', colour, hideOthers });
      continue;
    }
    if (isMeetingOrganiser) {
      map.set(task.id, { role: 'meetingOrganiser', colour, hideOthers });
      continue;
    }

    // Fourth tier: an active role is mentioned via @Name somewhere in
    // the task's prose but isn't structurally involved.
    const prose = [
      task.description,
      task.deliverables,
      task.keyDateRationale ?? '',
    ].join('\n\n');
    const isReferenced =
      prose.includes('@') &&
      [...extractRoleRefs(prose, activeRoles)].some((n) =>
        activeNames.has(n),
      );

    if (isReferenced) {
      map.set(task.id, { role: 'referenced', colour, hideOthers });
    } else {
      map.set(task.id, { role: 'none', colour: null, hideOthers });
    }
  }

  return map;
}

function computeAllDepartments(
  file: ProcessFile,
  hideOthers: boolean,
): Map<string, PerspectiveInfo> {
  const map = new Map<string, PerspectiveInfo>();

  // Build role-name → department lookup.
  const roleToDept = new Map<string, { id: string; colour: string | null }>();
  for (const role of file.roles) {
    if (role.departmentId) {
      const dept = file.departments.find((d) => d.id === role.departmentId);
      if (dept) {
        roleToDept.set(role.name, { id: dept.id, colour: dept.colour });
      }
    }
  }

  for (const task of file.tasks) {
    const acctDept = roleToDept.get(task.accountable);
    const colour = acctDept?.colour ?? null;

    // Collect unique contributor department colours (excluding accountable's).
    const contribColours: string[] = [];
    const seenDepts = new Set<string>();
    if (acctDept) seenDepts.add(acctDept.id);
    for (const c of task.contributors) {
      const cDept = roleToDept.get(c);
      if (cDept?.colour && !seenDepts.has(cDept.id)) {
        seenDepts.add(cDept.id);
        contribColours.push(cDept.colour);
      }
    }

    if (colour) {
      map.set(task.id, {
        role: 'accountable',
        colour,
        hideOthers,
        contributorColours: contribColours,
      });
    } else if (contribColours.length > 0) {
      map.set(task.id, {
        role: 'contributor',
        colour: contribColours[0],
        hideOthers,
        contributorColours: contribColours.slice(1),
      });
    } else {
      map.set(task.id, { role: 'none', colour: null, hideOthers });
    }
  }

  return map;
}

function computeDates(
  file: ProcessFile,
  hideOthers: boolean,
): Map<string, PerspectiveInfo> {
  const map = new Map<string, PerspectiveInfo>();
  const ACCENT = '#f59e0b';
  for (const task of file.tasks) {
    if (task.dateType && task.dateType !== 'NONE') {
      map.set(task.id, { role: 'accountable', colour: ACCENT, hideOthers });
    } else {
      map.set(task.id, { role: 'none', colour: null, hideOthers });
    }
  }
  return map;
}

function computeDeliverables(
  file: ProcessFile,
  hideOthers: boolean,
): Map<string, PerspectiveInfo> {
  const map = new Map<string, PerspectiveInfo>();
  const ACCENT = '#6366f1';
  for (const task of file.tasks) {
    if (task.deliverableTargets.length > 0) {
      map.set(task.id, { role: 'accountable', colour: ACCENT, hideOthers });
    } else {
      map.set(task.id, { role: 'none', colour: null, hideOthers });
    }
  }
  return map;
}
