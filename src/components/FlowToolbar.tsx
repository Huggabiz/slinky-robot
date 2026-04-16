import './FlowToolbar.css';

// Props shape is kept explicit rather than using a single config object
// so future tools (colour legend, layer hints, etc.) can be added as
// sibling controls without reshaping a shared config.
interface Props {
  highlightEnabled: boolean;
  onHighlightChange: (enabled: boolean) => void;
  fadeOver: number | null;
  onFadeChange: (fade: number | null) => void;
}

export function FlowToolbar({
  highlightEnabled,
  onHighlightChange,
  fadeOver,
  onFadeChange,
}: Props) {
  return (
    <div className="flow-toolbar">
      <div className="flow-toolbar-tool">
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
      </div>
    </div>
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
