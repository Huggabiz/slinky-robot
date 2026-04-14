import { APP_VERSION } from '../version';
import './Toolbar.css';

// The version badge is the only way the user can visually confirm a new
// build is live on GitHub Pages refresh — keep it visible and readable.
export function Toolbar() {
  return (
    <header className="toolbar">
      <div className="toolbar-title">Slinky Robot</div>
      <div className="toolbar-spacer" />
      <div className="toolbar-version" title="App version">
        v{APP_VERSION}
      </div>
    </header>
  );
}
