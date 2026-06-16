import { useEffect, useRef, useState, type FormEvent } from 'react';
import './PasswordModal.css';

// Modal types map onto the three password flows in ModeToggle:
//  - 'verify': enter the existing password to unlock edit mode
//  - 'remove': confirm the current password before clearing the lock
//  - 'set':    choose a new password (with confirmation field)
export type PasswordModalMode = 'verify' | 'set' | 'remove';

interface Props {
  mode: PasswordModalMode;
  // 'verify'/'remove': return true if the entered value is correct.
  // 'set': not used (the second field handles confirmation locally).
  verify?: (entered: string) => boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

const COPY: Record<
  PasswordModalMode,
  { title: string; intro: string; submit: string }
> = {
  verify: {
    title: 'Enter password',
    intro: 'This file is locked. Enter the password to edit it.',
    submit: 'Unlock',
  },
  remove: {
    title: 'Remove edit lock',
    intro: 'Enter the current password to remove the edit lock.',
    submit: 'Remove lock',
  },
  set: {
    title: 'Set edit password',
    intro:
      'Choose a password. It will be required next time someone enters edit mode.',
    submit: 'Set password',
  },
};

// Custom password dialog — replaces window.prompt so the characters are
// masked (type="password") and nobody looking over the shoulder can read
// them. window.prompt always shows plain text, which defeated the lock.
export function PasswordModal({ mode, verify, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the field so the user can type immediately, and let Escape
  // dismiss the dialog from anywhere within it.
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value) {
      setError('Password cannot be empty.');
      return;
    }
    if (mode === 'set') {
      if (value !== confirmValue) {
        setError("Passwords didn't match.");
        return;
      }
      onConfirm(value);
      return;
    }
    // verify / remove
    if (verify && !verify(value)) {
      setError('Incorrect password.');
      setValue('');
      inputRef.current?.focus();
      return;
    }
    onConfirm(value);
  };

  const copy = COPY[mode];

  return (
    <div
      className="password-modal-backdrop"
      onMouseDown={(e) => {
        // Click outside the card cancels.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form className="password-modal" onSubmit={handleSubmit}>
        <h2 className="password-modal-title">🔒 {copy.title}</h2>
        <p className="password-modal-intro">{copy.intro}</p>

        <label className="password-modal-field">
          <span>Password</span>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            autoComplete={mode === 'set' ? 'new-password' : 'current-password'}
          />
        </label>

        {mode === 'set' && (
          <label className="password-modal-field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmValue}
              onChange={(e) => {
                setConfirmValue(e.target.value);
                setError(null);
              }}
              autoComplete="new-password"
            />
          </label>
        )}

        {error && <p className="password-modal-error">{error}</p>}

        <div className="password-modal-actions">
          <button
            type="button"
            className="password-modal-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="password-modal-btn password-modal-btn-primary"
          >
            {copy.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
