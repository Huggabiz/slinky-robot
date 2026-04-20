import { ModeToggle } from './ModeToggle';
import { FileMenu } from './FileMenu';
import { APP_VERSION } from '../version';
import { useAppStore } from '../store/useAppStore';
import './Toolbar.css';

// FLOW LAB: drop onOpenLab from the props and the Layout Lab button
// when the lab is removed.
interface Props {
  onOpenLab?: () => void;
  onImportCsv: () => void;
}

export function Toolbar({ onOpenLab, onImportCsv }: Props) {
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

      <div className="toolbar-actions">
        {/* FLOW LAB: delete this button when the lab is removed. */}
        {onOpenLab && file && (
          <button type="button" className="toolbar-btn" onClick={onOpenLab}>
            Layout Lab…
          </button>
        )}
      </div>

      <div className="toolbar-version" title="App version">
        v{APP_VERSION}
      </div>

      <FileMenu onImportCsv={onImportCsv} />
    </header>
  );
}
