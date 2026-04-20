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
// FLOW LAB: delete these two imports when the lab is removed.
import { FlowLabPanel } from './components/FlowLabPanel';
import { DEFAULT_LAB_CONFIG, type LabConfig } from './utils/flowLab';
import { type ImportResult } from './utils/csvImport';
import { useAppStore } from './store/useAppStore';
import { getPhasesOrdered } from './types';
import './App.css';

function App() {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const loadFile = useAppStore((s) => s.loadFile);
  const markDirty = useAppStore((s) => s.markDirty);
  const addPhase = useAppStore((s) => s.addPhase);
  const [phaseId, setPhaseId] = useState<string | null>(null);

  // Display-tool state (FlowToolbar). These control how the flow
  // renders but don't affect the layout itself.
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [fadeOver, setFadeOver] = useState<number | null>(3);

  // FLOW LAB: labConfig state + lab open toggle.
  const [labConfig, setLabConfig] = useState<LabConfig>(DEFAULT_LAB_CONFIG);
  const [labOpen, setLabOpen] = useState(false);

  // CSV import dialog — opened from the File menu.
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

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
    // Task editor lands in the next commit; flag unimplemented for now.
    window.alert('Task creation lands in the next commit.');
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
      />
      {mode === 'edit' && file && (
        <EditToolbar
          onCreatePhase={handleCreatePhase}
          onCreateTask={handleCreateTask}
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
    </div>
  );
}

export default App;
