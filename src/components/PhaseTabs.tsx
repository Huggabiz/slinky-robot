import { getPhasesOrdered, getTasksInPhase } from '../types';
import { useAppStore } from '../store/useAppStore';
import './PhaseTabs.css';

interface Props {
  selectedPhaseId: string | null;
  onSelect: (id: string) => void;
}

export function PhaseTabs({ selectedPhaseId, onSelect }: Props) {
  const file = useAppStore((s) => s.file);
  if (!file) return null;

  const phases = getPhasesOrdered(file);
  if (phases.length === 0) return null;

  return (
    <nav className="phase-tabs">
      {phases.map((phase) => {
        const taskCount = getTasksInPhase(file, phase.id).length;
        const active = phase.id === selectedPhaseId;
        return (
          <button
            key={phase.id}
            type="button"
            className={active ? 'phase-tab phase-tab-active' : 'phase-tab'}
            onClick={() => onSelect(phase.id)}
          >
            <span className="phase-tab-name">{phase.name}</span>
            <span className="phase-tab-count">{taskCount}</span>
          </button>
        );
      })}
    </nav>
  );
}
