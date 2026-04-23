import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import './BookPerspectivesSidebar.css';

interface Props {
  selectedDeptIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

// Multi-select department filter for the book view. Checked
// departments mean "include tasks where any role involved with the
// task — as accountable, contributor, meeting organiser, or
// @-referenced in prose — belongs to this department." With nothing
// checked, no filter is applied and the full book renders.
//
// Sits in the left sidebar of the book view only; the flow view
// uses a different (single-select) PerspectivesPanel.
export function BookPerspectivesSidebar({
  selectedDeptIds,
  onChange,
}: Props) {
  const file = useAppStore((s) => s.file);

  const departments = useMemo(
    () =>
      [...(file?.departments ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [file],
  );

  if (!file) return null;

  const toggle = (deptId: string) => {
    const next = new Set(selectedDeptIds);
    if (next.has(deptId)) next.delete(deptId);
    else next.add(deptId);
    onChange(next);
  };

  const selectAll = () => {
    onChange(new Set(departments.map((d) => d.id)));
  };

  const clearAll = () => {
    onChange(new Set());
  };

  const hasAny = selectedDeptIds.size > 0;

  return (
    <aside className="book-perspectives-sidebar">
      <div className="book-perspectives-header">
        <h3>Filter by department</h3>
        <p className="book-perspectives-hint">
          Show only tasks involving the checked departments. Intro
          chapters and flow diagrams stay visible for context.
        </p>
      </div>

      <div className="book-perspectives-actions">
        <button
          type="button"
          className="book-perspectives-action"
          onClick={selectAll}
          disabled={selectedDeptIds.size === departments.length}
        >
          Select all
        </button>
        <button
          type="button"
          className="book-perspectives-action"
          onClick={clearAll}
          disabled={!hasAny}
        >
          Clear
        </button>
      </div>

      {departments.length === 0 ? (
        <p className="book-perspectives-empty">No departments defined.</p>
      ) : (
        <ul className="book-perspectives-list">
          {departments.map((dept) => {
            const checked = selectedDeptIds.has(dept.id);
            return (
              <li key={dept.id}>
                <label className="book-perspectives-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(dept.id)}
                  />
                  {dept.colour && (
                    <span
                      className="book-perspectives-swatch"
                      style={{ backgroundColor: dept.colour }}
                      aria-hidden
                    />
                  )}
                  <span className="book-perspectives-dept-name">
                    {dept.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {hasAny && (
        <p className="book-perspectives-status">
          <strong>{selectedDeptIds.size}</strong> department
          {selectedDeptIds.size === 1 ? '' : 's'} selected
        </p>
      )}
    </aside>
  );
}
