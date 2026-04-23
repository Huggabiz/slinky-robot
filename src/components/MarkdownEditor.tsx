import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
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
//
// Also supports @Role autocomplete: typing `@` followed by one or more
// characters opens a popover of matching roles. Pick one with mouse
// or arrow keys + Enter/Tab to replace the fragment with the full
// role name. The Markdown renderer picks these up and highlights.
export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const roles = useAppStore((s) => s.file?.roles ?? []);

  // Autocomplete state. When non-null, a popover is shown and keys
  // (ArrowUp/Down/Enter/Tab/Escape) are intercepted on the textarea.
  const [autocomplete, setAutocomplete] = useState<{
    query: string;
    fragmentStart: number; // index of `@` in value
    activeIndex: number;
  } | null>(null);

  const matches = useMemo(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase();
    const names = roles.map((r) => r.name);
    // Prefix matches first, then substring matches. Cap at 8 to keep
    // the popover short.
    const prefix = names.filter((n) => n.toLowerCase().startsWith(q));
    const inner = names.filter(
      (n) =>
        !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q),
    );
    return [...prefix, ...inner].slice(0, 8);
  }, [autocomplete, roles]);

  // Keep activeIndex in range as matches shrink.
  useEffect(() => {
    if (!autocomplete) return;
    if (autocomplete.activeIndex >= matches.length) {
      setAutocomplete({ ...autocomplete, activeIndex: 0 });
    }
  }, [autocomplete, matches.length]);

  // Read the current `@fragment` (if any) sitting at the cursor, and
  // update/close the autocomplete state accordingly. Called after
  // every value/selection change.
  const syncAutocomplete = (nextValue: string, caret: number) => {
    // Walk back from caret collecting word chars + space + dashes until
    // we hit an `@` that's at string start or preceded by a non-word
    // char. If found, the fragment is whatever comes after it up to
    // the caret.
    let i = caret - 1;
    let fragment = '';
    while (i >= 0) {
      const ch = nextValue[i];
      if (ch === '@') {
        const before = i === 0 ? '' : nextValue[i - 1];
        if (!before || /[^A-Za-z0-9_]/.test(before)) {
          setAutocomplete((prev) => ({
            query: fragment,
            fragmentStart: i,
            activeIndex: prev?.activeIndex ?? 0,
          }));
          return;
        }
        break;
      }
      // Role names can contain letters, digits, spaces, dashes. Stop
      // on newline or other punctuation that's unlikely inside a name.
      if (!/[A-Za-z0-9 \-&()]/.test(ch)) break;
      // Don't let the fragment cross the previous blank before an `@`
      // on a different line.
      if (ch === '\n') break;
      fragment = ch + fragment;
      i--;
    }
    setAutocomplete(null);
  };

  const acceptAutocomplete = (name: string) => {
    if (!autocomplete) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionEnd;
    const before = value.slice(0, autocomplete.fragmentStart);
    const after = value.slice(caret);
    const insertion = `@${name}`;
    const next = before + insertion + after;
    const newCaret = before.length + insertion.length;
    onChange(next);
    setAutocomplete(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocomplete || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocomplete({
        ...autocomplete,
        activeIndex: (autocomplete.activeIndex + 1) % matches.length,
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocomplete({
        ...autocomplete,
        activeIndex:
          (autocomplete.activeIndex - 1 + matches.length) % matches.length,
      });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      acceptAutocomplete(matches[autocomplete.activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAutocomplete(null);
    }
  };

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
        <span className="md-sep" aria-hidden />
        <span className="md-hint" title="Type @ in the text to reference a role">
          @Role
        </span>
      </div>
      <div className="md-textarea-wrap">
        <textarea
          ref={textareaRef}
          className="md-textarea"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            syncAutocomplete(e.target.value, e.target.selectionEnd);
          }}
          onKeyUp={(e) => {
            const ta = e.currentTarget;
            syncAutocomplete(ta.value, ta.selectionEnd);
          }}
          onClick={(e) => {
            const ta = e.currentTarget;
            syncAutocomplete(ta.value, ta.selectionEnd);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay so a click on a menu item can register before close.
            setTimeout(() => setAutocomplete(null), 120);
          }}
          rows={rows}
          placeholder={placeholder}
        />
        {autocomplete && matches.length > 0 && (
          <ul className="md-autocomplete" role="listbox">
            {matches.map((name, i) => (
              <li
                key={name}
                className={`md-autocomplete-item${i === autocomplete.activeIndex ? ' md-autocomplete-active' : ''}`}
                role="option"
                aria-selected={i === autocomplete.activeIndex}
                onMouseDown={(e) => {
                  // Prevent blur from firing before the click.
                  e.preventDefault();
                  acceptAutocomplete(name);
                }}
              >
                @{name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
