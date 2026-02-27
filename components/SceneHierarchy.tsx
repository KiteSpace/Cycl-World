import type { SceneObjectEntry } from "../types";

interface SceneHierarchyProps {
  objects: SceneObjectEntry[];
  selectedUuid: string | null;
  onSelect: (uuid: string | null) => void;
  onToggleVisibility?: (uuid: string, visible: boolean) => void;
  onDelete?: (uuid: string) => void;
}

export default function SceneHierarchy({
  objects,
  selectedUuid,
  onSelect,
  onToggleVisibility,
  onDelete,
}: SceneHierarchyProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 8,
        bottom: 8,
        width: 220,
        zIndex: 15,
        background: "rgba(10,10,20,0.9)",
        border: "1px solid rgba(100,100,150,0.2)",
        borderRadius: 6,
        backdropFilter: "blur(8px)",
        overflowY: "auto",
        fontSize: 11,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid #333",
          fontWeight: 600,
          color: "#888",
          fontSize: 10,
        }}
      >
        SCENE HIERARCHY
      </div>
      <div style={{ padding: 4 }}>
        {objects.map((obj) => (
          <TreeNode
            key={obj.uuid}
            entry={obj}
            depth={0}
            selectedUuid={selectedUuid}
            onSelect={onSelect}
            onToggleVisibility={onToggleVisibility}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  selectedUuid,
  onSelect,
  onToggleVisibility,
  onDelete,
}: {
  entry: SceneObjectEntry;
  depth: number;
  selectedUuid: string | null;
  onSelect: (uuid: string | null) => void;
  onToggleVisibility?: (uuid: string, visible: boolean) => void;
  onDelete?: (uuid: string) => void;
}) {
  const isSelected = entry.uuid === selectedUuid;
  const icon = getTypeIcon(entry.type, entry.name);

  return (
    <div>
      <div
        onClick={() => onSelect(isSelected ? null : entry.uuid)}
        style={{
          padding: "3px 6px",
          paddingLeft: 6 + depth * 12,
          cursor: "pointer",
          background: isSelected ? "rgba(100,68,204,0.3)" : "transparent",
          borderRadius: 3,
          color: entry.visible ? "#ccc" : "#555",
          display: "flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.6, fontFamily: "monospace" }}>{icon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry.name || entry.type}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility?.(entry.uuid, !entry.visible);
            }}
            style={{
              border: "none",
              background: "none",
              color: entry.visible ? "#9fd" : "#666",
              cursor: "pointer",
              fontSize: 10,
              padding: "0 2px",
            }}
            title={entry.visible ? "Hide" : "Show"}
          >
            {entry.visible ? "V" : "-"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(entry.uuid);
            }}
            style={{
              border: "none",
              background: "none",
              color: "#f88",
              cursor: "pointer",
              fontSize: 10,
              padding: "0 2px",
            }}
            title="Delete"
          >
            X
          </button>
        </div>
      </div>
      {entry.children.map((child) => (
        <TreeNode
          key={child.uuid}
          entry={child}
          depth={depth + 1}
          selectedUuid={selectedUuid}
          onSelect={onSelect}
          onToggleVisibility={onToggleVisibility}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function getTypeIcon(type: string, name: string): string {
  if (name.startsWith("builtin-")) return "L";
  switch (type) {
    case "Group": return "G";
    case "Mesh": return "M";
    case "Points": return "P";
    case "LineSegments": return "/";
    case "DirectionalLight": return "*";
    case "AmbientLight": return "o";
    case "Sprite": return "S";
    default: return "-";
  }
}
