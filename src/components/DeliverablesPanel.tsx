import { useMemo, useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { DeliverableItem } from '../types';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function DeliverablesPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const addDeliverableItem = useAppStore((s) => s.addDeliverableItem);
  const updateDeliverableItem = useAppStore((s) => s.updateDeliverableItem);
  const deleteDeliverableItem = useAppStore((s) => s.deleteDeliverableItem);
  const addItemState = useAppStore((s) => s.addItemState);
  const renameItemState = useAppStore((s) => s.renameItemState);
  const removeItemState = useAppStore((s) => s.removeItemState);
  const moveItemState = useAppStore((s) => s.moveItemState);
  const addDeliverableGroup = useAppStore((s) => s.addDeliverableGroup);
  const renameDeliverableGroup = useAppStore((s) => s.renameDeliverableGroup);
  const deleteDeliverableGroup = useAppStore((s) => s.deleteDeliverableGroup);
  const moveDeliverableGroup = useAppStore((s) => s.moveDeliverableGroup);
  const moveDeliverableItem = useAppStore((s) => s.moveDeliverableItem);

  const [newItemName, setNewItemName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Drag state.
  const dragItemId = useRef<string | null>(null);

  const groups = useMemo(
    () =>
      [...(file?.deliverableGroups ?? [])].sort(
        (a, b) => a.order - b.order,
      ),
    [file?.deliverableGroups],
  );

  const itemsByGroup = useMemo(() => {
    if (!file) return new Map<string | null, DeliverableItem[]>();
    const map = new Map<string | null, DeliverableItem[]>();
    const sorted = [...file.deliverableItems].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    for (const item of sorted) {
      const gid = item.groupId ?? null;
      let list = map.get(gid);
      if (!list) { list = []; map.set(gid, list); }
      list.push(item);
    }
    return map;
  }, [file]);

  if (!isOpen || !file) return null;

  const tasksUsingItem = (itemId: string): number =>
    file.tasks.reduce(
      (acc, t) =>
        t.deliverableTargets.some((dt) => dt.itemId === itemId) ? acc + 1 : acc,
      0,
    );

  const handleAddItem = () => {
    const id = addDeliverableItem(newItemName);
    if (id) { setNewItemName(''); setExpandedId(id); }
  };

  const handleDeleteItem = (id: string, name: string) => {
    const count = tasksUsingItem(id);
    const msg = count > 0
      ? `Delete "${name}"?\n\n${count} task${count === 1 ? '' : 's'} reference it.`
      : `Delete "${name}"?`;
    if (!window.confirm(msg)) return;
    deleteDeliverableItem(id);
    if (expandedId === id) setExpandedId(null);
  };

  const handleAddGroup = () => {
    const id = addDeliverableGroup(newGroupName);
    if (id) setNewGroupName('');
  };

  const onDragStart = (itemId: string) => { dragItemId.current = itemId; };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDropOnItem = (targetItemId: string, groupId: string | null) => {
    const srcId = dragItemId.current;
    if (!srcId || srcId === targetItemId) return;
    const inGroup = (itemsByGroup.get(groupId) ?? []);
    const targetIdx = inGroup.findIndex((i) => i.id === targetItemId);
    moveDeliverableItem(srcId, groupId, targetIdx);
    dragItemId.current = null;
  };
  const onDropOnGroup = (groupId: string | null) => {
    const srcId = dragItemId.current;
    if (!srcId) return;
    const inGroup = itemsByGroup.get(groupId) ?? [];
    moveDeliverableItem(srcId, groupId, inGroup.length);
    dragItemId.current = null;
  };

  const renderItemList = (items: DeliverableItem[], groupId: string | null) => (
    <div
      className="registry-item-list"
      onDragOver={onDragOver}
      onDrop={() => onDropOnGroup(groupId)}
    >
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        return (
          <div
            key={item.id}
            className={`deliv-item${isExpanded ? ' deliv-item-expanded' : ''}`}
            draggable
            onDragStart={() => onDragStart(item.id)}
            onDragOver={onDragOver}
            onDrop={(e) => { e.stopPropagation(); onDropOnItem(item.id, groupId); }}
          >
            <div
              className="deliv-item-row"
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <span className="deliv-item-drag" title="Drag to reorder">⠿</span>
              <span className="deliv-item-chevron">{isExpanded ? '▾' : '▸'}</span>
              <span className="deliv-item-name">{item.name}</span>
              <span className="registry-count">{tasksUsingItem(item.id)}</span>
              <span className="deliv-item-states-badge">
                {item.states.length} state{item.states.length !== 1 ? 's' : ''}
              </span>
            </div>
            {isExpanded && (
              <ItemDetail
                item={item}
                onUpdate={updateDeliverableItem}
                onDelete={() => handleDeleteItem(item.id, item.name)}
                onAddState={(name) => addItemState(item.id, name)}
                onRenameState={(old, next) => renameItemState(item.id, old, next)}
                onRemoveState={(name) => removeItemState(item.id, name)}
                onMoveState={(name, dir) => moveItemState(item.id, name, dir)}
              />
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="registry-empty" style={{ padding: '4px 8px', fontSize: 11 }}>
          Drop items here
        </p>
      )}
    </div>
  );

  const ungrouped = itemsByGroup.get(null) ?? [];

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
          <button type="button" className="registry-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div style={{ padding: 'var(--space-md) var(--space-lg)', overflow: 'auto', flex: 1 }}>
          <p className="registry-hint">
            Drag items to reorder or move between groups. Click to expand.
          </p>

          <div className="registry-add-row">
            <input
              type="text"
              className="registry-input"
              placeholder="New item name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
            />
            <button type="button" className="registry-add-btn" onClick={handleAddItem} disabled={!newItemName.trim()}>
              + Item
            </button>
            <input
              type="text"
              className="registry-input"
              placeholder="New group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddGroup(); } }}
              style={{ maxWidth: 160 }}
            />
            <button type="button" className="registry-add-btn" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
              + Group
            </button>
          </div>

          {groups.map((group, gIdx) => {
            const items = itemsByGroup.get(group.id) ?? [];
            return (
              <div key={group.id} className="deliv-group">
                <div className="deliv-group-header">
                  <input
                    type="text"
                    className="deliv-group-name-input"
                    defaultValue={group.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== group.name) renameDeliverableGroup(group.id, v);
                      else if (!v) e.target.value = group.name;
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                  <span className="registry-count">{items.length}</span>
                  <button type="button" className="registry-ctrl" title="Move up" disabled={gIdx === 0} onClick={() => moveDeliverableGroup(group.id, 'up')}>↑</button>
                  <button type="button" className="registry-ctrl" title="Move down" disabled={gIdx === groups.length - 1} onClick={() => moveDeliverableGroup(group.id, 'down')}>↓</button>
                  <button
                    type="button"
                    className="registry-ctrl registry-ctrl-danger"
                    title="Delete group"
                    onClick={() => {
                      if (window.confirm(`Delete group "${group.name}"? Items will move to Ungrouped.`))
                        deleteDeliverableGroup(group.id);
                    }}
                  >×</button>
                </div>
                {renderItemList(items, group.id)}
              </div>
            );
          })}

          {/* Ungrouped items */}
          {(ungrouped.length > 0 || groups.length > 0) && (
            <div className="deliv-group">
              <div className="deliv-group-header">
                <span className="deliv-group-name-label">Ungrouped</span>
                <span className="registry-count">{ungrouped.length}</span>
              </div>
              {renderItemList(ungrouped, null)}
            </div>
          )}

          {file.deliverableItems.length === 0 && groups.length === 0 && (
            <p className="registry-empty">No deliverable items yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemDetail({
  item,
  onUpdate,
  onDelete,
  onAddState,
  onRenameState,
  onRemoveState,
  onMoveState,
}: {
  item: { id: string; name: string; description: string; states: string[] };
  onUpdate: (id: string, patch: Partial<{ name: string; description: string }>) => void;
  onDelete: () => void;
  onAddState: (name: string) => boolean;
  onRenameState: (old: string, next: string) => boolean;
  onRemoveState: (name: string) => void;
  onMoveState: (name: string, dir: 'up' | 'down') => void;
}) {
  const [newState, setNewState] = useState('');

  return (
    <div className="deliv-detail">
      <div className="deliv-detail-field">
        <label className="deliv-detail-label">Name</label>
        <input
          type="text"
          className="registry-input"
          defaultValue={item.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== item.name) onUpdate(item.id, { name: next });
            else if (!next) e.target.value = item.name;
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </div>

      <div className="deliv-detail-field">
        <label className="deliv-detail-label">Description</label>
        <textarea
          className="registry-textarea"
          defaultValue={item.description}
          rows={3}
          placeholder="What this document is for…"
          onBlur={(e) => {
            if (e.target.value !== item.description)
              onUpdate(item.id, { description: e.target.value });
          }}
        />
      </div>

      <div className="deliv-detail-field">
        <label className="deliv-detail-label">Resolution states ({item.states.length})</label>
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
                  if (!ok) { window.alert(`"${next}" already exists.`); e.target.value = state; }
                } else if (!next) e.target.value = state;
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <button type="button" className="registry-ctrl" title="Move up" disabled={idx === 0} onClick={() => onMoveState(state, 'up')}>↑</button>
            <button type="button" className="registry-ctrl" title="Move down" disabled={idx === item.states.length - 1} onClick={() => onMoveState(state, 'down')}>↓</button>
            <button type="button" className="registry-delete-btn" onClick={() => onRemoveState(state)} aria-label={`Remove ${state}`}>×</button>
          </div>
        ))}
        <div className="registry-add-row" style={{ marginTop: 4 }}>
          <input
            type="text"
            className="registry-input"
            placeholder="New state"
            value={newState}
            onChange={(e) => setNewState(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (onAddState(newState)) setNewState(''); } }}
          />
          <button
            type="button"
            className="registry-add-btn"
            onClick={() => { if (onAddState(newState)) setNewState(''); }}
            disabled={!newState.trim()}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >+</button>
        </div>
      </div>

      <button type="button" className="deliv-detail-delete" onClick={onDelete}>
        Delete this item
      </button>
    </div>
  );
}
