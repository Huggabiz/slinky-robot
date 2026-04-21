import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { findTaskByInternalId, getPhasesOrdered } from '../types';
import { TaskDetailRead } from './TaskDetailRead';
import { TaskDetailEdit } from './TaskDetailEdit';
import './TaskDetail.css';

// Mode router — hands the selected task off to the read-only view in
// Navigate mode and the edit form in Edit mode. When multiple tasks are
// selected (edit mode only), shows a bulk-operations bar instead of
// the single-task editor.
export function TaskDetail() {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds);
  const bulkDeleteTasks = useAppStore((s) => s.bulkDeleteTasks);
  const bulkMoveTasksToPhase = useAppStore((s) => s.bulkMoveTasksToPhase);

  const phases = useMemo(
    () => (file ? getPhasesOrdered(file) : []),
    [file],
  );

  if (!file) return null;

  const multiCount = selectedTaskIds.size;

  // Multi-select bar: shown when more than one task is in the selection
  // set (edit mode only). The single-task editor shows for the primary
  // selection below if desired.
  if (mode === 'edit' && multiCount > 1) {
    return (
      <section className="task-detail task-detail-bulk">
        <h2 className="task-detail-bulk-title">
          {multiCount} tasks selected
        </h2>
        <p className="task-detail-bulk-hint">
          Alt+Click to toggle tasks in/out of the selection.
          Shift+Click to range-select.
        </p>
        <div className="task-detail-bulk-actions">
          <button
            type="button"
            className="task-edit-delete-btn"
            onClick={() => {
              const ok = window.confirm(
                `Delete ${multiCount} selected tasks?\n\nDependents will inherit prerequisites so the flow stays connected.`,
              );
              if (ok) bulkDeleteTasks();
            }}
          >
            Delete {multiCount} tasks
          </button>
          {phases.length > 1 && (
            <div className="task-detail-bulk-move">
              <span className="task-detail-bulk-label">Move to phase:</span>
              {phases.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="task-detail-bulk-phase-btn"
                  onClick={() => {
                    const ok = window.confirm(
                      `Move ${multiCount} tasks to "${p.name}"?`,
                    );
                    if (ok) bulkMoveTasksToPhase(p.id);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const task = selectedTaskId
    ? (findTaskByInternalId(file, selectedTaskId) ?? null)
    : null;

  if (!task) {
    return (
      <section className="task-detail task-detail-empty">
        <p>Pick a task from the flow to see its details.</p>
      </section>
    );
  }

  return mode === 'edit' ? (
    <TaskDetailEdit task={task} />
  ) : (
    <TaskDetailRead task={task} />
  );
}
