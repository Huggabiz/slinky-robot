import type { LabConfig, Rankdir } from '../utils/flowLab';
import { DEFAULT_LAB_CONFIG } from '../utils/flowLab';
import './FlowLabPanel.css';

// ╔══════════════════════════════════════════╗
// ║  FLOW LAB — TEMPORARY UI                 ║
// ║  See src/utils/flowLab.ts for removal.   ║
// ╚══════════════════════════════════════════╝

interface Props {
  config: LabConfig;
  onChange: (next: LabConfig) => void;
}

export function FlowLabPanel({ config, onChange }: Props) {
  const set = <K extends keyof LabConfig>(key: K, value: LabConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <aside className="flow-lab">
      <header className="flow-lab-header">
        <h2>Layout Lab</h2>
        <button
          type="button"
          className="flow-lab-reset"
          onClick={() => onChange(DEFAULT_LAB_CONFIG)}
        >
          Reset
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
