import type { ProcessFile, Role } from '../types';

// @Role references in prose. We recognise `@<role name>` where the role
// name exactly matches an existing Role.name. The `@` must be preceded
// by start-of-string or a non-word character, and the role name must be
// followed by a non-word character (so `@PM` in `@PMO` doesn't match).
// Role names are matched longest-first so that "Project Manager" wins
// over "Project" when both exist.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build one big alternation regex of all role names, longest first, so
// a single pass can find every @reference.
function buildMatcher(roleNames: string[]): RegExp | null {
  const names = [...roleNames]
    .filter((n) => n.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  const alt = names.map(escapeRegExp).join('|');
  return new RegExp(`(^|[^A-Za-z0-9_])@(${alt})(?![A-Za-z0-9_])`, 'g');
}

// Role names matched in the given prose. Dedup, so a role mentioned
// five times in one string contributes a single entry.
export function extractRoleRefs(prose: string, roles: Role[]): Set<string> {
  if (!prose) return new Set();
  const matcher = buildMatcher(roles.map((r) => r.name));
  if (!matcher) return new Set();
  const found = new Set<string>();
  for (const m of prose.matchAll(matcher)) {
    found.add(m[2]);
  }
  return found;
}

// Replace every @oldName in the prose with @newName, respecting the
// same word-boundary rules used for detection. Other roles in the same
// prose are left untouched.
export function renameRoleInProse(
  prose: string,
  oldName: string,
  newName: string,
): string {
  if (!prose || !oldName || oldName === newName) return prose;
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9_])@(${escapeRegExp(oldName)})(?![A-Za-z0-9_])`,
    'g',
  );
  return prose.replace(pattern, (_m, pre) => `${pre}@${newName}`);
}

// Walk every prose field in the file and rewrite @oldName → @newName.
// Returns a new ProcessFile with updated tasks, phases, intro chapters.
// Used by the store when a role is renamed or merged.
export function renameRoleInFile(
  file: ProcessFile,
  oldName: string,
  newName: string,
): ProcessFile {
  if (!oldName || oldName === newName) return file;
  const rewrite = (s: string | null): string | null =>
    s == null ? s : renameRoleInProse(s, oldName, newName);

  return {
    ...file,
    tasks: file.tasks.map((t) => ({
      ...t,
      description: renameRoleInProse(t.description, oldName, newName),
      deliverables: renameRoleInProse(t.deliverables, oldName, newName),
      keyDateRationale: rewrite(t.keyDateRationale) as string | null,
    })),
    phases: file.phases.map((p) => ({
      ...p,
      intro: renameRoleInProse(p.intro, oldName, newName),
    })),
    introChapters: file.introChapters.map((c) => ({
      ...c,
      sections: c.sections.map((s) => ({
        ...s,
        body: renameRoleInProse(s.body, oldName, newName),
      })),
    })),
  };
}

// Count, per role, how many tasks mention it via @Role in any prose
// field. Each task contributes at most 1 per role regardless of how
// many times the role is repeated inside the task's prose.
export function countTaskRefsPerRole(file: ProcessFile): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of file.tasks) {
    const prose = [
      task.description,
      task.deliverables,
      task.keyDateRationale ?? '',
    ].join('\n\n');
    const refs = extractRoleRefs(prose, file.roles);
    for (const name of refs) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

// Return the set of task ids that reference the given role name in any
// prose field. Used for "find tasks that mention this role" searches.
export function tasksReferencingRole(
  file: ProcessFile,
  roleName: string,
): Set<string> {
  const matched = new Set<string>();
  if (!roleName) return matched;
  const oneName = file.roles.filter((r) => r.name === roleName);
  if (oneName.length === 0) return matched;
  for (const task of file.tasks) {
    const prose = [
      task.description,
      task.deliverables,
      task.keyDateRationale ?? '',
    ].join('\n\n');
    if (extractRoleRefs(prose, oneName).has(roleName)) {
      matched.add(task.id);
    }
  }
  return matched;
}

// Preprocess raw Markdown source so that every @Role reference becomes
// an inline <span class="role-ref" ...> before marked.parse runs. The
// span carries data-role for click handling and inline colour styling
// matching the role's department (if any). Marked passes inline HTML
// through untouched, so the span survives to the DOM.
//
// Department colour lookup is provided by the caller rather than baked
// in, so the Markdown component doesn't need to know about the shape
// of the file.
export function preprocessRoleRefsForMarkdown(
  text: string,
  roles: Role[],
  colourForRole: (roleName: string) => string | null,
): string {
  if (!text) return text;
  const matcher = buildMatcher(roles.map((r) => r.name));
  if (!matcher) return text;
  return text.replace(matcher, (_m, pre, name) => {
    const colour = colourForRole(name);
    const styleAttr = colour
      ? ` style="--role-ref-colour: ${colour}"`
      : '';
    return `${pre}<span class="role-ref" data-role="${escapeHtmlAttr(name)}"${styleAttr}>@${escapeHtmlText(name)}</span>`;
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
