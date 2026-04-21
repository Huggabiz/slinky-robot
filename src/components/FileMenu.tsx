import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  downloadJsonFile,
  openProcessFilePicker,
  openWithFileSystemAccess,
  saveAsWithFileSystemAccess,
  saveToHandle,
  supportsFileSystemAccess,
  InvalidFileError,
} from '../utils/fileIO';
import './FileMenu.css';

interface Props {
  onImportCsv: () => void;
  onSaveComplete?: () => void;
}

export function FileMenu({ onImportCsv, onSaveComplete }: Props) {
  const file = useAppStore((s) => s.file);
  const fileName = useAppStore((s) => s.fileName);
  const fileHandle = useAppStore((s) => s.fileHandle);
  const dirty = useAppStore((s) => s.dirty);
  const newEmptyFile = useAppStore((s) => s.newEmptyFile);
  const loadFile = useAppStore((s) => s.loadFile);
  const setFileHandle = useAppStore((s) => s.setFileHandle);
  const markClean = useAppStore((s) => s.markClean);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true;
    return window.confirm('Discard unsaved changes?');
  };

  const handleNew = () => {
    if (!confirmDiscardIfDirty()) return;
    newEmptyFile();
    setOpen(false);
  };

  const handleOpen = async () => {
    setOpen(false);
    try {
      // Try File System Access API first (gives us a reusable handle).
      if (supportsFileSystemAccess) {
        const result = await openWithFileSystemAccess();
        if (!result) return;
        if (!confirmDiscardIfDirty()) return;
        loadFile(result.file, result.fileName, result.handle);
        return;
      }
      // Fallback to <input type="file">.
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

  const handleImportCsv = () => {
    if (!confirmDiscardIfDirty()) return;
    onImportCsv();
    setOpen(false);
  };

  const handleSave = async () => {
    if (!file) return;
    setOpen(false);
    // If we have a file handle from a previous Open or Save As,
    // overwrite in place without prompting.
    if (fileHandle) {
      try {
        await saveToHandle(fileHandle, file);
        markClean();
        onSaveComplete?.();
      } catch {
        // Handle may have been revoked (e.g. tab backgrounded too long).
        // Fall through to download.
        downloadJsonFile(file, fileName ?? 'process.json');
        markClean();
        onSaveComplete?.();
      }
      return;
    }
    // No handle: trigger a download.
    downloadJsonFile(file, fileName ?? 'process.json');
    markClean();
    onSaveComplete?.();
  };

  const handleSaveAs = async () => {
    if (!file) return;
    setOpen(false);
    if (supportsFileSystemAccess) {
      const handle = await saveAsWithFileSystemAccess(
        file,
        fileName ?? 'process.json',
      );
      if (handle) {
        setFileHandle(handle);
        // Update fileName to match what the user chose.
        loadFile(file, handle.name, handle);
        markClean();
        onSaveComplete?.();
        return;
      }
      // User cancelled — no action.
      return;
    }
    // Fallback: same as Save (blob download).
    downloadJsonFile(file, fileName ?? 'process.json');
    markClean();
  };

  return (
    <div className="file-menu" ref={menuRef}>
      <button
        type="button"
        className="file-menu-trigger"
        onClick={() => setOpen(!open)}
      >
        File
      </button>
      {open && (
        <div className="file-menu-dropdown">
          <button type="button" onClick={handleNew}>
            New
          </button>
          <button type="button" onClick={handleOpen}>
            Open…
          </button>
          <button type="button" onClick={handleImportCsv}>
            Import CSV…
          </button>
          <div className="file-menu-divider" />
          <button type="button" onClick={handleSave} disabled={!file}>
            Save
          </button>
          <button type="button" onClick={handleSaveAs} disabled={!file}>
            Save as…
          </button>
        </div>
      )}
    </div>
  );
}
