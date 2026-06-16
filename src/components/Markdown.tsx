import { useMemo, type MouseEvent } from 'react';
import { marked } from 'marked';
import { useAppStore } from '../store/useAppStore';
import { preprocessRoleRefsForMarkdown } from '../utils/roleRefs';
import { preprocessTaskRefsForMarkdown } from '../utils/taskRefs';
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
  const selectTask = useAppStore((s) => s.selectTask);

  const html = useMemo(() => {
    if (!text.trim()) return '';
    let src = text;
    if (file) {
      // #TaskID first so the role pass (which injects `#hex` colour
      // values into span styles) can't be mistaken for a task ref.
      const validTaskIds = new Set(file.tasks.map((t) => t.taskId));
      const internalForTaskId = (taskId: string): string | null =>
        file.tasks.find((t) => t.taskId === taskId)?.id ?? null;
      src = preprocessTaskRefsForMarkdown(src, validTaskIds, internalForTaskId);
      if (file.roles.length > 0) {
        src = preprocessRoleRefsForMarkdown(src, file.roles, (roleName) => {
          const role = file.roles.find((r) => r.name === roleName);
          if (!role?.departmentId) return null;
          const dept = file.departments.find((d) => d.id === role.departmentId);
          return dept?.colour ?? null;
        });
      }
    }
    return marked.parse(src, { async: false }) as string;
  }, [text, file]);

  // Click delegation: a #TaskID reference selects that task. Broken
  // refs carry no internal id, so they're inert.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest('.task-ref');
    if (!el) return;
    const internal = el.getAttribute('data-task-internal');
    if (internal) selectTask(internal);
  };

  if (!html) return null;

  return (
    <div
      className={`markdown-body${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
