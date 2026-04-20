import { create } from 'zustand';
import {
  type Phase,
  type ProcessFile,
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
}));
