// Process file schema.
//
// The JSON on disk conforms to ProcessFile. Schema evolution is handled by
// bumping CURRENT_SCHEMA_VERSION and adding a migration step in
// utils/fileIO.ts — never by silently changing field shapes. Unknown fields
// on a task are round-tripped via `extras` so forward-compat is free.

export const CURRENT_SCHEMA_VERSION = 3;

// Initial set of deliverable states a new empty file starts with. Users
// can rename, reorder, and add/remove these in the deliverable-item
// management panel.
export const DEFAULT_DELIVERABLE_STATES: string[] = [
  'Draft',
  'In Review',
  'Approved',
  'Final',
];

// Canonical activity types. The list is authoritative — the edit UI
// restricts selection to these values. "Deliverable" was renamed to
// "Key Output" in v3 to avoid confusion with the task-level
// deliverables field; the v2→v3 migration handles the rename on load.
export const ACTIVITY_TYPES = [
  'Start',
  'Key Output',
  'Standard Process',
  'Required',
  'Optional',
  'Conditional',
  'Milestone',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// Sentinel values that CSV imports treat as "no meeting organiser"
// rather than a meaningful role name.
const MEETING_SENTINELS = new Set(['', 'n/a', 'na', 'none', '-']);

export interface ProcessFile {
  schemaVersion: number;
  meta: FileMeta;
  phases: Phase[];
  tasks: Task[];
  // Registry of roles used across tasks. Tasks still store accountable /
  // contributor NAMES (strings), not IDs — the list is a directory for
  // pickers and colour metadata. Adding a role here is optional; tasks
  // can reference names that aren't in the list.
  roles: Role[];
  // Fixed-list document types tracked through the process, e.g. "Vision
  // Specification", "Business Case", "FMEA". Tasks declare which items
  // they advance and to what state via Task.deliverableTargets.
  deliverableItems: DeliverableItem[];
  // Allowed target states for deliverable items, e.g.
  // ["Draft", "In Review", "Approved", "Final"]. Ordered — later states
  // are "further progressed". Task.deliverableTargets[].state references
  // a value from here.
  deliverableStates: string[];
}

export interface FileMeta {
  // Name of the process master (historically a per-row constant in the
  // source spreadsheet, e.g. "NPDProcessMaster"). Lifted to file level.
  masterName: string;
  // Human-friendly title shown in the toolbar.
  title: string;
  // ISO-8601 timestamp of last save. Stamped by serializeProcessFile.
  updatedAt: string;
  // Obfuscated (NOT encrypted) password blob, or null if the file has no
  // edit gate. See utils/password.ts — a determined reader with the source
  // can always recover it; this only blocks casual tool users from editing.
  passwordCipher: string | null;
}

export interface Phase {
  id: string;                // internal stable id
  order: number;             // manual sort key, lower = earlier
  name: string;
  intro: string;             // free markdown for v1; constrained template later
  // Hex colour string (e.g. "#4f46e5") used for the phase's swatch in
  // the sidebar and any other phase accents. Null = no colour chosen.
  // Rendered the same way in both Navigate and Edit modes.
  colour: string | null;
}

export interface Role {
  id: string;
  name: string;
  // Optional colour for role-based node tinting (deferred feature).
  colour: string | null;
}

export interface DeliverableItem {
  id: string;
  name: string;
  description: string;
}

export interface DeliverableTarget {
  // References DeliverableItem.id on the file.
  itemId: string;
  // References a value in ProcessFile.deliverableStates. Free-form
  // string at the storage layer so renaming a state doesn't orphan
  // targets — the UI warns when a target's state isn't in the current
  // list.
  state: string;
}

export interface Task {
  // Internal stable id. Prerequisites reference this, NOT taskId, so that
  // renumbering a task (editing taskId) never breaks dependents.
  id: string;
  // User-visible code, e.g. "10.045". Editable; can collide in theory but
  // we surface duplicates in edit mode rather than enforcing uniqueness.
  taskId: string;
  phaseId: string;                  // → Phase.id
  processId: string | null;         // reserved for future Process container
  name: string;
  activityType: string;             // one of ACTIVITY_TYPES (enforced by UI, free on disk)
  dateType: string;                 // KEY DATE | MS DATE | NONE | custom
  description: string;
  deliverables: string;
  accountable: string;
  contributors: string[];
  // Whether this task involves a meeting. When true, meetingOrganiser
  // is shown in the UI. Inferred from meetingOrganiser on CSV import:
  // if the value is null/N/A/None → false, otherwise true.
  isMeetingTask: boolean;
  meetingOrganiser: string | null;
  pdmTemplate: string | null;
  // Abbreviation — only meaningful when dateType is KEY DATE or MS DATE
  // (e.g. "CR1", "VA MS"). Hidden in the edit UI when dateType is NONE.
  abbr: string | null;
  keyDateRationale: string | null;
  function: string;
  prerequisites: string[];          // refs to Task.id (internal), not Task.taskId
  // Declarative "by the end of this task, these deliverable items reach
  // these states". Powers the cross-cutting deliverable checklist view.
  deliverableTargets: DeliverableTarget[];
  // Pass-through for fields the current schema doesn't know about.
  // Preserved verbatim on export so future fields aren't silently lost.
  extras: Record<string, unknown>;
}

// ---- Factories ----------------------------------------------------------

export function makeEmptyProcessFile(title = 'Untitled Process'): ProcessFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      masterName: title,
      title,
      updatedAt: new Date().toISOString(),
      passwordCipher: null,
    },
    phases: [],
    tasks: [],
    roles: [],
    deliverableItems: [],
    deliverableStates: [...DEFAULT_DELIVERABLE_STATES],
  };
}

// ---- Lookup helpers -----------------------------------------------------

export function findTaskByInternalId(
  file: ProcessFile,
  id: string,
): Task | undefined {
  return file.tasks.find((t) => t.id === id);
}

export function findTaskByTaskId(
  file: ProcessFile,
  taskId: string,
): Task | undefined {
  return file.tasks.find((t) => t.taskId === taskId);
}

export function findPhaseById(
  file: ProcessFile,
  id: string,
): Phase | undefined {
  return file.phases.find((p) => p.id === id);
}

export function findRoleById(
  file: ProcessFile,
  id: string,
): Role | undefined {
  return file.roles.find((r) => r.id === id);
}

export function findRoleByName(
  file: ProcessFile,
  name: string,
): Role | undefined {
  return file.roles.find((r) => r.name === name);
}

export function findDeliverableItemById(
  file: ProcessFile,
  id: string,
): DeliverableItem | undefined {
  return file.deliverableItems.find((d) => d.id === id);
}

export function getPrerequisiteTasks(
  file: ProcessFile,
  task: Task,
): Task[] {
  return task.prerequisites
    .map((prereqId) => findTaskByInternalId(file, prereqId))
    .filter((t): t is Task => t !== undefined);
}

export function getDependentTasks(
  file: ProcessFile,
  task: Task,
): Task[] {
  return file.tasks.filter((t) => t.prerequisites.includes(task.id));
}

export function getTasksInPhase(
  file: ProcessFile,
  phaseId: string,
): Task[] {
  return file.tasks.filter((t) => t.phaseId === phaseId);
}

export function getPhasesOrdered(file: ProcessFile): Phase[] {
  return [...file.phases].sort((a, b) => a.order - b.order);
}

// ---- Activity type helpers ------------------------------------------------

/**
 * Normalize a raw activity-type string from imported data. Handles the
 * v2→v3 rename ("Deliverable" → "Key Output") and trims whitespace.
 * Unknown values are passed through as-is so no data is lost.
 */
export function normalizeActivityType(raw: string): string {
  const trimmed = raw.trim();
  if (/^deliverable$/i.test(trimmed)) return 'Key Output';
  return trimmed;
}

// ---- Role helpers ---------------------------------------------------------

/**
 * Build a unified sorted list of role names from the explicit roles
 * registry PLUS every unique name used across all tasks' accountable,
 * contributors, and meetingOrganiser fields. This is what all role
 * pickers should show as their suggestion list — it guarantees that
 * any name used anywhere in the process is selectable everywhere.
 */
export function getAllRoleNames(file: ProcessFile): string[] {
  const names = new Set<string>();
  for (const r of file.roles) if (r.name) names.add(r.name);
  for (const t of file.tasks) {
    if (t.accountable) names.add(t.accountable);
    for (const c of t.contributors) if (c) names.add(c);
    if (t.meetingOrganiser) names.add(t.meetingOrganiser);
  }
  names.delete('');
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/**
 * Infer whether a raw meetingOrganiser value from CSV/legacy data
 * means "this is a meeting task" (true) or not (false).
 */
export function inferIsMeetingTask(meetingOrganiser: string | null): boolean {
  if (!meetingOrganiser) return false;
  return !MEETING_SENTINELS.has(meetingOrganiser.trim().toLowerCase());
}
