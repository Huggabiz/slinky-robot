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
import {
  DropdownButton,
  DropdownItem,
  DropdownDivider,
} from './DropdownButton';
import './AppRibbon.css';

export type AppView = 'flow' | 'book';

interface Props {
  onImportCsv: () => void;
  onSaveComplete: () => void;
  onOpenLab: () => void;
  onOpenRoles: () => void;
  onOpenDeliverables: () => void;
  onCreatePhase: () => void;
  onCreateTask: () => void;
  onCreateDeliverableItem: () => void;
  onCreateIntroChapter: () => void;
  onOpenStats: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
}

// Unified ribbon bar that replaces the old EditToolbar + FileMenu.
// Always visible (both Navigate and Edit modes); some items are
// edit-mode-only. Layout: File ▾ | Tools ▾ | Create ▾ | spacer | undo/redo.
export function AppRibbon({
  onImportCsv,
  onSaveComplete,
  onOpenLab,
  onOpenRoles,
  onOpenDeliverables,
  onCreatePhase,
  onCreateTask,
  onCreateDeliverableItem,
  onCreateIntroChapter,
  onOpenStats,
  view,
  onViewChange,
}: Props) {
  const file = useAppStore((s) => s.file);
  const fileName = useAppStore((s) => s.fileName);
  const fileHandle = useAppStore((s) => s.fileHandle);
  const dirty = useAppStore((s) => s.dirty);
  const mode = useAppStore((s) => s.mode);
  const newEmptyFile = useAppStore((s) => s.newEmptyFile);
  const loadFile = useAppStore((s) => s.loadFile);
  const setFileHandle = useAppStore((s) => s.setFileHandle);
  const markClean = useAppStore((s) => s.markClean);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const pastLen = useAppStore((s) => s.past.length);
  const futureLen = useAppStore((s) => s.future.length);

  const editing = mode === 'edit';

  const confirmDiscardIfDirty = (): boolean => {
    if (!dirty) return true;
    return window.confirm('Discard unsaved changes?');
  };

  // ---- File operations ----

  const handleNew = () => {
    if (!confirmDiscardIfDirty()) return;
    newEmptyFile();
  };

  const handleOpen = async () => {
    try {
      if (supportsFileSystemAccess) {
        const result = await openWithFileSystemAccess();
        if (!result) return;
        if (!confirmDiscardIfDirty()) return;
        loadFile(result.file, result.fileName, result.handle);
        return;
      }
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
  };

  const handleSave = async () => {
    if (!file) return;
    if (fileHandle) {
      try {
        await saveToHandle(fileHandle, file);
        markClean();
        onSaveComplete();
      } catch {
        downloadJsonFile(file, fileName ?? 'process.json');
        markClean();
        onSaveComplete();
      }
      return;
    }
    downloadJsonFile(file, fileName ?? 'process.json');
    markClean();
    onSaveComplete();
  };

  const handleSaveAs = async () => {
    if (!file) return;
    if (supportsFileSystemAccess) {
      const handle = await saveAsWithFileSystemAccess(
        file,
        fileName ?? 'process.json',
      );
      if (handle) {
        setFileHandle(handle);
        loadFile(file, handle.name, handle);
        markClean();
        onSaveComplete();
        return;
      }
      return;
    }
    downloadJsonFile(file, fileName ?? 'process.json');
    markClean();
    onSaveComplete();
  };

  return (
    <div className="app-ribbon">
      {/* ---- File menu ---- */}
      <DropdownButton label="File">
        <DropdownItem label="New" onClick={handleNew} />
        <DropdownItem label="Open…" onClick={handleOpen} />
        <DropdownItem label="Import CSV…" onClick={handleImportCsv} />
        <DropdownDivider />
        <DropdownItem
          label="Save"
          onClick={handleSave}
          disabled={!file}
          shortcut="Ctrl+S"
        />
        <DropdownItem
          label="Save as…"
          onClick={handleSaveAs}
          disabled={!file}
        />
      </DropdownButton>

      {/* ---- View menu ---- */}
      <DropdownButton label="View" disabled={!file}>
        <DropdownItem
          label={view === 'flow' ? '✓ Flow chart' : 'Flow chart'}
          onClick={() => onViewChange('flow')}
        />
        <DropdownItem
          label={view === 'book' ? '✓ Book view' : 'Book view'}
          onClick={() => onViewChange('book')}
        />
        <DropdownDivider />
        <DropdownItem
          label="Process statistics…"
          onClick={onOpenStats}
        />
        <DropdownDivider />
        <DropdownItem
          label="Print book view…"
          onClick={() => {
            onViewChange('book');
            // Delay to let the book render before the print dialog fires.
            setTimeout(() => window.print(), 100);
          }}
          shortcut="Ctrl+P"
          disabled={view !== 'book' && !file}
        />
      </DropdownButton>

      {/* ---- Tools menu ---- */}
      <DropdownButton label="Tools" disabled={!file}>
        <DropdownItem label="Layout Lab…" onClick={onOpenLab} />
        {editing && (
          <>
            <DropdownDivider />
            <DropdownItem label="Roles…" onClick={onOpenRoles} />
            <DropdownItem
              label="Deliverables…"
              onClick={onOpenDeliverables}
            />
          </>
        )}
      </DropdownButton>

      {/* ---- Create menu (edit mode only) ---- */}
      {editing && file && (
        <DropdownButton label="Create">
          <DropdownItem
            label="Milestone Phase"
            onClick={onCreatePhase}
          />
          <DropdownItem
            label="Process Step"
            onClick={onCreateTask}
          />
          <DropdownItem
            label="Deliverable Item"
            onClick={onCreateDeliverableItem}
          />
          <DropdownDivider />
          <DropdownItem
            label="Intro Chapter"
            onClick={onCreateIntroChapter}
          />
        </DropdownButton>
      )}

      <div className="app-ribbon-spacer" />

      {/* ---- Undo / Redo (edit mode only) ---- */}
      {editing && file && (
        <div className="app-ribbon-undo">
          <button
            type="button"
            className="app-ribbon-icon-btn"
            onClick={undo}
            disabled={pastLen === 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            className="app-ribbon-icon-btn"
            onClick={redo}
            disabled={futureLen === 0}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
      )}
    </div>
  );
}
