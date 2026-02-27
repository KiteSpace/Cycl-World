import type { PostProcessingSettings } from "../types";

interface PostProcessingControlsProps {
  settings: PostProcessingSettings;
  onChange: (settings: PostProcessingSettings) => void;
}

export default function PostProcessingControls({ settings, onChange }: PostProcessingControlsProps) {
  const update = (path: string, value: any) => {
    const next = { ...settings };
    const parts = path.split(".");
    if (parts.length === 1) {
      (next as any)[parts[0]] = value;
    } else {
      const [group, key] = parts;
      (next as any)[group] = { ...(next as any)[group], [key]: value };
    }
    onChange(next);
  };

  const toggle = (label: string, checked: boolean, onToggle: () => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <label style={{ fontSize: 11, color: "#aaa", flex: 1 }}>{label}</label>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: "var(--color-primary)" }}
      />
    </div>
  );

  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onVal: (v: number) => void,
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <label style={{ fontSize: 11, color: "#aaa", width: 70 }}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onVal(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ fontSize: 10, color: "#888", width: 30, textAlign: "right" }}>
        {value.toFixed(1)}
      </span>
    </div>
  );

  const bloom = settings.bloom || {
    enabled: false,
    strength: 1.5,
    threshold: 0.0,
    radius: 0.5,
  };
  const ssao = settings.ssao || { enabled: false, kernelRadius: 16 };

  return (
    <div style={{ padding: 8 }}>
      <div style={{ fontSize: 10, color: "#888", fontWeight: 600, marginBottom: 8 }}>
        POST-PROCESSING
      </div>

      {toggle("Bloom", bloom.enabled, () => update("bloom.enabled", !bloom.enabled))}
      {bloom.enabled && (
        <>
          {slider("Strength", bloom.strength, 0, 4, 0.1, (v) => update("bloom.strength", v))}
          {slider("Threshold", bloom.threshold, 0, 1, 0.05, (v) => update("bloom.threshold", v))}
          {slider("Radius", bloom.radius, 0, 2, 0.05, (v) => update("bloom.radius", v))}
        </>
      )}

      {toggle("SSAO", ssao.enabled, () => update("ssao.enabled", !ssao.enabled))}
      {ssao.enabled && (
        <>
          {slider("Radius", ssao.kernelRadius, 1, 32, 1, (v) => update("ssao.kernelRadius", v))}
        </>
      )}

      {toggle("Shadows", settings.shadows ?? false, () =>
        update("shadows", !(settings.shadows ?? false)),
      )}
    </div>
  );
}
