import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { PhaseTabs } from './components/PhaseTabs';
import { ProcessFlow } from './components/ProcessFlow';
import { TaskDetail } from './components/TaskDetail';
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

  // FLOW LAB: labConfig state — delete when the lab is removed.
  const [labConfig, setLabConfig] = useState<LabConfig>(DEFAULT_LAB_CONFIG);

  // Keep the active phase coherent with the loaded file:
  // - no file → no phase
  // - file loaded but current phaseId doesn't exist in it → snap to first phase
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
      <Toolbar />
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
          {/* FLOW LAB: remove the FlowLabPanel element when the lab is removed. */}
          <FlowLabPanel config={labConfig} onChange={setLabConfig} />
          <div className="app-flow-column">
            <PhaseTabs selectedPhaseId={phaseId} onSelect={setPhaseId} />
            <ProcessFlow phaseId={phaseId} labConfig={labConfig} />
          </div>
          {selectedTaskId && (
            <aside className="app-detail-column">
              <TaskDetail />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
