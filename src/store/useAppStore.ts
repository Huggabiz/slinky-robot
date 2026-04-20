import { create } from 'zustand';
import {
  type Phase,
  type ProcessFile,
  type Role,
  type Task,
  findPhaseById,
  getPhasesOrdered,
  getTasksInPhase,
  makeEmptyProcessFile,
} from '../types';
import { makeId } from '../utils/id';

// Review = read-only navigation; Edit = full editing (behind the
// file's optional password gate, enforced at transition time in the UI).
export type EditorMode = 'review' | 'edit';

interface AppState {
  // The currently loaded process file (null = nothing open).
  file: ProcessFile | null;
  // Last-used filename for save default. Null until opened/saved.
  fileName: string | null;
  // File System Access API handle — when present, Save can overwrite
  // in place instead of prompting a download dialog. Set by Open
  // (when FSAA is available) or by Save As.
  fileHandle: FileSystemFileHandle | null;
  mode: EditorMode;
  // Selected task by internal id, drives the detail panel.
  selectedTaskId: string | null;
  // Whether there are unsaved changes since last load/save.
  dirty: boolean;

  // Actions
  newEmptyFile: () => void;
  loadFile: (
    file: ProcessFile,
    fileName: string | null,
    handle?: FileSystemFileHandle | null,
  ) => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  selectTask: (id: string | null) => void;
  setMode: (mode: EditorMode) => void;
  markDirty: () => void;
  markClean: () => void;

  // ---- Edit mutations ----
  // Generic updater that runs the given function against the current
  // file and stores the result. Marks dirty automatically. Returns the
  // new file, or null if there's no file open.
  updateFile: (
    updater: (file: ProcessFile) => ProcessFile,
  ) => ProcessFile | null;
  // Create a new phase at the end of the ordered list with sensible
  // defaults and return its id.
  addPhase: () => string | null;
  // Shallow-merge a patch onto an existing phase.
  updatePhase: (id: string, patch: Partial<Phase>) => void;
  // Delete a phase. Refuses if the phase still has tasks, surfacing an
  // error message the caller can show the user.
  deletePhase: (id: string) => { ok: boolean; error?: string };
  // Move a phase up or down in the ordered list, swapping its order
  // value with its neighbour.
  movePhase: (id: string, direction: 'up' | 'down') => void;
  // Create a new task in the given phase, optionally auto-adding a
  // prerequisite (used by "+ Process Step" to chain from the current
  // selection). Returns the new task's internal id.
  addTask: (
    phaseId: string,
    options?: { autoPrereqOfTaskId?: string | null },
  ) => string | null;
  // Shallow-merge a patch onto an existing task.
  updateTask: (id: string, patch: Partial<Task>) => void;
  // Add a role to the registry. If a role with the same name already
  // exists its id is returned without creating a duplicate. Returns
  // the role id, or null if no file is open.
  addRole: (name: string, colour?: string | null) => string | null;
}

export const useAppStore = create<AppState>((set, get) => ({
  file: null,
  fileName: null,
  fileHandle: null,
  mode: 'review',
  selectedTaskId: null,
  dirty: false,

  newEmptyFile: () =>
    set({
      file: makeEmptyProcessFile(),
      fileName: null,
      fileHandle: null,
      selectedTaskId: null,
      dirty: false,
      mode: 'review',
    }),

  loadFile: (file, fileName, handle) =>
    set({
      file,
      fileName,
      fileHandle: handle ?? null,
      selectedTaskId: null,
      dirty: false,
      mode: 'review',
    }),

  setFileHandle: (handle) => set({ fileHandle: handle }),
  selectTask: (id) => set({ selectedTaskId: id }),
  setMode: (mode) => set({ mode }),
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),

  // ---- Edit mutations ----

  updateFile: (updater) => {
    const current = get().file;
    if (!current) return null;
    const next = updater(current);
    set({ file: next, dirty: true });
    return next;
  },

  addPhase: () => {
    const current = get().file;
    if (!current) return null;
    const ordered = getPhasesOrdered(current);
    const maxOrder =
      ordered.length === 0 ? 0 : ordered[ordered.length - 1].order + 10;
    const newPhase: Phase = {
      id: makeId(),
      order: maxOrder,
      name: 'New Milestone',
      intro: '',
      colour: null,
    };
    set({
      file: { ...current, phases: [...current.phases, newPhase] },
      dirty: true,
    });
    return newPhase.id;
  },

  updatePhase: (id, patch) => {
    const current = get().file;
    if (!current) return;
    set({
      file: {
        ...current,
        phases: current.phases.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      },
      dirty: true,
    });
  },

  deletePhase: (id) => {
    const current = get().file;
    if (!current) return { ok: false, error: 'No file open' };
    const phase = current.phases.find((p) => p.id === id);
    if (!phase) return { ok: false, error: 'Phase not found' };
    const taskCount = getTasksInPhase(current, id).length;
    if (taskCount > 0) {
      return {
        ok: false,
        error: `Phase "${phase.name}" still has ${taskCount} task${taskCount === 1 ? '' : 's'}. Move or delete them first.`,
      };
    }
    set({
      file: {
        ...current,
        phases: current.phases.filter((p) => p.id !== id),
      },
      dirty: true,
    });
    return { ok: true };
  },

  movePhase: (id, direction) => {
    const current = get().file;
    if (!current) return;
    const ordered = getPhasesOrdered(current);
    const idx = ordered.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const swapWithIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWithIdx < 0 || swapWithIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapWithIdx];
    // Swap order values so the sort flips without reshuffling anything
    // else.
    const orderA = a.order;
    const orderB = b.order;
    set({
      file: {
        ...current,
        phases: current.phases.map((p) => {
          if (p.id === a.id) return { ...p, order: orderB };
          if (p.id === b.id) return { ...p, order: orderA };
          return p;
        }),
      },
      dirty: true,
    });
  },

  addTask: (phaseId, options = {}) => {
    const current = get().file;
    if (!current) return null;
    const phase = findPhaseById(current, phaseId);
    if (!phase) return null;
    const autoPrereq = options.autoPrereqOfTaskId;
    const newTask: Task = {
      id: makeId(),
      taskId: generateTaskId(current, phaseId),
      phaseId,
      processId: null,
      name: '',
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
      prerequisites: autoPrereq ? [autoPrereq] : [],
      deliverableTargets: [],
      extras: {},
    };
    set({
      file: { ...current, tasks: [...current.tasks, newTask] },
      dirty: true,
    });
    return newTask.id;
  },

  updateTask: (id, patch) => {
    const current = get().file;
    if (!current) return;
    set({
      file: {
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
      },
      dirty: true,
    });
  },

  addRole: (name, colour = null) => {
    const current = get().file;
    if (!current) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = current.roles.find((r) => r.name === trimmed);
    if (existing) return existing.id;
    const newRole: Role = { id: makeId(), name: trimmed, colour };
    set({
      file: { ...current, roles: [...current.roles, newRole] },
      dirty: true,
    });
    return newRole.id;
  },
}));

/**
 * Generate a task-id code for a new task following the host process's
 * naming convention. Existing IDs in the same phase are scanned for
 * the `<phaseOrder>.NNN` pattern and the next number is 10 higher
 * than the current max, padded to 3 digits (e.g. "20.045"). Falls
 * back to just the phase order and "000" if no existing tasks match
 * the pattern.
 */
function generateTaskId(file: ProcessFile, phaseId: string): string {
  const phase = findPhaseById(file, phaseId);
  if (!phase) return '';
  const prefix = phase.order;
  const existing = file.tasks
    .filter((t) => t.phaseId === phaseId)
    .map((t) => {
      const m = /^(\d+)\.(\d+)$/.exec(t.taskId);
      return m && Number(m[1]) === prefix ? Number(m[2]) : null;
    })
    .filter((n): n is number => n !== null);
  const nextNum = existing.length === 0 ? 0 : Math.max(...existing) + 10;
  return `${prefix}.${String(nextNum).padStart(3, '0')}`;
}
