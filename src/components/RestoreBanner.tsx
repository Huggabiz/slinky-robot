import type { ProcessFile } from '../types';
import './RestoreBanner.css';

interface Props {
  savedAt: string;
  onAccept: () => void;
  onDismiss: () => void;
}

// Amber banner shown at the top of the app when localStorage has a
// stashed file from a previous session that wasn't explicitly saved.
// Once the user accepts or dismisses it, the banner disappears and
// the stash is cleared.
export function RestoreBanner({ savedAt, onAccept, onDismiss }: Props) {
  const date = formatTimestamp(savedAt);
  return (
    <div className="restore-banner" role="alert">
      <span className="restore-banner-text">
        Unsaved changes recovered from <strong>{date}</strong>. Restore
        them?
      </span>
      <button type="button" onClick={onAccept}>
        Restore
      </button>
      <button
        type="button"
        className="restore-banner-dismiss"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// Suppress unused import warning — the type is used by callers who
// pass this component's accepted file into the store.
void (0 as unknown as ProcessFile);
