import { useAppStore } from '../store/useAppStore';
import { getPhasesOrdered, getTasksInPhase } from '../types';
import './PhaseSidebar.css';

export function PhaseSidebar() {
  const file = useAppStore((s) => s.file);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);

  if (!file) return null;

  const phases = getPhasesOrdered(file);

  if (phases.length === 0) {
    return (
      <aside className="phase-sidebar">
        <div className="phase-sidebar-empty">
          No phases yet. Import a CSV, or open an existing JSON file.
        </div>
      </aside>
    );
  }

  return (
    <aside className="phase-sidebar">
      {phases.map((phase) => {
        const tasks = getTasksInPhase(file, phase.id);
        return (
          <details key={phase.id} className="phase-section" open>
            <summary className="phase-summary">
              <span className="phase-name">{phase.name}</span>
              <span className="phase-count">{tasks.length}</span>
            </summary>
            <ul className="phase-tasks">
              {tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={
                      task.id === selectedTaskId
                        ? 'phase-task phase-task-active'
                        : 'phase-task'
                    }
                    onClick={() => selectTask(task.id)}
                  >
                    <span className="phase-task-id">{task.taskId}</span>
                    <span className="phase-task-name">
                      {task.name || '(untitled)'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </aside>
  );
}
