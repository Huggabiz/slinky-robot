import { useAppStore, type EditorMode } from '../store/useAppStore';
import { encodePassword, verifyPassword } from '../utils/password';
import './ModeToggle.css';

// Prominent segmented switch between Navigate and Edit modes. Placed
// at the top-left of the toolbar so it's the first thing the user sees.
// Edit mode triggers the dark charcoal + amber theme on the root .app
// element (handled in App.tsx via the store's mode state).
//
// Gates the review→edit transition behind the optional password set
// on the file. The padlock button next to the Edit button is the
// in-edit-mode toggle for that lock.
export function ModeToggle() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const file = useAppStore((s) => s.file);
  const updateMeta = useAppStore((s) => s.updateMeta);

  const hasPassword = !!file?.meta.passwordCipher;

  const tryEnterEdit = () => {
    if (mode === 'edit') return;
    if (!hasPassword || !file) {
      setMode('edit');
      return;
    }
    const entered = window.prompt('Enter password to edit this file:');
    if (entered === null) return;
    if (!verifyPassword(entered, file.meta.passwordCipher)) {
      window.alert('Incorrect password.');
      return;
    }
    setMode('edit');
  };

  const togglePasswordLock = () => {
    if (!file) return;
    if (hasPassword) {
      // Removing the lock — confirm with current password to stop
      // someone bypassing it with a single click.
      const entered = window.prompt(
        'Enter the current password to remove the edit lock:',
      );
      if (entered === null) return;
      if (!verifyPassword(entered, file.meta.passwordCipher)) {
        window.alert('Incorrect password.');
        return;
      }
      updateMeta({ passwordCipher: null });
      window.alert('Edit lock removed.');
    } else {
      const a = window.prompt(
        'Set a password for editing this file:',
      );
      if (!a) return;
      const b = window.prompt('Confirm the password:');
      if (a !== b) {
        window.alert("Passwords didn't match — lock not set.");
        return;
      }
      const cipher = encodePassword(a);
      if (!cipher) {
        window.alert('Could not encode password.');
        return;
      }
      updateMeta({ passwordCipher: cipher });
      window.alert(
        'Edit lock set. The password will be required next time someone enters edit mode.',
      );
    }
  };

  return (
    <div className="mode-toggle-wrap">
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
          onClick={tryEnterEdit}
        />
      </div>

      {mode === 'edit' && file && (
        <button
          type="button"
          className={
            hasPassword
              ? 'mode-toggle-lock mode-toggle-lock-on'
              : 'mode-toggle-lock'
          }
          onClick={togglePasswordLock}
          title={
            hasPassword
              ? 'Edit lock active — click to remove'
              : 'Set an edit password'
          }
          aria-label={hasPassword ? 'Remove edit lock' : 'Set edit lock'}
        >
          {hasPassword ? '🔒' : '🔓'}
        </button>
      )}
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
