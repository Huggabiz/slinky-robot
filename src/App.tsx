import { useEffect, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { EditToolbar } from './components/EditToolbar';
import { PhaseSidebar } from './components/PhaseSidebar';
import { PhaseInfoBar } from './components/PhaseInfoBar';
import { FlowToolbar } from './components/FlowToolbar';
import { ProcessFlow } from './components/ProcessFlow';
import { TaskDetail } from './components/TaskDetail';
import { DetailResizer } from './components/DetailResizer';
import { ImportCsvDialog } from './components/ImportCsvDialog';
import { RolesPanel } from './components/RolesPanel';
import { DeliverablesPanel } from './components/DeliverablesPanel';
import { RestoreBanner } from './components/RestoreBanner';
// FLOW LAB: delete these two imports when the lab is removed.
import { FlowLabPanel } from './components/FlowLabPanel';
import { DEFAULT_LAB_CONFIG, type LabConfig } from './utils/flowLab';
import { type ImportResult } from './utils/csvImport';
import { useAutosave } from './utils/autosave';
import { useAppStore } from './store/useAppStore';
import { getPhasesOrdered } from './types';
import './App.css';

function App() {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const dirty = useAppStore((s) => s.dirty);
  const loadFile = useAppStore((s) => s.loadFile);
  const markDirty = useAppStore((s) => s.markDirty);
  const addPhase = useAppStore((s) => s.addPhase);
  const addTask = useAppStore((s) => s.addTask);
  const selectTask = useAppStore((s) => s.selectTask);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const [phaseId, setPhaseId] = useState<string | null>(null);

  // localStorage crash-recovery: auto-saves every 3 s when dirty.
  // On mount, if a stash exists, `pending` is non-null and we show a
  // restore banner. After explicit save, call clear() to wipe it.
  const autosave = useAutosave(file, dirty);

  // Global undo/redo keyboard shortcuts. We intentionally skip when
  // focus is in an input/textarea/select so the browser's native
  // text-undo keeps working for typed fields — app-level undo only
  // applies to structural changes and clicks outside text editing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inTextField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (inTextField) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Display-tool state (FlowToolbar). These control how the flow
  // renders but don't affect the layout itself.
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [fadeOver, setFadeOver] = useState<number | null>(3);

  // FLOW LAB: labConfig state + lab open toggle.
  const [labConfig, setLabConfig] = useState<LabConfig>(DEFAULT_LAB_CONFIG);
  const [labOpen, setLabOpen] = useState(false);

  // CSV import dialog — opened from the File menu.
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  // Registry management panels (edit mode only).
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false);
  const [deliverablesPanelOpen, setDeliverablesPanelOpen] = useState(false);

  // Right-hand detail panel width, user-resizable via DetailResizer.
  const [detailWidth, setDetailWidth] = useState(420);
  const detailWidthRef = useRef(detailWidth);
  detailWidthRef.current = detailWidth;

  // Keep the active phase coherent with the loaded file.
  useEffect(() => {
    if (!file) {
      setPhaseId(null);
      return;
    }
    const phases = getPhasesOrdered(file);
    if (phases.length === 0) {
      setPhaseId(null);
      return;
    }
    if (!phaseId || !phases.some((p) => p.id === phaseId)) {
      setPhaseId(phases[0].id);
    }
  }, [file, phaseId]);

  const handleImported = (result: ImportResult) => {
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

  const handleCreatePhase = () => {
    const newId = addPhase();
    if (newId) setPhaseId(newId);
  };

  const handleCreateTask = () => {
    if (!file) return;
    if (!phaseId) {
      window.alert(
        'Select a phase in the sidebar first — new tasks land in the active phase.',
      );
      return;
    }
    // If a task is currently selected, auto-chain the new task after
    // it as a prerequisite. Otherwise, the new task has no prereqs
    // and the user sets them in the edit form.
    const newId = addTask(phaseId, {
      autoPrereqOfTaskId: selectedTaskId ?? null,
    });
    if (newId) selectTask(newId);
  };

  // The right-hand pane shows a pinned phase info bar above the task
  // detail whenever a phase is active; the detail panel itself only
  // renders when a task is also selected.
  const showDetailColumn = file !== null && (selectedTaskId !== null || phaseId !== null);

  return (
    <div className={`app${mode === 'edit' ? ' edit-mode' : ''}`}>
      <Toolbar
        onOpenLab={() => setLabOpen(true)}
        onImportCsv={() => setCsvDialogOpen(true)}
        onSaveComplete={autosave.clear}
      />
      {autosave.pending && !file && (
        <RestoreBanner
          savedAt={autosave.pending.savedAt}
          onAccept={() => {
            const restored = autosave.accept();
            if (restored) loadFile(restored, null);
          }}
          onDismiss={autosave.dismiss}
        />
      )}
      {mode === 'edit' && file && (
        <EditToolbar
          onCreatePhase={handleCreatePhase}
          onCreateTask={handleCreateTask}
          onOpenRoles={() => setRolesPanelOpen(true)}
          onOpenDeliverables={() => setDeliverablesPanelOpen(true)}
        />
      )}
      {!file ? (
        <main className="app-main">
          <div className="app-empty">
            <h1>No process file open</h1>
            <p>
              Use <strong>File → Open</strong> to load an existing process
              JSON file, <strong>File → Import CSV</strong> to bring in a
              spreadsheet, or <strong>File → New</strong> to start an empty
              one.
            </p>
          </div>
        </main>
      ) : (
        <div className="app-workspace">
          <PhaseSidebar
            selectedPhaseId={phaseId}
            onSelect={setPhaseId}
            onCreatePhase={handleCreatePhase}
          />
          <div className="app-flow-column">
            <FlowToolbar
              highlightEnabled={highlightEnabled}
              onHighlightChange={setHighlightEnabled}
              fadeOver={fadeOver}
              onFadeChange={setFadeOver}
            />
            <ProcessFlow
              phaseId={phaseId}
              labConfig={labConfig}
              highlightEnabled={highlightEnabled}
              fadeOver={fadeOver}
            />
          </div>
          {showDetailColumn && (
            <>
              <DetailResizer
                onResize={setDetailWidth}
                getCurrentWidth={() => detailWidthRef.current}
              />
              <aside
                className="app-detail-column"
                style={{ width: detailWidth }}
              >
                <PhaseInfoBar phaseId={phaseId} />
                {selectedTaskId && <TaskDetail />}
              </aside>
            </>
          )}
        </div>
      )}
      {/* FLOW LAB: delete this block when the lab is removed. */}
      {labOpen && file && (
        <FlowLabPanel
          config={labConfig}
          onChange={setLabConfig}
          onClose={() => setLabOpen(false)}
        />
      )}
      <ImportCsvDialog
        isOpen={csvDialogOpen}
        onClose={() => setCsvDialogOpen(false)}
        onImport={handleImported}
      />
      <RolesPanel
        isOpen={rolesPanelOpen}
        onClose={() => setRolesPanelOpen(false)}
      />
      <DeliverablesPanel
        isOpen={deliverablesPanelOpen}
        onClose={() => setDeliverablesPanelOpen(false)}
      />
    </div>
  );
}

export default App;
