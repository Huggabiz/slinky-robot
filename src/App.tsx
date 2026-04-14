import { Toolbar } from './components/Toolbar';
import { useAppStore } from './store/useAppStore';
import './App.css';

function App() {
  const message = useAppStore((s) => s.message);
  const setMessage = useAppStore((s) => s.setMessage);

  return (
    <div className="app">
      <Toolbar />
      <main className="app-main">
        <section className="app-card">
          <h1>Slinky Robot</h1>
          <p className="app-subtitle">
            Generic starter — replace this content with your app.
          </p>
          <label className="app-field">
            <span>Message</span>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type something…"
            />
          </label>
          <p className="app-echo">{message || '…'}</p>
        </section>
      </main>
    </div>
  );
}

export default App;
