import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Task } from '../types';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Suggestion {
  taskInternalId: string;
  taskId: string;
  taskName: string;
  refTaskId: string;
  field: 'description' | 'deliverables' | 'keyDateRationale';
  fieldLabel: string;
  context: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find bare task-ID occurrences in prose that are NOT already prefixed
// with `#`. Only matches ids that correspond to actual tasks.
function findSuggestions(
  tasks: Task[],
  validIds: Set<string>,
): Suggestion[] {
  const sorted = [...validIds]
    .filter((id) => id.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [];

  const alt = sorted.map(escapeRegExp).join('|');
  // Match a task id preceded by a non-# non-word char (or start),
  // followed by a non-word char (or end). Skip if already #-prefixed.
  const pattern = new RegExp(
    `(?:^|(?<=[^A-Za-z0-9_.#]))(${alt})(?![A-Za-z0-9_.])`,
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
        const refId = match[1];
        // Don't suggest a task referencing its own id.
        if (refId === task.taskId) continue;
        const dedup = `${task.id}:${key}:${refId}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);

        const idx = match.index;
        const before = text.slice(Math.max(0, idx - 25), idx);
        const after = text.slice(idx + refId.length, idx + refId.length + 25);
        results.push({
          taskInternalId: task.id,
          taskId: task.taskId,
          taskName: task.name,
          refTaskId: refId,
          field: key,
          fieldLabel: label,
          context: `…${before}${refId}${after}…`,
        });
      }
    }
  }

  return results;
}

function insertHashPrefix(prose: string, taskId: string): string {
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_.#])(${escapeRegExp(taskId)})(?![A-Za-z0-9_.])`,
    'g',
  );
  return prose.replace(pattern, '$1#$2');
}

export function BulkTaskRefPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const updateTask = useAppStore((s) => s.updateTask);
  const [dismissed, setDismissed] = useState(new Set<string>());

  const validIds = useMemo(() => {
    if (!file) return new Set<string>();
    return new Set(
      file.tasks.map((t) => t.taskId).filter((id) => id.trim() !== ''),
    );
  }, [file]);

  const suggestions = useMemo(() => {
    if (!file) return [];
    return findSuggestions(file.tasks, validIds);
  }, [file, validIds]);

  const visible = useMemo(
    () =>
      suggestions.filter(
        (s) => !dismissed.has(`${s.taskInternalId}:${s.field}:${s.refTaskId}`),
      ),
    [suggestions, dismissed],
  );

  if (!isOpen || !file) return null;

  const accept = (s: Suggestion) => {
    const task = file.tasks.find((t) => t.id === s.taskInternalId);
    if (!task) return;
    const original = task[s.field];
    if (!original) return;
    const updated = insertHashPrefix(original, s.refTaskId);
    if (updated !== original) {
      updateTask(s.taskInternalId, { [s.field]: updated });
    }
    dismiss(s);
  };

  const dismiss = (s: Suggestion) => {
    setDismissed((prev) =>
      new Set(prev).add(`${s.taskInternalId}:${s.field}:${s.refTaskId}`),
    );
  };

  const acceptAll = () => {
    const grouped = new Map<
      string,
      {
        taskInternalId: string;
        field: 'description' | 'deliverables' | 'keyDateRationale';
        ids: string[];
      }
    >();
    for (const s of visible) {
      const key = `${s.taskInternalId}:${s.field}`;
      let entry = grouped.get(key);
      if (!entry) {
        entry = { taskInternalId: s.taskInternalId, field: s.field, ids: [] };
        grouped.set(key, entry);
      }
      entry.ids.push(s.refTaskId);
    }

    for (const { taskInternalId, field, ids } of grouped.values()) {
      const task = file.tasks.find((t) => t.id === taskInternalId);
      if (!task) continue;
      const original = task[field];
      if (!original) continue;
      let updated = original;
      for (const refId of ids) {
        updated = insertHashPrefix(updated, refId);
      }
      if (updated !== original) {
        updateTask(taskInternalId, { [field]: updated });
      }
    }
    setDismissed(
      new Set(
        suggestions.map(
          (s) => `${s.taskInternalId}:${s.field}:${s.refTaskId}`,
        ),
      ),
    );
  };

  return (
    <div className="registry-backdrop" onMouseDown={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Bulk #TaskID Suggestions"
      >
        <header className="registry-header">
          <h2>Bulk #TaskID Suggestions</h2>
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
          Found <strong>{visible.length}</strong> bare task-ID mention{visible.length !== 1 ? 's' : ''} in
          prose that could become <code>#TaskID</code> references.
          Accepting adds the <code>#</code> prefix so the reference is
          tracked, clickable, and follows renames.
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
              ? 'No bare task-ID mentions found — all clear!'
              : 'All suggestions handled.'}
          </p>
        ) : (
          <div className="bulk-role-list">
            {visible.map((s) => {
              const key = `${s.taskInternalId}:${s.field}:${s.refTaskId}`;
              return (
                <div key={key} className="bulk-role-row">
                  <div className="bulk-role-meta">
                    <span className="bulk-role-task-id">{s.taskId}</span>
                    <span className="bulk-role-task-name">
                      {s.taskName || '(untitled)'}
                    </span>
                    <span className="bulk-role-field">{s.fieldLabel}</span>
                  </div>
                  <div className="bulk-role-context">
                    {s.context.replace(
                      s.refTaskId,
                      `→ #${s.refTaskId} ←`,
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
