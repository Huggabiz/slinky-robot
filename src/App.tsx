import { Toolbar } from './components/Toolbar';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const file = useAppStore((s) => s.file);

  return (
    <div className="app">
      <Toolbar />
      <main className="app-main">
        {!file ? (
          <div className="app-empty">
            <h1>No process file open</h1>
            <p>
              Use <strong>Open…</strong> to load an existing process JSON file,
              or <strong>New</strong> to start an empty one.
            </p>
          </div>
        ) : (
          <div className="app-loaded">
            <h1>{file.meta.title}</h1>
            <p className="app-meta">
              {file.phases.length} phase{file.phases.length === 1 ? '' : 's'}
              {' · '}
              {file.tasks.length} task{file.tasks.length === 1 ? '' : 's'}
              {' · '}
              updated {new Date(file.meta.updatedAt).toLocaleString()}
            </p>
            <p className="app-placeholder">
              Review mode UI will appear here in the next increment.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
