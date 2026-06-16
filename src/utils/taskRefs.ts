import type { ProcessFile } from '../types';

// #TaskID references in prose. The task analogue of roleRefs.ts. A
// reference is `#` followed by a task's display id (task.taskId, e.g.
// "10.045" or "FM_280"). The `#` must be preceded by start-of-string or
// a non-word character, and the id token must start AND end with an
// alphanumeric — so a trailing sentence period in "see #10.045." isn't
// swallowed, and incidental fragments ("C#", "#fff", "#1") don't match.

// Captures group 1 = the boundary char (re-emitted on replace), group 2
// = the id token. A token is a single alphanumeric, or alphanumeric…
// alphanumeric with `._-` allowed in between. Fresh instance each call
// because a global RegExp carries lastIndex state between uses.
function candidateMatcher(): RegExp {
  return /(^|[^A-Za-z0-9_])#([A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?)/g;
}

// A token "looks like" a task id (rather than an incidental hashtag)
// when it carries an internal separator — every id format the app
// produces has one ("<order>.<nnn>" or imported "FM_280"). Used to flag
// broken references without lighting up ordinary "#1" / "#todo" text.
export function looksLikeTaskId(token: string): boolean {
  return /[._-]/.test(token);
}

// Task ids referenced in the prose that resolve to a real task. Deduped.
export function extractTaskRefs(
  prose: string,
  validIds: Set<string>,
): Set<string> {
  const found = new Set<string>();
  if (!prose) return found;
  for (const m of prose.matchAll(candidateMatcher())) {
    if (validIds.has(m[2])) found.add(m[2]);
  }
  return found;
}

// Replace every #oldId in the prose with #newId, using the exact same
// tokenisation as detection so "#10.045." renames but "#10.045.2"
// (a different, longer id) is left alone.
export function renameTaskRefInProse(
  prose: string,
  oldId: string,
  newId: string,
): string {
  if (!prose || !oldId || oldId === newId) return prose;
  return prose.replace(candidateMatcher(), (m, pre, token) =>
    token === oldId ? `${pre}#${newId}` : m,
  );
}

// Walk every prose field and rewrite #oldId → #newId. Mirrors
// renameRoleInFile — used by the store when a task's display id changes
// so cross-references in other tasks' text track the rename.
export function renameTaskRefInFile(
  file: ProcessFile,
  oldId: string,
  newId: string,
): ProcessFile {
  if (!oldId || oldId === newId) return file;
  const rewrite = (s: string | null): string | null =>
    s == null ? s : renameTaskRefInProse(s, oldId, newId);

  return {
    ...file,
    tasks: file.tasks.map((t) => ({
      ...t,
      description: renameTaskRefInProse(t.description, oldId, newId),
      deliverables: renameTaskRefInProse(t.deliverables, oldId, newId),
      keyDateRationale: rewrite(t.keyDateRationale) as string | null,
    })),
    phases: file.phases.map((p) => ({
      ...p,
      intro: renameTaskRefInProse(p.intro, oldId, newId),
    })),
    introChapters: file.introChapters.map((c) => ({
      ...c,
      sections: c.sections.map((s) => ({
        ...s,
        body: renameTaskRefInProse(s.body, oldId, newId),
      })),
    })),
  };
}

// Internal ids of tasks whose prose references the given display id.
// Optionally excludes a task (so a task doesn't list itself).
export function tasksReferencingTaskId(
  file: ProcessFile,
  taskId: string,
  excludeInternalId?: string,
): Set<string> {
  const matched = new Set<string>();
  if (!taskId) return matched;
  const one = new Set([taskId]);
  for (const t of file.tasks) {
    if (t.id === excludeInternalId) continue;
    const prose = [
      t.description,
      t.deliverables,
      t.keyDateRationale ?? '',
    ].join('\n\n');
    if (extractTaskRefs(prose, one).has(taskId)) matched.add(t.id);
  }
  return matched;
}

// Preprocess raw Markdown so every #TaskID becomes an inline
// <span class="task-ref">. Valid refs carry data-task-internal for
// click-to-navigate; ids that look like a task id but no longer resolve
// get the "task-ref-broken" class so deleted-task references stay
// visible and fixable. Mirrors preprocessRoleRefsForMarkdown.
export function preprocessTaskRefsForMarkdown(
  text: string,
  validIds: Set<string>,
  internalIdForTaskId: (taskId: string) => string | null,
): string {
  if (!text) return text;
  return text.replace(candidateMatcher(), (m, pre, token) => {
    if (validIds.has(token)) {
      const internal = internalIdForTaskId(token);
      const dataInternal = internal
        ? ` data-task-internal="${escapeHtmlAttr(internal)}"`
        : '';
      return `${pre}<span class="task-ref" data-task-id="${escapeHtmlAttr(token)}"${dataInternal}>#${escapeHtmlText(token)}</span>`;
    }
    if (looksLikeTaskId(token)) {
      return `${pre}<span class="task-ref task-ref-broken" data-task-id="${escapeHtmlAttr(token)}" title="Unknown task #${escapeHtmlAttr(token)} — this reference is broken">#${escapeHtmlText(token)}</span>`;
    }
    return m;
  });
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
