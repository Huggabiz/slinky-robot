import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Role, Task } from '../types';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Suggestion {
  taskId: string;
  taskInternalId: string;
  taskName: string;
  roleName: string;
  field: 'description' | 'deliverables' | 'keyDateRationale';
  fieldLabel: string;
  context: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find bare role-name occurrences in prose that are NOT already
// prefixed with `@`. Returns one suggestion per task×role×field
// (deduplicated). Matches are bounded by word-boundary rules
// consistent with the @-reference regex.
function findSuggestions(tasks: Task[], roles: Role[]): Suggestion[] {
  const sorted = [...roles]
    .map((r) => r.name)
    .filter((n) => n.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [];

  const alt = sorted.map(escapeRegExp).join('|');
  // Match the role name preceded by a non-@ non-word char (or start),
  // followed by a non-word char (or end). Only match when NOT already
  // prefixed with @.
  const pattern = new RegExp(
    `(?:^|(?<=[^A-Za-z0-9_]))(?<!@)(${alt})(?![A-Za-z0-9_])`,
    'g',
  );

  const results: Suggestion[] = [];
  const seen = new Set<string>();

  const fields: {
    key: 'description' | 'deliverables' | 'keyDateRationale';
    label: string;
  }[] = [
    { key: 'description', label: 'Description' },
    { key: 'deliverables', label: 'Deliverables' },
    { key: 'keyDateRationale', label: 'Key Date Rationale' },
  ];

  for (const task of tasks) {
    for (const { key, label } of fields) {
      const text = task[key];
      if (!text) continue;

      for (const match of text.matchAll(pattern)) {
        const name = match[1];
        const dedup = `${task.id}:${key}:${name}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);

        const idx = match.index;
        const before = text.slice(Math.max(0, idx - 25), idx);
        const after = text.slice(
          idx + name.length,
          idx + name.length + 25,
        );
        results.push({
          taskId: task.taskId,
          taskInternalId: task.id,
          taskName: task.name,
          roleName: name,
          field: key,
          fieldLabel: label,
          context: `…${before}${name}${after}…`,
        });
      }
    }
  }

  return results;
}

// Replace bare role name with @role in a single field.
function insertAtPrefix(prose: string, roleName: string): string {
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_@])(${escapeRegExp(roleName)})(?![A-Za-z0-9_])`,
    'g',
  );
  return prose.replace(pattern, '$1@$2');
}

export function BulkRoleRefPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const updateTask = useAppStore((s) => s.updateTask);
  const [dismissed, setDismissed] = useState(new Set<string>());

  const suggestions = useMemo(() => {
    if (!file) return [];
    return findSuggestions(file.tasks, file.roles);
  }, [file]);

  const visible = useMemo(
    () => suggestions.filter((s) => !dismissed.has(`${s.taskInternalId}:${s.field}:${s.roleName}`)),
    [suggestions, dismissed],
  );

  if (!isOpen || !file) return null;

  const accept = (s: Suggestion) => {
    const task = file.tasks.find((t) => t.id === s.taskInternalId);
    if (!task) return;
    const original = task[s.field];
    if (!original) return;
    const updated = insertAtPrefix(original, s.roleName);
    if (updated !== original) {
      updateTask(s.taskInternalId, { [s.field]: updated });
    }
    dismiss(s);
  };

  const dismiss = (s: Suggestion) => {
    setDismissed((prev) => new Set(prev).add(`${s.taskInternalId}:${s.field}:${s.roleName}`));
  };

  const acceptAll = () => {
    for (const s of visible) {
      const task = file.tasks.find((t) => t.id === s.taskInternalId);
      if (!task) continue;
      const original = task[s.field];
      if (!original) continue;
      const updated = insertAtPrefix(original, s.roleName);
      if (updated !== original) {
        updateTask(s.taskInternalId, { [s.field]: updated });
      }
    }
    setDismissed(new Set(suggestions.map((s) => `${s.taskInternalId}:${s.field}:${s.roleName}`)));
  };

  return (
    <div className="registry-backdrop" onClick={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Bulk @Role Suggestions"
      >
        <header className="registry-header">
          <h2>Bulk @Role Suggestions</h2>
          <button
            type="button"
            className="registry-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="registry-hint" style={{ padding: '0 16px' }}>
          Found <strong>{visible.length}</strong> bare role-name mention{visible.length !== 1 ? 's' : ''} in
          task prose that could become <code>@Role</code> references.
          Accepting adds the <code>@</code> prefix so the name is tracked,
          highlighted, and follows renames.
        </p>

        {visible.length > 0 && (
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="bulk-role-accept-all-btn"
              onClick={acceptAll}
            >
              Accept all ({visible.length})
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="registry-hint" style={{ padding: '0 16px 16px' }}>
            {suggestions.length === 0
              ? 'No bare role-name mentions found — all clear!'
              : 'All suggestions handled.'}
          </p>
        ) : (
          <div className="bulk-role-list">
            {visible.map((s) => {
              const key = `${s.taskInternalId}:${s.field}:${s.roleName}`;
              return (
                <div key={key} className="bulk-role-row">
                  <div className="bulk-role-meta">
                    <span className="bulk-role-task-id">{s.taskId}</span>
                    <span className="bulk-role-task-name">{s.taskName || '(untitled)'}</span>
                    <span className="bulk-role-field">{s.fieldLabel}</span>
                  </div>
                  <div className="bulk-role-context">
                    {s.context.replace(
                      s.roleName,
                      `→ @${s.roleName} ←`,
                    )}
                  </div>
                  <div className="bulk-role-actions">
                    <button
                      type="button"
                      className="bulk-role-btn bulk-role-btn-accept"
                      onClick={() => accept(s)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="bulk-role-btn bulk-role-btn-dismiss"
                      onClick={() => dismiss(s)}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
