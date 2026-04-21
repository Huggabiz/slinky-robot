import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Modal panel for managing deliverable items. Each item carries its
// own ordered list of resolution states (per-item, not global).
export function DeliverablesPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const addDeliverableItem = useAppStore((s) => s.addDeliverableItem);
  const updateDeliverableItem = useAppStore((s) => s.updateDeliverableItem);
  const deleteDeliverableItem = useAppStore((s) => s.deleteDeliverableItem);
  const addItemState = useAppStore((s) => s.addItemState);
  const renameItemState = useAppStore((s) => s.renameItemState);
  const removeItemState = useAppStore((s) => s.removeItemState);
  const moveItemState = useAppStore((s) => s.moveItemState);

  const [newItemName, setNewItemName] = useState('');

  if (!isOpen || !file) return null;

  const tasksUsingItem = (itemId: string): number =>
    file.tasks.reduce(
      (acc, t) =>
        t.deliverableTargets.some((dt) => dt.itemId === itemId)
          ? acc + 1
          : acc,
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
        ? `Delete "${name}"?\n\nTracked by ${count} task${count === 1 ? '' : 's'} — those entries will be removed too.`
        : `Delete "${name}"?`;
    if (!window.confirm(msg)) return;
    deleteDeliverableItem(id);
  };

  return (
    <div className="registry-backdrop" onClick={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Deliverable items"
      >
        <header className="registry-header">
          <h2>Deliverable items</h2>
          <button
            type="button"
            className="registry-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div
          className="registry-split"
          style={{ gridTemplateColumns: '1fr' }}
        >
          <section className="registry-section">
            <p className="registry-hint">
              Each item is a tracked document type (e.g. Vision Spec,
              Business Case, FMEA). Each carries its own ordered list of
              resolution states — define what "done" means for each
              document independently.
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
              <p className="registry-empty">No deliverable items yet.</p>
            ) : (
              <div className="registry-item-list">
                {file.deliverableItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    useCount={tasksUsingItem(item.id)}
                    onUpdateItem={updateDeliverableItem}
                    onDeleteItem={() =>
                      handleDeleteItem(item.id, item.name)
                    }
                    onAddState={(name) => addItemState(item.id, name)}
                    onRenameState={(old, next) =>
                      renameItemState(item.id, old, next)
                    }
                    onRemoveState={(name) =>
                      removeItemState(item.id, name)
                    }
                    onMoveState={(name, dir) =>
                      moveItemState(item.id, name, dir)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  useCount,
  onUpdateItem,
  onDeleteItem,
  onAddState,
  onRenameState,
  onRemoveState,
  onMoveState,
}: {
  item: { id: string; name: string; description: string; states: string[] };
  useCount: number;
  onUpdateItem: (
    id: string,
    patch: Partial<{ name: string; description: string }>,
  ) => void;
  onDeleteItem: () => void;
  onAddState: (name: string) => boolean;
  onRenameState: (old: string, next: string) => boolean;
  onRemoveState: (name: string) => void;
  onMoveState: (name: string, dir: 'up' | 'down') => void;
}) {
  const [newState, setNewState] = useState('');

  const handleAddState = () => {
    if (onAddState(newState)) setNewState('');
  };

  return (
    <div className="registry-item-card">
      <div className="registry-item-head">
        <input
          type="text"
          className="registry-input"
          defaultValue={item.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== item.name) {
              onUpdateItem(item.id, { name: next });
            } else if (!next) {
              e.target.value = item.name;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span className="registry-count">{useCount}</span>
        <button
          type="button"
          className="registry-delete-btn"
          onClick={onDeleteItem}
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
            onUpdateItem(item.id, { description: e.target.value });
          }
        }}
      />
      <div className="registry-item-states">
        <span className="registry-item-states-label">States:</span>
        {item.states.map((state, idx) => (
          <div key={state} className="registry-state-row">
            <span className="registry-state-order">{idx + 1}</span>
            <input
              type="text"
              className="registry-input"
              defaultValue={state}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== state) {
                  const ok = onRenameState(state, next);
                  if (!ok) {
                    window.alert(`"${next}" already exists.`);
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
            <button
              type="button"
              className="registry-ctrl"
              title="Move up"
              disabled={idx === 0}
              onClick={() => onMoveState(state, 'up')}
            >
              ↑
            </button>
            <button
              type="button"
              className="registry-ctrl"
              title="Move down"
              disabled={idx === item.states.length - 1}
              onClick={() => onMoveState(state, 'down')}
            >
              ↓
            </button>
            <button
              type="button"
              className="registry-delete-btn"
              onClick={() => onRemoveState(state)}
              aria-label={`Remove ${state}`}
            >
              ×
            </button>
          </div>
        ))}
        <div className="registry-add-row" style={{ marginTop: 4 }}>
          <input
            type="text"
            className="registry-input"
            placeholder="New state"
            value={newState}
            onChange={(e) => setNewState(e.target.value)}
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
            disabled={!newState.trim()}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
