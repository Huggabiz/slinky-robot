import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { MarkdownEditor } from './MarkdownEditor';
import './RegistryPanel.css';
import './ReferencedDocsPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Library manager for "Referenced Documentation / Sub-Processes" — SOPs and
// how-to docs that tasks can cite. Mirrors the Deliverables manager but
// simpler (no states/groups). Includes an editable intro for the book-view
// index.
export function ReferencedDocsPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const addReferencedDoc = useAppStore((s) => s.addReferencedDoc);
  const updateReferencedDoc = useAppStore((s) => s.updateReferencedDoc);
  const deleteReferencedDoc = useAppStore((s) => s.deleteReferencedDoc);
  const moveReferencedDoc = useAppStore((s) => s.moveReferencedDoc);
  const updateMeta = useAppStore((s) => s.updateMeta);
  const [newName, setNewName] = useState('');

  const docs = useMemo(
    () => [...(file?.referencedDocs ?? [])].sort((a, b) => a.order - b.order),
    [file?.referencedDocs],
  );

  // doc id → number of tasks that cite it.
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of file?.tasks ?? []) {
      for (const id of t.referencedDocs ?? []) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [file]);

  if (!isOpen || !file) return null;

  const handleAdd = () => {
    const id = addReferencedDoc(newName);
    if (id) setNewName('');
  };

  return (
    <div className="registry-backdrop" onMouseDown={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Referenced Documentation"
      >
        <header className="registry-header">
          <h2>Referenced Documentation / Sub-Processes</h2>
          <button
            type="button"
            className="registry-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="refdocs-body">
          <p className="registry-hint">
            A library of SOPs and how-to documents that tasks reference.
            These are indexed as an appendix in the book view, listing which
            tasks cite each one.
          </p>

          <label className="refdocs-intro-field">
            <span className="refdocs-intro-label">Index introduction</span>
            <MarkdownEditor
              value={file.meta.referencedDocsIntro ?? ''}
              onChange={(v) => updateMeta({ referencedDocsIntro: v })}
              rows={3}
              placeholder="e.g. These documents can be found on the shared drive under…"
            />
          </label>

          <div className="registry-add-row">
            <input
              type="text"
              className="registry-input"
              placeholder="New document name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <button type="button" className="refdocs-add-btn" onClick={handleAdd}>
              + Add
            </button>
          </div>

          {docs.length === 0 ? (
            <p className="registry-empty">No referenced documents yet.</p>
          ) : (
            <ul className="refdocs-list">
              {docs.map((doc, idx) => {
                const count = usage.get(doc.id) ?? 0;
                return (
                  <li key={doc.id} className="refdocs-item">
                    <div className="refdocs-item-head">
                      <input
                        type="text"
                        className="registry-input refdocs-name"
                        value={doc.name}
                        placeholder="Document name"
                        onChange={(e) =>
                          updateReferencedDoc(doc.id, { name: e.target.value })
                        }
                      />
                      <span className="refdocs-usage">
                        {count === 0
                          ? 'Unused'
                          : `${count} task${count === 1 ? '' : 's'}`}
                      </span>
                      <div className="refdocs-item-ctrls">
                        <button
                          type="button"
                          className="refdocs-ctrl"
                          title="Move up"
                          disabled={idx === 0}
                          onClick={() => moveReferencedDoc(doc.id, 'up')}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="refdocs-ctrl"
                          title="Move down"
                          disabled={idx === docs.length - 1}
                          onClick={() => moveReferencedDoc(doc.id, 'down')}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="refdocs-ctrl refdocs-ctrl-danger"
                          title="Delete"
                          onClick={() => {
                            if (
                              count === 0 ||
                              window.confirm(
                                `Delete "${doc.name}"? It is cited by ${count} task${count === 1 ? '' : 's'}; those citations will be removed.`,
                              )
                            ) {
                              deleteReferencedDoc(doc.id);
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      className="registry-input refdocs-link"
                      value={doc.link}
                      placeholder="Location / link (optional) — e.g. SharePoint URL"
                      onChange={(e) =>
                        updateReferencedDoc(doc.id, { link: e.target.value })
                      }
                    />
                    <textarea
                      className="registry-input refdocs-desc"
                      value={doc.description}
                      placeholder="Description (supports Markdown)…"
                      rows={2}
                      onChange={(e) =>
                        updateReferencedDoc(doc.id, {
                          description: e.target.value,
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
