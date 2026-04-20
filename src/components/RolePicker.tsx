import { useId } from 'react';
import type { Role } from '../types';
import './RolePicker.css';

// Single-role picker — text input with a datalist of known role names
// for autocomplete. Users can type any name, known or not; unknown
// names live on the task but aren't added to the roles registry
// (that's what the roles-management panel is for).
export function RolePicker({
  value,
  onChange,
  roles,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  roles: Role[];
  placeholder?: string;
}) {
  const listId = useId();
  return (
    <>
      <input
        type="text"
        className="role-picker"
        value={value}
        placeholder={placeholder}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {roles.map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
    </>
  );
}

// Multi-role picker — chip list of current values plus an input row
// to add a new one. Removing a chip clicks out the name; submitting
// the input adds it.
export function RoleMultiPicker({
  value,
  onChange,
  roles,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  roles: Role[];
  placeholder?: string;
}) {
  const listId = useId();

  const handleAdd = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  };

  const handleRemove = (name: string) => {
    onChange(value.filter((v) => v !== name));
  };

  return (
    <div className="role-multi">
      {value.length > 0 && (
        <div className="role-multi-chips">
          {value.map((name) => (
            <span key={name} className="role-multi-chip">
              {name}
              <button
                type="button"
                className="role-multi-chip-remove"
                onClick={() => handleRemove(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        className="role-picker"
        list={listId}
        placeholder={placeholder ?? 'Add contributor…'}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const target = e.currentTarget;
            handleAdd(target.value);
            target.value = '';
          }
        }}
        onBlur={(e) => {
          if (e.target.value) {
            handleAdd(e.target.value);
            e.target.value = '';
          }
        }}
      />
      <datalist id={listId}>
        {roles
          .filter((r) => !value.includes(r.name))
          .map((r) => (
            <option key={r.id} value={r.name} />
          ))}
      </datalist>
    </div>
  );
}
