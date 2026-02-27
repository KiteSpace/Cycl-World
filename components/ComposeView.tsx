import { useState, useEffect, useMemo, Suspense, lazy, useCallback, useRef } from "react";
import { Import, Redo2, Undo2 } from "lucide-react";
import type {
  SceneDef,
  ExecutableLayer,
  ProductionLayer,
  LibraryItem,
  CompositionEntry,
  PostProcessingSettings,
  Composition,
} from "../types";
import {
  getLibrary,
  getCompositions,
  generateId,
  saveComposition,
  deleteComposition,
} from "../lib/library";
import { BUILTIN_LAYERS, type SceneInternals } from "./ScenePreview";
import PostProcessingControls from "./PostProcessingControls";
import {
  processImportedFiles,
  readFileAsText,
  normalizeProductionLayerKey,
  normalizeProductionLayersMap,
} from "../lib/importUtils";
import { downloadZip } from "../lib/zipDownload";
import { validateProductionLayersMap } from "../lib/cyclFormatValidator";

const ScenePreview = lazy(() => import("./ScenePreview"));

interface ComposeViewProps {
  pendingAdd?: LibraryItem | null;
  onPendingConsumed?: () => void;
  pendingCompId?: string | null;
  onPendingCompConsumed?: () => void;
}

interface ComposeSnapshot {
  entries: CompositionEntry[];
  postSettings: PostProcessingSettings;
  cameraSpeed: number;
}

function defaultEntries(): CompositionEntry[] {
  return [
    {
      id: generateId(),
      layer: {
        id: "sky",
        kind: "background_gradient",
        attachTo: "scene",
        params: { colorTop: "#000011", colorMid: "#001133", colorHorizon: "#2244ff" },
      },
      visible: true,
    },
    {
      id: generateId(),
      layer: {
        id: "road",
        kind: "road_v9",
        attachTo: "world",
        params: {
          style: "grid",
          colors: { road: "#1a0022", edge: "#ff69b4", line: "#ff1493" },
        },
      },
      visible: true,
    },
  ];
}

export default function ComposeView({
  pendingAdd,
  onPendingConsumed,
  pendingCompId,
  onPendingCompConsumed,
}: ComposeViewProps) {
  const [entries, setEntries] = useState<CompositionEntry[]>(defaultEntries);
  const [compName, setCompName] = useState("My Scene");
  const [compId, setCompId] = useState<string | null>(null);
  const [savedComps, setSavedComps] = useState<Composition[]>([]);
  const [showCompPicker, setShowCompPicker] = useState(false);
  const [showLibPicker, setShowLibPicker] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [cameraSpeed, setCameraSpeed] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [postSettings, setPostSettings] = useState<PostProcessingSettings>({
    bloom: { enabled: true, strength: 1.5, threshold: 0, radius: 0.5 },
  });
  const [history, setHistory] = useState<ComposeSnapshot[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const sceneRefOut = useRef<SceneInternals | null>(null);
  const composeImportRef = useRef<HTMLInputElement>(null);
  const restoringHistoryRef = useRef(false);
  const lastFingerprintRef = useRef("");

  const refreshSavedComps = useCallback(async () => {
    const comps = await getCompositions();
    setSavedComps(comps);
    return comps;
  }, []);

  useEffect(() => {
    refreshSavedComps();
  }, [refreshSavedComps]);

  const loadComposition = useCallback((comp: Composition) => {
    setCompId(comp.id);
    setCompName(comp.name);
    setEntries(comp.entries);
    setSelectedEntry(null);
    setShowCompPicker(false);
    setHistory([]);
    setHistoryIdx(-1);
    lastFingerprintRef.current = "";
  }, []);

  useEffect(() => {
    if (!pendingAdd) return;
    const normalizedProd = normalizeProductionLayersMap(pendingAdd.productionLayers);
    const newEntries = pendingAdd.layers.map((layer) => {
      const prodKey = normalizeProductionLayerKey(layer.kind);
      return {
        id: generateId(),
        libraryItemId: pendingAdd.id,
        layer: { ...layer, id: `${layer.id}_${Date.now()}` },
        executableLayer: pendingAdd.executableLayers[layer.kind],
        productionLayer: normalizedProd[prodKey],
        visible: true,
      } as CompositionEntry;
    });
    // Opening from Library should prioritize the selected asset, not previously accessed compositions.
    setCompId(null);
    setCompName(pendingAdd.name || "My Scene");
    setSelectedEntry(null);
    setEntries(newEntries.length > 0 ? newEntries : defaultEntries());
    setHistory([]);
    setHistoryIdx(-1);
    lastFingerprintRef.current = "";
    onPendingConsumed?.();
  }, [pendingAdd, onPendingConsumed]);

  useEffect(() => {
    if (!pendingCompId) return;
    getCompositions().then((comps) => {
      const target = comps.find((c) => c.id === pendingCompId);
      if (target) loadComposition(target);
    });
    onPendingCompConsumed?.();
  }, [pendingCompId, onPendingCompConsumed, loadComposition]);

  const createSnapshot = useCallback((e: CompositionEntry[], p: PostProcessingSettings, speed: number): ComposeSnapshot => ({
    entries: JSON.parse(JSON.stringify(e)),
    postSettings: JSON.parse(JSON.stringify(p)),
    cameraSpeed: speed,
  }), []);

  const applySnapshot = useCallback((snapshot: ComposeSnapshot) => {
    restoringHistoryRef.current = true;
    setEntries(JSON.parse(JSON.stringify(snapshot.entries)));
    setPostSettings(JSON.parse(JSON.stringify(snapshot.postSettings)));
    setCameraSpeed(snapshot.cameraSpeed);
    setTimeout(() => {
      restoringHistoryRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (restoringHistoryRef.current) return;
    const fp = JSON.stringify({ entries, postSettings, cameraSpeed });
    if (fp === lastFingerprintRef.current) return;
    lastFingerprintRef.current = fp;
    const snap = createSnapshot(entries, postSettings, cameraSpeed);
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1);
      const next = [...truncated, snap];
      setHistoryIdx(next.length - 1);
      return next;
    });
  }, [entries, postSettings, cameraSpeed, createSnapshot, historyIdx]);

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0) return;
    const target = history[historyIdx - 1];
    if (!target) return;
    setHistoryIdx(historyIdx - 1);
    applySnapshot(target);
  }, [history, historyIdx, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1 || historyIdx < 0) return;
    const target = history[historyIdx + 1];
    if (!target) return;
    setHistoryIdx(historyIdx + 1);
    applySnapshot(target);
  }, [history, historyIdx, applySnapshot]);

  const handleImportToCompose = useCallback(async (fileList: FileList) => {
    const files: { name: string; content: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      files.push({ name: fileList[i].name, content: await readFileAsText(fileList[i]) });
    }
    const result = processImportedFiles(files);
    const normalizedProd = normalizeProductionLayersMap(result.productionLayers);
    const newEntries: CompositionEntry[] = [];
    for (const [kind, exec] of Object.entries(result.executableLayers)) {
      const prodKey = normalizeProductionLayerKey(kind);
      newEntries.push({
        id: generateId(),
        layer: { id: `${kind}_${Date.now()}`, kind, attachTo: "world", params: {} },
        executableLayer: exec,
        productionLayer: normalizedProd[prodKey],
        visible: true,
      });
    }
    if (newEntries.length > 0) setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const addFromLibrary = (item: LibraryItem) => {
    const normalizedProd = normalizeProductionLayersMap(item.productionLayers || {});
    const newEntries = item.layers.map((layer) => {
      const prodKey = normalizeProductionLayerKey(layer.kind);
      return {
        id: generateId(),
        libraryItemId: item.id,
        layer: { ...layer, id: `${layer.id}_${Date.now()}` },
        executableLayer: item.executableLayers[layer.kind],
        productionLayer: normalizedProd[prodKey],
        visible: true,
      } as CompositionEntry;
    });
    setEntries((prev) => [...prev, ...newEntries]);
  };

  const toggleVisibility = (entryId: string) => {
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, visible: !e.visible } : e)));
  };

  const removeEntry = (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedEntry === entryId) setSelectedEntry(null);
  };

  const moveEntry = (entryId: string, dir: -1 | 1) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entryId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  };

  const updateParam = (entryId: string, path: string, value: any) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const params = { ...(e.layer.params || {}) };
        const parts = path.split(".");
        let obj: any = params;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
          obj[parts[i]] = { ...obj[parts[i]] };
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        return { ...e, layer: { ...e.layer, params } };
      }),
    );
  };

  const sceneDef = useMemo<SceneDef>(
    () => ({
      id: compName.replace(/\s+/g, "_").toLowerCase(),
      camera: { posY: 1.6, lookY: 1.4, lookZ: -15 },
      layers: entries.map((e) => ({ ...e.layer, visible: e.visible })),
    }),
    [entries, compName],
  );

  const execLayers = useMemo(() => {
    const out: Record<string, ExecutableLayer> = {};
    entries.forEach((e) => {
      if (e.executableLayer && e.visible) out[e.layer.kind] = e.executableLayer;
    });
    return out;
  }, [entries]);

  const selected = selectedEntry ? entries.find((e) => e.id === selectedEntry) : null;

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

  const handleSaveComposition = async () => {
    const id = compId || generateId();
    await saveComposition({ id, name: compName, camera: sceneDef.camera, entries });
    setCompId(id);
    await refreshSavedComps();
    alert(`Saved composition "${compName}".`);
  };

  const handleExportSceneConfig = () => {
    downloadFile(`${compName.replace(/\s+/g, "_")}_config.json`, JSON.stringify(sceneDef, null, 2));
  };

  const handleExportAllCode = () => {
    const parts: string[] = [];
    parts.push(`// Scene config\nexport const sceneConfig = ${JSON.stringify(sceneDef, null, 2)};`);
    entries.forEach((e) => {
      if (e.executableLayer) parts.push(`// Layer: ${e.layer.kind}\n${e.executableLayer.code}`);
    });
    downloadFile(`${compName.replace(/\s+/g, "_")}_full.ts`, parts.join("\n\n"));
  };

  const handleExportLayerFiles = async () => {
    const files = entries
      .filter((e) => !!e.executableLayer)
      .map((e) => ({ name: `${e.layer.kind}.ts`, content: e.executableLayer!.code }));
    if (files.length > 0) await downloadZip(`${compName.replace(/\s+/g, "_")}_layers`, files);
  };

  const handleExportBundle = () => {
    const bundle = {
      name: compName,
      sceneConfig: sceneDef,
      layers: entries.map((e) => ({
        kind: e.layer.kind,
        params: e.layer.params,
        visible: e.visible,
        executableCode: e.executableLayer?.code || null,
        description: e.executableLayer?.description || null,
      })),
    };
    downloadFile(`${compName.replace(/\s+/g, "_")}_bundle.json`, JSON.stringify(bundle, null, 2));
  };

  const handleExportCyclLayers = async () => {
    const files = entries
      .filter((e) => !!e.productionLayer)
      .map((e) => ({ name: e.productionLayer!.filename, content: e.productionLayer!.code }));
    if (files.length === 0) return;
    const layerMap: Record<string, ProductionLayer> = {};
    files.forEach((f) => {
      layerMap[f.name] = { filename: f.name, code: f.content, description: "" };
    });
    const invalid = Object.entries(validateProductionLayersMap(layerMap))
      .filter(([, v]) => v.errors.length > 0)
      .map(([k]) => k);
    if (invalid.length > 0) {
      const proceed = confirm(`Some Cycl files failed validation:\n${invalid.join("\n")}\n\nDownload anyway?`);
      if (!proceed) return;
    }
    await downloadZip(`${compName.replace(/\s+/g, "_")}_cycl`, files);
  };

  const cyclLayerCount = entries.filter((e) => e.productionLayer).length;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--app-font-family)" }}>
      <div style={{ width: 340, borderRight: "1px solid var(--color-border)", background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 16, flex: 1 }}>Compose</h2>
            <button onClick={() => setShowCompPicker((s) => !s)} style={smallBtn}>{savedComps.length > 0 ? `Load (${savedComps.length})` : "Load"}</button>
            <button onClick={() => { setCompId(null); setCompName("My Scene"); setEntries(defaultEntries()); setSelectedEntry(null); }} style={smallBtn}>New</button>
            <button onClick={handleSaveComposition} style={{ ...smallBtn, background: "#228833", color: "#fff" }}>{compId ? "Save" : "Save As New"}</button>
            <button onClick={() => composeImportRef.current?.click()} style={iconBtn} title="Import"><Import size={14} /></button>
            <button onClick={() => setShowExportPanel((s) => !s)} style={smallBtn}>Export</button>
          </div>
          <input value={compName} onChange={(e) => setCompName(e.target.value)} style={{ ...inputStyle, marginTop: 8, width: "100%" }} />
          <input
            type="file"
            ref={composeImportRef}
            accept=".json,.js,.ts,.tsx"
            multiple
            style={{ display: "none" }}
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                await handleImportToCompose(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {showCompPicker && (
          <div style={{ borderBottom: "1px solid var(--color-border)", padding: 8, maxHeight: 220, overflowY: "auto", background: "var(--color-surface)" }}>
            {savedComps.length === 0 ? (
              <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>No saved compositions yet.</div>
            ) : (
              savedComps.map((comp) => (
                <div key={comp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer" }}>
                  <span style={{ flex: 1 }} onClick={() => loadComposition(comp)}>{comp.name}</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{comp.entries.length}L</span>
                  <button style={smallBtn} onClick={async () => { await deleteComposition(comp.id); await refreshSavedComps(); }}>Del</button>
                </div>
              ))
            )}
          </div>
        )}

        {showExportPanel && (
          <div style={{ borderBottom: "1px solid var(--color-border)", padding: 10, background: "var(--color-surface)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button onClick={handleExportAllCode} style={smallBtn}>Download Full Scene Code (.ts)</button>
              <button onClick={handleExportSceneConfig} style={smallBtn}>Download Scene Config (.json)</button>
              <button onClick={handleExportLayerFiles} style={smallBtn}>Download Layer Files (.zip)</button>
              <button onClick={handleExportBundle} style={smallBtn}>Download Bundle (.json)</button>
              <div style={{ borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />
              {cyclLayerCount > 0 ? (
                <button onClick={handleExportCyclLayers} style={smallBtn}>Download Cycl Layers (.zip)</button>
              ) : (
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Cycl Layers — None available</div>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setSelectedEntry(entry.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 12,
                background: selectedEntry === entry.id ? "var(--color-surface-2)" : "transparent",
                borderLeft: selectedEntry === entry.id ? "3px solid var(--color-primary)" : "3px solid transparent",
                opacity: entry.visible ? 1 : 0.5,
              }}
            >
              <button onClick={(e) => { e.stopPropagation(); toggleVisibility(entry.id); }} style={ghostBtn}>{entry.visible ? "V" : "-"}</button>
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.layer.kind}</span>
              <button onClick={(e) => { e.stopPropagation(); moveEntry(entry.id, -1); }} style={ghostBtn}>Up</button>
              <button onClick={(e) => { e.stopPropagation(); moveEntry(entry.id, 1); }} style={ghostBtn}>Dn</button>
              <button onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }} style={{ ...ghostBtn, color: "#f88" }}>X</button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--color-border)", padding: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {BUILTIN_LAYERS.map((kind) => (
              <button key={kind} onClick={() => setEntries((prev) => [...prev, { id: generateId(), layer: { id: `${kind}_${Date.now()}`, kind, attachTo: "scene", params: {} }, visible: true }])} style={smallChip}>
                + {kind.replace(/_v\d+/, "")}
              </button>
            ))}
            <button onClick={() => setShowLibPicker((s) => !s)} style={smallChip}>+ From Library</button>
          </div>
          {showLibPicker && <LibraryPicker onSelect={(item) => { addFromLibrary(item); setShowLibPicker(false); }} onClose={() => setShowLibPicker(false)} />}
        </div>

        {selected && (
          <div style={{ borderTop: "1px solid var(--color-border)", padding: 10, maxHeight: 230, overflowY: "auto" }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>{selected.layer.kind.toUpperCase()} PROPERTIES</div>
            <LayerParamEditor entry={selected} onUpdate={(p, v) => updateParam(selected.id, p, v)} />
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--color-border)", maxHeight: 210, overflowY: "auto" }}>
          <PostProcessingControls settings={postSettings} onChange={setPostSettings} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, background: "#000", position: "relative" }}>
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 15, display: "flex", gap: 6 }}>
          <button onClick={handleUndo} disabled={historyIdx <= 0} style={overlayBtn}><Undo2 size={14} /></button>
          <button onClick={handleRedo} disabled={historyIdx >= history.length - 1 || historyIdx < 0} style={overlayBtn}><Redo2 size={14} /></button>
        </div>
        <Suspense fallback={<div style={{ color: "var(--color-text-muted)", padding: 20 }}>Loading...</div>}>
          <ScenePreview
            sceneConfig={sceneDef}
            executableLayers={execLayers}
            cameraSpeed={cameraSpeed}
            interactionEnabled={true}
            postProcessing={postSettings}
            sceneRefOut={sceneRefOut}
          />
        </Suspense>
      </div>
    </div>
  );
}

function LibraryPicker({
  onSelect,
  onClose,
}: {
  onSelect: (item: LibraryItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  useEffect(() => {
    getLibrary().then(setItems);
  }, []);
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 8, maxHeight: 180, overflowY: "auto", background: "var(--color-surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>SELECT FROM LIBRARY</span>
        <button onClick={onClose} style={ghostBtn}>X</button>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Library is empty.</div>
      ) : (
        items.map((item) => (
          <div key={item.id} onClick={() => onSelect(item)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4, cursor: "pointer" }}>
            <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{item.type === "object" ? "OBJ" : "SCN"}</span>
            <span style={{ flex: 1 }}>{item.name}</span>
            <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{item.layers.length}L</span>
          </div>
        ))
      )}
    </div>
  );
}

function LayerParamEditor({
  entry,
  onUpdate,
}: {
  entry: CompositionEntry;
  onUpdate: (path: string, value: any) => void;
}) {
  const p = entry.layer.params || {};

  const textInput = (label: string, path: string, value: string | number) => (
    <div key={path} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <label style={{ width: 80, fontSize: 11, color: "var(--color-text-muted)" }}>{label}</label>
      <input
        value={value as any}
        onChange={(e) => {
          const next = e.target.value;
          onUpdate(path, /^\d+(\.\d+)?$/.test(next) ? parseFloat(next) : next);
        }}
        style={{ ...inputStyle, flex: 1, padding: "5px 7px", fontSize: 11 }}
      />
    </div>
  );

  return (
    <div>
      {Object.entries(p).length === 0 && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>No editable params.</div>
      )}
      {Object.entries(p).map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          return Object.entries(v).map(([k2, v2]) =>
            textInput(`${k}.${k2}`, `${k}.${k2}`, v2 as any),
          );
        }
        return textInput(k, k, v as any);
      })}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const smallBtn: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  fontSize: 11,
  padding: 0,
};

const smallChip: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 6,
  fontSize: 10,
  padding: "4px 8px",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 6,
  outline: "none",
};

const overlayBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(18,122,226,0.9)",
  color: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
