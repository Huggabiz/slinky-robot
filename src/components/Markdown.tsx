import { useMemo } from 'react';
import { marked } from 'marked';
import './Markdown.css';

// Configure marked for clean output. GFM enabled for tables and
// strikethrough; breaks OFF so list items don't get inflated with
// extra <br> tags between them. Users who want a hard line break
// within a paragraph can use two trailing spaces or a blank line.
marked.setOptions({
  breaks: false,
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
