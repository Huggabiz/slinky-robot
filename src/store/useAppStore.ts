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

// Maximum history entries retained per direction (undo + redo each).
// Snapshots are shallow references to ProcessFile objects, not deep
// copies, so the memory cost per entry is small — the file reference
// just holds the tasks/phases arrays from a previous render.
const MAX_HISTORY = 50;

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

  // ---- Undo history ----
  // Past file snapshots in chronological order (oldest first). Each
  // mutation pushes the pre-change file here. Undo pops the most
  // recent entry and restores it.
  past: ProcessFile[];
  // Future snapshots populated by undo. Each redo pops from here.
  // Any fresh mutation clears this array — redo-after-new-edit is
  // intentionally not supported (standard editor behaviour).
  future: ProcessFile[];

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

  // ---- Undo/redo ----
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ---- Edit mutations ----
  updateFile: (
    updater: (file: ProcessFile) => ProcessFile,
  ) => ProcessFile | null;
  addPhase: () => string | null;
  updatePhase: (id: string, patch: Partial<Phase>) => void;
  deletePhase: (id: string) => { ok: boolean; error?: string };
  movePhase: (id: string, direction: 'up' | 'down') => void;
  addTask: (
    phaseId: string,
    options?: { autoPrereqOfTaskId?: string | null },
  ) => string | null;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addRole: (name: string, colour?: string | null) => string | null;
  // Update a role (name and/or colour). If `name` changes, the rename
  // propagates through every task's accountable, contributors, and
  // meetingOrganiser fields so no task silently points at a missing
  // name. Returns false if the new name is empty or collides with
  // another existing role.
  updateRole: (id: string, patch: Partial<Role>) => boolean;
  // Remove a role from the registry. Does NOT modify tasks — names
  // still live on the tasks as free text. Callers can warn the user
  // if the role was still in use.
  deleteRole: (id: string) => void;
  // Deliverable items: add / update / delete. Delete cascades to
  // every task's deliverableTargets so no task points at a missing
  // item.
  addDeliverableItem: (name: string, description?: string) => string | null;
  updateDeliverableItem: (
    id: string,
    patch: Partial<{ name: string; description: string }>,
  ) => void;
  deleteDeliverableItem: (id: string) => void;
  // Deliverable states (ordered string list).
  addDeliverableState: (name: string) => boolean;
  renameDeliverableState: (oldName: string, newName: string) => boolean;
  removeDeliverableState: (name: string) => void;
  moveDeliverableState: (name: string, direction: 'up' | 'down') => void;
  togglePrerequisite: (taskId: string, prereqId: string) => void;
  deleteTask: (id: string) => void;
  insertTaskOnEdge: (
    sourceId: string,
    targetId: string,
    phaseId: string,
  ) => string | null;
}

export const useAppStore = create<AppState>((set, get) => {
  /**
   * Wrap a mutation that produces a new file. Pushes the current file
   * onto the past history, clears the future (redo stack), applies the
   * new file, and marks dirty. Used by every mutating action so undo
   * just means "restore the most recent past snapshot".
   */
  const commit = (nextFile: ProcessFile): void => {
    const current = get().file;
    if (!current) {
      set({ file: nextFile, dirty: true });
      return;
    }
    const nextPast = [...get().past, current];
    // Cap the history so long editing sessions don't retain unbounded
    // snapshots. Drop the oldest entries when over the limit.
    if (nextPast.length > MAX_HISTORY) {
      nextPast.splice(0, nextPast.length - MAX_HISTORY);
    }
    set({
      file: nextFile,
      past: nextPast,
      future: [],
      dirty: true,
    });
  };

  return {
    file: null,
    fileName: null,
    fileHandle: null,
    mode: 'review',
    selectedTaskId: null,
    dirty: false,
    past: [],
    future: [],

    newEmptyFile: () =>
      set({
        file: makeEmptyProcessFile(),
        fileName: null,
        fileHandle: null,
        selectedTaskId: null,
        dirty: false,
        mode: 'review',
        past: [],
        future: [],
      }),

    loadFile: (file, fileName, handle) =>
      set({
        file,
        fileName,
        fileHandle: handle ?? null,
        selectedTaskId: null,
        dirty: false,
        mode: 'review',
        past: [],
        future: [],
      }),

    setFileHandle: (handle) => set({ fileHandle: handle }),
    selectTask: (id) => set({ selectedTaskId: id }),
    setMode: (mode) => set({ mode }),
    markDirty: () => set({ dirty: true }),
    markClean: () => set({ dirty: false }),

    // ---- Undo / redo ----

    undo: () => {
      const { past, file, future } = get();
      if (past.length === 0 || !file) return;
      const previous = past[past.length - 1];
      set({
        file: previous,
        past: past.slice(0, -1),
        future: [...future, file],
        dirty: true,
      });
    },

    redo: () => {
      const { past, file, future } = get();
      if (future.length === 0 || !file) return;
      const next = future[future.length - 1];
      set({
        file: next,
        past: [...past, file],
        future: future.slice(0, -1),
        dirty: true,
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    // ---- Edit mutations ----

    updateFile: (updater) => {
      const current = get().file;
      if (!current) return null;
      const next = updater(current);
      commit(next);
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
      commit({ ...current, phases: [...current.phases, newPhase] });
      return newPhase.id;
    },

    updatePhase: (id, patch) => {
      const current = get().file;
      if (!current) return;
      commit({
        ...current,
        phases: current.phases.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      });
    },

    deletePhase: (id) => {
      const current = get().file;
      if (!current) return { ok: false, error: 'No file open' };
      const phase = current.phases.find((p) => p.id === id);
      if (!phase) return { ok: false, error: 'Phase not found' };
      // Cascade: all tasks in the phase are deleted too. Any task in
      // ANOTHER phase that referenced a doomed task as a prerequisite
      // has that reference removed from its prereq list.
      const doomedTaskIds = new Set(
        getTasksInPhase(current, id).map((t) => t.id),
      );
      const updatedTasks = current.tasks
        .filter((t) => !doomedTaskIds.has(t.id))
        .map((t) => ({
          ...t,
          prerequisites: t.prerequisites.filter(
            (p) => !doomedTaskIds.has(p),
          ),
        }));
      const currentSelected = get().selectedTaskId;
      commit({
        ...current,
        phases: current.phases.filter((p) => p.id !== id),
        tasks: updatedTasks,
      });
      if (currentSelected && doomedTaskIds.has(currentSelected)) {
        set({ selectedTaskId: null });
      }
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
      const orderA = a.order;
      const orderB = b.order;
      commit({
        ...current,
        phases: current.phases.map((p) => {
          if (p.id === a.id) return { ...p, order: orderB };
          if (p.id === b.id) return { ...p, order: orderA };
          return p;
        }),
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
      commit({ ...current, tasks: [...current.tasks, newTask] });
      return newTask.id;
    },

    updateTask: (id, patch) => {
      const current = get().file;
      if (!current) return;
      commit({
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
      });
    },

    togglePrerequisite: (taskId, prereqId) => {
      const current = get().file;
      if (!current) return;
      const task = current.tasks.find((t) => t.id === taskId);
      if (!task || taskId === prereqId) return;
      const has = task.prerequisites.includes(prereqId);
      const next = has
        ? task.prerequisites.filter((p) => p !== prereqId)
        : [...task.prerequisites, prereqId];
      commit({
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === taskId ? { ...t, prerequisites: next } : t,
        ),
      });
    },

    deleteTask: (id) => {
      const current = get().file;
      if (!current) return;
      const doomed = current.tasks.find((t) => t.id === id);
      if (!doomed) return;
      const doomedPrereqs = doomed.prerequisites;
      const updatedTasks = current.tasks
        .filter((t) => t.id !== id)
        .map((t) => {
          if (!t.prerequisites.includes(id)) return t;
          const withoutDoomed = t.prerequisites.filter((p) => p !== id);
          const merged = [
            ...withoutDoomed,
            ...doomedPrereqs.filter((p) => !withoutDoomed.includes(p)),
          ];
          return { ...t, prerequisites: merged };
        });
      commit({ ...current, tasks: updatedTasks });
      if (get().selectedTaskId === id) {
        set({ selectedTaskId: null });
      }
    },

    insertTaskOnEdge: (sourceId, targetId, phaseId) => {
      const current = get().file;
      if (!current) return null;
      const phase = findPhaseById(current, phaseId);
      if (!phase) return null;
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
        prerequisites: [sourceId],
        deliverableTargets: [],
        extras: {},
      };
      const updatedTasks = current.tasks.map((t) => {
        if (t.id === targetId) {
          return {
            ...t,
            prerequisites: t.prerequisites.map((p) =>
              p === sourceId ? newTask.id : p,
            ),
          };
        }
        return t;
      });
      commit({ ...current, tasks: [...updatedTasks, newTask] });
      return newTask.id;
    },

    addRole: (name, colour = null) => {
      const current = get().file;
      if (!current) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = current.roles.find((r) => r.name === trimmed);
      if (existing) return existing.id;
      const newRole: Role = { id: makeId(), name: trimmed, colour };
      commit({ ...current, roles: [...current.roles, newRole] });
      return newRole.id;
    },

    updateRole: (id, patch) => {
      const current = get().file;
      if (!current) return false;
      const role = current.roles.find((r) => r.id === id);
      if (!role) return false;
      const nextName = patch.name === undefined ? role.name : patch.name.trim();
      if (!nextName) return false;
      // Reject collisions (unless it's the same role keeping its name).
      if (
        nextName !== role.name &&
        current.roles.some((r) => r.id !== id && r.name === nextName)
      ) {
        return false;
      }
      const nameChanged = nextName !== role.name;
      const nextRole: Role = {
        ...role,
        name: nextName,
        colour: patch.colour === undefined ? role.colour : patch.colour,
      };
      const updatedRoles = current.roles.map((r) =>
        r.id === id ? nextRole : r,
      );
      // If the name changed, propagate through every task field that
      // references role names as strings.
      const updatedTasks = nameChanged
        ? current.tasks.map((t) => ({
            ...t,
            accountable: t.accountable === role.name ? nextName : t.accountable,
            contributors: t.contributors.map((c) =>
              c === role.name ? nextName : c,
            ),
            meetingOrganiser:
              t.meetingOrganiser === role.name ? nextName : t.meetingOrganiser,
          }))
        : current.tasks;
      commit({ ...current, roles: updatedRoles, tasks: updatedTasks });
      return true;
    },

    deleteRole: (id) => {
      const current = get().file;
      if (!current) return;
      commit({
        ...current,
        roles: current.roles.filter((r) => r.id !== id),
      });
    },

    addDeliverableItem: (name, description = '') => {
      const current = get().file;
      if (!current) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const newItem = { id: makeId(), name: trimmed, description };
      commit({
        ...current,
        deliverableItems: [...current.deliverableItems, newItem],
      });
      return newItem.id;
    },

    updateDeliverableItem: (id, patch) => {
      const current = get().file;
      if (!current) return;
      commit({
        ...current,
        deliverableItems: current.deliverableItems.map((i) =>
          i.id === id
            ? {
                ...i,
                name: patch.name === undefined ? i.name : patch.name,
                description:
                  patch.description === undefined
                    ? i.description
                    : patch.description,
              }
            : i,
        ),
      });
    },

    deleteDeliverableItem: (id) => {
      const current = get().file;
      if (!current) return;
      // Cascade: strip references to the doomed item from every task's
      // deliverableTargets so no task points at a missing id.
      commit({
        ...current,
        deliverableItems: current.deliverableItems.filter((i) => i.id !== id),
        tasks: current.tasks.map((t) => ({
          ...t,
          deliverableTargets: t.deliverableTargets.filter(
            (dt) => dt.itemId !== id,
          ),
        })),
      });
    },

    addDeliverableState: (name) => {
      const current = get().file;
      if (!current) return false;
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (current.deliverableStates.includes(trimmed)) return false;
      commit({
        ...current,
        deliverableStates: [...current.deliverableStates, trimmed],
      });
      return true;
    },

    renameDeliverableState: (oldName, newName) => {
      const current = get().file;
      if (!current) return false;
      const trimmed = newName.trim();
      if (!trimmed) return false;
      if (oldName === trimmed) return true;
      if (current.deliverableStates.includes(trimmed)) return false;
      // Propagate through every task's deliverableTargets so targets
      // using the old state name now use the new one.
      commit({
        ...current,
        deliverableStates: current.deliverableStates.map((s) =>
          s === oldName ? trimmed : s,
        ),
        tasks: current.tasks.map((t) => ({
          ...t,
          deliverableTargets: t.deliverableTargets.map((dt) =>
            dt.state === oldName ? { ...dt, state: trimmed } : dt,
          ),
        })),
      });
      return true;
    },

    removeDeliverableState: (name) => {
      const current = get().file;
      if (!current) return;
      // Strip references to the doomed state from every task's
      // deliverableTargets so nothing points at a missing state.
      commit({
        ...current,
        deliverableStates: current.deliverableStates.filter((s) => s !== name),
        tasks: current.tasks.map((t) => ({
          ...t,
          deliverableTargets: t.deliverableTargets.filter(
            (dt) => dt.state !== name,
          ),
        })),
      });
    },

    moveDeliverableState: (name, direction) => {
      const current = get().file;
      if (!current) return;
      const idx = current.deliverableStates.indexOf(name);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= current.deliverableStates.length) return;
      const next = [...current.deliverableStates];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      commit({ ...current, deliverableStates: next });
    },
  };
});

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
