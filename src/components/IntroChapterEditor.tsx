import { useAppStore } from '../store/useAppStore';
import { SectionsEditor } from './SectionsEditor';
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

      <SectionsEditor
        sections={chapter.sections}
        editing={editing}
        onAdd={() => addIntroSection(chapterId)}
        onUpdate={(sectionId, patch) =>
          updateIntroSection(chapterId, sectionId, patch)
        }
        onDelete={(sectionId) => deleteIntroSection(chapterId, sectionId)}
        emptyLabel="No sections in this chapter yet."
      />
    </section>
  );
}
