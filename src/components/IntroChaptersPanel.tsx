import { useAppStore } from '../store/useAppStore';
import './IntroChaptersPanel.css';

interface Props {
  selectedChapterId: string | null;
  onSelect: (id: string | null) => void;
}

// Compact sidebar list of intro chapters. Click to select; the full
// editor opens in the right detail panel (IntroChapterEditor).
export function IntroChaptersPanel({ selectedChapterId, onSelect }: Props) {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const addIntroChapter = useAppStore((s) => s.addIntroChapter);
  const deleteIntroChapter = useAppStore((s) => s.deleteIntroChapter);

  if (!file) return null;

  const chapters = [...file.introChapters].sort(
    (a, b) => a.order - b.order,
  );
  const editing = mode === 'edit';

  return (
    <section className="intro-chapters-panel">
      <div className="intro-chapters-label">Intro Chapters</div>

      {chapters.length === 0 && !editing && (
        <p className="intro-ch-empty">No intro chapters defined.</p>
      )}

      {chapters.map((ch) => {
        const active = ch.id === selectedChapterId;
        return (
          <div
            key={ch.id}
            className={`intro-ch-row${active ? ' intro-ch-row-active' : ''}`}
          >
            <button
              type="button"
              className="intro-ch-name"
              onClick={() => onSelect(active ? null : ch.id)}
            >
              {ch.title || '(untitled)'}
            </button>
            {editing && (
              <button
                type="button"
                className="intro-ch-del"
                onClick={() => {
                  if (window.confirm(`Delete intro chapter "${ch.title}"?`)) {
                    deleteIntroChapter(ch.id);
                    if (active) onSelect(null);
                  }
                }}
                aria-label="Delete chapter"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {editing && (
        <button
          type="button"
          className="intro-ch-add"
          onClick={() => {
            const id = addIntroChapter();
            if (id) onSelect(id);
          }}
        >
          + New Intro Chapter
        </button>
      )}
    </section>
  );
}
