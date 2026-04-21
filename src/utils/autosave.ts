import { useEffect, useRef, useState } from 'react';
import { type ProcessFile } from '../types';
import { parseProcessFile, serializeProcessFile } from './fileIO';

const STORAGE_KEY = 'slinky-robot-autosave';
const STORAGE_TS_KEY = 'slinky-robot-autosave-ts';
const DEBOUNCE_MS = 3000;

/**
 * Auto-save the current file to localStorage every DEBOUNCE_MS when
 * dirty. Provides a one-shot restore check on mount and a clear
 * function for after an explicit save.
 *
 * Call pattern:
 *   const { pending, accept, dismiss, clear } = useAutosave(file, dirty);
 *
 *   pending   — a stashed ProcessFile + timestamp if a recovery is available
 *   accept()  — caller replaces its file with the stashed one
 *   dismiss() — user declined; stash is discarded
 *   clear()   — call after a successful explicit save to wipe the stash
 */
export function useAutosave(
  file: ProcessFile | null,
  dirty: boolean,
): {
  pending: { file: ProcessFile; savedAt: string } | null;
  accept: () => ProcessFile | null;
  dismiss: () => void;
  clear: () => void;
} {
  // Recovery state — only populated once on mount if localStorage has
  // a stash. After accept or dismiss it's cleared and never re-checked.
  const [pending, setPending] = useState<{
    file: ProcessFile;
    savedAt: string;
  } | null>(null);
  const checkedRef = useRef(false);

  // One-time check on mount: is there a stashed file in localStorage?
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ts = localStorage.getItem(STORAGE_TS_KEY);
      if (!raw || !ts) return;
      const parsed = parseProcessFile(raw);
      setPending({ file: parsed, savedAt: ts });
    } catch {
      // Corrupted stash — silently discard.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TS_KEY);
    }
  }, []);

  // Debounced auto-save whenever the file changes and is dirty. Clears
  // the timer on cleanup so rapid edits don't pile up writes.
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!file || !dirty) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const text = serializeProcessFile(file);
        localStorage.setItem(STORAGE_KEY, text);
        localStorage.setItem(STORAGE_TS_KEY, new Date().toISOString());
      } catch {
        // localStorage full or blocked — ignore silently.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [file, dirty]);

  const accept = (): ProcessFile | null => {
    const p = pending;
    setPending(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
    return p?.file ?? null;
  };

  const dismiss = () => {
    setPending(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
  };

  return { pending, accept, dismiss, clear };
}
