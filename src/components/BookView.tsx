import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  findTaskByInternalId,
  getPhasesOrdered,
  type DeliverableTarget,
  type IntroChapter,
  type ProcessFile,
  type Task,
} from '../types';
import { topoSortTasksInPhase } from '../utils/topoSort';
import { extractRoleRefs } from '../utils/roleRefs';
import { BookFlowDiagram } from './BookFlowDiagram';
import { BookPerspectivesSidebar } from './BookPerspectivesSidebar';
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
export function BookView() {
  const file = useAppStore((s) => s.file);

  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(
    () => new Set(),
  );

  // role name → department id. Rebuild when roles change.
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

  return (
    <div className="book-layout">
      <BookPerspectivesSidebar
        selectedDeptIds={selectedDeptIds}
        onChange={setSelectedDeptIds}
      />
      <article className="book-view">
        <header className="book-cover">
          <h1>{file.meta.title}</h1>
          {file.meta.masterName && file.meta.masterName !== file.meta.title && (
            <p className="book-cover-sub">{file.meta.masterName}</p>
          )}
          <p className="book-cover-date">
            Generated {new Date().toLocaleDateString()}
          </p>
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
            {phases.map((phase, idx) => (
              <li key={phase.id}>
                <a href={`#phase-${phase.id}`}>
                  <span className="book-toc-num">{introCount + idx + 1}.</span>{' '}
                  {phase.name}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {introChapters.map((ch, idx) => (
          <BookIntroChapter key={ch.id} chapter={ch} chapterNumber={idx + 1} />
        ))}

        {phases.map((phase, idx) => (
          <BookChapter
            key={phase.id}
            phase={phase}
            chapterNumber={introCount + idx + 1}
            file={file}
            selectedDeptIds={selectedDeptIds}
            roleToDeptId={roleToDeptId}
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
  selectedDeptIds: Set<string>,
  roleToDeptId: Map<string, string>,
): boolean {
  if (selectedDeptIds.size === 0) return true;

  const deptFor = (name: string | null | undefined): string | undefined =>
    name ? roleToDeptId.get(name) : undefined;

  const structural = [
    task.accountable,
    task.meetingOrganiser ?? '',
    ...task.contributors,
  ];
  for (const name of structural) {
    const d = deptFor(name);
    if (d && selectedDeptIds.has(d)) return true;
  }

  const prose = [
    task.description,
    task.deliverables,
    task.keyDateRationale ?? '',
  ].join('\n\n');
  if (prose.trim()) {
    const refs = extractRoleRefs(prose, file.roles);
    for (const refName of refs) {
      const d = deptFor(refName);
      if (d && selectedDeptIds.has(d)) return true;
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
  selectedDeptIds,
  roleToDeptId,
}: {
  phase: { id: string; name: string; intro: string; colour: string | null };
  chapterNumber: number;
  file: ProcessFile;
  selectedDeptIds: Set<string>;
  roleToDeptId: Map<string, string>;
}) {
  const allTasks = topoSortTasksInPhase(file, phase.id);
  const tasks = allTasks.filter((t) =>
    taskMatchesSelection(t, file, selectedDeptIds, roleToDeptId),
  );
  const filtered = selectedDeptIds.size > 0;

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

      <BookFlowDiagram phaseId={phase.id} phaseName={phase.name} />

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
