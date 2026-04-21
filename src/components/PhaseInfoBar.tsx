import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { findPhaseById } from '../types';
import { Markdown } from './Markdown';
import './PhaseInfoBar.css';

interface Props {
  phaseId: string | null;
}

// Collapsible phase header that sits at the top of the right pane
// whenever a phase is active. Read-only in Navigate mode; editable
// (colour picker + name + intro textarea) in Edit mode. Remains
// visible and selectable even when a task is selected, so the phase
// context isn't lost on task navigation.
export function PhaseInfoBar({ phaseId }: Props) {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const updatePhase = useAppStore((s) => s.updatePhase);
  const [expanded, setExpanded] = useState(false);

  if (!file || !phaseId) return null;
  const phase = findPhaseById(file, phaseId);
  if (!phase) return null;

  const editing = mode === 'edit';

  return (
    <section
      className={`phase-info-bar${expanded ? ' phase-info-bar-expanded' : ''}`}
      aria-label="Phase info"
    >
      <header
        className="phase-info-bar-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <span
          className="phase-info-bar-swatch"
          style={
            phase.colour
              ? { backgroundColor: phase.colour, borderColor: phase.colour }
              : undefined
          }
          aria-hidden
        />
        <span className="phase-info-bar-name">{phase.name}</span>
        <span className="phase-info-bar-chevron" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </header>

      {expanded && (
        <div className="phase-info-bar-body">
          {editing ? (
            <div className="phase-info-bar-fields">
              <label className="phase-info-bar-field">
                <span className="phase-info-bar-label">Name</span>
                <input
                  type="text"
                  value={phase.name}
                  onChange={(e) =>
                    updatePhase(phase.id, { name: e.target.value })
                  }
                />
              </label>
              <label className="phase-info-bar-field">
                <span className="phase-info-bar-label">Colour</span>
                <div className="phase-info-bar-colour-row">
                  <input
                    type="color"
                    value={phase.colour ?? '#4f46e5'}
                    onChange={(e) =>
                      updatePhase(phase.id, { colour: e.target.value })
                    }
                  />
                  {phase.colour && (
                    <button
                      type="button"
                      className="phase-info-bar-clear"
                      onClick={() => updatePhase(phase.id, { colour: null })}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </label>
              <label className="phase-info-bar-field">
                <span className="phase-info-bar-label">Intro</span>
                <textarea
                  value={phase.intro}
                  onChange={(e) =>
                    updatePhase(phase.id, { intro: e.target.value })
                  }
                  rows={6}
                  placeholder="Phase introduction / description…"
                />
              </label>
            </div>
          ) : (
            <div className="phase-info-bar-read">
              {phase.intro ? (
                <Markdown text={phase.intro} className="phase-info-bar-intro" />
              ) : (
                <p className="phase-info-bar-empty">
                  No intro written for this phase yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
