import { useAppStore } from '../store/useAppStore';
import type { PerspectiveFilter } from '../utils/perspective';
import './FlowToolbar.css';

// Props shape is kept explicit rather than using a single config object
// so future tools (colour legend, layer hints, etc.) can be added as
// sibling controls without reshaping a shared config.
interface Props {
  highlightEnabled: boolean;
  onHighlightChange: (enabled: boolean) => void;
  fadeOver: number | null;
  onFadeChange: (fade: number | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  perspectiveFilter: PerspectiveFilter | null;
}

export function FlowToolbar({
  highlightEnabled,
  onHighlightChange,
  fadeOver,
  onFadeChange,
  searchQuery,
  onSearchChange,
  perspectiveFilter,
}: Props) {
  const file = useAppStore((s) => s.file);

  // Resolve the colour and label for the active perspective so the
  // legend's swatches match what the canvas actually shows. Only the
  // 'department' and 'role' filters surface the four-tier hierarchy
  // (accountable / contributor / meeting organiser / referenced) — the
  // other filter modes use their own scheme and don't need a legend.
  let perspectiveLegend: { label: string; colour: string } | null = null;
  if (file && perspectiveFilter) {
    if (perspectiveFilter.type === 'department') {
      const dept = file.departments.find(
        (d) => d.id === perspectiveFilter.departmentId,
      );
      if (dept?.colour) {
        perspectiveLegend = { label: dept.name, colour: dept.colour };
      }
    } else if (perspectiveFilter.type === 'role') {
      const role = file.roles.find((r) => r.name === perspectiveFilter.roleName);
      const dept = role?.departmentId
        ? file.departments.find((d) => d.id === role.departmentId)
        : undefined;
      if (dept?.colour) {
        perspectiveLegend = { label: role!.name, colour: dept.colour };
      }
    }
  }

  return (
    <div className="flow-toolbar">
      <div className="flow-toolbar-tool">
        <input
          type="text"
          className="flow-toolbar-search"
          placeholder="Search tasks… (@RoleName to find role refs)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="flow-toolbar-search-clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        <span className="flow-toolbar-divider" aria-hidden />
        <label className="flow-toolbar-check">
          <input
            type="checkbox"
            checked={highlightEnabled}
            onChange={(e) => onHighlightChange(e.target.checked)}
          />
          <span>Dependency highlight</span>
        </label>

        {highlightEnabled && (
          <>
            <span className="flow-toolbar-divider" aria-hidden />
            <Legend swatchClass="flow-toolbar-swatch-self" label="Selected" />
            <Legend
              swatchClass="flow-toolbar-swatch-past"
              label="Prerequisites"
            />
            <Legend
              swatchClass="flow-toolbar-swatch-future"
              label="Dependents"
            />
            <span className="flow-toolbar-divider" aria-hidden />
            <label className="flow-toolbar-field">
              <span className="flow-toolbar-field-label">Fade over</span>
              <select
                value={fadeOver === null ? 'none' : String(fadeOver)}
                onChange={(e) => {
                  const v = e.target.value;
                  onFadeChange(v === 'none' ? null : Number(v));
                }}
              >
                <option value="3">3 steps</option>
                <option value="5">5 steps</option>
                <option value="none">Don't fade</option>
              </select>
            </label>
          </>
        )}

        {perspectiveLegend && (
          <>
            <span className="flow-toolbar-divider" aria-hidden />
            <span className="flow-toolbar-perspective-label">
              {perspectiveLegend.label}:
            </span>
            <PerspectiveSwatch
              colour={perspectiveLegend.colour}
              variant="accountable"
              label="Accountable"
            />
            <PerspectiveSwatch
              colour={perspectiveLegend.colour}
              variant="contributor"
              label="Contributor"
            />
            <PerspectiveSwatch
              colour={perspectiveLegend.colour}
              variant="meeting"
              label="Meeting Org."
            />
            <PerspectiveSwatch
              colour={perspectiveLegend.colour}
              variant="referenced"
              label="Referenced"
            />
          </>
        )}
      </div>
    </div>
  );
}

function PerspectiveSwatch({
  colour,
  variant,
  label,
}: {
  colour: string;
  variant: 'accountable' | 'contributor' | 'meeting' | 'referenced';
  label: string;
}) {
  // Mirror the four TaskNode perspectiveStyle cases so the legend
  // visually matches the cards on the canvas. Backgrounds use
  // colour + an alpha hex suffix to imitate the tinted fills.
  let style: React.CSSProperties;
  switch (variant) {
    case 'accountable':
      style = {
        borderColor: colour,
        backgroundColor: colour + '30',
        borderStyle: 'solid',
      };
      break;
    case 'contributor':
      style = {
        borderColor: colour,
        backgroundColor: colour + '15',
        borderStyle: 'dashed',
      };
      break;
    case 'meeting':
      style = {
        borderColor: colour,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
      };
      break;
    case 'referenced':
      style = {
        borderColor: colour,
        backgroundColor: 'transparent',
        borderStyle: 'dotted',
      };
      break;
  }
  return (
    <span className="flow-toolbar-legend">
      <span className="flow-toolbar-perspective-swatch" style={style} />
      <span>{label}</span>
    </span>
  );
}

function Legend({
  swatchClass,
  label,
}: {
  swatchClass: string;
  label: string;
}) {
  return (
    <span className="flow-toolbar-legend">
      <span className={`flow-toolbar-swatch ${swatchClass}`} />
      <span>{label}</span>
    </span>
  );
}
