import type { ProcessFile } from '../types';

export type PerspectiveFilter =
  | { type: 'department'; departmentId: string }
  | { type: 'role'; roleName: string };

export interface PerspectiveInfo {
  role: 'accountable' | 'contributor' | 'meetingOrganiser' | 'none';
  colour: string | null;
  hideOthers: boolean;
}

/**
 * Build a map of task id → perspective info for the given filter.
 *
 * When a department is selected, ALL roles assigned to that department
 * are treated as "active". When a single role is selected, only that
 * role name is active. Hierarchy (highest wins):
 *   1. accountable — task.accountable matches an active name
 *   2. contributor — any task.contributors entry matches
 *   3. meetingOrganiser — task.meetingOrganiser matches
 *   4. none — nothing matched
 *
 * Highest-wins means if the same role is BOTH accountable AND a
 * contributor, the task displays as accountable.
 */
export function computePerspective(
  file: ProcessFile,
  filter: PerspectiveFilter | null,
  hideOthers: boolean,
): Map<string, PerspectiveInfo> {
  const map = new Map<string, PerspectiveInfo>();
  if (!filter) return map;

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
    } else if (isContributor) {
      map.set(task.id, { role: 'contributor', colour, hideOthers });
    } else if (isMeetingOrganiser) {
      map.set(task.id, { role: 'meetingOrganiser', colour, hideOthers });
    } else {
      map.set(task.id, { role: 'none', colour: null, hideOthers });
    }
  }

  return map;
}
