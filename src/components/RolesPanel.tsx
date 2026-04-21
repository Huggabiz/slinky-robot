import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Modal pop-out for managing the roles registry. Rename propagates
// through every task automatically; delete removes from the registry
// but leaves task values as-is (free text).
export function RolesPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const addRole = useAppStore((s) => s.addRole);
  const updateRole = useAppStore((s) => s.updateRole);
  const deleteRole = useAppStore((s) => s.deleteRole);
  const [newName, setNewName] = useState('');

  if (!isOpen || !file) return null;

  const tasksUsingRole = (name: string): number =>
    file.tasks.reduce((acc, t) => {
      if (t.accountable === name) acc++;
      if (t.contributors.includes(name)) acc++;
      if (t.meetingOrganiser === name) acc++;
      return acc;
    }, 0);

  const handleAdd = () => {
    const id = addRole(newName);
    if (id) setNewName('');
  };

  const handleDelete = (id: string, name: string) => {
    const count = tasksUsingRole(name);
    const msg =
      count > 0
        ? `Delete role "${name}"?\n\nIt's still referenced by ${count} field${count === 1 ? '' : 's'} on tasks — those will keep the name as free text. You can re-add it anytime.`
        : `Delete role "${name}"?`;
    if (!window.confirm(msg)) return;
    deleteRole(id);
  };

  return (
    <div className="registry-backdrop" onClick={onClose}>
      <div
        className="registry-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Manage roles"
      >
        <header className="registry-header">
          <h2>Roles</h2>
          <button
            type="button"
            className="registry-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <p className="registry-hint">
          Renaming a role propagates to every task. Deleting removes
          the entry from this list but keeps whatever value already
          exists on tasks as free text.
        </p>

        <div className="registry-add-row">
          <input
            type="text"
            className="registry-input"
            placeholder="New role name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            type="button"
            className="registry-add-btn"
            onClick={handleAdd}
            disabled={!newName.trim()}
          >
            + Add role
          </button>
        </div>

        {file.roles.length === 0 ? (
          <p className="registry-empty">
            No roles defined yet. Roles are auto-discovered from CSV
            imports; add more here as your process grows.
          </p>
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Colour</th>
                <th>Uses</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {file.roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <input
                      type="text"
                      className="registry-input"
                      value={role.name}
                      onBlur={(e) => {
                        const nextName = e.target.value.trim();
                        if (nextName === role.name) return;
                        const ok = updateRole(role.id, { name: nextName });
                        if (!ok) {
                          window.alert(
                            `Couldn't rename — "${nextName}" is either empty or already taken.`,
                          );
                          e.target.value = role.name;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      defaultValue={role.name}
                    />
                  </td>
                  <td>
                    <div className="registry-colour-cell">
                      <input
                        type="color"
                        className="registry-colour"
                        value={role.colour ?? '#4f46e5'}
                        onChange={(e) =>
                          updateRole(role.id, { colour: e.target.value })
                        }
                      />
                      {role.colour && (
                        <button
                          type="button"
                          className="registry-clear-btn"
                          onClick={() =>
                            updateRole(role.id, { colour: null })
                          }
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="registry-count">
                    {tasksUsingRole(role.name)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="registry-delete-btn"
                      onClick={() => handleDelete(role.id, role.name)}
                      aria-label={`Delete ${role.name}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
