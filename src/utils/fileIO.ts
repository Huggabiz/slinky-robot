import {
  type ProcessFile,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DELIVERABLE_STATES,
} from '../types';
import { makeId } from './id';

export class InvalidFileError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'InvalidFileError';
    this.cause = cause;
  }
}

// Runs before validation to bring older schema versions up to current.
// Each migration is its own named function and the chain applies them
// in order, so adding future bumps is a one-line change.
function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const versionRaw = obj.schemaVersion;
  const version = typeof versionRaw === 'number' ? versionRaw : 1;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new InvalidFileError(
      `File schemaVersion ${version} is newer than this app supports (${CURRENT_SCHEMA_VERSION}). Update the app.`,
    );
  }

  let migrated = obj;
  if (version < 2) migrated = migrateV1toV2(migrated);
  if (version < 3) migrated = migrateV2toV3(migrated);
  if (version < 4) migrated = migrateV3toV4(migrated);
  // Always run the defensive normalisation pass regardless of starting
  // version, so files with missing fields from any era (including
  // earlier-in-development v2/v3 files that never hit the relevant
  // migration) end up with a complete, predictable shape.
  migrated = normaliseShape(migrated);
  return migrated;
}

/**
 * Defensive normalisation — idempotent. Ensures every top-level array
 * and every task/phase field the app expects is present with a
 * sensible default, without clobbering any existing values. This
 * runs after the version-specific migrations so a file can't reach
 * the renderer in a partially-populated state (which was the root
 * cause of "loading my previous file crashes").
 */
function normaliseShape(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const sentinels = new Set(['', 'n/a', 'na', 'none', '-']);
  const inferIsMeeting = (organiser: unknown): boolean => {
    if (typeof organiser !== 'string') return false;
    return !sentinels.has(organiser.trim().toLowerCase());
  };

  const phases = Array.isArray(raw.phases) ? raw.phases : [];
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];

  return {
    ...raw,
    departments: Array.isArray(raw.departments) ? raw.departments : [],
    roles: Array.isArray(raw.roles)
      ? (raw.roles as Record<string, unknown>[]).map((r) => ({
          ...r,
          departmentId:
            typeof r.departmentId === 'string' ? r.departmentId : null,
        }))
      : [],
    deliverableItems: Array.isArray(raw.deliverableItems)
      ? (raw.deliverableItems as Record<string, unknown>[]).map((di) => ({
          ...di,
          states: Array.isArray(di.states) ? di.states : [],
        }))
      : [],
    phases: phases.map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return {
        ...o,
        intro: typeof o.intro === 'string' ? o.intro : '',
        colour:
          typeof o.colour === 'string' || o.colour === null
            ? o.colour
            : null,
        order: typeof o.order === 'number' ? o.order : 0,
        name: typeof o.name === 'string' ? o.name : 'Unnamed phase',
      };
    }),
    tasks: tasks.map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const str = (v: unknown, fallback = ''): string =>
        typeof v === 'string' ? v : fallback;
      const strOrNull = (v: unknown): string | null =>
        typeof v === 'string' ? v : null;
      return {
        ...o,
        taskId: str(o.taskId),
        phaseId: str(o.phaseId),
        processId:
          typeof o.processId === 'string' ? o.processId : null,
        name: str(o.name),
        activityType: str(o.activityType),
        dateType: str(o.dateType, 'NONE'),
        description: str(o.description),
        deliverables: str(o.deliverables),
        accountable: str(o.accountable),
        contributors: Array.isArray(o.contributors)
          ? (o.contributors as unknown[]).filter(
              (c): c is string => typeof c === 'string',
            )
          : [],
        isMeetingTask:
          typeof o.isMeetingTask === 'boolean'
            ? o.isMeetingTask
            : inferIsMeeting(o.meetingOrganiser),
        meetingOrganiser: strOrNull(o.meetingOrganiser),
        pdmTemplate: strOrNull(o.pdmTemplate),
        abbr: strOrNull(o.abbr),
        keyDateRationale: strOrNull(o.keyDateRationale),
        function: str(o.function),
        prerequisites: Array.isArray(o.prerequisites)
          ? (o.prerequisites as unknown[]).filter(
              (p): p is string => typeof p === 'string',
            )
          : [],
        deliverableTargets: Array.isArray(o.deliverableTargets)
          ? o.deliverableTargets
          : [],
        extras:
          o.extras && typeof o.extras === 'object'
            ? (o.extras as Record<string, unknown>)
            : {},
      };
    }),
  };
}

/**
 * v1 → v2 migration.
 *
 * Adds the Phase.colour, Task.deliverableTargets, and the three new
 * file-level arrays (roles, deliverableItems, deliverableStates). All
 * defaults are empty except deliverableStates which seeds the standard
 * list so the user has something to pick from. Existing fields are
 * untouched, so this migration is non-destructive.
 */
function migrateV1toV2(
  file: Record<string, unknown>,
): Record<string, unknown> {
  const phases = Array.isArray(file.phases) ? file.phases : [];
  const tasks = Array.isArray(file.tasks) ? file.tasks : [];
  return {
    ...file,
    schemaVersion: 2,
    roles: Array.isArray(file.roles) ? file.roles : [],
    deliverableItems: Array.isArray(file.deliverableItems)
      ? file.deliverableItems
      : [],
    deliverableStates: Array.isArray(file.deliverableStates)
      ? file.deliverableStates
      : [...DEFAULT_DELIVERABLE_STATES],
    phases: phases.map((p) => {
      const phaseObj = (p ?? {}) as Record<string, unknown>;
      return {
        ...phaseObj,
        colour:
          typeof phaseObj.colour === 'string' || phaseObj.colour === null
            ? phaseObj.colour
            : null,
      };
    }),
    tasks: tasks.map((t) => {
      const taskObj = (t ?? {}) as Record<string, unknown>;
      return {
        ...taskObj,
        deliverableTargets: Array.isArray(taskObj.deliverableTargets)
          ? taskObj.deliverableTargets
          : [],
      };
    }),
  };
}

/**
 * v2 → v3 migration.
 *
 * - Renames the "Deliverable" activity type to "Key Output" on every
 *   task (case-insensitive match).
 * - Adds the `isMeetingTask` boolean to every task, inferred from
 *   meetingOrganiser: null / N/A / None / empty → false, else true.
 */
function migrateV2toV3(
  file: Record<string, unknown>,
): Record<string, unknown> {
  const tasks = Array.isArray(file.tasks) ? file.tasks : [];
  return {
    ...file,
    schemaVersion: 3,
    tasks: tasks.map((t) => {
      const taskObj = (t ?? {}) as Record<string, unknown>;
      const rawType =
        typeof taskObj.activityType === 'string'
          ? taskObj.activityType
          : '';
      const rawOrganiser =
        typeof taskObj.meetingOrganiser === 'string'
          ? taskObj.meetingOrganiser
          : null;
      const sentinels = new Set(['', 'n/a', 'na', 'none', '-']);
      const isMeeting =
        !!rawOrganiser && !sentinels.has(rawOrganiser.trim().toLowerCase());
      return {
        ...taskObj,
        activityType: /^deliverable$/i.test(rawType.trim())
          ? 'Key Output'
          : rawType,
        isMeetingTask:
          typeof taskObj.isMeetingTask === 'boolean'
            ? taskObj.isMeetingTask
            : isMeeting,
      };
    }),
  };
}

/**
 * v3 → v4 migration.
 *
 * - Adds the `departments` top-level array (empty — user curates).
 * - Adds `departmentId: null` to every Role.
 * - Moves the global `deliverableStates` list into each
 *   DeliverableItem as a per-item `states` array. Items that already
 *   have `states` are left alone.
 * - Removes `deliverableStates` from the top level (the normaliser
 *   won't re-add it since it's no longer in the type).
 */
function migrateV3toV4(
  file: Record<string, unknown>,
): Record<string, unknown> {
  const globalStates = Array.isArray(file.deliverableStates)
    ? (file.deliverableStates as string[])
    : [];
  const items = Array.isArray(file.deliverableItems)
    ? file.deliverableItems
    : [];
  const roles = Array.isArray(file.roles) ? file.roles : [];

  const result: Record<string, unknown> = {
    ...file,
    schemaVersion: 4,
    departments: Array.isArray(file.departments) ? file.departments : [],
    roles: roles.map((r) => {
      const roleObj = (r ?? {}) as Record<string, unknown>;
      return {
        ...roleObj,
        departmentId:
          typeof roleObj.departmentId === 'string'
            ? roleObj.departmentId
            : null,
      };
    }),
    deliverableItems: items.map((item) => {
      const itemObj = (item ?? {}) as Record<string, unknown>;
      return {
        ...itemObj,
        states: Array.isArray(itemObj.states)
          ? itemObj.states
          : [...globalStates],
      };
    }),
  };
  // Remove the deprecated global list.
  delete result.deliverableStates;
  return result;
}

// Lenient structural validation. We want the app to open any reasonably
// shaped file and surface field-level issues inline rather than refusing
// to load. Migration has already filled in the new top-level arrays by
// this point, so we only need to check the core shape.
function validateProcessFile(raw: unknown): ProcessFile {
  if (!raw || typeof raw !== 'object') {
    throw new InvalidFileError('Root must be an object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number') {
    throw new InvalidFileError('Missing or invalid schemaVersion');
  }
  if (!obj.meta || typeof obj.meta !== 'object') {
    throw new InvalidFileError('Missing or invalid meta object');
  }
  if (!Array.isArray(obj.phases)) {
    throw new InvalidFileError('phases must be an array');
  }
  if (!Array.isArray(obj.tasks)) {
    throw new InvalidFileError('tasks must be an array');
  }
  if (!Array.isArray(obj.departments)) {
    throw new InvalidFileError('departments must be an array');
  }
  if (!Array.isArray(obj.roles)) {
    throw new InvalidFileError('roles must be an array');
  }
  if (!Array.isArray(obj.deliverableItems)) {
    throw new InvalidFileError('deliverableItems must be an array');
  }
  return raw as ProcessFile;
}

export function parseProcessFile(text: string): ProcessFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new InvalidFileError('File is not valid JSON', err);
  }
  const file = validateProcessFile(migrate(raw));
  return discoverMissingRoles(file);
}

/**
 * Scan every task's accountable, contributors, and meetingOrganiser
 * fields and add any name that isn't already in the roles registry.
 * Runs on every file load (JSON or CSV) so the registry is always a
 * superset of what the process actually references — not just what was
 * present at CSV-import time.
 */
function discoverMissingRoles(file: ProcessFile): ProcessFile {
  const existing = new Set(file.roles.map((r) => r.name));
  const sentinels = new Set(['', 'n/a', 'na', 'none', '-']);
  const discovered: { id: string; name: string; departmentId: null }[] = [];

  for (const task of file.tasks) {
    const names = [
      task.accountable,
      ...task.contributors,
      task.meetingOrganiser ?? '',
    ].filter(
      (n) => n.length > 0 && !sentinels.has(n.trim().toLowerCase()),
    );
    for (const name of names) {
      if (!existing.has(name)) {
        existing.add(name);
        discovered.push({ id: makeId(), name, departmentId: null });
      }
    }
  }

  if (discovered.length === 0) return file;
  return { ...file, roles: [...file.roles, ...discovered] };
}

export function serializeProcessFile(file: ProcessFile): string {
  // Always stamp updatedAt on save so meta reflects real save time.
  const updated: ProcessFile = {
    ...file,
    meta: {
      ...file.meta,
      updatedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(updated, null, 2);
}

// Trigger a browser download of the given file contents.
export function downloadJsonFile(file: ProcessFile, fileName: string): void {
  const text = serializeProcessFile(file);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Whether the browser supports the File System Access API (Chrome, Edge).
export const supportsFileSystemAccess =
  typeof window !== 'undefined' && 'showSaveFilePicker' in window;

const JSON_PICKER_TYPES: FilePickerAcceptType[] = [
  { description: 'JSON files', accept: { 'application/json': ['.json'] } },
];

/**
 * Open a file using the File System Access API. Returns the parsed
 * ProcessFile, the filename, and the FileSystemFileHandle (so Save
 * can overwrite in place). Falls back to null if FSAA is unavailable
 * or the user cancels.
 */
export async function openWithFileSystemAccess(): Promise<{
  file: ProcessFile;
  fileName: string;
  handle: FileSystemFileHandle;
} | null> {
  if (!supportsFileSystemAccess) return null;
  try {
    const [handle] = await window.showOpenFilePicker!({
      types: JSON_PICKER_TYPES,
      multiple: false,
    });
    const blob = await handle.getFile();
    const text = await blob.text();
    const parsed = parseProcessFile(text);
    return { file: parsed, fileName: handle.name, handle };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Save As — shows the native save dialog and writes the file. Returns
 * the new FileSystemFileHandle for subsequent Save operations. Returns
 * null if the user cancels or FSAA is unavailable.
 */
export async function saveAsWithFileSystemAccess(
  file: ProcessFile,
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  if (!supportsFileSystemAccess) return null;
  try {
    const handle = await window.showSaveFilePicker!({
      suggestedName,
      types: JSON_PICKER_TYPES,
    });
    await writeToHandle(handle, file);
    return handle;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Save (overwrite) — writes to an existing FileSystemFileHandle
 * without prompting.
 */
export async function saveToHandle(
  handle: FileSystemFileHandle,
  file: ProcessFile,
): Promise<void> {
  await writeToHandle(handle, file);
}

async function writeToHandle(
  handle: FileSystemFileHandle,
  file: ProcessFile,
): Promise<void> {
  const text = serializeProcessFile(file);
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

// Open the native file picker and return the parsed process file plus the
// original filename. If the user cancels, the promise resolves with null so
// callers can distinguish cancellation from error.
export function openProcessFilePicker(): Promise<
  { file: ProcessFile; fileName: string } | null
> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // `cancel` fires in modern browsers when the picker is dismissed without
    // a selection. Treat as a resolve(null), not an error.
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', async () => {
      const selected = input.files?.[0];
      if (!selected) {
        resolve(null);
        return;
      }
      try {
        const text = await selected.text();
        const parsed = parseProcessFile(text);
        resolve({ file: parsed, fileName: selected.name });
      } catch (err) {
        reject(err);
      }
    });
    input.click();
  });
}
