import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Hit {
  taskInternalId: string;
  taskId: string;
  taskName: string;
  roleName: string;
}

export function DuplicateContributorPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const updateTask = useAppStore((s) => s.updateTask);
  const [dismissed, setDismissed] = useState(new Set<string>());

  const hits = useMemo<Hit[]>(() => {
    if (!file) return [];
    const out: Hit[] = [];
    for (const t of file.tasks) {
      if (!t.accountable) continue;
      if (t.contributors.includes(t.accountable)) {
        out.push({
          taskInternalId: t.id,
          taskId: t.taskId,
          taskName: t.name,
          roleName: t.accountable,
        });
      }
    }
    return out;
  }, [file]);

  const visible = useMemo(
    () => hits.filter((h) => !dismissed.has(h.taskInternalId)),
    [hits, dismissed],
  );

  if (!isOpen || !file) return null;

  const fix = (h: Hit) => {
    const task = file.tasks.find((t) => t.id === h.taskInternalId);
    if (!task) return;
    updateTask(h.taskInternalId, {
      contributors: task.contributors.filter((c) => c !== task.accountable),
    });
    setDismissed((prev) => new Set(prev).add(h.taskInternalId));
  };

  const skip = (h: Hit) => {
    setDismissed((prev) => new Set(prev).add(h.taskInternalId));
  };

  const fixAll = () => {
    for (const h of visible) {
      const task = file.tasks.find((t) => t.id === h.taskInternalId);
      if (!task) continue;
      updateTask(h.taskInternalId, {
        contributors: task.contributors.filter((c) => c !== task.accountable),
      });
    }
    setDismissed(new Set(hits.map((h) => h.taskInternalId)));
  };

  return (
    <div className="registry-backdrop" onMouseDown={onClose}>
      <div
        className="registry-panel"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Duplicate Contributor Cleanup"
      >
        <header className="registry-header">
          <h2>Duplicate Contributor Cleanup</h2>
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
          Found <strong>{visible.length}</strong> task{visible.length !== 1 ? 's' : ''} where
          the accountable role also appears in Contributors.
          Accepting removes the duplicate contributor entry.
        </p>

        {visible.length > 0 && (
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="bulk-role-accept-all-btn"
              onClick={fixAll}
            >
              Fix all ({visible.length})
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="registry-hint" style={{ padding: '0 16px 16px' }}>
            {hits.length === 0
              ? 'No duplicates found — all clear!'
              : 'All items handled.'}
          </p>
        ) : (
          <div className="bulk-role-list">
            {visible.map((h) => (
              <div key={h.taskInternalId} className="bulk-role-row">
                <div className="bulk-role-meta">
                  <span className="bulk-role-task-id">{h.taskId}</span>
                  <span className="bulk-role-task-name">
                    {h.taskName || '(untitled)'}
                  </span>
                </div>
                <div className="bulk-role-context">
                  <strong>{h.roleName}</strong> is accountable and also listed
                  as a contributor
                </div>
                <div className="bulk-role-actions">
                  <button
                    type="button"
                    className="bulk-role-btn bulk-role-btn-accept"
                    onClick={() => fix(h)}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="bulk-role-btn bulk-role-btn-dismiss"
                    onClick={() => skip(h)}
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
