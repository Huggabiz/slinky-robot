import type { LabConfig, NodePlacement, Rankdir } from '../utils/flowLab';
import { DEFAULT_LAB_CONFIG } from '../utils/flowLab';
import './FlowLabPanel.css';

// ╔══════════════════════════════════════════╗
// ║  FLOW LAB — TEMPORARY UI                 ║
// ║  See src/utils/flowLab.ts for removal.   ║
// ╚══════════════════════════════════════════╝

interface Props {
  config: LabConfig;
  onChange: (next: LabConfig) => void;
  onClose: () => void;
}

// Floating pop-out panel. Rendered as a position: fixed overlay on top
// of the workspace so it doesn't steal layout space from the flow or
// detail columns. Dismiss with the × button.
export function FlowLabPanel({ config, onChange, onClose }: Props) {
  const set = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <aside className="flow-lab" role="dialog" aria-label="Layout Lab">
      <header className="flow-lab-header">
        <h2>Layout Lab</h2>
        <button
          type="button"
          className="flow-lab-reset"
          onClick={() => onChange(DEFAULT_LAB_CONFIG)}
        >
          Reset
        </button>
        <button
          type="button"
          className="flow-lab-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <section className="flow-lab-section">
        <label className="flow-lab-field">
          <span className="flow-lab-label">Direction</span>
          <select
            value={config.rankdir}
            onChange={(e) => set('rankdir', e.target.value as Rankdir)}
          >
            <option value="TB">Top → Bottom</option>
            <option value="LR">Left → Right</option>
          </select>
        </label>

        <label className="flow-lab-field">
          <span className="flow-lab-label">Node placement</span>
          <select
            value={config.nodePlacement}
            onChange={(e) =>
              set('nodePlacement', e.target.value as NodePlacement)
            }
          >
            <option value="BRANDES_KOEPF">BRANDES_KOEPF</option>
            <option value="NETWORK_SIMPLEX">NETWORK_SIMPLEX</option>
            <option value="LINEAR_SEGMENTS">LINEAR_SEGMENTS</option>
            <option value="SIMPLE">SIMPLE</option>
          </select>
        </label>

        <label className="flow-lab-check">
          <input
            type="checkbox"
            checked={config.favorStraightEdges}
            onChange={(e) => set('favorStraightEdges', e.target.checked)}
          />
          <span>Favour straight edges</span>
        </label>

        <label className="flow-lab-check">
          <input
            type="checkbox"
            checked={config.centreStartEnd}
            onChange={(e) => set('centreStartEnd', e.target.checked)}
          />
          <span>Centre start/end on screen</span>
        </label>
      </section>

      <section className="flow-lab-section">
        <Slider
          label="Node gap (X)"
          value={config.nodesep}
          min={0}
          max={400}
          step={10}
          onChange={(v) => set('nodesep', v)}
        />
        <Slider
          label="Rank gap (Y)"
          value={config.ranksep}
          min={0}
          max={400}
          step={10}
          onChange={(v) => set('ranksep', v)}
        />
        <Slider
          label="Node width"
          value={config.nodeWidth}
          min={120}
          max={320}
          step={10}
          onChange={(v) => set('nodeWidth', v)}
        />
        <Slider
          label="Node height"
          value={config.nodeHeight}
          min={60}
          max={200}
          step={4}
          onChange={(v) => set('nodeHeight', v)}
        />
      </section>

      <section className="flow-lab-section">
        <Slider
          label="Corner radius"
          value={config.cornerRadius}
          min={0}
          max={60}
          step={2}
          onChange={(v) => set('cornerRadius', v)}
        />
        <Slider
          label="Arrow size"
          value={config.arrowSize}
          min={8}
          max={64}
          step={2}
          onChange={(v) => set('arrowSize', v)}
        />
      </section>

      <p className="flow-lab-note">
        Temporary panel. Changes apply live and are not persisted.
      </p>
    </aside>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flow-lab-field">
      <div className="flow-lab-slider-row">
        <span className="flow-lab-label">{label}</span>
        <span className="flow-lab-slider-value">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
