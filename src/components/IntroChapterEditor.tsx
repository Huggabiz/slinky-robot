import { useAppStore } from '../store/useAppStore';
import { Markdown } from './Markdown';
import { MarkdownEditor } from './MarkdownEditor';
import './IntroChapterEditor.css';

interface Props {
  chapterId: string;
}

// Full-width editor for an intro chapter, shown in the right detail
// panel. Provides spacious inputs for the chapter title plus each
// section's title, subtitle, and body. Read-only in Navigate mode.
export function IntroChapterEditor({ chapterId }: Props) {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const updateIntroChapter = useAppStore((s) => s.updateIntroChapter);
  const addIntroSection = useAppStore((s) => s.addIntroSection);
  const updateIntroSection = useAppStore((s) => s.updateIntroSection);
  const deleteIntroSection = useAppStore((s) => s.deleteIntroSection);

  if (!file) return null;
  const chapter = file.introChapters.find((c) => c.id === chapterId);
  if (!chapter) return null;

  const editing = mode === 'edit';

  return (
    <section className="intro-editor">
      <header className="intro-editor-header">
        {editing ? (
          <input
            type="text"
            className="intro-editor-title-input"
            value={chapter.title}
            placeholder="Chapter title"
            onChange={(e) =>
              updateIntroChapter(chapterId, { title: e.target.value })
            }
          />
        ) : (
          <h2 className="intro-editor-title">{chapter.title || '(untitled)'}</h2>
        )}
      </header>

      <div className="intro-editor-sections">
        {chapter.sections.map((sec, idx) => (
          <div key={sec.id} className="intro-editor-section">
            {editing ? (
              <>
                <input
                  type="text"
                  className="intro-editor-sec-title"
                  value={sec.title}
                  placeholder="Section title"
                  onChange={(e) =>
                    updateIntroSection(chapterId, sec.id, {
                      title: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  className="intro-editor-sec-subtitle"
                  value={sec.subtitle}
                  placeholder="Subtitle (optional)"
                  onChange={(e) =>
                    updateIntroSection(chapterId, sec.id, {
                      subtitle: e.target.value,
                    })
                  }
                />
                <MarkdownEditor
                  value={sec.body}
                  onChange={(body) =>
                    updateIntroSection(chapterId, sec.id, { body })
                  }
                  rows={12}
                  placeholder="Body text… (supports Markdown)"
                />
                <button
                  type="button"
                  className="intro-editor-sec-del"
                  onClick={() => deleteIntroSection(chapterId, sec.id)}
                >
                  Remove section
                </button>
              </>
            ) : (
              <>
                {sec.title && (
                  <h3 className="intro-editor-read-title">{sec.title}</h3>
                )}
                {sec.subtitle && (
                  <h4 className="intro-editor-read-subtitle">{sec.subtitle}</h4>
                )}
                {sec.body && (
                  <Markdown text={sec.body} className="intro-editor-read-body" />
                )}
              </>
            )}
            {idx < chapter.sections.length - 1 && (
              <hr className="intro-editor-divider" />
            )}
          </div>
        ))}

        {chapter.sections.length === 0 && !editing && (
          <p className="intro-editor-empty">No sections in this chapter yet.</p>
        )}

        {editing && (
          <button
            type="button"
            className="intro-editor-add-sec"
            onClick={() => addIntroSection(chapterId)}
          >
            + Add section
          </button>
        )}
      </div>
    </section>
  );
}
