import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  downloadJsonFile,
  openProcessFilePicker,
  InvalidFileError,
} from '../utils/fileIO';
import { type ImportResult } from '../utils/csvImport';
import { ImportCsvDialog } from './ImportCsvDialog';
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
  const markDirty = useAppStore((s) => s.markDirty);
  const markClean = useAppStore((s) => s.markClean);

  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true;
    return window.confirm('Discard unsaved changes?');
  };

  const handleOpen = async () => {
    try {
      const result = await openProcessFilePicker();
      if (!result) return;
      if (!confirmDiscardIfDirty()) return;
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
    if (!confirmDiscardIfDirty()) return;
    newEmptyFile();
  };

  const handleImportCsvClick = () => {
    if (!confirmDiscardIfDirty()) return;
    setCsvDialogOpen(true);
  };

  const handleImported = (result: ImportResult) => {
    // Imported data is a fresh in-memory file — no filename yet, and dirty
    // so the user knows they still need to Save to get a persistent JSON.
    loadFile(result.file, null);
    markDirty();
    setCsvDialogOpen(false);
    if (result.warnings.length > 0) {
      const shown = result.warnings.slice(0, 20);
      const more =
        result.warnings.length > 20
          ? `\n\n…and ${result.warnings.length - 20} more.`
          : '';
      window.alert(
        `Imported with ${result.warnings.length} warning(s):\n\n` +
          shown.join('\n') +
          more,
      );
    }
  };

  return (
    <>
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
          <button type="button" onClick={handleImportCsvClick}>
            Import CSV…
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

      <ImportCsvDialog
        isOpen={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onImport={handleImported}
      />
    </>
  );
}
