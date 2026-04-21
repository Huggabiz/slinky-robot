import { useEffect, useRef, useState, type ReactNode } from 'react';
import './DropdownButton.css';

interface Props {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}

// Reusable dropdown trigger. Renders a button that toggles a
// positioned dropdown panel. Click outside or on a menu item
// closes it. Children go inside the dropdown and should be
// <button> or <div className="dropdown-divider" />.
export function DropdownButton({ label, children, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="dropdown-btn-wrap" ref={ref}>
      <button
        type="button"
        className={`dropdown-trigger${open ? ' dropdown-trigger-open' : ''}`}
        onClick={() => setOpen(!open)}
        disabled={disabled}
      >
        {label} <span className="dropdown-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div
          className="dropdown-panel"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Helper components for dropdown content.
export function DropdownItem({
  label,
  onClick,
  disabled,
  shortcut,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      className="dropdown-item"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="dropdown-item-label">{label}</span>
      {shortcut && (
        <span className="dropdown-item-shortcut">{shortcut}</span>
      )}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="dropdown-divider" />;
}
