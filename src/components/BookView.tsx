import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  findTaskByInternalId,
  getPhasesOrdered,
  type DeliverableTarget,
  type IntroChapter,
  type ProcessFile,
  type Task,
} from '../types';
import { getPhaseDeliverableSummary } from '../utils/deliverableSummary';
import { pickImageFile, fileToDataUrl } from '../utils/imageUpload';
import { topoSortTasksInPhase } from '../utils/topoSort';
import { layoutTasks } from '../utils/flowLayout';
import { DEFAULT_LAB_CONFIG } from '../utils/flowLab';
import { extractRoleRefs } from '../utils/roleRefs';
import { BookFlowDiagram } from './BookFlowDiagram';
import { BookPerspectivesSidebar } from './BookPerspectivesSidebar';
import { BookReadingGuide } from './BookReadingGuide';
import { Markdown } from './Markdown';
import './BookView.css';

// Full-document reading view. Renders every phase as a chapter,
// each containing the phase intro plus an ordered sequence of task
// cards. Scrollable on screen, paginated on print via the CSS
// @media print rules in BookView.css.
//
// A left sidebar offers a multi-select department filter. When any
// departments are checked, only tasks whose involved roles belong
// to a checked department are rendered as step cards — intro
// chapters, chapter headers, intros, and flow diagrams are kept so
// the reader still has full context.
// Filter state for the book sidebar — supports both department-level
// and role-level selection. A task matches if any involved role either
// (a) belongs to a checked department, or (b) is individually checked.
export interface BookFilter {
  deptIds: Set<string>;
  roleNames: Set<string>;
}

const EMPTY_FILTER: BookFilter = {
  deptIds: new Set(),
  roleNames: new Set(),
};

function isFilterActive(f: BookFilter): boolean {
  return f.deptIds.size > 0 || f.roleNames.size > 0;
}

// Build a structured breakdown for the cover filter notice. Groups
// individual role selections under their parent department, and marks
// full-department selections distinctly from partial ones.
function FilterBreakdown({
  filter,
  file,
}: {
  filter: BookFilter;
  file: ProcessFile;
}) {
  // Build dept → roles mapping.
  const roleToDept = new Map<string, string>();
  const rolesByDeptId = new Map<string, string[]>();
  for (const role of file.roles) {
    if (role.departmentId) {
      roleToDept.set(role.name, role.departmentId);
      let list = rolesByDeptId.get(role.departmentId);
      if (!list) {
        list = [];
        rolesByDeptId.set(role.departmentId, list);
      }
      list.push(role.name);
    }
  }

  // Group selected role names by dept, identifying which depts are
  // fully selected vs partially.
  const groups: {
    deptName: string;
    full: boolean;
    roles: string[];
  }[] = [];

  for (const dept of file.departments) {
    const deptFull = filter.deptIds.has(dept.id);
    const deptRoles = rolesByDeptId.get(dept.id) ?? [];
    const selectedRoles = deptRoles.filter((r) =>
      filter.roleNames.has(r),
    );
    if (!deptFull && selectedRoles.length === 0) continue;
    groups.push({
      deptName: dept.name,
      full: deptFull,
      roles: deptFull ? [] : selectedRoles.sort(),
    });
  }

  // Roles without a department.
  const orphanRoles = [...filter.roleNames].filter(
    (r) => !roleToDept.has(r),
  );

  return (
    <ul className="book-cover-filter-list">
      {groups.map((g) => (
        <li key={g.deptName}>
          <strong>{g.deptName}</strong>
          {g.full ? ' (all roles)' : ''}
          {g.roles.length > 0 && (
            <ul className="book-cover-filter-roles">
              {g.roles.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
      {orphanRoles.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

export function BookView() {
  const file = useAppStore((s) => s.file);
  const mode = useAppStore((s) => s.mode);
  const updateMeta = useAppStore((s) => s.updateMeta);

  const [filter, setFilter] = useState<BookFilter>(EMPTY_FILTER);
  const [simplify, setSimplify] = useState(false);

  const roleToDeptId = useMemo(() => {
    const map = new Map<string, string>();
    if (!file) return map;
    for (const role of file.roles) {
      if (role.departmentId) map.set(role.name, role.departmentId);
    }
    return map;
  }, [file]);

  if (!file) return null;

  const phases = getPhasesOrdered(file);
  const introChapters = [...file.introChapters].sort(
    (a, b) => a.order - b.order,
  );
  const introCount = introChapters.length;
  const guideChapterNum = introCount + 1;
  const filtering = isFilterActive(filter);

  return (
    <div className="book-layout">
      <BookPerspectivesSidebar
        filter={filter}
        onChange={setFilter}
        simplify={simplify}
        onSimplifyChange={setSimplify}
      />
      <article className="book-view">
        <header
          className={`book-cover${file.meta.coverImage ? ' book-cover-has-image' : ''}`}
        >
          {file.meta.coverImage && (
            <img
              src={file.meta.coverImage}
              alt=""
              className="book-cover-bg-img"
            />
          )}
          <div className="book-cover-content">
            {file.meta.coverLogo && (
              <img
                src={file.meta.coverLogo}
                alt="Logo"
                className="book-cover-logo"
              />
            )}
            {mode === 'edit' && (
              <div className="book-cover-logo-controls">
                <button
                  type="button"
                  className="book-cover-image-btn"
                  onClick={async () => {
                    const f = await pickImageFile();
                    if (!f) return;
                    const dataUrl = await fileToDataUrl(f);
                    updateMeta({ coverLogo: dataUrl });
                  }}
                >
                  {file.meta.coverLogo ? 'Change logo' : 'Add logo'}
                </button>
                {file.meta.coverLogo && (
                  <button
                    type="button"
                    className="book-cover-image-btn"
                    onClick={() => updateMeta({ coverLogo: null })}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
            {mode === 'edit' ? (
              <>
                <div
                  className="book-cover-edit-field book-cover-edit-title"
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Document title"
                  onBlur={(e) => {
                    const text = e.currentTarget.textContent?.trim() ?? '';
                    if (text && text !== file.meta.title) updateMeta({ title: text });
                  }}
                  dangerouslySetInnerHTML={{ __html: file.meta.title }}
                />
                <div
                  className="book-cover-edit-field book-cover-edit-sub"
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Subtitle (optional)"
                  onBlur={(e) => {
                    const text = e.currentTarget.textContent?.trim() ?? '';
                    if (text !== file.meta.masterName) updateMeta({ masterName: text });
                  }}
                  dangerouslySetInnerHTML={{ __html: file.meta.masterName }}
                />
              </>
            ) : (
              <>
                <h1>{file.meta.title}</h1>
                {file.meta.masterName && file.meta.masterName !== file.meta.title && (
                  <p className="book-cover-sub">{file.meta.masterName}</p>
                )}
              </>
            )}
            <p className="book-cover-date">
              Generated {new Date().toLocaleDateString()}
            </p>
          </div>
          {filtering && (
            <div className="book-cover-filter-notice">
              <strong>Filtered view</strong> — this document shows a subset
              of the full process, filtered to the following:
              <FilterBreakdown filter={filter} file={file} />
            </div>
          )}
          {mode === 'edit' && (
            <div className="book-cover-image-controls">
              <button
                type="button"
                className="book-cover-image-btn"
                onClick={async () => {
                  const f = await pickImageFile();
                  if (!f) return;
                  const dataUrl = await fileToDataUrl(f);
                  updateMeta({ coverImage: dataUrl });
                }}
              >
                {file.meta.coverImage ? 'Change cover image' : 'Add cover image'}
              </button>
              {file.meta.coverImage && (
                <button
                  type="button"
                  className="book-cover-image-btn"
                  onClick={() => updateMeta({ coverImage: null })}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </header>

        <nav className="book-toc">
          <h2>Contents</h2>
          <ol>
            {introChapters.map((ch, idx) => (
              <li key={ch.id}>
                <a href={`#intro-${ch.id}`}>
                  <span className="book-toc-num">{idx + 1}.</span>{' '}
                  {ch.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#reading-guide">
                <span className="book-toc-num">{guideChapterNum}.</span>{' '}
                How to Read This Document
              </a>
            </li>
            {phases.map((phase, idx) => (
              <li key={phase.id}>
                <a href={`#phase-${phase.id}`}>
                  <span className="book-toc-num">{guideChapterNum + idx + 1}.</span>{' '}
                  {phase.name}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {introChapters.map((ch, idx) => (
          <BookIntroChapter key={ch.id} chapter={ch} chapterNumber={idx + 1} />
        ))}

        <BookReadingGuide chapterNumber={guideChapterNum} />

        {phases.map((phase, idx) => (
          <BookChapter
            key={phase.id}
            phase={phase}
            chapterNumber={guideChapterNum + idx + 1}
            file={file}
            filter={filter}
            roleToDeptId={roleToDeptId}
            simplify={simplify}
          />
        ))}
      </article>
    </div>
  );
}

// Does this task involve any role from any selected department? Tests
// structural slots (accountable / contributors / meetingOrganiser) and
// @-mentions in the task's prose fields. When no departments are
// selected, everything matches.
function taskMatchesSelection(
  task: Task,
  file: ProcessFile,
  filter: BookFilter,
  roleToDeptId: Map<string, string>,
): boolean {
  if (!isFilterActive(filter)) return true;

  const roleMatches = (name: string | null | undefined): boolean => {
    if (!name) return false;
    if (filter.roleNames.has(name)) return true;
    const d = roleToDeptId.get(name);
    return d !== undefined && filter.deptIds.has(d);
  };

  if (roleMatches(task.accountable)) return true;
  if (roleMatches(task.meetingOrganiser)) return true;
  for (const c of task.contributors) {
    if (roleMatches(c)) return true;
  }

  const prose = [
    task.description,
    task.deliverables,
    task.keyDateRationale ?? '',
  ].join('\n\n');
  if (prose.trim()) {
    const refs = extractRoleRefs(prose, file.roles);
    for (const refName of refs) {
      if (roleMatches(refName)) return true;
    }
  }

  return false;
}

function BookIntroChapter({
  chapter,
  chapterNumber,
}: {
  chapter: IntroChapter;
  chapterNumber: number;
}) {
  return (
    <section className="book-chapter" id={`intro-${chapter.id}`}>
      <header className="book-chapter-header">
        <div className="book-chapter-heading">
          <div className="book-chapter-number">Chapter {chapterNumber}</div>
          <h2>{chapter.title}</h2>
        </div>
      </header>

      {chapter.sections.length === 0 ? (
        <p className="book-empty">No sections in this chapter yet.</p>
      ) : (
        <div className="book-intro-sections">
          {chapter.sections.map((sec) => (
            <div key={sec.id} className="book-intro-section">
              {sec.title && (
                <h3 className="book-intro-section-title">{sec.title}</h3>
              )}
              {sec.subtitle && (
                <h4 className="book-intro-section-subtitle">{sec.subtitle}</h4>
              )}
              {sec.image && (
                <img
                  src={sec.image}
                  alt=""
                  className="book-intro-section-image"
                />
              )}
              {sec.body && <Markdown text={sec.body} className="book-step-prose" />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BookChapter({
  phase,
  chapterNumber,
  file,
  filter,
  roleToDeptId,
  simplify,
}: {
  phase: { id: string; name: string; intro: string; colour: string | null };
  chapterNumber: number;
  file: ProcessFile;
  filter: BookFilter;
  roleToDeptId: Map<string, string>;
  simplify: boolean;
}) {
  // Compute layout positions so the book ordering matches the visual
  // flow (Y then X) rather than taskId string order.
  const [positionMap, setPositionMap] = useState<
    Map<string, { x: number; y: number }>
  >(() => new Map());

  useEffect(() => {
    let cancelled = false;
    layoutTasks(file.tasks, phase.id, DEFAULT_LAB_CONFIG)
      .then((result) => {
        if (cancelled) return;
        const map = new Map<string, { x: number; y: number }>();
        for (const n of result.nodes) {
          map.set(n.id, { x: n.position.x, y: n.position.y });
        }
        setPositionMap(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [file, phase.id]);

  const allTasks = useMemo(
    () => topoSortTasksInPhase(file, phase.id, positionMap.size > 0 ? positionMap : undefined),
    [file, phase.id, positionMap],
  );
  const tasks = allTasks.filter((t) =>
    taskMatchesSelection(t, file, filter, roleToDeptId),
  );
  const filtered = isFilterActive(filter);

  return (
    <section className="book-chapter" id={`phase-${phase.id}`}>
      <header className="book-chapter-header">
        {phase.colour && (
          <span
            className="book-chapter-swatch"
            style={{ backgroundColor: phase.colour }}
            aria-hidden
          />
        )}
        <div className="book-chapter-heading">
          <div className="book-chapter-number">Chapter {chapterNumber}</div>
          <h2>{phase.name}</h2>
        </div>
      </header>

      {phase.intro && (
        <div className="book-chapter-intro">
          <Markdown text={phase.intro} className="book-step-prose" />
        </div>
      )}

      <PhaseDeliverableSummaryTable file={file} phaseId={phase.id} phaseName={phase.name} />

      <BookFlowDiagram
        phaseId={phase.id}
        phaseName={phase.name}
        highlightTaskIds={
          filtered
            ? new Set(tasks.map((t) => t.id))
            : null
        }
        collapseRelevantIds={
          simplify && filtered
            ? new Set(tasks.map((t) => t.id))
            : null
        }
      />

      {allTasks.length === 0 ? (
        <p className="book-empty">No tasks defined for this phase.</p>
      ) : tasks.length === 0 ? (
        <p className="book-empty">
          {filtered
            ? 'No tasks in this phase match the selected departments.'
            : 'No tasks to display.'}
        </p>
      ) : (
        <>
          {filtered && (
            <p className="book-filter-note">
              Showing {tasks.length} of {allTasks.length} tasks filtered
              by department.
            </p>
          )}
          <div className="book-step-list">
            {tasks.map((task) => (
              <BookStepCard key={task.id} task={task} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BookStepCard({ task }: { task: Task }) {
  const file = useAppStore((s) => s.file);
  if (!file) return null;

  const prereqRefs = task.prerequisites
    .map((id) => findTaskByInternalId(file, id))
    .filter((t): t is Task => t !== undefined);

  const dependentRefs = file.tasks.filter((t) =>
    t.prerequisites.includes(task.id),
  );

  return (
    <article
      className="book-step"
      id={`task-${task.id}`}
    >
      <header className="book-step-header">
        <div className="book-step-id-line">
          <span className="book-step-id">{task.taskId}</span>
          {task.activityType && (
            <span className="book-step-chip">{task.activityType}</span>
          )}
          {task.dateType && task.dateType !== 'NONE' && (
            <span className="book-step-chip book-step-chip-accent">
              {task.dateType}
            </span>
          )}
          {task.abbr && (
            <span className="book-step-chip book-step-chip-mono">
              {task.abbr}
            </span>
          )}
        </div>
        <h3 className="book-step-name">{task.name || '(untitled)'}</h3>
      </header>

      <dl className="book-step-meta">
        {task.accountable && (
          <MetaRow label="Accountable" value={task.accountable} />
        )}
        {task.contributors.length > 0 && (
          <MetaRow label="Contributors" items={task.contributors} />
        )}
        {task.isMeetingTask && task.meetingOrganiser && (
          <MetaRow label="Meeting Organiser" value={task.meetingOrganiser} />
        )}
        {task.pdmTemplate && (
          <MetaRow label="PDM Template" value={task.pdmTemplate} />
        )}
      </dl>

      {task.description && (
        <BookSection title="Description">
          <Markdown text={task.description} className="book-step-prose" />
        </BookSection>
      )}

      {task.deliverables && (
        <BookSection title="Deliverables">
          <Markdown text={task.deliverables} className="book-step-prose" />
        </BookSection>
      )}

      {task.deliverableTargets.length > 0 && (
        <BookSection title="Deliverable targets">
          <DeliverableTable
            targets={task.deliverableTargets}
            items={file.deliverableItems}
          />
        </BookSection>
      )}

      {task.keyDateRationale && (
        <BookSection title="Key date rationale">
          <Markdown text={task.keyDateRationale} className="book-step-prose" />
        </BookSection>
      )}

      <footer className="book-step-refs">
        {prereqRefs.length > 0 && (
          <div>
            <strong>Follows: </strong>
            {prereqRefs
              .map((t) => `${t.taskId}${t.name ? ` (${t.name})` : ''}`)
              .join('; ')}
          </div>
        )}
        {dependentRefs.length > 0 && (
          <div>
            <strong>Unlocks: </strong>
            {dependentRefs
              .map((t) => `${t.taskId}${t.name ? ` (${t.name})` : ''}`)
              .join('; ')}
          </div>
        )}
      </footer>
    </article>
  );
}

function PhaseDeliverableSummaryTable({
  file,
  phaseId,
  phaseName,
}: {
  file: ProcessFile;
  phaseId: string;
  phaseName: string;
}) {
  const rows = useMemo(
    () => getPhaseDeliverableSummary(file, phaseId),
    [file, phaseId],
  );
  if (rows.length === 0) return null;
  return (
    <div className="book-deliverable-summary">
      <h4 className="book-deliverable-summary-title">
        Deliverables required to exit {phaseName}
      </h4>
      <table className="book-step-table">
        <thead>
          <tr>
            <th>Deliverable</th>
            <th>Required State</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.itemId}>
              <td>{r.itemName}</td>
              <td>{r.requiredState}</td>
              <td>
                <span className="book-deliverable-progress">
                  {r.stateIndex + 1} / {r.totalStates}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetaRow({
  label,
  value,
  items,
}: {
  label: string;
  value?: string;
  items?: string[];
}) {
  if (items) {
    if (items.length === 0) return null;
    return (
      <div className="book-meta-row">
        <dt>{label}</dt>
        <dd>
          <ul className="book-meta-row-list">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </dd>
      </div>
    );
  }
  return (
    <div className="book-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function BookSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="book-step-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function DeliverableTable({
  targets,
  items,
}: {
  targets: DeliverableTarget[];
  items: { id: string; name: string }[];
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return (
    <table className="book-step-table">
      <thead>
        <tr>
          <th>Item</th>
          <th>State at this task</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((t) => (
          <tr key={t.itemId}>
            <td>{byId.get(t.itemId)?.name ?? '(unknown)'}</td>
            <td>{t.state}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
