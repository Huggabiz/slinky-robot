import { useEffect, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { PhaseSidebar } from './components/PhaseSidebar';
import { FlowToolbar } from './components/FlowToolbar';
import { ProcessFlow } from './components/ProcessFlow';
import { TaskDetail } from './components/TaskDetail';
import { DetailResizer } from './components/DetailResizer';
// FLOW LAB: delete these two imports when the lab is removed.
import { FlowLabPanel } from './components/FlowLabPanel';
import { DEFAULT_LAB_CONFIG, type LabConfig } from './utils/flowLab';
import { useAppStore } from './store/useAppStore';
import { getPhasesOrdered } from './types';
import './App.css';

function App() {
  const file = useAppStore((s) => s.file);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const [phaseId, setPhaseId] = useState<string | null>(null);

  // Display-tool state (FlowToolbar). These control how the flow
  // renders but don't affect the layout itself.
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [fadeOver, setFadeOver] = useState<number | null>(3);

  // FLOW LAB: labConfig state + lab open toggle.
  const [labConfig, setLabConfig] = useState<LabConfig>(DEFAULT_LAB_CONFIG);
  const [labOpen, setLabOpen] = useState(false);

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

  return (
    <div className="app">
      <Toolbar onOpenLab={() => setLabOpen(true)} />
      {!file ? (
        <main className="app-main">
          <div className="app-empty">
            <h1>No process file open</h1>
            <p>
              Use <strong>Open…</strong> to load an existing process JSON
              file, <strong>Import CSV…</strong> to bring in a spreadsheet,
              or <strong>New</strong> to start an empty one.
            </p>
          </div>
        </main>
      ) : (
        <div className="app-workspace">
          <PhaseSidebar selectedPhaseId={phaseId} onSelect={setPhaseId} />
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
          {selectedTaskId && (
            <>
              <DetailResizer
                onResize={setDetailWidth}
                getCurrentWidth={() => detailWidthRef.current}
              />
              <aside
                className="app-detail-column"
                style={{ width: detailWidth }}
              >
                <TaskDetail />
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
    </div>
  );
}

export default App;
