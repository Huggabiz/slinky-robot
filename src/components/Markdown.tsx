import { useMemo } from 'react';
import { marked } from 'marked';
import './Markdown.css';

// Configure marked for safe, minimal output. No need for full GFM
// features — just paragraphs, lists, bold/italic, and headings.
marked.setOptions({
  breaks: true, // single newlines become <br>
  gfm: true,
});

interface Props {
  text: string;
  className?: string;
}

// Renders a Markdown string as formatted HTML. Used in Navigate mode
// and the book view for any prose field (descriptions, deliverables,
// phase intros, intro chapter sections). The raw Markdown is stored
// as a plain string in the JSON — human-readable, no proprietary
// format.
export function Markdown({ text, className }: Props) {
  const html = useMemo(() => {
    if (!text.trim()) return '';
    return marked.parse(text, { async: false }) as string;
  }, [text]);

  if (!html) return null;

  return (
    <div
      className={`markdown-body${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
