import { ModeToggle } from './ModeToggle';
import { APP_VERSION } from '../version';
import { useAppStore } from '../store/useAppStore';
import './Toolbar.css';

// Top bar: mode toggle, file title with dirty indicator, version badge.
// All file/tool/create operations now live in AppRibbon below this bar.
export function Toolbar() {
  const file = useAppStore((s) => s.file);
  const dirty = useAppStore((s) => s.dirty);

  return (
    <header className="toolbar">
      <ModeToggle />

      <div className="toolbar-title">
        {file?.meta.title ?? 'Slinky Robot'}
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
