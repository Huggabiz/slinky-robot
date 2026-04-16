import { useAppStore } from '../store/useAppStore';
import { getPhasesOrdered, getTasksInPhase } from '../types';
import './PhaseSidebar.css';

interface Props {
  selectedPhaseId: string | null;
  onSelect: (id: string) => void;
}

// Left-hand nav listing phases (milestones) as vertical rows. Click to
// drive which phase the flowchart renders.
export function PhaseSidebar({ selectedPhaseId, onSelect }: Props) {
  const file = useAppStore((s) => s.file);
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
      <div className="phase-sidebar-label">Milestones</div>
      {phases.map((phase) => {
        const count = getTasksInPhase(file, phase.id).length;
        const active = phase.id === selectedPhaseId;
        return (
          <button
            key={phase.id}
            type="button"
            className={
              active
                ? 'phase-sidebar-item phase-sidebar-item-active'
                : 'phase-sidebar-item'
            }
            onClick={() => onSelect(phase.id)}
          >
            <span className="phase-sidebar-name">{phase.name}</span>
            <span className="phase-sidebar-count">{count}</span>
          </button>
        );
      })}
    </aside>
  );
}
