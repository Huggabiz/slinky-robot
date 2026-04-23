import { useMemo } from 'react';
import { marked } from 'marked';
import { useAppStore } from '../store/useAppStore';
import { preprocessRoleRefsForMarkdown } from '../utils/roleRefs';
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
//
// @Role references in the prose get turned into inline spans tinted
// by the role's department colour. The preprocess happens before
// marked.parse so the spans travel through as inline HTML.
export function Markdown({ text, className }: Props) {
  const file = useAppStore((s) => s.file);

  const html = useMemo(() => {
    if (!text.trim()) return '';
    let src = text;
    if (file && file.roles.length > 0) {
      src = preprocessRoleRefsForMarkdown(src, file.roles, (roleName) => {
        const role = file.roles.find((r) => r.name === roleName);
        if (!role?.departmentId) return null;
        const dept = file.departments.find((d) => d.id === role.departmentId);
        return dept?.colour ?? null;
      });
    }
    return marked.parse(src, { async: false }) as string;
  }, [text, file]);

  if (!html) return null;

  return (
    <div
      className={`markdown-body${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
