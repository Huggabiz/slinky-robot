import { useEffect, useRef } from 'react';
import './PublishConfirmModal.css';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

// Pre-export confirmation for File → Publish HTML. Mirrors PasswordModal's
// backdrop/card/Escape-to-cancel structure. Sets expectations clearly: the
// exported file is a read-only copy and the original .json is still the thing
// you edit.
export function PublishConfirmModal({ onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="publish-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="publish-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
      >
        <h2 className="publish-modal-title" id="publish-modal-title">
          📄 Publish HTML copy
        </h2>
        <p className="publish-modal-intro">
          This saves a standalone HTML file anyone can open in a browser to
          read and navigate the process — no app or JSON needed.
        </p>
        <p className="publish-modal-intro">
          The published copy is <strong>read-only</strong> and cannot be
          edited. Keep the original <code>.json</code> file to make changes.
        </p>

        <div className="publish-modal-actions">
          <button
            type="button"
            className="publish-modal-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="publish-modal-btn publish-modal-btn-primary"
            onClick={onConfirm}
          >
            Publish copy
          </button>
        </div>
      </div>
    </div>
  );
}
