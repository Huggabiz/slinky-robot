import {
  type ProcessFile,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DELIVERABLE_STATES,
} from '../types';

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
  return migrated;
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
  if (!Array.isArray(obj.roles)) {
    throw new InvalidFileError('roles must be an array');
  }
  if (!Array.isArray(obj.deliverableItems)) {
    throw new InvalidFileError('deliverableItems must be an array');
  }
  if (!Array.isArray(obj.deliverableStates)) {
    throw new InvalidFileError('deliverableStates must be an array');
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
  return validateProcessFile(migrate(raw));
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
