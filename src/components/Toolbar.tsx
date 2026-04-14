import { useAppStore } from '../store/useAppStore';
import {
  downloadJsonFile,
  openProcessFilePicker,
  InvalidFileError,
} from '../utils/fileIO';
import { APP_VERSION } from '../version';
import './Toolbar.css';

// The version badge is the only way the user can visually confirm a new
// build is live on GitHub Pages refresh — keep it visible and readable.
export function Toolbar() {
  const file = useAppStore((s) => s.file);
  const fileName = useAppStore((s) => s.fileName);
  const dirty = useAppStore((s) => s.dirty);
  const newEmptyFile = useAppStore((s) => s.newEmptyFile);
  const loadFile = useAppStore((s) => s.loadFile);
  const markClean = useAppStore((s) => s.markClean);

  const handleOpen = async () => {
    try {
      const result = await openProcessFilePicker();
      if (!result) return; // user cancelled
      if (dirty) {
        const ok = window.confirm('Discard unsaved changes and open this file?');
        if (!ok) return;
      }
      loadFile(result.file, result.fileName);
    } catch (err) {
      const message =
        err instanceof InvalidFileError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      window.alert(`Couldn't open file: ${message}`);
    }
  };

  const handleSave = () => {
    if (!file) return;
    const name = fileName ?? 'process.json';
    downloadJsonFile(file, name);
    markClean();
  };

  const handleNew = () => {
    if (dirty) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
    newEmptyFile();
  };

  return (
    <header className="toolbar">
      <div className="toolbar-title">
        {file?.meta.title ?? 'Slinky Robot'}
        {dirty && (
          <span className="toolbar-dirty" title="Unsaved changes">
            •
          </span>
        )}
      </div>

      <div className="toolbar-actions">
        <button type="button" onClick={handleNew}>
          New
        </button>
        <button type="button" onClick={handleOpen}>
          Open…
        </button>
        <button type="button" onClick={handleSave} disabled={!file}>
          Save
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-version" title="App version">
        v{APP_VERSION}
      </div>
    </header>
  );
}
