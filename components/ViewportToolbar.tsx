interface ViewportToolbarProps {
  cameraMode: "orbit" | "drive";
  onCameraModeChange: (mode: "orbit" | "drive") => void;
  transformMode: "translate" | "rotate" | "scale";
  onTransformModeChange: (mode: "translate" | "rotate" | "scale") => void;
  showHierarchy: boolean;
  onToggleHierarchy: () => void;
  onExport?: () => void;
  onDeselect?: () => void;
}

export default function ViewportToolbar({
  cameraMode,
  onCameraModeChange,
  transformMode,
  onTransformModeChange,
  showHierarchy,
  onToggleHierarchy,
  onExport,
  onDeselect,
}: ViewportToolbarProps) {
  const btn = (label: string, active: boolean, onClick: () => void, title: string) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "4px 8px",
        background: active ? "var(--color-primary)" : "#222",
        border: "1px solid " + (active ? "#8866ee" : "#444"),
        color: active ? "#fff" : "#aaa",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 700 : 400,
        minWidth: 28,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        right: 8,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 6px",
        background: "rgba(10,10,20,0.85)",
        borderRadius: 6,
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(100,100,150,0.2)",
      }}
    >
      <span style={{ fontSize: 10, color: "#888", marginRight: 2 }}>CAM</span>
      {btn("Orbit", cameraMode === "orbit", () => onCameraModeChange("orbit"), "Orbit camera (mouse)")}
      {btn("Drive", cameraMode === "drive", () => onCameraModeChange("drive"), "Auto-drive camera")}

      <div style={{ width: 1, height: 20, background: "#333", margin: "0 4px" }} />

      <span style={{ fontSize: 10, color: "#888", marginRight: 2 }}>GIZMO</span>
      {btn("W", transformMode === "translate", () => onTransformModeChange("translate"), "Move (W)")}
      {btn("E", transformMode === "rotate", () => onTransformModeChange("rotate"), "Rotate (E)")}
      {btn("T", transformMode === "scale", () => onTransformModeChange("scale"), "Scale (T)")}

      <div style={{ width: 1, height: 20, background: "#333", margin: "0 4px" }} />

      <span style={{ fontSize: 10, color: "#888", marginRight: 2 }}>NAV</span>
      {btn("H", false, () => {}, "Hand drag (H)")}
      {btn("V", false, () => {}, "Standard cursor (V)")}
      {btn("R", false, () => {}, "Reset camera (R)")}

      <div style={{ width: 1, height: 20, background: "#333", margin: "0 4px" }} />

      {btn("Tree", showHierarchy, onToggleHierarchy, "Toggle scene hierarchy")}
      {onDeselect && btn("Esc", false, onDeselect, "Deselect")}

      <div style={{ flex: 1 }} />

      {onExport && btn("Export", false, onExport, "Export scene")}
    </div>
  );
}
