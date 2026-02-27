import { useState, useEffect, useCallback, useRef } from "react";
import type { SelectedObjectInfo } from "../types";

interface PropertyPanelProps {
  selectedInfo: SelectedObjectInfo | null;
  onPropertyChange: (uuid: string, property: string, value: any) => void;
  onAction?: (uuid: string, action: "duplicate" | "delete" | "focus") => void;
}

// ─── Undo / Redo History ──────────────────────────────────────────────────────

interface HistoryEntry {
  uuid: string;
  property: string;
  oldValue: any;
  newValue: any;
  label: string;
  timestamp: number;
}

const MAX_HISTORY = 80;

const MATERIAL_PRESETS: Record<
  string,
  {
    roughness: number;
    metalness: number;
    color?: string;
    emissive?: string;
    emissiveIntensity?: number;
  }
> = {
  chrome: { roughness: 0.1, metalness: 1.0, color: "#cccccc" },
  glass: { roughness: 0.0, metalness: 0.0, color: "#ffffff" },
  rubber: { roughness: 0.9, metalness: 0.0, color: "#333333" },
  neonGlow: {
    roughness: 0.3,
    metalness: 0.5,
    emissive: "#ff00ff",
    emissiveIntensity: 2,
  },
  matte: { roughness: 1.0, metalness: 0.0, color: "#888888" },
  plastic: { roughness: 0.4, metalness: 0.0, color: "#ff6666" },
};

export default function PropertyPanel({
  selectedInfo,
  onPropertyChange,
  onAction,
}: PropertyPanelProps) {
  const [localInfo, setLocalInfo] = useState<SelectedObjectInfo | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const undoingRef = useRef(false);

  useEffect(() => {
    setLocalInfo(selectedInfo);
  }, [selectedInfo]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (isMod && e.key === "z" && e.shiftKey) ||
        (isMod && e.key === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const getLocalValue = useCallback(
    (prop: string): any => {
      if (!localInfo) return undefined;
      const axisMap: Record<string, number> = { x: 0, y: 1, z: 2 };
      if (prop.startsWith("position."))
        return localInfo.position[axisMap[prop.split(".")[1]]];
      if (prop.startsWith("rotation."))
        return localInfo.rotation[axisMap[prop.split(".")[1]]];
      if (prop.startsWith("scale."))
        return localInfo.scale[axisMap[prop.split(".")[1]]];
      if (prop === "material.color") return localInfo.materialColor;
      if (prop === "material.roughness") return localInfo.materialRoughness;
      if (prop === "material.metalness") return localInfo.materialMetalness;
      if (prop === "material.emissive") return localInfo.materialEmissive;
      if (prop === "material.emissiveIntensity")
        return localInfo.materialEmissiveIntensity;
      if (prop === "material.opacity") return localInfo.materialOpacity;
      if (prop === "material.wireframe") return localInfo.materialWireframe;
      return undefined;
    },
    [localInfo],
  );

  const applyValue = useCallback(
    (prop: string, rawValue: any) => {
      if (!localInfo) return;
      const isRotation = prop.startsWith("rotation.");
      const threeValue = isRotation ? rawValue * (Math.PI / 180) : rawValue;
      onPropertyChange(localInfo.uuid, prop, threeValue);

      setLocalInfo((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        const axisMap: Record<string, number> = { x: 0, y: 1, z: 2 };
        if (prop.startsWith("position.")) {
          const idx = axisMap[prop.split(".")[1]];
          next.position = [...prev.position] as [number, number, number];
          next.position[idx] = rawValue;
        } else if (isRotation) {
          const idx = axisMap[prop.split(".")[1]];
          next.rotation = [...prev.rotation] as [number, number, number];
          next.rotation[idx] = threeValue;
        } else if (prop.startsWith("scale.")) {
          const idx = axisMap[prop.split(".")[1]];
          next.scale = [...prev.scale] as [number, number, number];
          next.scale[idx] = rawValue;
        } else if (prop === "material.color") next.materialColor = rawValue;
        else if (prop === "material.roughness")
          next.materialRoughness = rawValue;
        else if (prop === "material.metalness")
          next.materialMetalness = rawValue;
        else if (prop === "material.emissive")
          next.materialEmissive = rawValue;
        else if (prop === "material.emissiveIntensity")
          next.materialEmissiveIntensity = rawValue;
        else if (prop === "material.opacity") next.materialOpacity = rawValue;
        else if (prop === "material.wireframe")
          next.materialWireframe = rawValue;
        return next;
      });
    },
    [localInfo, onPropertyChange],
  );

  const emit = (prop: string, rawValue: any) => {
    if (undoingRef.current) return applyValue(prop, rawValue);

    const oldValue = getLocalValue(prop);
    applyValue(prop, rawValue);

    const label = prop.replace("material.", "mat.");
    const entry: HistoryEntry = {
      uuid: localInfo!.uuid,
      property: prop,
      oldValue,
      newValue: rawValue,
      label,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1);
      const next = [...truncated, entry];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIdx((prev) => {
      const base = Math.min(prev + 1, MAX_HISTORY - 1);
      return base;
    });
  };

  const handleUndo = () => {
    setHistory((h) => {
      setHistoryIdx((idx) => {
        if (idx < 0) return idx;
        const entry = h[idx];
        if (entry) {
          undoingRef.current = true;
          applyValue(entry.property, entry.oldValue);
          undoingRef.current = false;
        }
        return idx - 1;
      });
      return h;
    });
  };

  const handleRedo = () => {
    setHistory((h) => {
      setHistoryIdx((idx) => {
        if (idx >= h.length - 1) return idx;
        const entry = h[idx + 1];
        if (entry) {
          undoingRef.current = true;
          applyValue(entry.property, entry.newValue);
          undoingRef.current = false;
        }
        return idx + 1;
      });
      return h;
    });
  };

  if (!localInfo) return null;

  const canUndo = historyIdx >= 0;
  const canRedo = historyIdx < history.length - 1;

  const axisColors: Record<string, string> = {
    X: "#e05555",
    Y: "#55b855",
    Z: "#5588ee",
  };

  const numInput = (
    label: string,
    value: number,
    prop: string,
    step = 0.1,
  ) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <label
        style={{
          fontSize: 10,
          color: axisColors[label] || "#888",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {label}
      </label>
      <input
        type="number"
        step={step}
        value={parseFloat(value.toFixed(3))}
        onChange={(e) => emit(prop, parseFloat(e.target.value) || 0)}
        style={{
          width: "100%",
          padding: "6px 6px",
          background: "#141422",
          border: "1px solid #2a2a3e",
          color: "#fff",
          borderRadius: 4,
          fontSize: 13,
          outline: "none",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      />
    </div>
  );

  const vec3Input = (
    sectionLabel: string,
    prefix: string,
    values: [number, number, number],
    step = 0.1,
  ) => (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          color: "#777",
          marginBottom: 4,
          fontWeight: 500,
        }}
      >
        {sectionLabel}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {numInput("X", values[0], `${prefix}.x`, step)}
        {numInput("Y", values[1], `${prefix}.y`, step)}
        {numInput("Z", values[2], `${prefix}.z`, step)}
      </div>
    </div>
  );

  const applyPreset = (name: string) => {
    const preset = MATERIAL_PRESETS[name];
    if (!preset) return;
    if (preset.color) emit("material.color", preset.color);
    emit("material.roughness", preset.roughness);
    emit("material.metalness", preset.metalness);
    if (preset.emissive) emit("material.emissive", preset.emissive);
    if (preset.emissiveIntensity !== undefined)
      emit("material.emissiveIntensity", preset.emissiveIntensity);
  };

  const hasPBR =
    localInfo.materialType === "MeshStandardMaterial" ||
    localInfo.materialType === "MeshPhysicalMaterial";

  const smallBtn = (
    label: string,
    onClick: () => void,
    disabled: boolean,
    style?: React.CSSProperties,
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px",
        background: disabled ? "#111" : "#1a1a2e",
        border: `1px solid ${disabled ? "#1a1a1a" : "#2a2a3e"}`,
        color: disabled ? "#444" : "#ccc",
        borderRadius: 4,
        cursor: disabled ? "default" : "pointer",
        fontSize: 11,
        fontWeight: 600,
        ...style,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        right: 8,
        width: 280,
        zIndex: 15,
        background: "rgba(10,10,20,0.92)",
        border: "1px solid rgba(100,100,150,0.2)",
        borderRadius: 8,
        backdropFilter: "blur(10px)",
        overflowY: "auto",
        maxHeight: "calc(100% - 60px)",
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #333",
          color: "#ddd",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {localInfo.name}
          <span style={{ color: "#666", fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
            {localInfo.type}
          </span>
        </div>
      </div>

      {/* Undo / Redo bar */}
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {smallBtn("\u21A9 Undo", handleUndo, !canUndo)}
        {smallBtn("Redo \u21AA", handleRedo, !canRedo)}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowHistory((s) => !s)}
          style={{
            padding: "3px 8px",
            background: showHistory ? "#2a2a4e" : "transparent",
            border: "1px solid #2a2a3e",
            color: "#888",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 10,
          }}
        >
          History ({history.length})
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <div
          style={{
            maxHeight: 140,
            overflowY: "auto",
            borderBottom: "1px solid #222",
            background: "#0a0a14",
          }}
        >
          {history.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                color: "#555",
                fontSize: 11,
                textAlign: "center",
              }}
            >
              No changes yet
            </div>
          ) : (
            history.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: "4px 12px",
                  fontSize: 10,
                  color: i <= historyIdx ? "#aaa" : "#555",
                  background:
                    i === historyIdx ? "rgba(100,68,204,0.15)" : "transparent",
                  borderLeft:
                    i === historyIdx
                      ? "2px solid var(--color-primary)"
                      : "2px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (i < historyIdx) {
                    for (let j = historyIdx; j > i; j--) {
                      undoingRef.current = true;
                      applyValue(history[j].property, history[j].oldValue);
                      undoingRef.current = false;
                    }
                    setHistoryIdx(i);
                  } else if (i > historyIdx) {
                    for (let j = historyIdx + 1; j <= i; j++) {
                      undoingRef.current = true;
                      applyValue(history[j].property, history[j].newValue);
                      undoingRef.current = false;
                    }
                    setHistoryIdx(i);
                  }
                }}
              >
                <span style={{ fontFamily: "monospace" }}>{entry.label}</span>
                <span style={{ color: "#555" }}>
                  {typeof entry.newValue === "number"
                    ? entry.newValue.toFixed(2)
                    : String(entry.newValue)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transform */}
      <div style={{ padding: "12px 12px", borderBottom: "1px solid #222" }}>
        <div
          style={{
            fontSize: 10,
            color: "#999",
            fontWeight: 700,
            marginBottom: 10,
            letterSpacing: 0.5,
          }}
        >
          TRANSFORM
        </div>
        {vec3Input("Position", "position", localInfo.position)}
        {vec3Input(
          "Rotation (deg)",
          "rotation",
          localInfo.rotation.map((r) => r * (180 / Math.PI)) as [
            number,
            number,
            number,
          ],
          1,
        )}
        {vec3Input("Scale", "scale", localInfo.scale, 0.01)}
      </div>

      {/* Material */}
      {localInfo.hasMaterial && (
        <div style={{ padding: "12px 12px", borderBottom: "1px solid #222" }}>
          <div
            style={{
              fontSize: 10,
              color: "#999",
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: 0.5,
            }}
          >
            MATERIAL
            <span
              style={{ color: "#555", fontWeight: 400, marginLeft: 6 }}
            >
              {localInfo.materialType}
            </span>
          </div>

          {localInfo.materialColor !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <label style={{ fontSize: 11, color: "#aaa", width: 55 }}>
                Color
              </label>
              <input
                type="color"
                value={localInfo.materialColor}
                onChange={(e) => emit("material.color", e.target.value)}
                style={{
                  width: 28,
                  height: 22,
                  border: "none",
                  padding: 0,
                  background: "none",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                value={localInfo.materialColor}
                onChange={(e) => emit("material.color", e.target.value)}
                style={{
                  flex: 1,
                  padding: "4px 6px",
                  background: "#141422",
                  border: "1px solid #2a2a3e",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </div>
          )}

          {hasPBR && localInfo.materialRoughness !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: 11, color: "#aaa", width: 55 }}>
                Rough
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localInfo.materialRoughness}
                onChange={(e) =>
                  emit("material.roughness", parseFloat(e.target.value))
                }
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11, color: "#888", width: 30, textAlign: "right" }}>
                {localInfo.materialRoughness.toFixed(2)}
              </span>
            </div>
          )}

          {hasPBR && localInfo.materialMetalness !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: 11, color: "#aaa", width: 55 }}>
                Metal
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localInfo.materialMetalness}
                onChange={(e) =>
                  emit("material.metalness", parseFloat(e.target.value))
                }
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11, color: "#888", width: 30, textAlign: "right" }}>
                {localInfo.materialMetalness.toFixed(2)}
              </span>
            </div>
          )}

          {localInfo.materialEmissive !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: 11, color: "#aaa", width: 55 }}>
                Emissive
              </label>
              <input
                type="color"
                value={localInfo.materialEmissive}
                onChange={(e) => emit("material.emissive", e.target.value)}
                style={{
                  width: 28,
                  height: 22,
                  border: "none",
                  padding: 0,
                  background: "none",
                  cursor: "pointer",
                }}
              />
            </div>
          )}

          {localInfo.materialOpacity !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: 11, color: "#aaa", width: 55 }}>
                Opacity
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localInfo.materialOpacity}
                onChange={(e) =>
                  emit("material.opacity", parseFloat(e.target.value))
                }
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11, color: "#888", width: 30, textAlign: "right" }}>
                {localInfo.materialOpacity.toFixed(2)}
              </span>
            </div>
          )}

          {localInfo.materialWireframe !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: 11, color: "#aaa", width: 55 }}>
                Wireframe
              </label>
              <input
                type="checkbox"
                checked={localInfo.materialWireframe}
                onChange={(e) => emit("material.wireframe", e.target.checked)}
                style={{ accentColor: "var(--color-primary)", width: 16, height: 16 }}
              />
            </div>
          )}

          {hasPBR && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{ fontSize: 10, color: "#666", marginBottom: 4 }}
              >
                Presets
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Object.keys(MATERIAL_PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    style={{
                      padding: "4px 8px",
                      background: "#1a1a2e",
                      border: "1px solid #2a2a3e",
                      color: "#aaa",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Geometry stats */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #222" }}>
        <div
          style={{
            fontSize: 10,
            color: "#999",
            fontWeight: 700,
            marginBottom: 4,
            letterSpacing: 0.5,
          }}
        >
          GEOMETRY
        </div>
        <div style={{ color: "#777", fontSize: 11, lineHeight: 1.7 }}>
          <div>Vertices: {localInfo.vertexCount.toLocaleString()}</div>
          <div>Triangles: {localInfo.triangleCount.toLocaleString()}</div>
          {localInfo.boundingBox && (
            <div>
              Bounds: {localInfo.boundingBox[0]} x {localInfo.boundingBox[1]}{" "}
              x {localInfo.boundingBox[2]}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {onAction && (
        <div style={{ padding: "10px 12px", display: "flex", gap: 6 }}>
          <button
            onClick={() => onAction(localInfo.uuid, "focus")}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "#1a2a3a",
              border: "1px solid #2a3a4a",
              color: "#88ccff",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Focus
          </button>
          <button
            onClick={() => onAction(localInfo.uuid, "duplicate")}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "#1a2a3a",
              border: "1px solid #2a3a4a",
              color: "#88ccff",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Clone
          </button>
          <button
            onClick={() => onAction(localInfo.uuid, "delete")}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "#3a1a1a",
              border: "1px solid #4a2a2a",
              color: "#ff8888",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
