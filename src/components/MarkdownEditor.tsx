import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Role } from '../types';
import { looksLikeTaskId } from '../utils/taskRefs';
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Break raw text into runs: plain strings and @Role tokens. Used by the
// backdrop div that sits behind the transparent textarea so the user
// can see where each role reference starts and ends.
function tokenizeRoleRefs(
  text: string,
  roles: Role[],
  colourForRole: (name: string) => string | null,
): ReactNode[] {
  if (!text) return [];
  const names = roles
    .map((r) => r.name)
    .filter((n) => n.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return [text];

  const alt = names.map(escapeRegExp).join('|');
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_])@(${alt})(?![A-Za-z0-9_])`,
    'g',
  );

  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const matchStart = match.index;
    const prefix = match[1];
    const name = match[2];
    const atIndex = matchStart + prefix.length;
    const endIndex = atIndex + 1 + name.length;

    if (atIndex > lastIndex) {
      out.push(text.slice(lastIndex, atIndex));
    }
    const colour = colourForRole(name);
    const style = colour
      ? ({ ['--role-ref-colour' as string]: colour } as CSSProperties)
      : undefined;
    out.push(
      <span
        key={`r${key++}`}
        className="md-highlight-role-token"
        style={style}
      >
        @{name}
      </span>,
    );
    lastIndex = endIndex;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out;
}

// Split a plain string into runs, tinting each #TaskID run. Valid ids
// (in validTaskIds) tint teal; id-shaped-but-unknown tokens tint as
// broken; incidental "#word" / "#1" is left untouched. seg disambiguates
// React keys across the multiple string segments we tokenise.
function tokenizeTaskRefs(
  text: string,
  validTaskIds: Set<string>,
  seg: number,
): ReactNode[] {
  const pattern = /(^|[^A-Za-z0-9_])#([A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?)/g;
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const prefix = match[1];
    const token = match[2];
    const valid = validTaskIds.has(token);
    if (!valid && !looksLikeTaskId(token)) continue; // leave plain text
    const hashIndex = match.index + prefix.length;
    const endIndex = hashIndex + 1 + token.length;
    if (hashIndex > lastIndex) out.push(text.slice(lastIndex, hashIndex));
    out.push(
      <span
        key={`t${seg}-${key++}`}
        className={`md-highlight-task-token${valid ? '' : ' md-highlight-task-token-broken'}`}
      >
        #{token}
      </span>,
    );
    lastIndex = endIndex;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

// Compose the two: tokenise @Role refs first, then split any remaining
// plain-string runs by #TaskID refs.
function tokenizeRefs(
  text: string,
  roles: Role[],
  validTaskIds: Set<string>,
  colourForRole: (name: string) => string | null,
): ReactNode[] {
  const roleNodes = tokenizeRoleRefs(text, roles, colourForRole);
  const out: ReactNode[] = [];
  roleNodes.forEach((node, i) => {
    if (typeof node === 'string') {
      out.push(...tokenizeTaskRefs(node, validTaskIds, i));
    } else {
      out.push(node);
    }
  });
  return out;
}

// Textarea with a Markdown formatting toolbar. Buttons insert syntax
// at the cursor or wrap the current selection. No WYSIWYG — the user
// sees raw Markdown in the textarea and the result renders via the
// Markdown component elsewhere.
//
// Also supports @Role autocomplete: typing `@` followed by one or more
// characters opens a popover of matching roles. Pick one with mouse
// or arrow keys + Enter/Tab to replace the fragment with the full
// role name. A highlight backdrop sits behind the textarea so each
// @Role run is visibly tinted even while typing.
export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const file = useAppStore((s) => s.file);
  const roles = file?.roles ?? [];
  const tasks = file?.tasks ?? [];

  const validTaskIds = useMemo(
    () => new Set(tasks.map((t) => t.taskId).filter((id) => id.trim() !== '')),
    [tasks],
  );

  const colourForRole = (roleName: string): string | null => {
    if (!file) return null;
    const role = file.roles.find((r) => r.name === roleName);
    if (!role?.departmentId) return null;
    const dept = file.departments.find((d) => d.id === role.departmentId);
    return dept?.colour ?? null;
  };

  // The backdrop and the textarea render the same text, but the
  // backdrop renders each @Role as a tinted span. When the textarea
  // ends with a newline, that trailing empty line is invisible in a
  // div with white-space: pre-wrap — append a space so the backdrop
  // height matches the textarea height.
  const displayNodes = useMemo(
    () => tokenizeRefs(
      value.endsWith('\n') ? value + ' ' : value,
      roles,
      validTaskIds,
      colourForRole,
    ),
    [value, roles, validTaskIds, file],
  );

  // Auto-grow: resize the textarea to fit content so it never needs
  // an internal scrollbar. The parent wrapper (.md-textarea-wrap)
  // handles scrolling when the content exceeds its max-height. With
  // no scrollbar inside the textarea, its content width matches the
  // backdrop's exactly and text wraps identically.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [value]);

  // Autocomplete state. When non-null, a popover is shown and keys
  // (ArrowUp/Down/Enter/Tab/Escape) are intercepted on the textarea.
  // `trigger` distinguishes @Role from #TaskID mentions.
  const [autocomplete, setAutocomplete] = useState<{
    trigger: '@' | '#';
    query: string;
    fragmentStart: number; // index of the trigger char in value
    activeIndex: number;
  } | null>(null);

  // A unified suggestion: `insert` is the text placed after the trigger,
  // `display` is the popover label (already prefixed with the trigger).
  const matches = useMemo<
    { key: string; insert: string; display: string }[]
  >(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase();
    if (autocomplete.trigger === '#') {
      // Dedupe by display id (ids can collide) and rank prefix-first.
      const seen = new Set<string>();
      const items: { id: string; name: string }[] = [];
      for (const t of tasks) {
        if (!t.taskId.trim() || seen.has(t.taskId)) continue;
        seen.add(t.taskId);
        items.push({ id: t.taskId, name: t.name });
      }
      const prefix = items.filter((it) => it.id.toLowerCase().startsWith(q));
      const inner = items.filter(
        (it) =>
          !it.id.toLowerCase().startsWith(q) &&
          (it.id.toLowerCase().includes(q) ||
            it.name.toLowerCase().includes(q)),
      );
      return [...prefix, ...inner].slice(0, 8).map((it) => ({
        key: it.id,
        insert: it.id,
        display: `#${it.id}${it.name ? ` — ${it.name}` : ''}`,
      }));
    }
    const names = roles.map((r) => r.name);
    const prefix = names.filter((n) => n.toLowerCase().startsWith(q));
    const inner = names.filter(
      (n) =>
        !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q),
    );
    return [...prefix, ...inner].slice(0, 8).map((n) => ({
      key: n,
      insert: n,
      display: `@${n}`,
    }));
  }, [autocomplete, roles, tasks]);

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
    // Walk back from caret collecting fragment chars until we hit a
    // trigger (`@` for roles, `#` for tasks) that's at string start or
    // preceded by a non-word char. The fragment is whatever follows the
    // trigger up to the caret. Role names allow spaces; task ids don't,
    // but the permissive walk-back is fine — a fragment that can't match
    // anything just yields an empty (hidden) popover.
    let i = caret - 1;
    let fragment = '';
    while (i >= 0) {
      const ch = nextValue[i];
      if (ch === '@' || ch === '#') {
        const before = i === 0 ? '' : nextValue[i - 1];
        if (!before || /[^A-Za-z0-9_]/.test(before)) {
          const trigger = ch as '@' | '#';
          setAutocomplete((prev) => ({
            trigger,
            query: fragment,
            fragmentStart: i,
            activeIndex: prev?.activeIndex ?? 0,
          }));
          return;
        }
        break;
      }
      // Allow letters, digits, spaces, dashes, and the id punctuation
      // (._) so both role names and task ids can be typed mid-fragment.
      if (!/[A-Za-z0-9 _.\-&()]/.test(ch)) break;
      if (ch === '\n') break;
      fragment = ch + fragment;
      i--;
    }
    setAutocomplete(null);
  };

  const acceptAutocomplete = (suggestion: {
    insert: string;
  }) => {
    if (!autocomplete) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionEnd;
    const before = value.slice(0, autocomplete.fragmentStart);
    const after = value.slice(caret);
    const insertion = `${autocomplete.trigger}${suggestion.insert}`;
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
        <span
          className="md-hint"
          title="Type @ to reference a role, # to reference a task"
        >
          @Role&ensp;#Task
        </span>
      </div>
      <div className="md-textarea-wrap">
        <div className="md-highlight-backdrop" aria-hidden>
          {displayNodes}
        </div>
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
          spellCheck
        />
        {autocomplete && matches.length > 0 && (
          <ul className="md-autocomplete" role="listbox">
            {matches.map((s, i) => (
              <li
                key={s.key}
                className={`md-autocomplete-item${i === autocomplete.activeIndex ? ' md-autocomplete-active' : ''}`}
                role="option"
                aria-selected={i === autocomplete.activeIndex}
                onMouseDown={(e) => {
                  // Prevent blur from firing before the click.
                  e.preventDefault();
                  acceptAutocomplete(s);
                }}
              >
                {s.display}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
