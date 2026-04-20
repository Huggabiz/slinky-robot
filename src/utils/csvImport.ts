import {
  type ProcessFile,
  type Phase,
  type Role,
  type Task,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DELIVERABLE_STATES,
} from '../types';

// Target fields the importer knows how to populate. Anything else in the
// source spreadsheet is ignored (for now — a later pass could drop
// unknown columns into `task.extras` automatically).
export const TARGET_FIELDS = [
  'taskId',
  'name',
  'phase',
  'prerequisites',
  'activityType',
  'dateType',
  'description',
  'deliverables',
  'accountable',
  'contributors',
  'meetingOrganiser',
  'pdmTemplate',
  'abbr',
  'keyDateRationale',
  'function',
  'masterName',
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

export const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  taskId: 'Task ID',
  name: 'Task Name',
  phase: 'Phase',
  prerequisites: 'Pre-Requisites',
  activityType: 'Activity Type',
  dateType: 'Date Type',
  description: 'Task Description',
  deliverables: 'Deliverable(s)',
  accountable: 'Accountable',
  contributors: 'Contributor(s)',
  meetingOrganiser: 'Meeting Organiser',
  pdmTemplate: 'PDM Template',
  abbr: 'ABBR',
  keyDateRationale: 'Key Date Target Rationale',
  function: 'Function',
  masterName: 'Master Name (file-level)',
};

// Without these the import can't produce a meaningful task list.
export const REQUIRED_FIELDS: TargetField[] = ['taskId', 'name', 'phase'];

export type ColumnMapping = Partial<Record<TargetField, number>>;

/**
 * Heuristic auto-mapper: for each target field, find the best matching
 * source header by case-insensitive exact match first, then substring
 * containment. Unmapped fields come back as undefined and have to be
 * resolved by the user in the dialog.
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = {};

  const candidates: Record<TargetField, string[]> = {
    taskId: ['task id', 'id', 'step id'],
    name: ['task name', 'name', 'step name', 'activity name'],
    phase: ['phase', 'milestone phase', 'stage'],
    prerequisites: [
      'pre-requisites',
      'prerequisites',
      'prereq',
      'depends on',
    ],
    activityType: ['activity type', 'type'],
    dateType: ['date type'],
    description: ['task description', 'description', 'notes'],
    deliverables: [
      'deliverable(s)',
      'deliverables',
      'deliverable',
      'output',
    ],
    accountable: ['accountable', 'owner', 'raci a'],
    contributors: [
      'contributor(s)',
      'contributors',
      'contributor',
      'responsible',
      'raci r',
    ],
    meetingOrganiser: [
      'meeting organiser',
      'meeting organizer',
      'organiser',
    ],
    pdmTemplate: ['pdm template', 'template'],
    abbr: ['abbr', 'abbreviation', 'short code'],
    keyDateRationale: ['key date target rationale', 'rationale'],
    function: ['function'],
    masterName: ['master name', 'process master'],
  };

  for (const field of TARGET_FIELDS) {
    const opts = candidates[field];
    let found = -1;
    for (let i = 0; i < normalized.length; i++) {
      if (opts.includes(normalized[i])) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      for (let i = 0; i < normalized.length; i++) {
        if (opts.some((o) => normalized[i].includes(o))) {
          found = i;
          break;
        }
      }
    }
    if (found !== -1) {
      mapping[field] = found;
    }
  }

  return mapping;
}

function cell(row: string[], col: number | undefined): string {
  if (col === undefined) return '';
  return (row[col] || '').trim();
}

function splitList(raw: string, separators: RegExp): string[] {
  return raw
    .split(separators)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Extract the leading numeric prefix from a taskId like "10.045" → 10.
 * Used as a natural phase sort key for the NPD format. Unparseable IDs
 * sink to the end.
 */
function leadingNumericPrefix(taskId: string): number {
  const match = /^(\d+)/.exec(taskId.trim());
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]);
}

/**
 * Generate an internal id. crypto.randomUUID is available in all modern
 * browsers in a secure context; the fallback exists only so unit tests or
 * very old runtimes don't throw.
 */
function makeId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface ImportResult {
  file: ProcessFile;
  warnings: string[];
}

/**
 * Build a ProcessFile from parsed CSV rows using the given column mapping.
 *
 * Phase discovery: unique values in the phase column become phases. The
 * order field is set to the leading numeric prefix of the first task in
 * that phase so "10.000 Opportunities Identified" sorts before "20.000
 * Vision Agreed", falling back to encounter order for ties.
 *
 * Prerequisites: source column is treated as a semicolon- or comma-
 * separated list of taskId strings. We build a taskId → internal-id map
 * in the first pass, then resolve each string in a second pass.
 * Unresolved refs produce a warning but don't fail the import.
 */
export function buildProcessFileFromCsv(
  _headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
  options: { title?: string } = {},
): ImportResult {
  const warnings: string[] = [];

  const phasesByName = new Map<string, Phase>();
  const phaseOrderSeen = new Map<string, number>();
  const tasks: Task[] = [];
  const tasksByTaskId = new Map<string, Task>();
  const rawPrereqs: { task: Task; raw: string }[] = [];
  let masterName: string | null = null;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const taskIdStr = cell(row, mapping.taskId);
    const nameStr = cell(row, mapping.name);
    const phaseStr = cell(row, mapping.phase);

    if (!taskIdStr && !nameStr && !phaseStr) {
      continue; // effectively-empty row
    }
    if (!taskIdStr) {
      warnings.push(`Row ${rowIdx + 2}: missing Task ID, skipped.`);
      continue;
    }
    if (!phaseStr) {
      warnings.push(
        `Row ${rowIdx + 2} (${taskIdStr}): missing Phase, skipped.`,
      );
      continue;
    }

    let phase = phasesByName.get(phaseStr);
    if (!phase) {
      phase = {
        id: makeId(),
        order: leadingNumericPrefix(taskIdStr),
        name: phaseStr,
        intro: '',
        colour: null,
      };
      phasesByName.set(phaseStr, phase);
      phaseOrderSeen.set(phaseStr, phasesByName.size);
    }

    if (masterName === null) {
      const m = cell(row, mapping.masterName);
      if (m) masterName = m;
    }

    const task: Task = {
      id: makeId(),
      taskId: taskIdStr,
      phaseId: phase.id,
      processId: null,
      name: nameStr,
      activityType: cell(row, mapping.activityType),
      dateType: cell(row, mapping.dateType),
      description: cell(row, mapping.description),
      deliverables: cell(row, mapping.deliverables),
      accountable: cell(row, mapping.accountable),
      contributors: splitList(cell(row, mapping.contributors), /,/),
      meetingOrganiser: cell(row, mapping.meetingOrganiser) || null,
      pdmTemplate: cell(row, mapping.pdmTemplate) || null,
      abbr: cell(row, mapping.abbr) || null,
      keyDateRationale: cell(row, mapping.keyDateRationale) || null,
      function: cell(row, mapping.function),
      prerequisites: [],
      deliverableTargets: [],
      extras: {},
    };

    if (tasksByTaskId.has(taskIdStr)) {
      warnings.push(
        `Duplicate Task ID "${taskIdStr}" — both tasks kept; taskId lookups resolve to the later row.`,
      );
    }
    tasksByTaskId.set(taskIdStr, task);
    tasks.push(task);

    const prereqRaw = cell(row, mapping.prerequisites);
    if (prereqRaw) {
      rawPrereqs.push({ task, raw: prereqRaw });
    }
  }

  // Second pass: resolve prerequisites via taskId lookup now that all
  // tasks have been created.
  for (const { task, raw } of rawPrereqs) {
    const refs = splitList(raw, /[;,]/);
    const resolved: string[] = [];
    for (const ref of refs) {
      const target = tasksByTaskId.get(ref);
      if (target) {
        resolved.push(target.id);
      } else {
        warnings.push(
          `Task ${task.taskId}: prerequisite "${ref}" not found in imported rows.`,
        );
      }
    }
    task.prerequisites = resolved;
  }

  const phases = Array.from(phasesByName.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return (
      (phaseOrderSeen.get(a.name) ?? 0) - (phaseOrderSeen.get(b.name) ?? 0)
    );
  });

  const title = options.title ?? masterName ?? 'Imported Process';

  // Auto-discover roles from the imported task data — unique non-empty
  // strings across `accountable` and every `contributors[]`. Skips
  // sentinels like "None" and "N/A" which appear in the sample data
  // but aren't meaningful roles.
  const roles = discoverRoles(tasks);

  const file: ProcessFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      masterName: masterName ?? title,
      title,
      updatedAt: new Date().toISOString(),
      passwordCipher: null,
    },
    phases,
    tasks,
    roles,
    deliverableItems: [],
    deliverableStates: [...DEFAULT_DELIVERABLE_STATES],
  };

  return { file, warnings };
}

const ROLE_SENTINELS = new Set(['', 'none', 'n/a', 'na', '-']);

function discoverRoles(tasks: Task[]): Role[] {
  const names = new Set<string>();
  for (const task of tasks) {
    if (task.accountable && !isSentinelRole(task.accountable)) {
      names.add(task.accountable);
    }
    for (const c of task.contributors) {
      if (c && !isSentinelRole(c)) names.add(c);
    }
  }
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: makeId(), name, colour: null }));
}

function isSentinelRole(name: string): boolean {
  return ROLE_SENTINELS.has(name.trim().toLowerCase());
}
