import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getPhasesOrdered, getTasksInPhase } from '../types';
import { countTaskRefsPerRole } from '../utils/roleRefs';
import './RegistryPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Modal panel showing process statistics: task counts by phase,
// role workload, deliverable coverage.
export function StatsPanel({ isOpen, onClose }: Props) {
  const file = useAppStore((s) => s.file);

  const stats = useMemo(() => {
    if (!file) return null;

    const phases = getPhasesOrdered(file);
    const phaseStats = phases.map((p) => ({
      name: p.name,
      taskCount: getTasksInPhase(file, p.id).length,
    }));

    // Role workload — tasks per role, split into three columns:
    //   accountable  — task.accountable === role.name
    //   contributing — role appears in task.contributors
    //   referenced   — @role mention in any prose field (each task
    //                  counts once no matter how many mentions)
    const accountableCount = new Map<string, number>();
    const contributingCount = new Map<string, number>();
    for (const t of file.tasks) {
      if (t.accountable) {
        accountableCount.set(
          t.accountable,
          (accountableCount.get(t.accountable) ?? 0) + 1,
        );
      }
      const seen = new Set<string>();
      for (const c of t.contributors) {
        if (!c || seen.has(c)) continue;
        seen.add(c);
        contributingCount.set(c, (contributingCount.get(c) ?? 0) + 1);
      }
    }
    const referencedCount = countTaskRefsPerRole(file);

    const allRoleNames = new Set<string>([
      ...accountableCount.keys(),
      ...contributingCount.keys(),
      ...referencedCount.keys(),
    ]);
    const roleStats = [...allRoleNames]
      .map((name) => ({
        name,
        accountable: accountableCount.get(name) ?? 0,
        contributing: contributingCount.get(name) ?? 0,
        referenced: referencedCount.get(name) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.accountable + b.contributing + b.referenced -
          (a.accountable + a.contributing + a.referenced),
      )
      .slice(0, 20);

    // Deliverable coverage — how many tasks have targets set.
    const tasksWithTargets = file.tasks.filter(
      (t) => t.deliverableTargets.length > 0,
    ).length;
    const totalTasks = file.tasks.length;

    // Key dates.
    const keyDates = file.tasks.filter(
      (t) => t.dateType && t.dateType !== 'NONE',
    ).length;

    // Meeting tasks.
    const meetings = file.tasks.filter((t) => t.isMeetingTask).length;

    return {
      totalTasks,
      totalPhases: phases.length,
      phaseStats,
      roleStats,
      tasksWithTargets,
      keyDates,
      meetings,
      totalDeliverableItems: file.deliverableItems.length,
      totalRoles: file.roles.length,
      totalDepts: file.departments.length,
    };
  }, [file]);

  if (!isOpen || !file || !stats) return null;

  return (
    <div className="registry-backdrop" onClick={onClose}>
      <div
        className="registry-panel registry-panel-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Process Statistics"
      >
        <header className="registry-header">
          <h2>Process Statistics</h2>
          <button
            type="button"
            className="registry-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="registry-split">
          <section className="registry-section">
            <h3>Overview</h3>
            <table className="stats-table">
              <tbody>
                <StatRow label="Total tasks" value={stats.totalTasks} />
                <StatRow label="Milestone phases" value={stats.totalPhases} />
                <StatRow label="Key dates" value={stats.keyDates} />
                <StatRow label="Meeting tasks" value={stats.meetings} />
                <StatRow
                  label="Tasks with deliverable targets"
                  value={`${stats.tasksWithTargets} / ${stats.totalTasks}`}
                />
                <StatRow label="Deliverable items defined" value={stats.totalDeliverableItems} />
                <StatRow label="Departments" value={stats.totalDepts} />
                <StatRow label="Roles" value={stats.totalRoles} />
              </tbody>
            </table>

            <h3 style={{ marginTop: 16 }}>Tasks by phase</h3>
            <table className="stats-table">
              <tbody>
                {stats.phaseStats.map((p) => (
                  <StatRow key={p.name} label={p.name} value={p.taskCount} />
                ))}
              </tbody>
            </table>
          </section>

          <section className="registry-section">
            <h3>Role workload (top 20)</h3>
            <p className="registry-hint">
              Tasks per role, split by how the role is involved. Referenced = the role is
              mentioned via <code>@Name</code> in a task's description, deliverables or
              key-date rationale. A task counts once per role per column regardless of
              how many times it repeats within that task.
            </p>
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="stats-label">Role</th>
                  <th className="stats-value">Accountable</th>
                  <th className="stats-value">Contributing</th>
                  <th className="stats-value">Referenced</th>
                </tr>
              </thead>
              <tbody>
                {stats.roleStats.map((r) => (
                  <tr key={r.name} className="stats-row">
                    <td className="stats-label">{r.name}</td>
                    <td className="stats-value">{r.accountable || ''}</td>
                    <td className="stats-value">{r.contributing || ''}</td>
                    <td className="stats-value">{r.referenced || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <tr className="stats-row">
      <td className="stats-label">{label}</td>
      <td className="stats-value">{value}</td>
    </tr>
  );
}
