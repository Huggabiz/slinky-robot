import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getPhasesOrdered, getTasksInPhase } from '../types';
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

    // Role workload — count how many tasks each role appears on.
    const roleCount = new Map<string, number>();
    for (const t of file.tasks) {
      if (t.accountable) {
        roleCount.set(t.accountable, (roleCount.get(t.accountable) ?? 0) + 1);
      }
      for (const c of t.contributors) {
        if (c) roleCount.set(c, (roleCount.get(c) ?? 0) + 1);
      }
    }
    const roleStats = [...roleCount.entries()]
      .sort((a, b) => b[1] - a[1])
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
              Count of tasks each role appears on (accountable + contributor).
            </p>
            <table className="stats-table">
              <tbody>
                {stats.roleStats.map(([name, count]) => (
                  <StatRow key={name} label={name} value={count} />
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
