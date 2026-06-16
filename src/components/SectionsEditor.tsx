import type { IntroSection } from '../types';
import { Markdown } from './Markdown';
import { MarkdownEditor } from './MarkdownEditor';
import { pickImageFile, fileToDataUrl } from '../utils/imageUpload';
import './IntroChapterEditor.css';

interface Props {
  sections: IntroSection[];
  editing: boolean;
  onAdd: () => void;
  onUpdate: (sectionId: string, patch: Partial<IntroSection>) => void;
  onDelete: (sectionId: string) => void;
  emptyLabel?: string;
}

// Shared multi-section editor used by both intro chapters and phase
// (milestone) intros. Each section has a title, subtitle, optional
// inline image, and a Markdown body. Read-only when `editing` is false.
export function SectionsEditor({
  sections,
  editing,
  onAdd,
  onUpdate,
  onDelete,
  emptyLabel = 'No sections yet.',
}: Props) {
  return (
    <div className="intro-editor-sections">
      {sections.map((sec, idx) => (
        <div key={sec.id} className="intro-editor-section">
          {editing ? (
            <>
              <input
                type="text"
                className="intro-editor-sec-title"
                value={sec.title}
                placeholder="Section title"
                onChange={(e) => onUpdate(sec.id, { title: e.target.value })}
              />
              <input
                type="text"
                className="intro-editor-sec-subtitle"
                value={sec.subtitle}
                placeholder="Subtitle (optional)"
                onChange={(e) => onUpdate(sec.id, { subtitle: e.target.value })}
              />
              <div className="intro-editor-sec-image">
                {sec.image && (
                  <img
                    src={sec.image}
                    alt=""
                    className="intro-editor-sec-image-preview"
                  />
                )}
                <div className="intro-editor-sec-image-btns">
                  <button
                    type="button"
                    className="intro-editor-sec-image-btn"
                    onClick={async () => {
                      const f = await pickImageFile();
                      if (!f) return;
                      const dataUrl = await fileToDataUrl(f);
                      onUpdate(sec.id, { image: dataUrl });
                    }}
                  >
                    {sec.image ? 'Change image' : 'Add image'}
                  </button>
                  {sec.image && (
                    <button
                      type="button"
                      className="intro-editor-sec-image-btn"
                      onClick={() => onUpdate(sec.id, { image: null })}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <MarkdownEditor
                value={sec.body}
                onChange={(body) => onUpdate(sec.id, { body })}
                rows={12}
                placeholder="Body text… (supports Markdown)"
              />
              <button
                type="button"
                className="intro-editor-sec-del"
                onClick={() => onDelete(sec.id)}
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
              {sec.image && (
                <img
                  src={sec.image}
                  alt=""
                  className="intro-editor-sec-image-preview"
                />
              )}
              {sec.body && (
                <Markdown text={sec.body} className="intro-editor-read-body" />
              )}
            </>
          )}
          {idx < sections.length - 1 && (
            <hr className="intro-editor-divider" />
          )}
        </div>
      ))}

      {sections.length === 0 && !editing && (
        <p className="intro-editor-empty">{emptyLabel}</p>
      )}

      {editing && (
        <button
          type="button"
          className="intro-editor-add-sec"
          onClick={onAdd}
        >
          + Add section
        </button>
      )}
    </div>
  );
}
