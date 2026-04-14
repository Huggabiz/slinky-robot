// Process file schema.
//
// The JSON on disk conforms to ProcessFile. Schema evolution is handled by
// bumping CURRENT_SCHEMA_VERSION and adding a migration step in
// utils/fileIO.ts — never by silently changing field shapes. Unknown fields
// on a task are round-tripped via `extras` so forward-compat is free.

export const CURRENT_SCHEMA_VERSION = 1;

export interface ProcessFile {
  schemaVersion: number;
  meta: FileMeta;
  phases: Phase[];
  tasks: Task[];
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
  id: string;        // internal stable id
  order: number;     // manual sort key, lower = earlier
  name: string;
  intro: string;     // free markdown for v1; constrained template later
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
  activityType: string;             // free string, discovered from data
  dateType: string;                 // KEY DATE | MS DATE | NONE | custom
  description: string;
  deliverables: string;
  accountable: string;
  contributors: string[];
  meetingOrganiser: string | null;
  pdmTemplate: string | null;
  abbr: string | null;
  keyDateRationale: string | null;
  function: string;
  prerequisites: string[];          // refs to Task.id (internal), not Task.taskId
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
