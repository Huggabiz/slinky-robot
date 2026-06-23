import { type ReactNode, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  findPhaseById,
  getDependentTasks,
  getPrerequisiteTasks,
  type Task,
} from '../types';
import { tasksReferencingTaskId } from '../utils/taskRefs';
import { Markdown } from './Markdown';
import './TaskDetail.css';

// Read-only task view shown in Navigate mode. The edit-mode form is a
// separate component (TaskDetailEdit).
export function TaskDetailRead({ task }: { task: Task }) {
  const file = useAppStore((s) => s.file);
  const selectTask = useAppStore((s) => s.selectTask);

  // Tasks whose prose references this one via #TaskID.
  const referencedIn = useMemo(() => {
    if (!file) return [];
    const ids = tasksReferencingTaskId(file, task.taskId, task.id);
    return file.tasks.filter((t) => ids.has(t.id));
  }, [file, task.taskId, task.id]);

  if (!file) return null;

  const phase = findPhaseById(file, task.phaseId);
  const prereqs = getPrerequisiteTasks(file, task);
  const dependents = getDependentTasks(file, task);

  return (
    <section className="task-detail">
      <header className="task-detail-header">
        <div className="task-detail-breadcrumb">
          {phase?.name ?? 'Unknown phase'}
        </div>
        <div className="task-detail-heading">
          <span className="task-detail-id">{task.taskId}</span>
          <h1 className="task-detail-name">{task.name || '(untitled)'}</h1>
        </div>
        <div className="task-detail-chips">
          {task.activityType && (
            <span className="chip">{task.activityType}</span>
          )}
          {task.dateType && task.dateType !== 'NONE' && (
            <span className="chip chip-accent">{task.dateType}</span>
          )}
          {task.abbr && <span className="chip chip-mono">{task.abbr}</span>}
        </div>
      </header>

      <dl className="task-detail-meta">
        <MetaRow label="Accountable" value={task.accountable} />
        <MetaRow label="Contributors" items={task.contributors} />
        <MetaRow label="Meeting Organiser" value={task.meetingOrganiser} />
        <MetaRow label="PDM Template" value={task.pdmTemplate} />
      </dl>

      {task.description && (
        <Section title="Description">
          <Markdown text={task.description} />
        </Section>
      )}

      {task.deliverables && (
        <Section title="Deliverables">
          <Markdown text={task.deliverables} />
        </Section>
      )}

      {(() => {
        const cited = (task.referencedDocs ?? [])
          .map((id) => (file.referencedDocs ?? []).find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => d !== undefined);
        if (cited.length === 0) return null;
        return (
          <Section title="Referenced Documentation">
            <ul className="task-detail-refdocs">
              {cited.map((d) => (
                <li key={d.id}>
                  {d.name}
                  {d.link && (
                    <span className="task-detail-refdoc-link"> — {d.link}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        );
      })()}

      {task.keyDateRationale && (
        <Section title="Key Date Rationale">
          <Markdown text={task.keyDateRationale} />
        </Section>
      )}

      <Section title={`Follows (${prereqs.length})`}>
        {prereqs.length === 0 ? (
          <p className="task-detail-muted">No prerequisites.</p>
        ) : (
          <TaskLinkList
            tasks={prereqs}
            onSelect={selectTask}
            direction="up"
          />
        )}
      </Section>

      <Section title={`Unlocks (${dependents.length})`}>
        {dependents.length === 0 ? (
          <p className="task-detail-muted">No downstream tasks.</p>
        ) : (
          <TaskLinkList
            tasks={dependents}
            onSelect={selectTask}
            direction="down"
          />
        )}
      </Section>

      <Section title={`Referenced in (${referencedIn.length})`}>
        {referencedIn.length === 0 ? (
          <p className="task-detail-muted">
            No other task mentions this one with #{task.taskId}.
          </p>
        ) : (
          <TaskLinkList
            tasks={referencedIn}
            onSelect={selectTask}
            direction="ref"
          />
        )}
      </Section>
    </section>
  );
}

function MetaRow({
  label,
  value,
  items,
}: {
  label: string;
  value?: string | null;
  items?: string[];
}) {
  if (items) {
    if (items.length === 0) return null;
    return (
      <div className="meta-row">
        <dt>{label}</dt>
        <dd>
          <ul className="meta-row-list">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </dd>
      </div>
    );
  }
  if (!value) return null;
  return (
    <div className="meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="task-detail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TaskLinkList({
  tasks,
  onSelect,
  direction,
}: {
  tasks: Task[];
  onSelect: (id: string) => void;
  direction: 'up' | 'down' | 'ref';
}) {
  const arrow = direction === 'up' ? '←' : direction === 'ref' ? '#' : '→';
  return (
    <ul className="task-link-list">
      {tasks.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            className="task-link"
            onClick={() => onSelect(t.id)}
          >
            <span className="task-link-arrow">{arrow}</span>
            <span className="task-link-id">{t.taskId}</span>
            <span className="task-link-name">
              {t.name || '(untitled)'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
