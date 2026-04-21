import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { PerspectiveFilter } from '../utils/perspective';
import './PerspectivesPanel.css';

interface Props {
  filter: PerspectiveFilter | null;
  onFilterChange: (filter: PerspectiveFilter | null) => void;
  hideOthers: boolean;
  onHideOthersChange: (hide: boolean) => void;
}

// Tree panel showing departments → roles. Selecting a department or
// role drives the perspective lens on the flow chart. Sits in the
// left sidebar below the Milestones section.
export function PerspectivesPanel({
  filter,
  onFilterChange,
  hideOthers,
  onHideOthersChange,
}: Props) {
  const file = useAppStore((s) => s.file);
  if (!file) return null;

  // Group roles by department.
  const deptMap = new Map<string | null, typeof file.roles>();
  for (const role of file.roles) {
    const key = role.departmentId;
    const bucket = deptMap.get(key) ?? [];
    bucket.push(role);
    deptMap.set(key, bucket);
  }

  const departments = file.departments;
  const unassigned = deptMap.get(null) ?? [];

  const isActiveDept = (deptId: string) =>
    filter?.type === 'department' && filter.departmentId === deptId;

  const isActiveRole = (roleName: string) =>
    filter?.type === 'role' && filter.roleName === roleName;

  const toggleDept = (deptId: string) => {
    if (isActiveDept(deptId)) {
      onFilterChange(null);
    } else {
      onFilterChange({ type: 'department', departmentId: deptId });
    }
  };

  const toggleRole = (roleName: string) => {
    if (isActiveRole(roleName)) {
      onFilterChange(null);
    } else {
      onFilterChange({ type: 'role', roleName });
    }
  };

  if (departments.length === 0 && unassigned.length === 0) {
    return (
      <section className="perspectives-panel">
        <div className="perspectives-label">Perspectives</div>
        <p className="perspectives-empty">
          Define departments and assign roles to see perspectives.
        </p>
      </section>
    );
  }

  return (
    <section className="perspectives-panel">
      <div className="perspectives-label">Perspectives</div>

      {departments.map((dept) => {
        const roles = deptMap.get(dept.id) ?? [];
        return (
          <DeptSection
            key={dept.id}
            name={dept.name}
            colour={dept.colour}
            isActive={isActiveDept(dept.id)}
            onToggle={() => toggleDept(dept.id)}
            roles={roles}
            activeRoleName={
              filter?.type === 'role' ? filter.roleName : null
            }
            onToggleRole={toggleRole}
          />
        );
      })}

      {unassigned.length > 0 && (
        <DeptSection
          name="Unassigned"
          colour={null}
          isActive={false}
          onToggle={() => {}}
          roles={unassigned}
          activeRoleName={
            filter?.type === 'role' ? filter.roleName : null
          }
          onToggleRole={toggleRole}
        />
      )}

      <label className="perspectives-checkbox">
        <input
          type="checkbox"
          checked={hideOthers}
          onChange={(e) => onHideOthersChange(e.target.checked)}
        />
        <span>Hide unrelated tasks</span>
      </label>

      {filter && (
        <button
          type="button"
          className="perspectives-clear"
          onClick={() => onFilterChange(null)}
        >
          Clear perspective
        </button>
      )}
    </section>
  );
}

function DeptSection({
  name,
  colour,
  isActive,
  onToggle,
  roles,
  activeRoleName,
  onToggleRole,
}: {
  name: string;
  colour: string | null;
  isActive: boolean;
  onToggle: () => void;
  roles: { id: string; name: string }[];
  activeRoleName: string | null;
  onToggleRole: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="perspectives-dept">
      <div className="perspectives-dept-row">
        <button
          type="button"
          className="perspectives-expand"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▾' : '▸'}
        </button>
        {colour && (
          <span
            className="perspectives-swatch"
            style={{ backgroundColor: colour }}
            aria-hidden
          />
        )}
        <button
          type="button"
          className={`perspectives-dept-name${isActive ? ' perspectives-active' : ''}`}
          onClick={onToggle}
        >
          {name}
        </button>
        <span className="perspectives-count">{roles.length}</span>
      </div>
      {expanded && roles.length > 0 && (
        <ul className="perspectives-roles">
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                className={`perspectives-role${activeRoleName === role.name ? ' perspectives-active' : ''}`}
                onClick={() => onToggleRole(role.name)}
              >
                {role.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
