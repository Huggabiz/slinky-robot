import { useAppStore } from '../store/useAppStore';
import {
  getPhasesOrdered,
  getTasksInPhase,
  type Phase,
} from '../types';
import './PhaseSidebar.css';

interface Props {
  selectedPhaseId: string | null;
  onSelect: (id: string) => void;
  // Callback fired when the "+ Phase" button is clicked at the bottom
  // of the sidebar. App creates the phase and selects it so the user
  // immediately sees the editable info bar.
  onCreatePhase?: () => void;
}

// Left-hand nav listing phases (milestones) as vertical rows. Click to
// drive which phase the flowchart renders. In Edit mode each row grows
// up/down reorder and delete controls, and a "+" button at the bottom
// creates a new phase.
export function PhaseSidebar({
  selectedPhaseId,
  onSelect,
  onCreatePhase,
}: Props) {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const movePhase = useAppStore((s) => s.movePhase);
  const deletePhase = useAppStore((s) => s.deletePhase);

  if (!file) return null;

  const phases = getPhasesOrdered(file);
  const editing = mode === 'edit';

  const handleDelete = (id: string) => {
    const result = deletePhase(id);
    if (!result.ok && result.error) {
      window.alert(result.error);
    }
  };

  return (
    <aside className="phase-sidebar">
      <div className="phase-sidebar-label">Milestones</div>
      {phases.length === 0 ? (
        <div className="phase-sidebar-empty">
          No phases yet. {editing ? 'Click + below to add one.' : 'Import a CSV, or open an existing JSON file.'}
        </div>
      ) : (
        phases.map((phase, idx) => {
          const count = getTasksInPhase(file, phase.id).length;
          const active = phase.id === selectedPhaseId;
          return (
            <div
              key={phase.id}
              className={
                active
                  ? 'phase-sidebar-row phase-sidebar-row-active'
                  : 'phase-sidebar-row'
              }
            >
              <button
                type="button"
                className="phase-sidebar-item"
                onClick={() => onSelect(phase.id)}
              >
                <PhaseSwatch phase={phase} />
                <span className="phase-sidebar-name">{phase.name}</span>
                <span className="phase-sidebar-count">{count}</span>
              </button>
              {editing && (
                <div className="phase-sidebar-controls">
                  <button
                    type="button"
                    className="phase-sidebar-ctrl"
                    title="Move up"
                    disabled={idx === 0}
                    onClick={() => movePhase(phase.id, 'up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="phase-sidebar-ctrl"
                    title="Move down"
                    disabled={idx === phases.length - 1}
                    onClick={() => movePhase(phase.id, 'down')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="phase-sidebar-ctrl phase-sidebar-ctrl-danger"
                    title={
                      count > 0
                        ? `Phase has ${count} task${count === 1 ? '' : 's'} — can't delete`
                        : 'Delete phase'
                    }
                    disabled={count > 0}
                    onClick={() => handleDelete(phase.id)}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
      {editing && onCreatePhase && (
        <button
          type="button"
          className="phase-sidebar-add"
          onClick={onCreatePhase}
        >
          + New Phase
        </button>
      )}
    </aside>
  );
}

function PhaseSwatch({ phase }: { phase: Phase }) {
  return (
    <span
      className="phase-sidebar-swatch"
      style={
        phase.colour
          ? { backgroundColor: phase.colour, borderColor: phase.colour }
          : undefined
      }
      aria-hidden
    />
  );
}
