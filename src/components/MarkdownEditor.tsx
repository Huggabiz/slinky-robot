import { useRef } from 'react';
import './MarkdownEditor.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

type FormatAction =
  | 'bold'
  | 'italic'
  | 'ul'
  | 'ol'
  | 'h2'
  | 'h3'
  | 'quote';

// Textarea with a Markdown formatting toolbar. Buttons insert syntax
// at the cursor or wrap the current selection. No WYSIWYG — the user
// sees raw Markdown in the textarea and the result renders via the
// Markdown component elsewhere.
export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (action: FormatAction) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    let replacement: string;
    let newCursorStart: number;
    let newCursorEnd: number;

    switch (action) {
      case 'bold': {
        const inner = selected || 'bold text';
        replacement = `**${inner}**`;
        newCursorStart = start + 2;
        newCursorEnd = start + 2 + inner.length;
        break;
      }
      case 'italic': {
        const inner = selected || 'italic text';
        replacement = `*${inner}*`;
        newCursorStart = start + 1;
        newCursorEnd = start + 1 + inner.length;
        break;
      }
      case 'ul': {
        if (selected) {
          replacement = selected
            .split('\n')
            .map((line) => `- ${line}`)
            .join('\n');
        } else {
          replacement = '- ';
        }
        newCursorStart = start + replacement.length;
        newCursorEnd = newCursorStart;
        break;
      }
      case 'ol': {
        if (selected) {
          replacement = selected
            .split('\n')
            .map((line, i) => `${i + 1}. ${line}`)
            .join('\n');
        } else {
          replacement = '1. ';
        }
        newCursorStart = start + replacement.length;
        newCursorEnd = newCursorStart;
        break;
      }
      case 'h2': {
        const inner = selected || 'Heading';
        replacement = `## ${inner}`;
        newCursorStart = start + 3;
        newCursorEnd = start + 3 + inner.length;
        break;
      }
      case 'h3': {
        const inner = selected || 'Subheading';
        replacement = `### ${inner}`;
        newCursorStart = start + 4;
        newCursorEnd = start + 4 + inner.length;
        break;
      }
      case 'quote': {
        if (selected) {
          replacement = selected
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n');
        } else {
          replacement = '> ';
        }
        newCursorStart = start + replacement.length;
        newCursorEnd = newCursorStart;
        break;
      }
    }

    const newValue =
      value.slice(0, start) + replacement + value.slice(end);
    onChange(newValue);

    // Restore focus and select the inserted text so the user can see
    // what was added and keep typing.
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursorStart, newCursorEnd);
    });
  };

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('bold')}
          title="Bold (**text**)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('italic')}
          title="Italic (*text*)"
        >
          <em>I</em>
        </button>
        <span className="md-sep" aria-hidden />
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('ul')}
          title="Bullet list (- item)"
        >
          •&ensp;List
        </button>
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('ol')}
          title="Numbered list (1. item)"
        >
          1.&ensp;List
        </button>
        <span className="md-sep" aria-hidden />
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('h2')}
          title="Heading (## text)"
        >
          H2
        </button>
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('h3')}
          title="Subheading (### text)"
        >
          H3
        </button>
        <button
          type="button"
          className="md-btn"
          onClick={() => applyFormat('quote')}
          title="Blockquote (> text)"
        >
          &ldquo;&ensp;Quote
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="md-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    </div>
  );
}
