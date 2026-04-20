import { useAppStore, type EditorMode } from '../store/useAppStore';
import './ModeToggle.css';

// Prominent segmented switch between Navigate and Edit modes. Placed
// at the top-left of the toolbar so it's the first thing the user sees.
// Edit mode triggers the dark charcoal + amber theme on the root .app
// element (handled in App.tsx via the store's mode state).
export function ModeToggle() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <div className="mode-toggle" role="radiogroup" aria-label="View mode">
      <ModeButton
        label="Navigate"
        value="review"
        active={mode === 'review'}
        onClick={() => setMode('review')}
      />
      <ModeButton
        label="Edit"
        value="edit"
        active={mode === 'edit'}
        onClick={() => setMode('edit')}
      />
    </div>
  );
}

function ModeButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: EditorMode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={active ? 'mode-toggle-btn mode-toggle-btn-active' : 'mode-toggle-btn'}
      data-mode={value}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
