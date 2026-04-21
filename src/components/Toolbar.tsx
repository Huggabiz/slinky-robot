import { useState } from 'react';
import { ModeToggle } from './ModeToggle';
import { APP_VERSION } from '../version';
import { useAppStore } from '../store/useAppStore';
import './Toolbar.css';

// Top bar: mode toggle, editable file title, version badge.
export function Toolbar() {
  const file = useAppStore((s) => s.file);
  const dirty = useAppStore((s) => s.dirty);
  const updateFile = useAppStore((s) => s.updateFile);
  const [editing, setEditing] = useState(false);

  const title = file?.meta.title ?? 'Slinky Robot';

  const handleTitleCommit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && file) {
      updateFile((f) => ({
        ...f,
        meta: { ...f.meta, title: trimmed },
      }));
    }
    setEditing(false);
  };

  return (
    <header className="toolbar">
      <ModeToggle />

      <div className="toolbar-title">
        {editing && file ? (
          <input
            type="text"
            className="toolbar-title-input"
            defaultValue={title}
            autoFocus
            onBlur={(e) => handleTitleCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className={file ? 'toolbar-title-text toolbar-title-editable' : 'toolbar-title-text'}
            onClick={() => file && setEditing(true)}
            title={file ? 'Click to rename' : undefined}
          >
            {title}
          </span>
        )}
        {dirty && (
          <span className="toolbar-dirty" title="Unsaved changes">
            •
          </span>
        )}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-version" title="App version">
        v{APP_VERSION}
      </div>
    </header>
  );
}
