import { type ReactNode, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ACTIVITY_TYPES,
  getAllRoleNames,
  getPhasesOrdered,
  getDependentTasks,
  type DeliverableTarget,
  type Task,
} from '../types';
import { RolePicker, RoleMultiPicker } from './RolePicker';
import { MarkdownEditor } from './MarkdownEditor';
import './TaskDetailEdit.css';
import './TaskDetail.css';

// Edit-mode task form. All fields inline-save on change via the
// store's updateTask action, which marks the file dirty.
export function TaskDetailEdit({ task }: { task: Task }) {
  const file = useAppStore((s) => s.file);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const selectTask = useAppStore((s) => s.selectTask);

  const phases = useMemo(
    () => (file ? getPhasesOrdered(file) : []),
    [file],
  );

  // Unified role suggestions: registry + every name used on any task.
  const allRoleNames = useMemo(
    () => (file ? getAllRoleNames(file) : []),
    [file],
  );

  // Eligible prereqs: exclude self and direct dependents (naive cycle
  // guard). Full transitive cycle check can come later.
  const eligiblePrereqs = useMemo(() => {
    if (!file) return [];
    const dependentIds = new Set(
      getDependentTasks(file, task).map((t) => t.id),
    );
    return file.tasks.filter(
      (t) => t.id !== task.id && !dependentIds.has(t.id),
    );
  }, [file, task]);

  const prereqSet = useMemo(
    () => new Set(task.prerequisites),
    [task.prerequisites],
  );

  if (!file) return null;

  const patch = (p: Partial<Task>) => updateTask(task.id, p);

  const togglePrereq = (id: string) => {
    const next = prereqSet.has(id)
      ? task.prerequisites.filter((p) => p !== id)
      : [...task.prerequisites, id];
    patch({ prerequisites: next });
  };

  const setDeliverableTarget = (
    itemId: string,
    state: string | null,
  ) => {
    const filtered = task.deliverableTargets.filter(
      (t) => t.itemId !== itemId,
    );
    const next: DeliverableTarget[] = state
      ? [...filtered, { itemId, state }]
      : filtered;
    patch({ deliverableTargets: next });
  };

  const dependents = getDependentTasks(file, task);

  return (
    <section className="task-detail task-detail-edit">
      <header className="task-detail-header">
        <div className="task-detail-breadcrumb">
          <select
            className="task-edit-phase-select"
            value={task.phaseId}
            onChange={(e) => patch({ phaseId: e.target.value })}
          >
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="task-detail-heading">
          <input
            type="text"
            className="task-edit-id-input"
            value={task.taskId}
            placeholder="Task ID"
            onChange={(e) => patch({ taskId: e.target.value })}
          />
          <input
            type="text"
            className="task-edit-name-input"
            value={task.name}
            placeholder="Task name"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
      </header>

      <Section title="Classification">
        <Field label="Activity type">
          <select
            className="task-edit-input"
            value={task.activityType}
            onChange={(e) => patch({ activityType: e.target.value })}
          >
            <option value="">— select —</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date type">
          <select
            className="task-edit-input"
            value={task.dateType}
            onChange={(e) => patch({ dateType: e.target.value })}
          >
            <option value="NONE">NONE</option>
            <option value="KEY DATE">KEY DATE</option>
            <option value="MS DATE">MS DATE</option>
          </select>
        </Field>
        {task.dateType !== 'NONE' && (
          <Field label="Abbreviation">
            <input
              type="text"
              className="task-edit-input"
              value={task.abbr ?? ''}
              placeholder="e.g. CR1, VA MS"
              onChange={(e) => patch({ abbr: e.target.value || null })}
            />
          </Field>
        )}
      </Section>

      <Section title="People">
        <Field label="Accountable">
          <RolePicker
            value={task.accountable}
            onChange={(v) => patch({ accountable: v })}
            suggestions={allRoleNames}
            placeholder="Who's accountable?"
          />
        </Field>
        <Field label="Contributors">
          <RoleMultiPicker
            value={task.contributors}
            onChange={(v) => patch({ contributors: v })}
            suggestions={allRoleNames}
          />
        </Field>
        <Field label="Meeting Organiser">
          <label className="task-edit-checkbox">
            <input
              type="checkbox"
              checked={task.isMeetingTask}
              onChange={(e) => {
                const checked = e.target.checked;
                patch({
                  isMeetingTask: checked,
                  meetingOrganiser: checked ? task.meetingOrganiser : null,
                });
              }}
            />
            <span>Meeting task</span>
          </label>
          {task.isMeetingTask && (
            <RolePicker
              value={task.meetingOrganiser ?? ''}
              onChange={(v) => patch({ meetingOrganiser: v || null })}
              suggestions={allRoleNames}
              placeholder="Who organises the meeting?"
            />
          )}
        </Field>
      </Section>

      <Section title="Description">
        <MarkdownEditor
          value={task.description}
          onChange={(v) => patch({ description: v })}
          rows={6}
          placeholder="What does this task involve? Use @Role to reference a role."
        />
      </Section>

      <Section title="Deliverables">
        <MarkdownEditor
          value={task.deliverables}
          onChange={(v) => patch({ deliverables: v })}
          rows={4}
          placeholder="What comes out of this task?"
        />
      </Section>

      {file.deliverableItems.length > 0 && (
        <Section title="Deliverable targets">
          {task.deliverableTargets.length > 0 && (
            <div className="task-edit-deliverable-list">
              {task.deliverableTargets.map((dt) => {
                const item = file.deliverableItems.find(
                  (i) => i.id === dt.itemId,
                );
                if (!item) return null;
                return (
                  <div key={dt.itemId} className="task-edit-deliverable-row">
                    <span className="task-edit-deliverable-name">
                      {item.name}
                    </span>
                    <select
                      className="task-edit-input"
                      value={dt.state}
                      onChange={(e) =>
                        setDeliverableTarget(dt.itemId, e.target.value || null)
                      }
                    >
                      {item.states.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="task-edit-deliverable-remove"
                      onClick={() => setDeliverableTarget(dt.itemId, null)}
                      aria-label={`Remove ${item.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {(() => {
            const assignedIds = new Set(
              task.deliverableTargets.map((dt) => dt.itemId),
            );
            const unassigned = file.deliverableItems.filter(
              (i) => !assignedIds.has(i.id) && i.states.length > 0,
            );
            if (unassigned.length === 0) return null;
            return (
              <select
                className="task-edit-input"
                value=""
                onChange={(e) => {
                  const itemId = e.target.value;
                  if (!itemId) return;
                  const item = file.deliverableItems.find(
                    (i) => i.id === itemId,
                  );
                  if (item && item.states.length > 0) {
                    setDeliverableTarget(itemId, item.states[0]);
                  }
                }}
              >
                <option value="">+ Add deliverable target…</option>
                {unassigned.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            );
          })()}
        </Section>
      )}

      {task.dateType !== 'NONE' && (
        <Section title="Key Date Rationale">
          <MarkdownEditor
            value={task.keyDateRationale ?? ''}
            onChange={(v) => patch({ keyDateRationale: v || null })}
            rows={3}
            placeholder="Why is this a key date?"
          />
        </Section>
      )}

      <Section title="References">
        <Field label="PDM Template">
          <input
            type="text"
            className="task-edit-input"
            value={task.pdmTemplate ?? ''}
            placeholder="(optional) path or template reference"
            onChange={(e) =>
              patch({ pdmTemplate: e.target.value || null })
            }
          />
        </Field>
      </Section>

      <Section title={`Prerequisites (${task.prerequisites.length})`}>
        <p className="task-edit-hint">
          Tick below, or <strong>Ctrl+Click</strong> (Cmd on Mac) tasks on
          the flow to toggle.
        </p>
        <div className="task-edit-prereq-list">
          {eligiblePrereqs.length === 0 ? (
            <p className="task-detail-muted">
              No other tasks available yet.
            </p>
          ) : (
            eligiblePrereqs.map((t) => (
              <label key={t.id} className="task-edit-prereq-row">
                <input
                  type="checkbox"
                  checked={prereqSet.has(t.id)}
                  onChange={() => togglePrereq(t.id)}
                />
                <span className="task-edit-prereq-id">{t.taskId}</span>
                <span className="task-edit-prereq-name">
                  {t.name || '(untitled)'}
                </span>
              </label>
            ))
          )}
        </div>
      </Section>

      <Section title={`Unlocks (${dependents.length})`}>
        {dependents.length === 0 ? (
          <p className="task-detail-muted">No downstream tasks.</p>
        ) : (
          <ul className="task-link-list">
            {dependents.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="task-link"
                  onClick={() => selectTask(t.id)}
                >
                  <span className="task-link-arrow">→</span>
                  <span className="task-link-id">{t.taskId}</span>
                  <span className="task-link-name">
                    {t.name || '(untitled)'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="task-edit-hint">
          Read-only — manage on the dependent task's Prerequisites.
        </p>
      </Section>

      <Section title="Danger zone">
        <button
          type="button"
          className="task-edit-delete-btn"
          onClick={() => {
            const ok = window.confirm(
              `Delete "${task.taskId}: ${task.name || '(untitled)'}"?\n\n` +
                `Dependents will inherit this task's prerequisites so the flow stays connected.`,
            );
            if (ok) deleteTask(task.id);
          }}
        >
          Delete this task
        </button>
      </Section>
    </section>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="task-edit-field">
      <span className="task-edit-field-label">{label}</span>
      {children}
    </div>
  );
}
