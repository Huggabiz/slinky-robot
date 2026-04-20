import { useAppStore } from '../store/useAppStore';
import './EditToolbar.css';

interface Props {
  // Callback fired when the user wants to create a new milestone phase.
  onCreatePhase: () => void;
  // Callback for creating a new process step.
  onCreateTask: () => void;
}

// Second-row toolbar only visible in edit mode. Hosts "Create …"
// actions and the Undo/Redo controls. The dividers separate the
// add-item buttons from the history controls.
export function EditToolbar({ onCreatePhase, onCreateTask }: Props) {
  const file = useAppStore((s) => s.file);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  // Subscribe to the stacks directly so the buttons disable/enable
  // reactively as history grows or shrinks.
  const pastLen = useAppStore((s) => s.past.length);
  const futureLen = useAppStore((s) => s.future.length);

  if (!file) return null;

  return (
    <div className="edit-toolbar">
      <button type="button" className="edit-toolbar-btn" onClick={onCreatePhase}>
        + Milestone Phase
      </button>
      <button type="button" className="edit-toolbar-btn" onClick={onCreateTask}>
        + Process Step
      </button>
      <div className="edit-toolbar-divider" aria-hidden />
      <button
        type="button"
        className="edit-toolbar-icon-btn"
        onClick={undo}
        disabled={pastLen === 0}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        ↶
      </button>
      <button
        type="button"
        className="edit-toolbar-icon-btn"
        onClick={redo}
        disabled={futureLen === 0}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        ↷
      </button>
      {(pastLen > 0 || futureLen > 0) && (
        <span className="edit-toolbar-hint">
          {pastLen} back / {futureLen} forward
        </span>
      )}
    </div>
  );
}
