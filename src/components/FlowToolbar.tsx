import { useAppStore } from '../store/useAppStore';
import type { PerspectiveFilter } from '../utils/perspective';
import './FlowToolbar.css';

// Props shape is kept explicit rather than using a single config object
// so future tools (colour legend, layer hints, etc.) can be added as
// sibling controls without reshaping a shared config.
interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  perspectiveFilter: PerspectiveFilter | null;
}

export function FlowToolbar({
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
          placeholder="Search tasks… (@Role or #TaskID to find refs)"
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
  // Mirror the TaskNode perspectiveStyle cases so the legend visually
  // matches the cards on the canvas. Accountable + contributor share
  // the strong fill (contributor distinguished by a dashed border);
  // referenced is a faint fill with a dashed border. Meeting organiser
  // doesn't tint the card — it colours the calendar badge — so its
  // swatch shows the coloured 📅 chip instead of a fill.
  if (variant === 'meeting') {
    return (
      <span className="flow-toolbar-legend">
        <span
          className="flow-toolbar-perspective-badge"
          style={{ backgroundColor: colour, borderColor: colour }}
        >
          📅
        </span>
        <span>{label}</span>
      </span>
    );
  }

  let style: React.CSSProperties;
  switch (variant) {
    case 'accountable':
      style = { borderColor: colour, backgroundColor: colour + '70', borderStyle: 'solid' };
      break;
    case 'contributor':
      style = { borderColor: colour, backgroundColor: colour + '70', borderStyle: 'dashed' };
      break;
    case 'referenced':
      style = { borderColor: colour, backgroundColor: colour + '0D', borderStyle: 'dashed' };
      break;
  }
  return (
    <span className="flow-toolbar-legend">
      <span className="flow-toolbar-perspective-swatch" style={style} />
      <span>{label}</span>
    </span>
  );
}
