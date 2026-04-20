import { create } from 'zustand';
import { type ProcessFile, makeEmptyProcessFile } from '../types';

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
}

export const useAppStore = create<AppState>((set) => ({
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
}));
