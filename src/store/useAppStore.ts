import { create } from 'zustand';
import { type ProcessFile, makeEmptyProcessFile } from '../types';

// Review = read-only navigation; Edit = form controls unlocked (behind the
// file's optional password gate, enforced at mode-transition time in the UI).
export type EditorMode = 'review' | 'edit';

interface AppState {
  // The currently loaded process file (null = nothing open).
  file: ProcessFile | null;
  // Last-used filename for save default. Null until opened/saved.
  fileName: string | null;
  mode: EditorMode;
  // Selected task by internal id, drives the detail panel.
  selectedTaskId: string | null;
  // Whether there are unsaved changes since last load/save.
  dirty: boolean;

  // Actions
  newEmptyFile: () => void;
  loadFile: (file: ProcessFile, fileName: string | null) => void;
  selectTask: (id: string | null) => void;
  setMode: (mode: EditorMode) => void;
  markDirty: () => void;
  markClean: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  file: null,
  fileName: null,
  mode: 'review',
  selectedTaskId: null,
  dirty: false,

  newEmptyFile: () =>
    set({
      file: makeEmptyProcessFile(),
      fileName: null,
      selectedTaskId: null,
      dirty: false,
      mode: 'review',
    }),

  loadFile: (file, fileName) =>
    set({
      file,
      fileName,
      selectedTaskId: null,
      dirty: false,
      mode: 'review',
    }),

  selectTask: (id) => set({ selectedTaskId: id }),
  setMode: (mode) => set({ mode }),
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),
}));
