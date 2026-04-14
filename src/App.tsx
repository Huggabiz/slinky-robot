import { Toolbar } from './components/Toolbar';
import { PhaseSidebar } from './components/PhaseSidebar';
import { TaskDetail } from './components/TaskDetail';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const file = useAppStore((s) => s.file);

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
          <PhaseSidebar />
          <TaskDetail />
        </div>
      )}
    </div>
  );
}

export default App;
