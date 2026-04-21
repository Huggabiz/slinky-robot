import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Modal pop-out for managing deliverable items (the fixed list of
// tracked document types) and the ordered list of deliverable states
// (Draft / In Review / Approved / Final). Both cascade updates
// through every task's deliverableTargets when names change or
// entries are removed.
export function DeliverablesPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const addDeliverableItem = useAppStore((s) => s.addDeliverableItem);
  const updateDeliverableItem = useAppStore((s) => s.updateDeliverableItem);
  const deleteDeliverableItem = useAppStore((s) => s.deleteDeliverableItem);
  const addDeliverableState = useAppStore((s) => s.addDeliverableState);
  const renameDeliverableState = useAppStore(
    (s) => s.renameDeliverableState,
  );
  const removeDeliverableState = useAppStore(
    (s) => s.removeDeliverableState,
  );
  const moveDeliverableState = useAppStore((s) => s.moveDeliverableState);

  const [newItemName, setNewItemName] = useState('');
  const [newStateName, setNewStateName] = useState('');

  if (!isOpen || !file) return null;

  const tasksUsingItem = (itemId: string): number =>
    file.tasks.reduce(
      (acc, t) =>
        t.deliverableTargets.some((dt) => dt.itemId === itemId)
          ? acc + 1
          : acc,
      0,
    );

  const tasksUsingState = (state: string): number =>
    file.tasks.reduce(
      (acc, t) =>
        t.deliverableTargets.some((dt) => dt.state === state) ? acc + 1 : acc,
      0,
    );

  const handleAddItem = () => {
    const id = addDeliverableItem(newItemName);
    if (id) setNewItemName('');
  };

  const handleDeleteItem = (id: string, name: string) => {
    const count = tasksUsingItem(id);
    const msg =
      count > 0
        ? `Delete "${name}"?\n\nIt's tracked by ${count} task${count === 1 ? '' : 's'} — those entries will be removed too.`
        : `Delete "${name}"?`;
    if (!window.confirm(msg)) return;
    deleteDeliverableItem(id);
  };

  const handleAddState = () => {
    if (addDeliverableState(newStateName)) setNewStateName('');
  };

  const handleRemoveState = (name: string) => {
    const count = tasksUsingState(name);
    const msg =
      count > 0
        ? `Remove state "${name}"?\n\n${count} task target${count === 1 ? '' : 's'} use${count === 1 ? 's' : ''} this state — those entries will be removed too.`
        : `Remove state "${name}"?`;
    if (!window.confirm(msg)) return;
    removeDeliverableState(name);
  };

  return (
    <div className="registry-backdrop" onClick={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Manage deliverable items"
      >
        <header className="registry-header">
          <h2>Deliverable items &amp; states</h2>
          <button
            type="button"
            className="registry-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="registry-split">
          <section className="registry-section">
            <h3>Items</h3>
            <p className="registry-hint">
              The fixed list of document types your process tracks (FMEA,
              QAF, Vision Spec, Business Case, etc.). Each task can
              declare which items it advances and to what state.
            </p>

            <div className="registry-add-row">
              <input
                type="text"
                className="registry-input"
                placeholder="New item name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <button
                type="button"
                className="registry-add-btn"
                onClick={handleAddItem}
                disabled={!newItemName.trim()}
              >
                + Add item
              </button>
            </div>

            {file.deliverableItems.length === 0 ? (
              <p className="registry-empty">
                No deliverable items yet.
              </p>
            ) : (
              <div className="registry-item-list">
                {file.deliverableItems.map((item) => (
                  <div key={item.id} className="registry-item-card">
                    <div className="registry-item-head">
                      <input
                        type="text"
                        className="registry-input"
                        defaultValue={item.name}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next && next !== item.name) {
                            updateDeliverableItem(item.id, { name: next });
                          } else if (!next) {
                            e.target.value = item.name;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                      <span className="registry-count">
                        {tasksUsingItem(item.id)}
                      </span>
                      <button
                        type="button"
                        className="registry-delete-btn"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        aria-label={`Delete ${item.name}`}
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      className="registry-textarea"
                      defaultValue={item.description}
                      rows={2}
                      placeholder="Description (optional)"
                      onBlur={(e) => {
                        if (e.target.value !== item.description) {
                          updateDeliverableItem(item.id, {
                            description: e.target.value,
                          });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="registry-section">
            <h3>States</h3>
            <p className="registry-hint">
              The ordered list of states each item can reach. Later
              states represent more progress (e.g. Final comes after
              Draft). Renaming propagates through every task target;
              removing a state clears target entries that used it.
            </p>

            <div className="registry-add-row">
              <input
                type="text"
                className="registry-input"
                placeholder="New state name"
                value={newStateName}
                onChange={(e) => setNewStateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddState();
                  }
                }}
              />
              <button
                type="button"
                className="registry-add-btn"
                onClick={handleAddState}
                disabled={!newStateName.trim()}
              >
                + Add state
              </button>
            </div>

            {file.deliverableStates.length === 0 ? (
              <p className="registry-empty">No states defined.</p>
            ) : (
              <div className="registry-state-list">
                {file.deliverableStates.map((state, idx) => (
                  <div key={state} className="registry-state-row">
                    <span className="registry-state-order">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      className="registry-input"
                      defaultValue={state}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== state) {
                          const ok = renameDeliverableState(state, next);
                          if (!ok) {
                            window.alert(
                              `Couldn't rename — "${next}" already exists.`,
                            );
                            e.target.value = state;
                          }
                        } else if (!next) {
                          e.target.value = state;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                    />
                    <span className="registry-count">
                      {tasksUsingState(state)}
                    </span>
                    <button
                      type="button"
                      className="registry-ctrl"
                      title="Move up"
                      disabled={idx === 0}
                      onClick={() =>
                        moveDeliverableState(state, 'up')
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="registry-ctrl"
                      title="Move down"
                      disabled={idx === file.deliverableStates.length - 1}
                      onClick={() =>
                        moveDeliverableState(state, 'down')
                      }
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="registry-delete-btn"
                      onClick={() => handleRemoveState(state)}
                      aria-label={`Remove ${state}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
