import { useEffect, useRef } from 'react';
import './DetailResizer.css';

interface Props {
  // Called with the new panel width as the user drags the handle.
  onResize: (newWidth: number) => void;
  // Snapshot of the current width at drag start — the resizer needs
  // this (not current state) because React's closures would otherwise
  // reference stale width values across mouse-move events.
  getCurrentWidth: () => number;
  minWidth?: number;
  maxWidth?: number;
}

// Thin vertical drag handle for resizing the right-hand detail panel.
// Sits as a flex-layout sibling BEFORE the panel, so dragging leftwards
// grows the panel (and rightwards shrinks it).
export function DetailResizer({
  onResize,
  getCurrentWidth,
  minWidth = 280,
  maxWidth = 800,
}: Props) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = getCurrentWidth();
    // Global cursor + disable text selection while dragging so the
    // pointer doesn't flicker on unrelated elements under the cursor.
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = startXRef.current - e.clientX;
      const next = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + dx),
      );
      onResize(next);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [onResize, minWidth, maxWidth]);

  return (
    <div
      className="detail-resizer"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
    />
  );
}
