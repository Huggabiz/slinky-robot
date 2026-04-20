import { useAppStore } from '../store/useAppStore';
import { findTaskByInternalId } from '../types';
import { TaskDetailRead } from './TaskDetailRead';
import { TaskDetailEdit } from './TaskDetailEdit';
import './TaskDetail.css';

// Mode router — hands the selected task off to the read-only view in
// Navigate mode and the edit form in Edit mode. Both receive the
// resolved Task object so the inner components don't each need to
// duplicate the selection lookup.
export function TaskDetail() {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);

  if (!file) return null;

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
