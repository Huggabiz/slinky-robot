import { useAppStore } from '../store/useAppStore';
import './EditToolbar.css';

interface Props {
  // Callback fired when the user wants to create a new milestone phase.
  // App holds the active-phase state so it does the follow-up of
  // selecting the new phase for display.
  onCreatePhase: () => void;
  // Callback for creating a new process step. Stubbed for now — the
  // task editor is the next commit.
  onCreateTask: () => void;
}

// Second-row toolbar only visible in edit mode. Currently hosts the
// "Create …" actions as named buttons; will become an icon toolbar in
// a later pass.
export function EditToolbar({ onCreatePhase, onCreateTask }: Props) {
  const file = useAppStore((s) => s.file);
  if (!file) return null;

  return (
    <div className="edit-toolbar">
      <button type="button" className="edit-toolbar-btn" onClick={onCreatePhase}>
        + Milestone Phase
      </button>
      <button type="button" className="edit-toolbar-btn" onClick={onCreateTask}>
        + Process Step
      </button>
    </div>
  );
}
