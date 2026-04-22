import { useEffect, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { AppRibbon } from './components/AppRibbon';
import { PhaseSidebar } from './components/PhaseSidebar';
import { PhaseInfoBar } from './components/PhaseInfoBar';
import { FlowToolbar } from './components/FlowToolbar';
import { ProcessFlow } from './components/ProcessFlow';
import { TaskDetail } from './components/TaskDetail';
import { DetailResizer } from './components/DetailResizer';
import { ImportCsvDialog } from './components/ImportCsvDialog';
import { PerspectivesPanel } from './components/PerspectivesPanel';
import { IntroChaptersPanel } from './components/IntroChaptersPanel';
import { IntroChapterEditor } from './components/IntroChapterEditor';
import { BookView } from './components/BookView';
import { StatsPanel } from './components/StatsPanel';
import type { AppView } from './components/AppRibbon';
import type { PerspectiveFilter } from './utils/perspective';
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
  const addDeliverableItem = useAppStore((s) => s.addDeliverableItem);
  const addIntroChapter = useAppStore((s) => s.addIntroChapter);
  const selectTask = useAppStore((s) => s.selectTask);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const [phaseId, setPhaseId] = useState<string | null>(null);

  // localStorage crash-recovery.
  const autosave = useAutosave(file, dirty);

  // Global undo/redo keyboard shortcuts. Skipped when focus is in a
  // text field so browser-native text undo keeps working.
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

  // Display-tool state (FlowToolbar).
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [fadeOver, setFadeOver] = useState<number | null>(3);
  const [searchQuery, setSearchQuery] = useState('');

  // FLOW LAB: labConfig state + lab open toggle.
  const [labConfig, setLabConfig] = useState<LabConfig>(DEFAULT_LAB_CONFIG);
  const [labOpen, setLabOpen] = useState(false);

  // Perspective lens state.
  const [perspectiveFilter, setPerspectiveFilter] =
    useState<PerspectiveFilter | null>({ type: 'allDepartments' });
  const [perspectiveHideOthers, setPerspectiveHideOthers] = useState(false);

  // View toggle: flow chart vs book view.
  const [view, setView] = useState<AppView>('flow');

  // Intro chapter selection — when set, the right panel shows the
  // chapter editor instead of the task detail. Cleared whenever a
  // task is selected on the flow.
  const [selectedIntroChapterId, setSelectedIntroChapterId] = useState<
    string | null
  >(null);

  // Clear intro chapter selection when a task gets selected.
  useEffect(() => {
    if (selectedTaskId) setSelectedIntroChapterId(null);
  }, [selectedTaskId]);

  // Dialogs / panels.
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false);
  const [deliverablesPanelOpen, setDeliverablesPanelOpen] = useState(false);
  const [statsPanelOpen, setStatsPanelOpen] = useState(false);

  // Right-hand detail panel width, user-resizable.
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
    const newId = addTask(phaseId, {
      autoPrereqOfTaskId: selectedTaskId ?? null,
    });
    if (newId) selectTask(newId);
  };

  const handleCreateDeliverableItem = () => {
    const name = window.prompt('New deliverable item name:');
    if (name?.trim()) addDeliverableItem(name.trim());
  };

  const showDetailColumn =
    file !== null &&
    (selectedTaskId !== null || phaseId !== null || selectedIntroChapterId !== null);

  return (
    <div className={`app${mode === 'edit' ? ' edit-mode' : ''}`}>
      <Toolbar />
      <AppRibbon
        onImportCsv={() => setCsvDialogOpen(true)}
        onSaveComplete={autosave.clear}
        onOpenLab={() => setLabOpen(true)}
        onOpenRoles={() => setRolesPanelOpen(true)}
        onOpenDeliverables={() => setDeliverablesPanelOpen(true)}
        onCreatePhase={handleCreatePhase}
        onCreateTask={handleCreateTask}
        onCreateDeliverableItem={handleCreateDeliverableItem}
        onCreateIntroChapter={() => addIntroChapter()}
        onOpenStats={() => setStatsPanelOpen(true)}
        view={view}
        onViewChange={setView}
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
      ) : view === 'book' ? (
        <BookView />
      ) : (
        <div className="app-workspace">
          <aside className="app-left-sidebar">
            <IntroChaptersPanel
              selectedChapterId={selectedIntroChapterId}
              onSelect={(id) => {
                setSelectedIntroChapterId(id);
                if (id) selectTask(null);
              }}
            />
            <PhaseSidebar
              selectedPhaseId={phaseId}
              onSelect={setPhaseId}
              onCreatePhase={handleCreatePhase}
            />
            <PerspectivesPanel
              filter={perspectiveFilter}
              onFilterChange={setPerspectiveFilter}
              hideOthers={perspectiveHideOthers}
              onHideOthersChange={setPerspectiveHideOthers}
            />
          </aside>
          <div className="app-flow-column">
            <FlowToolbar
              highlightEnabled={highlightEnabled}
              onHighlightChange={setHighlightEnabled}
              fadeOver={fadeOver}
              onFadeChange={setFadeOver}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <ProcessFlow
              phaseId={phaseId}
              labConfig={labConfig}
              highlightEnabled={highlightEnabled}
              fadeOver={fadeOver}
              perspectiveFilter={perspectiveFilter}
              perspectiveHideOthers={perspectiveHideOthers}
              searchQuery={searchQuery}
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
                {selectedIntroChapterId ? (
                  <IntroChapterEditor chapterId={selectedIntroChapterId} />
                ) : (
                  <>
                    <PhaseInfoBar phaseId={phaseId} />
                    {selectedTaskId && <TaskDetail />}
                  </>
                )}
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
      <StatsPanel
        isOpen={statsPanelOpen}
        onClose={() => setStatsPanelOpen(false)}
      />
    </div>
  );
}

export default App;
