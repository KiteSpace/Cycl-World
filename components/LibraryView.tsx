import { useState, useEffect, useRef, useCallback } from "react";
import type { LibraryItem, Composition } from "../types";
import {
  getLibrary,
  deleteLibraryItem,
  duplicateLibraryItem,
  getCompositions,
  deleteComposition,
  exportToFile,
  exportLibraryToFile,
  importFromFile,
  type ImportResult,
} from "../lib/library";
import { downloadZip } from "../lib/zipDownload";

interface LibraryViewProps {
  onEdit: (item: LibraryItem) => void;
  onAddToComposer: (item: LibraryItem) => void;
  onOpenComposition: (compId: string) => void;
}

export default function LibraryView({ onEdit, onAddToComposer, onOpenComposition }: LibraryViewProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [filter, setFilter] = useState<"all" | "object" | "scene" | "composition">("all");
  const [search, setSearch] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    getLibrary().then(setItems);
    getCompositions().then(setCompositions);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = filter === "composition" ? [] : items
    .filter((i) => filter === "all" || i.type === filter)
    .filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const filteredComps = (filter === "all" || filter === "composition") ? compositions
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())) : [];

  const handleDelete = async (id: string) => {
    if (confirm("Delete this item?")) {
      await deleteLibraryItem(id);
      refresh();
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateLibraryItem(id);
    refresh();
  };

  const handleExportAll = async () => {
    try {
      await exportToFile();
    } catch (e: any) {
      console.error("Export failed:", e);
    }
  };

  const handleExportSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await exportLibraryToFile(Array.from(selectedIds));
    } catch (e: any) {
      console.error("Export selected failed:", e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportStatus("Importing...");
      const result: ImportResult = await importFromFile(file, "merge");
      setImportStatus(
        `Imported ${result.libraryAdded} item${result.libraryAdded !== 1 ? "s" : ""}` +
        (result.compositionsAdded > 0 ? `, ${result.compositionsAdded} composition${result.compositionsAdded !== 1 ? "s" : ""}` : "") +
        (result.librarySkipped > 0 ? ` (${result.librarySkipped} duplicates skipped)` : ""),
      );
      refresh();
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
      setTimeout(() => setImportStatus(null), 5000);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const downloadFile = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSceneConfig = (item: LibraryItem) => {
    const config = {
      id: item.id,
      camera: item.camera,
      layers: item.layers,
    };
    downloadFile(`${item.name.replace(/\s+/g, "_")}_scene_config.json`, JSON.stringify(config, null, 2));
  };

  const downloadExecutableBundle = (item: LibraryItem) => {
    const content = Object.entries(item.executableLayers || {})
      .map(([kind, layer]) => `// ${kind}.ts\n\n${layer.code}`)
      .join("\n\n");
    if (!content) return;
    downloadFile(`${item.name.replace(/\s+/g, "_")}_layers.ts`, content);
  };

  const downloadCyclZip = async (item: LibraryItem) => {
    const map = item.productionLayers || {};
    const files = Object.values(map).map((l) => ({ name: l.filename, content: l.code }));
    if (files.length === 0) return;
    await downloadZip(`${item.name.replace(/\s+/g, "_")}_cycl_layers`, files);
  };

  const downloadFullBundle = async (item: LibraryItem) => {
    const files: { name: string; content: string }[] = [
      {
        name: "scene_config.json",
        content: JSON.stringify({ id: item.id, camera: item.camera, layers: item.layers }, null, 2),
      },
    ];
    Object.entries(item.executableLayers || {}).forEach(([kind, layer]) => {
      files.push({ name: `${kind}.ts`, content: layer.code });
    });
    Object.values(item.productionLayers || {}).forEach((layer) => {
      files.push({ name: layer.filename, content: layer.code });
    });
    await downloadZip(`${item.name.replace(/\s+/g, "_")}_export`, files);
  };

  const pill = (label: string, value: typeof filter) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      style={{
        padding: "5px 14px", fontSize: 12, fontWeight: 600,
        background: filter === value ? "var(--color-primary)" : "transparent",
        border: "none", color: "#fff", borderRadius: 4, cursor: "pointer",
      }}
    >{label}</button>
  );

  const actionBtn = (label: string, onClick: () => void, style?: React.CSSProperties) => (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", fontSize: 12, fontWeight: 600,
        background: "#1a1a2e", border: "1px solid #2a2a3e", color: "#ccc",
        borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0a0a0a", fontFamily: "system-ui" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #333", background: "#111", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: "#fff", fontSize: 18 }}>Library</h2>
        <div style={{ display: "flex", gap: 3, background: "#1a1a2e", borderRadius: 6, padding: 3 }}>
          {pill("All", "all")}
          {pill("Objects", "object")}
          {pill("Scenes", "scene")}
          {pill("Compositions", "composition")}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {selectMode ? (
            <>
              <span style={{ fontSize: 12, color: "#888" }}>{selectedIds.size} selected</span>
              {actionBtn("Export Selected", handleExportSelected, {
                background: selectedIds.size > 0 ? "#1a2a4a" : "#1a1a2e",
                color: selectedIds.size > 0 ? "#6699ff" : "#555",
              })}
              {actionBtn("Cancel", exitSelectMode)}
            </>
          ) : (
            <>
              {actionBtn("Select", () => setSelectMode(true))}
              {actionBtn("Export All", handleExportAll, { background: "#1a2a4a", color: "#6699ff" })}
              <label style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                background: "#1a3a2a", border: "1px solid #2a4a3a", color: "#aaffaa",
                borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
              }}>
                Import
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  style={{ display: "none" }}
                />
              </label>
            </>
          )}
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ padding: "6px 12px", background: "#1a1a2e", border: "1px solid #2a2a3e", color: "#fff", borderRadius: 6, outline: "none", fontSize: 13, width: 180 }}
          />
        </div>
      </div>

      {/* Import status toast */}
      {importStatus && (
        <div style={{
          padding: "10px 24px", fontSize: 13, fontWeight: 500,
          background: importStatus.startsWith("Import failed") ? "#3a1a1a" : "#1a2a1a",
          color: importStatus.startsWith("Import failed") ? "#ff8888" : "#88ff88",
          borderBottom: "1px solid #333",
        }}>
          {importStatus}
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {filtered.length === 0 && filteredComps.length === 0 ? (
          <div style={{ color: "#666", textAlign: "center", marginTop: 60, fontSize: 14 }}>
            {items.length === 0 && compositions.length === 0
              ? "Your library is empty. Create something and save it, or import a backup file!"
              : "No items match your filter."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {filteredComps.map((comp) => (
              <div
                key={`comp-${comp.id}`}
                style={{
                  background: "#111",
                  border: "1px solid #2a2a3e",
                  borderRadius: 10,
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2a2a3e"}
              >
                <div style={{ height: 140, background: "#0a0518", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <span style={{ color: "var(--color-primary)", fontSize: 16, fontWeight: 700 }}>COMP</span>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.5, background: "#1a2a2a", color: "#66ccaa" }}>
                      COMP
                    </span>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {comp.name}
                    </span>
                  </div>
                  <div style={{ color: "#888", fontSize: 11, marginBottom: 8 }}>
                    {comp.entries.length} layer{comp.entries.length !== 1 ? "s" : ""}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => onOpenComposition(comp.id)} style={{ flex: 1, padding: "6px 0", background: "#1a2a2a", border: "1px solid #2a4a4a", color: "#66ccaa", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      Open in Composer
                    </button>
                    <button onClick={async () => { if (confirm("Delete this composition?")) { await deleteComposition(comp.id); refresh(); } }}
                      style={{ padding: "6px 8px", background: "#3a1a1a", border: "1px solid #5a2a2a", color: "#ff8888", borderRadius: 4, cursor: "pointer", fontSize: 11 }} title="Delete">
                      Del
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={selectMode ? () => toggleSelect(item.id) : () => setDetailItem(item)}
                  style={{
                    background: "#111",
                    border: `1px solid ${isSelected ? "var(--color-primary)" : "#2a2a3e"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                    outline: isSelected ? "2px solid var(--color-primary)" : "none",
                    outlineOffset: -1,
                  }}
                  onMouseEnter={(e) => { if (!selectMode) e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                  onMouseLeave={(e) => { if (!selectMode && !isSelected) e.currentTarget.style.borderColor = "#2a2a3e"; }}
                >
                  {/* Select checkbox overlay */}
                  {selectMode && (
                    <div style={{
                      position: "relative",
                    }}>
                      <div style={{
                        position: "absolute", top: 8, left: 8, zIndex: 2,
                        width: 22, height: 22, borderRadius: 4,
                        background: isSelected ? "var(--color-primary)" : "rgba(0,0,0,0.6)",
                        border: `2px solid ${isSelected ? "#8866ee" : "#555"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: "#fff",
                      }}>
                        {isSelected ? "\u2713" : ""}
                      </div>
                    </div>
                  )}

                  {/* Thumbnail */}
                  <div style={{ height: 140, background: "#050510", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ color: "#333", fontSize: 13, fontWeight: 700 }}>{item.type === "object" ? "OBJECT" : "SCENE"}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.5, background: item.type === "object" ? "#1a2a4a" : "#2a1a4a", color: item.type === "object" ? "#6699ff" : "#aa66ff" }}>
                        {item.type.toUpperCase()}
                      </span>
                      <span style={{ color: "#fff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.name}
                      </span>
                    </div>

                    <div style={{ color: "#888", fontSize: 11, marginBottom: 8 }}>
                      {item.layers.length} layer{item.layers.length !== 1 ? "s" : ""} · {new Date(item.updatedAt).toLocaleDateString()}
                    </div>

                    {/* Actions (hidden in select mode) */}
                    {!selectMode && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} style={{ flex: 1, padding: "6px 0", background: "#2a2a3e", border: "1px solid #3a3a4e", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          Edit
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onAddToComposer(item); }} style={{ flex: 1, padding: "6px 0", background: "#1a3a2a", border: "1px solid #2a4a3a", color: "#aaffaa", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          + Compose
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDuplicate(item.id); }} style={{ padding: "6px 8px", background: "#2a2a3e", border: "1px solid #3a3a4e", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 11 }} title="Duplicate">
                          {"\u{1F4CB}"}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} style={{ padding: "6px 8px", background: "#3a1a1a", border: "1px solid #5a2a2a", color: "#ff8888", borderRadius: 4, cursor: "pointer", fontSize: 11 }} title="Delete">
                          {"\u{1F5D1}"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {detailItem && (
        <div
          onClick={() => setDetailItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(760px, 95vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)" }}>{detailItem.name}</div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                  {detailItem.type.toUpperCase()} · {detailItem.layers.length} layer{detailItem.layers.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {actionBtn("Download Scene Config", () => downloadSceneConfig(detailItem), { background: "var(--color-surface-2)", color: "var(--color-text)" })}
              {actionBtn("Download Executable Code", () => downloadExecutableBundle(detailItem), { background: "var(--color-surface-2)", color: "var(--color-text)" })}
              {actionBtn("Download Cycl Layers (.zip)", () => { void downloadCyclZip(detailItem); }, { background: "var(--color-surface-2)", color: "var(--color-text)" })}
              {actionBtn("Download All (.zip)", () => { void downloadFullBundle(detailItem); }, { background: "var(--color-primary)", color: "#fff" })}
              {actionBtn("Edit", () => { setDetailItem(null); onEdit(detailItem); }, { background: "#2a2a3e", color: "#fff" })}
              {actionBtn("Compose", () => { setDetailItem(null); onAddToComposer(detailItem); }, { background: "#1a3a2a", color: "#aaffaa" })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
