import { type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  findPhaseById,
  findTaskByInternalId,
  getDependentTasks,
  getPrerequisiteTasks,
  type Task,
} from '../types';
import './TaskDetail.css';

export function TaskDetail() {
  const file = useAppStore((s) => s.file);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);

  if (!file) return null;

  const task = selectedTaskId
    ? (findTaskByInternalId(file, selectedTaskId) ?? null)
    : null;

  if (!task) {
    return (
      <section className="task-detail task-detail-empty">
        <p>Pick a task from the sidebar to see its details.</p>
      </section>
    );
  }

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
        <MetaRow
          label="Contributors"
          value={task.contributors.join(', ')}
        />
        <MetaRow label="Meeting Organiser" value={task.meetingOrganiser} />
        <MetaRow label="PDM Template" value={task.pdmTemplate} />
        <MetaRow label="Function" value={task.function} />
      </dl>

      {task.description && (
        <Section title="Description">
          <Prose text={task.description} />
        </Section>
      )}

      {task.deliverables && (
        <Section title="Deliverables">
          <Prose text={task.deliverables} />
        </Section>
      )}

      {task.keyDateRationale && (
        <Section title="Key Date Rationale">
          <Prose text={task.keyDateRationale} />
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
    </section>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
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

function Prose({ text }: { text: string }) {
  return <p className="task-detail-prose">{text}</p>;
}

function TaskLinkList({
  tasks,
  onSelect,
  direction,
}: {
  tasks: Task[];
  onSelect: (id: string) => void;
  direction: 'up' | 'down';
}) {
  const arrow = direction === 'up' ? '←' : '→';
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
