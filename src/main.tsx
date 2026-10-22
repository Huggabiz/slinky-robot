import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { publishedRaw } from './published';
import { useAppStore } from './store/useAppStore';
import { parseProcessFile } from './utils/fileIO';

// In a published HTML copy the process file is embedded in the page. Hydrate
// the store imperatively BEFORE render: this avoids a flash of the empty
// "No process file open" state, and — unlike a mount effect — isn't re-run by
// StrictMode's double-invoke. loadFile() resets mode to 'review', so the copy
// opens straight into read-only Navigate. parseProcessFile runs the full
// schema-migration chain, so copies published by older builds keep loading.
if (publishedRaw) {
  try {
    const file = parseProcessFile(publishedRaw);
    useAppStore.getState().loadFile(file, null);
  } catch (err) {
    console.error('Failed to load published process data', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
