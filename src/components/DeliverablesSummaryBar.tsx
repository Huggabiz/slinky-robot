import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { findPhaseById } from '../types';
import { getPhaseDeliverableSummary } from '../utils/deliverableSummary';
import { ALL_PHASES_ID } from './PhaseSidebar';
import './DeliverablesSummaryBar.css';

interface Props {
  phaseId: string | null;
}

// Collapsible bar pinned to the bottom of the flow column. Shows a
// summary of deliverable items and the furthest state each needs to
// reach within the active phase. Hidden when no deliverable targets
// exist for the phase, or in All Milestones mode.
export function DeliverablesSummaryBar({ phaseId }: Props) {
  const file = useAppStore((s) => s.file);
  const [open, setOpen] = useState(false);

  const phase = useMemo(
    () => (file && phaseId ? findPhaseById(file, phaseId) : null),
    [file, phaseId],
  );

  const rows = useMemo(() => {
    if (!file || !phaseId || phaseId === ALL_PHASES_ID) return [];
    return getPhaseDeliverableSummary(file, phaseId);
  }, [file, phaseId]);

  if (rows.length === 0 || !phase) return null;

  return (
    <aside className={`deliv-summary-bar${open ? ' deliv-summary-bar-open' : ''}`}>
      <button
        type="button"
        className="deliv-summary-bar-toggle"
        onClick={() => setOpen(!open)}
      >
        <span className="deliv-summary-bar-chevron" aria-hidden>
          {open ? '▾' : '▴'}
        </span>
        <span>
          Deliverables for {phase.name} ({rows.length})
        </span>
      </button>

      {open && (
        <div className="deliv-summary-bar-body">
          <table className="deliv-summary-bar-table">
            <thead>
              <tr>
                <th>Deliverable</th>
                <th>Required State</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId}>
                  <td>{r.itemName}</td>
                  <td>{r.requiredState}</td>
                  <td className="deliv-summary-bar-progress">
                    {r.stateIndex + 1} / {r.totalStates}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
}
