import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { BookFilter } from './BookView';
import './BookPerspectivesSidebar.css';

interface Props {
  filter: BookFilter;
  onChange: (next: BookFilter) => void;
}

export function BookPerspectivesSidebar({ filter, onChange }: Props) {
  const file = useAppStore((s) => s.file);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const departments = useMemo(
    () =>
      [...(file?.departments ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [file],
  );

  const rolesByDept = useMemo(() => {
    const map = new Map<string, { name: string }[]>();
    if (!file) return map;
    for (const role of file.roles) {
      if (!role.departmentId) continue;
      let list = map.get(role.departmentId);
      if (!list) {
        list = [];
        map.set(role.departmentId, list);
      }
      list.push({ name: role.name });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [file]);

  if (!file) return null;

  const hasAny = filter.deptIds.size > 0 || filter.roleNames.size > 0;

  const toggleDept = (deptId: string) => {
    const next = new Set(filter.deptIds);
    const nextRoles = new Set(filter.roleNames);
    if (next.has(deptId)) {
      next.delete(deptId);
      // Also uncheck any roles in this department.
      const roles = rolesByDept.get(deptId) ?? [];
      for (const r of roles) nextRoles.delete(r.name);
    } else {
      next.add(deptId);
    }
    onChange({ deptIds: next, roleNames: nextRoles });
  };

  const toggleRole = (roleName: string) => {
    const next = new Set(filter.roleNames);
    if (next.has(roleName)) next.delete(roleName);
    else next.add(roleName);
    onChange({ deptIds: filter.deptIds, roleNames: next });
  };

  const toggleExpand = (deptId: string) => {
    const next = new Set(expanded);
    if (next.has(deptId)) next.delete(deptId);
    else next.add(deptId);
    setExpanded(next);
  };

  const selectAll = () => {
    onChange({
      deptIds: new Set(departments.map((d) => d.id)),
      roleNames: new Set(),
    });
  };

  const clearAll = () => {
    onChange({ deptIds: new Set(), roleNames: new Set() });
  };

  return (
    <aside className="book-perspectives-sidebar">
      <div className="book-perspectives-header">
        <h3>Filter</h3>
        <p className="book-perspectives-hint">
          Check departments or individual roles. Only tasks involving
          a checked item will be shown. Intro chapters and flow diagrams
          stay visible for context.
        </p>
      </div>

      <div className="book-perspectives-actions">
        <button
          type="button"
          className="book-perspectives-action"
          onClick={selectAll}
          disabled={filter.deptIds.size === departments.length}
        >
          All depts
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
            const deptChecked = filter.deptIds.has(dept.id);
            const roles = rolesByDept.get(dept.id) ?? [];
            const isExpanded = expanded.has(dept.id);
            return (
              <li key={dept.id} className="book-perspectives-dept">
                <div className="book-perspectives-dept-row">
                  {roles.length > 0 && (
                    <button
                      type="button"
                      className="book-perspectives-expand"
                      onClick={() => toggleExpand(dept.id)}
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  )}
                  <label className="book-perspectives-row">
                    <input
                      type="checkbox"
                      checked={deptChecked}
                      onChange={() => toggleDept(dept.id)}
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
                </div>
                {isExpanded && roles.length > 0 && (
                  <ul className="book-perspectives-roles">
                    {roles.map((role) => (
                      <li key={role.name}>
                        <label className="book-perspectives-row book-perspectives-role-row">
                          <input
                            type="checkbox"
                            checked={
                              deptChecked || filter.roleNames.has(role.name)
                            }
                            disabled={deptChecked}
                            onChange={() => toggleRole(role.name)}
                          />
                          <span>{role.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasAny && (
        <p className="book-perspectives-status">
          {filter.deptIds.size > 0 && (
            <>
              <strong>{filter.deptIds.size}</strong> dept
              {filter.deptIds.size === 1 ? '' : 's'}
            </>
          )}
          {filter.deptIds.size > 0 && filter.roleNames.size > 0 && ', '}
          {filter.roleNames.size > 0 && (
            <>
              <strong>{filter.roleNames.size}</strong> role
              {filter.roleNames.size === 1 ? '' : 's'}
            </>
          )}
          {' '}selected
        </p>
      )}
    </aside>
  );
}
