import { useAppStore } from '../store/useAppStore';
import {
  findTaskByInternalId,
  getPhasesOrdered,
  type DeliverableTarget,
  type IntroChapter,
  type Task,
} from '../types';
import { topoSortTasksInPhase } from '../utils/topoSort';
import { BookFlowDiagram } from './BookFlowDiagram';
import { Markdown } from './Markdown';
import './BookView.css';

// Full-document reading view. Renders every phase as a chapter,
// each containing the phase intro plus an ordered sequence of task
// cards. Scrollable on screen, paginated on print via the CSS
// @media print rules in BookView.css.
export function BookView() {
  const file = useAppStore((s) => s.file);
  if (!file) return null;

  const phases = getPhasesOrdered(file);
  const introChapters = [...file.introChapters].sort(
    (a, b) => a.order - b.order,
  );
  const introCount = introChapters.length;

  return (
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
        />
      ))}
    </article>
  );
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
}: {
  phase: { id: string; name: string; intro: string; colour: string | null };
  chapterNumber: number;
}) {
  const file = useAppStore((s) => s.file);
  if (!file) return null;

  const tasks = topoSortTasksInPhase(file, phase.id);

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

      <BookFlowDiagram phaseId={phase.id} />

      {tasks.length === 0 ? (
        <p className="book-empty">No tasks defined for this phase.</p>
      ) : (
        <div className="book-step-list">
          {tasks.map((task) => (
            <BookStepCard key={task.id} task={task} />
          ))}
        </div>
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
          <MetaRow
            label="Contributors"
            value={task.contributors.join(', ')}
          />
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

function MetaRow({ label, value }: { label: string; value: string }) {
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
