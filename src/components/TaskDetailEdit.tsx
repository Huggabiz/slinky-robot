import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  ACTIVITY_TYPES,
  getAllRoleNames,
  getPhasesOrdered,
  getDependentTasks,
  type DeliverableTarget,
  type Task,
} from '../types';
import { tasksReferencingTaskId } from '../utils/taskRefs';
import { RolePicker, RoleMultiPicker } from './RolePicker';
import { MarkdownEditor } from './MarkdownEditor';
import './TaskDetailEdit.css';
import './TaskDetail.css';

// Edit-mode task form. All fields inline-save on change via the
// store's updateTask action, which marks the file dirty.
export function TaskDetailEdit({ task }: { task: Task }) {
  const file = useAppStore((s) => s.file);
  const updateTask = useAppStore((s) => s.updateTask);
  const renameTaskId = useAppStore((s) => s.renameTaskId);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const selectTask = useAppStore((s) => s.selectTask);

  // The display id commits on blur (not per keystroke) so the #id
  // reference cascade runs once against the original id, not against
  // every half-typed intermediate value.
  const [taskIdDraft, setTaskIdDraft] = useState(task.taskId);
  useEffect(() => {
    setTaskIdDraft(task.taskId);
  }, [task.id, task.taskId]);

  // Tasks whose prose references this one via #TaskID.
  const referencedIn = useMemo(() => {
    if (!file) return [];
    const ids = tasksReferencingTaskId(file, task.taskId, task.id);
    return file.tasks.filter((t) => ids.has(t.id));
  }, [file, task.taskId, task.id]);

  const phases = useMemo(
    () => (file ? getPhasesOrdered(file) : []),
    [file],
  );

  // Unified role suggestions: registry + every name used on any task.
  const allRoleNames = useMemo(
    () => (file ? getAllRoleNames(file) : []),
    [file],
  );

  if (!file) return null;

  const patch = (p: Partial<Task>) => updateTask(task.id, p);

  const removePrereq = (id: string) => {
    patch({ prerequisites: task.prerequisites.filter((p) => p !== id) });
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
            value={taskIdDraft}
            placeholder="Task ID"
            title="Changing the ID updates every #reference to this task"
            onChange={(e) => setTaskIdDraft(e.target.value)}
            onBlur={() => {
              if (taskIdDraft !== task.taskId) {
                renameTaskId(task.id, taskIdDraft);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
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
          placeholder="What does this task involve? Use @Role and #TaskID to reference roles and tasks."
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
            const unassigned = file.deliverableItems
              .filter((i) => !assignedIds.has(i.id) && i.states.length > 0)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            if (unassigned.length === 0) return null;
            const groups = [...(file.deliverableGroups ?? [])].sort(
              (a, b) => a.order - b.order,
            );
            const ungrouped = unassigned.filter((i) => !i.groupId);
            const hasGroups = groups.length > 0;
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
                {groups.map((g) => {
                  const items = unassigned.filter((i) => i.groupId === g.id);
                  if (items.length === 0) return null;
                  return (
                    <optgroup key={g.id} label={g.name}>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                {hasGroups && ungrouped.length > 0 ? (
                  <optgroup label="Ungrouped">
                    {ungrouped.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  ungrouped.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                )}
              </select>
            );
          })()}
        </Section>
      )}

      {(file.referencedDocs ?? []).length > 0 && (
        <Section title="Referenced Documentation">
          <div className="task-edit-refdocs">
            {[...(file.referencedDocs ?? [])]
              .sort((a, b) => a.order - b.order)
              .map((doc) => {
                const cited = (task.referencedDocs ?? []).includes(doc.id);
                return (
                  <label key={doc.id} className="task-edit-refdoc-row">
                    <input
                      type="checkbox"
                      checked={cited}
                      onChange={(e) => {
                        const set = new Set(task.referencedDocs ?? []);
                        if (e.target.checked) set.add(doc.id);
                        else set.delete(doc.id);
                        patch({ referencedDocs: [...set] });
                      }}
                    />
                    <span>{doc.name || '(untitled)'}</span>
                  </label>
                );
              })}
          </div>
          <p className="task-edit-hint">
            Tick the SOPs / sub-process docs this task references. Manage the
            library under <strong>Tools → Referenced Documentation</strong>.
          </p>
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
        {task.prerequisites.length === 0 ? (
          <p className="task-detail-muted">No prerequisites.</p>
        ) : (
          <ul className="task-link-list">
            {task.prerequisites
              .map((id) => file.tasks.find((t) => t.id === id))
              .filter((t): t is Task => t !== undefined)
              .map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="task-link"
                    onClick={() => selectTask(t.id)}
                  >
                    <span className="task-link-arrow">←</span>
                    <span className="task-link-id">{t.taskId}</span>
                    <span className="task-link-name">
                      {t.name || '(untitled)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="task-edit-prereq-remove"
                    onClick={() => removePrereq(t.id)}
                    title="Remove prerequisite"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        )}
        <p className="task-edit-hint">
          <strong>Ctrl+Click</strong> a task on the flow to add/remove
          prerequisites. <strong>Shift+Click</strong> to set this task as
          a prerequisite of the clicked task.
        </p>
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

      <Section title={`Referenced in (${referencedIn.length})`}>
        {referencedIn.length === 0 ? (
          <p className="task-detail-muted">
            No other task mentions this one with #{task.taskId}.
          </p>
        ) : (
          <ul className="task-link-list">
            {referencedIn.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="task-link"
                  onClick={() => selectTask(t.id)}
                >
                  <span className="task-link-arrow">#</span>
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
          Type <strong>#</strong> in any description or deliverable to
          reference another task.
        </p>
      </Section>

      <Section title="Danger zone">
        <button
          type="button"
          className="task-edit-delete-btn"
          onClick={() => {
            const refWarning =
              referencedIn.length > 0
                ? `\n\n⚠ ${referencedIn.length} other task${referencedIn.length === 1 ? '' : 's'} reference this one with #${task.taskId} ` +
                  `(${referencedIn.map((t) => t.taskId).join(', ')}). ` +
                  `Those references will be left dangling and shown in red until you fix them.`
                : '';
            const ok = window.confirm(
              `Delete "${task.taskId}: ${task.name || '(untitled)'}"?\n\n` +
                `Dependents will inherit this task's prerequisites so the flow stays connected.` +
                refWarning,
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
