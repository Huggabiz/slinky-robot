import { useState } from 'react';
import { useAppStore, type EditorMode } from '../store/useAppStore';
import { encodePassword, verifyPassword } from '../utils/password';
import { PasswordModal, type PasswordModalMode } from './PasswordModal';
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

  // Which password dialog (if any) is currently open. Replaces the old
  // window.prompt flows so characters are masked while being typed.
  const [dialog, setDialog] = useState<PasswordModalMode | null>(null);

  const tryEnterEdit = () => {
    if (mode === 'edit') return;
    if (!hasPassword || !file) {
      setMode('edit');
      return;
    }
    setDialog('verify');
  };

  const togglePasswordLock = () => {
    if (!file) return;
    // Removing the lock confirms the current password first; setting one
    // collects a password + confirmation. Both go through the modal.
    setDialog(hasPassword ? 'remove' : 'set');
  };

  const verifyEntered = (entered: string) =>
    !!file && verifyPassword(entered, file.meta.passwordCipher);

  const handleConfirm = (password: string) => {
    if (dialog === 'verify') {
      setMode('edit');
    } else if (dialog === 'remove') {
      updateMeta({ passwordCipher: null });
    } else if (dialog === 'set') {
      const cipher = encodePassword(password);
      if (!cipher) {
        window.alert('Could not encode password.');
        return;
      }
      updateMeta({ passwordCipher: cipher });
    }
    setDialog(null);
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

      {dialog && (
        <PasswordModal
          mode={dialog}
          verify={dialog === 'set' ? undefined : verifyEntered}
          onConfirm={handleConfirm}
          onCancel={() => setDialog(null)}
        />
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
