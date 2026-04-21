import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import './IntroChaptersPanel.css';

// Left-sidebar section (edit mode) for managing the introductory
// chapters that appear before the milestone-phase chapters in book
// view. Users can add chapters, add sections within them, and edit
// titles/subtitles/body copy.
export function IntroChaptersPanel() {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const addIntroChapter = useAppStore((s) => s.addIntroChapter);
  const updateIntroChapter = useAppStore((s) => s.updateIntroChapter);
  const deleteIntroChapter = useAppStore((s) => s.deleteIntroChapter);
  const addIntroSection = useAppStore((s) => s.addIntroSection);
  const updateIntroSection = useAppStore((s) => s.updateIntroSection);
  const deleteIntroSection = useAppStore((s) => s.deleteIntroSection);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!file || mode !== 'edit') return null;

  const chapters = [...file.introChapters].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <section className="intro-chapters-panel">
      <div className="intro-chapters-label">Intro Chapters</div>

      {chapters.map((ch) => {
        const expanded = expandedId === ch.id;
        return (
          <div key={ch.id} className="intro-ch">
            <div className="intro-ch-row">
              <button
                type="button"
                className="intro-ch-expand"
                onClick={() =>
                  setExpandedId(expanded ? null : ch.id)
                }
              >
                {expanded ? '▾' : '▸'}
              </button>
              <input
                type="text"
                className="intro-ch-title"
                defaultValue={ch.title}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (t && t !== ch.title) {
                    updateIntroChapter(ch.id, { title: t });
                  } else if (!t) {
                    e.target.value = ch.title;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <button
                type="button"
                className="intro-ch-del"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete intro chapter "${ch.title}"?`,
                    )
                  ) {
                    deleteIntroChapter(ch.id);
                  }
                }}
                aria-label="Delete chapter"
              >
                ×
              </button>
            </div>

            {expanded && (
              <div className="intro-ch-sections">
                {ch.sections.map((sec) => (
                  <div key={sec.id} className="intro-sec">
                    <input
                      type="text"
                      className="intro-sec-input"
                      placeholder="Section title"
                      defaultValue={sec.title}
                      onBlur={(e) =>
                        updateIntroSection(ch.id, sec.id, {
                          title: e.target.value,
                        })
                      }
                    />
                    <input
                      type="text"
                      className="intro-sec-input intro-sec-sub"
                      placeholder="Subtitle (optional)"
                      defaultValue={sec.subtitle}
                      onBlur={(e) =>
                        updateIntroSection(ch.id, sec.id, {
                          subtitle: e.target.value,
                        })
                      }
                    />
                    <textarea
                      className="intro-sec-body"
                      placeholder="Body text…"
                      defaultValue={sec.body}
                      rows={4}
                      onBlur={(e) =>
                        updateIntroSection(ch.id, sec.id, {
                          body: e.target.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      className="intro-sec-del"
                      onClick={() => deleteIntroSection(ch.id, sec.id)}
                    >
                      Remove section
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="intro-sec-add"
                  onClick={() => addIntroSection(ch.id)}
                >
                  + Add section
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="intro-ch-add"
        onClick={() => addIntroChapter()}
      >
        + New Intro Chapter
      </button>
    </section>
  );
}
