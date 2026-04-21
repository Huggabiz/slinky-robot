import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Modal panel for managing departments and roles. Two-level hierarchy:
// departments carry colours, roles are assigned to departments.
export function RolesPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);
  const addDepartment = useAppStore((s) => s.addDepartment);
  const updateDepartment = useAppStore((s) => s.updateDepartment);
  const deleteDepartment = useAppStore((s) => s.deleteDepartment);
  const addRole = useAppStore((s) => s.addRole);
  const updateRole = useAppStore((s) => s.updateRole);
  const deleteRole = useAppStore((s) => s.deleteRole);
  const mergeRole = useAppStore((s) => s.mergeRole);
  const [newDeptName, setNewDeptName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  if (!isOpen || !file) return null;

  const tasksUsingRole = (name: string): number =>
    file.tasks.reduce((acc, t) => {
      if (t.accountable === name) acc++;
      if (t.contributors.includes(name)) acc++;
      if (t.meetingOrganiser === name) acc++;
      return acc;
    }, 0);

  const rolesInDept = (deptId: string): number =>
    file.roles.filter((r) => r.departmentId === deptId).length;

  const handleAddDept = () => {
    if (addDepartment(newDeptName)) setNewDeptName('');
  };

  const handleAddRole = () => {
    if (addRole(newRoleName)) setNewRoleName('');
  };

  const handleDeleteDept = (id: string, name: string) => {
    const count = rolesInDept(id);
    const msg =
      count > 0
        ? `Delete department "${name}"?\n\n${count} role${count === 1 ? '' : 's'} will become unassigned.`
        : `Delete department "${name}"?`;
    if (!window.confirm(msg)) return;
    deleteDepartment(id);
  };

  const handleDeleteRole = (id: string, name: string) => {
    const count = tasksUsingRole(name);
    const msg =
      count > 0
        ? `Delete role "${name}"?\n\nReferenced by ${count} field${count === 1 ? '' : 's'} on tasks — those will keep the name as free text.`
        : `Delete role "${name}"?`;
    if (!window.confirm(msg)) return;
    deleteRole(id);
  };

  return (
    <div className="registry-backdrop" onClick={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Departments & Roles"
      >
        <header className="registry-header">
          <h2>Departments &amp; Roles</h2>
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
          {/* ---- Departments ---- */}
          <section className="registry-section">
            <h3>Departments</h3>
            <p className="registry-hint">
              Departments carry colours used for node tinting. Roles
              assigned to a department inherit its colour.
            </p>
            <div className="registry-add-row">
              <input
                type="text"
                className="registry-input"
                placeholder="New department name"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDept();
                  }
                }}
              />
              <button
                type="button"
                className="registry-add-btn"
                onClick={handleAddDept}
                disabled={!newDeptName.trim()}
              >
                + Add
              </button>
            </div>
            {file.departments.length === 0 ? (
              <p className="registry-empty">No departments yet.</p>
            ) : (
              <div className="registry-item-list">
                {file.departments.map((dept) => (
                  <div key={dept.id} className="registry-item-card">
                    <div className="registry-item-head">
                      <input
                        type="text"
                        className="registry-input"
                        defaultValue={dept.name}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (next && next !== dept.name) {
                            updateDepartment(dept.id, { name: next });
                          } else if (!next) {
                            e.target.value = dept.name;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                      <input
                        type="color"
                        className="registry-colour"
                        value={dept.colour ?? '#4f46e5'}
                        onChange={(e) =>
                          updateDepartment(dept.id, {
                            colour: e.target.value,
                          })
                        }
                      />
                      <span className="registry-count">
                        {rolesInDept(dept.id)}
                      </span>
                      <button
                        type="button"
                        className="registry-delete-btn"
                        onClick={() =>
                          handleDeleteDept(dept.id, dept.name)
                        }
                        aria-label={`Delete ${dept.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---- Roles ---- */}
          <section className="registry-section">
            <h3>Roles</h3>
            <p className="registry-hint">
              Roles are the specific functions used on tasks (Accountable,
              Contributors). Assign each to a department for colour
              grouping. Renaming propagates through every task.
            </p>
            <div className="registry-add-row">
              <input
                type="text"
                className="registry-input"
                placeholder="New role name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRole();
                  }
                }}
              />
              <button
                type="button"
                className="registry-add-btn"
                onClick={handleAddRole}
                disabled={!newRoleName.trim()}
              >
                + Add
              </button>
            </div>
            {file.roles.length === 0 ? (
              <p className="registry-empty">
                No roles defined yet. Roles are auto-discovered from
                task data on every file load.
              </p>
            ) : (
              <div className="registry-item-list">
                {file.roles.map((role) => (
                  <div key={role.id} className="registry-state-row">
                    <input
                      type="text"
                      className="registry-input"
                      defaultValue={role.name}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next === role.name) return;
                        const ok = updateRole(role.id, { name: next });
                        if (!ok) {
                          window.alert(
                            `Couldn't rename — "${next}" is either empty or already taken.`,
                          );
                          e.target.value = role.name;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                    />
                    <select
                      className="registry-input"
                      style={{ width: 'auto', minWidth: 100 }}
                      value={role.departmentId ?? ''}
                      onChange={(e) =>
                        updateRole(role.id, {
                          departmentId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">— No dept —</option>
                      {file.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <span className="registry-count">
                      {tasksUsingRole(role.name)}
                    </span>
                    <select
                      className="registry-input registry-merge-select"
                      value=""
                      title="Merge into another role"
                      onChange={(e) => {
                        const targetId = e.target.value;
                        if (!targetId) return;
                        const target = file.roles.find(
                          (r) => r.id === targetId,
                        );
                        if (!target) return;
                        const count = tasksUsingRole(role.name);
                        const ok = window.confirm(
                          `Merge "${role.name}" into "${target.name}"?\n\n` +
                            `${count} task field${count === 1 ? '' : 's'} will be renamed. "${role.name}" will be removed from the registry.`,
                        );
                        if (ok) mergeRole(role.id, targetId);
                      }}
                    >
                      <option value="">Merge →</option>
                      {file.roles
                        .filter((r) => r.id !== role.id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="registry-delete-btn"
                      onClick={() =>
                        handleDeleteRole(role.id, role.name)
                      }
                      aria-label={`Delete ${role.name}`}
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
