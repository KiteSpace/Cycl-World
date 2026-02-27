import { useState, useRef, Suspense, lazy, useEffect, useCallback } from "react";
import {
  Import,
  Paperclip,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import type {
  SceneDef,
  Message,
  GenerateSceneResponse,
  ExecutableLayer,
  ProductionLayer,
  LibraryItem,
  PostProcessingSettings,
} from "../types";
import { saveLibraryItem, generateId } from "../lib/library";
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
import { ShimmerBar, SkeletonCodeBlock } from "./SkeletonLoader";

const ScenePreview = lazy(() => import("./ScenePreview"));

interface CreateEditViewProps {
  editItem?: LibraryItem | null;
  onSaved?: (item: LibraryItem) => void;
  onDiscard?: () => void;
}

interface Snapshot {
  scene: SceneDef | null;
  code: string;
  executableLayers: Record<string, ExecutableLayer>;
  productionLayers: Record<string, ProductionLayer>;
}

export default function CreateEditView({
  editItem,
  onSaved,
  onDiscard,
}: CreateEditViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentScene, setCurrentScene] = useState<SceneDef | null>(null);
  const [currentCode, setCurrentCode] = useState("");
  const [executableLayers, setExecutableLayers] = useState<Record<string, ExecutableLayer>>({});
  const [productionLayers, setProductionLayers] = useState<Record<string, ProductionLayer>>({});
  const [hasCustomLayers, setHasCustomLayers] = useState(false);
  const [activeTab, setActiveTab] = useState<"demo" | "code" | "layers" | "cycl">("demo");
  const [itemType, setItemType] = useState<"object" | "scene">("scene");
  const [itemName, setItemName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [complexity, setComplexity] = useState<"medium" | "high" | "ultra">("high");
  const [materialQuality, setMaterialQuality] = useState<"basic" | "pbr">("pbr");
  const [postSettings, setPostSettings] = useState<PostProcessingSettings>({
    bloom: { enabled: true, strength: 1.5, threshold: 0, radius: 0.5 },
  });
  const [showPostControls, setShowPostControls] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const sceneRefOut = useRef<SceneInternals | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const restoringHistoryRef = useRef(false);

  useEffect(() => {
    if (!editItem) return;
    const sceneDef: SceneDef = {
      id: editItem.id,
      camera: editItem.camera,
      layers: editItem.layers,
    };
    setCurrentScene(sceneDef);
    setCurrentCode(JSON.stringify(sceneDef, null, 2));
    setExecutableLayers(editItem.executableLayers || {});
    setProductionLayers(normalizeProductionLayersMap(editItem.productionLayers || {}));
    setHasCustomLayers(Object.keys(editItem.executableLayers || {}).length > 0);
    setItemType(editItem.type);
    setItemName(editItem.name);
    setMessages([
      {
        role: "assistant",
        content: `Editing "${editItem.name}". Describe what to update.`,
        sceneConfig: sceneDef,
      },
    ]);
    setHistory([]);
    setHistoryIdx(-1);
    setDirty(false);
  }, [editItem]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const pushHistory = useCallback(
    (scene: SceneDef | null, code: string, exec: Record<string, ExecutableLayer>, prod: Record<string, ProductionLayer>) => {
      if (!scene || restoringHistoryRef.current) return;
      const snapshot: Snapshot = {
        scene: JSON.parse(JSON.stringify(scene)),
        code,
        executableLayers: JSON.parse(JSON.stringify(exec)),
        productionLayers: JSON.parse(JSON.stringify(prod)),
      };
      setHistory((prev) => {
        const truncated = prev.slice(0, historyIdx + 1);
        const next = [...truncated, snapshot];
        setHistoryIdx(next.length - 1);
        return next;
      });
    },
    [historyIdx],
  );

  const applySnapshot = useCallback((snapshot: Snapshot) => {
    restoringHistoryRef.current = true;
    setCurrentScene(snapshot.scene ? JSON.parse(JSON.stringify(snapshot.scene)) : null);
    setCurrentCode(snapshot.code);
    setExecutableLayers(JSON.parse(JSON.stringify(snapshot.executableLayers)));
    setProductionLayers(normalizeProductionLayersMap(snapshot.productionLayers));
    setHasCustomLayers(Object.keys(snapshot.executableLayers).length > 0);
    setTimeout(() => {
      restoringHistoryRef.current = false;
    }, 0);
  }, []);

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

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    await handleImportFiles(dt.files);
  };

  const handleImportFiles = useCallback(async (fileList: FileList) => {
    const files: { name: string; content: string }[] = [];
    for (let i = 0; i < fileList.length; i++) {
      files.push({
        name: fileList[i].name,
        content: await readFileAsText(fileList[i]),
      });
    }

    const result = processImportedFiles(files);
    setImportWarnings(result.warnings);

    if (result.sceneDef) {
      setCurrentScene(result.sceneDef);
      setCurrentCode(JSON.stringify(result.sceneDef, null, 2));
    }
    if (Object.keys(result.executableLayers).length > 0) {
      setExecutableLayers((prev) => ({ ...prev, ...result.executableLayers }));
      setHasCustomLayers(true);
    }
    if (Object.keys(result.productionLayers).length > 0) {
      setProductionLayers((prev) => normalizeProductionLayersMap({ ...prev, ...result.productionLayers }));
    }
    if (!itemName && result.name) setItemName(result.name);
    setDirty(true);
    setActiveTab("demo");
  }, [itemName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !image) return;
    setLoading(true);
    try {
      let imageBase64: string | undefined;
      if (image) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(image);
        });
      }

      const requestBody: Record<string, any> = {
        prompt: prompt.trim() || "Analyze this image and create a scene.",
        imageBase64,
        conversationHistory: messages,
        complexity,
        materialQuality,
      };
      if (currentScene) {
        requestBody.currentSceneConfig = currentScene;
        requestBody.currentExecutableLayers = executableLayers;
        requestBody.currentProductionLayers = productionLayers;
      }

      const response = await fetch("/api/generate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data: GenerateSceneResponse = await response.json();
      if (!data.sceneConfig) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: prompt || "(attachment)" },
          { role: "assistant", content: data.error || data.explanation || "Generation failed." },
        ]);
        return;
      }

      const nextScene = data.sceneConfig;
      const nextCode = data.code || JSON.stringify(nextScene, null, 2);
      const nextExec = data.editMode
        ? { ...executableLayers, ...(data.executableLayers || {}) }
        : (data.executableLayers || {});
      const nextProd = data.editMode
        ? normalizeProductionLayersMap({ ...productionLayers, ...((data.productionLayers || {}) as Record<string, ProductionLayer>) })
        : normalizeProductionLayersMap((data.productionLayers || {}) as Record<string, ProductionLayer>);

      pushHistory(currentScene, currentCode, executableLayers, productionLayers);
      setCurrentScene(nextScene);
      setCurrentCode(nextCode);
      setExecutableLayers(nextExec);
      setProductionLayers(nextProd);
      setHasCustomLayers(Object.keys(nextExec).length > 0);
      setDirty(true);
      if (!itemName && nextScene.id) setItemName(nextScene.id.replace(/_/g, " "));
      setMessages((prev) => [
        ...prev,
        { role: "user", content: prompt.trim() || "(attachment)" },
        { role: "assistant", content: data.explanation || "Generated.", sceneConfig: nextScene },
      ]);
      setPrompt("");
      setImage(null);
      setImagePreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScene = async (saveAs: boolean, explicitName?: string) => {
    if (!currentScene) return;
    const id = !saveAs && editItem ? editItem.id : generateId();
    const item: LibraryItem = {
      id,
      name: explicitName?.trim() || itemName || currentScene.id || "Untitled",
      type: itemType,
      description:
        messages
          .filter((m) => m.role === "assistant")
          .pop()
          ?.content.slice(0, 180) || "",
      layers: currentScene.layers,
      executableLayers,
      productionLayers,
      camera: currentScene.camera,
      createdAt: editItem && !saveAs ? editItem.createdAt : Date.now(),
      updatedAt: Date.now(),
      tags: [],
    };
    await saveLibraryItem(item);
    setItemName(item.name);
    setDirty(false);
    onSaved?.(item);
  };

  const handleSaveLayers = async (selectedLayerIds: string[]) => {
    if (!currentScene) return 0;
    let count = 0;
    for (const layer of currentScene.layers) {
      if (!selectedLayerIds.includes(layer.id)) continue;
      const prodKey = normalizeProductionLayerKey(layer.kind);
      const item: LibraryItem = {
        id: generateId(),
        name: layer.kind.replace(/_/g, " "),
        type: "object",
        description: `Saved from ${itemName || currentScene.id}`,
        layers: [layer],
        executableLayers: executableLayers[layer.kind] ? { [layer.kind]: executableLayers[layer.kind] } : {},
        productionLayers: productionLayers[prodKey] ? { [prodKey]: productionLayers[prodKey] } : {},
        camera: currentScene.camera,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [itemName || currentScene.id],
      };
      await saveLibraryItem(item);
      count++;
    }
    return count;
  };

  const copyCode = () => navigator.clipboard.writeText(currentCode);
  const downloadTextFile = (name: string, content: string) => {
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
  const downloadAllEditableCode = async () => {
    const base = (itemName || currentScene?.id || "scene").replace(/\s+/g, "_");
    const files: { name: string; content: string }[] = [
      {
        name: "scene_config.json",
        content: currentScene ? JSON.stringify(currentScene, null, 2) : currentCode,
      },
    ];
    Object.entries(executableLayers).forEach(([kind, layer]) => {
      files.push({ name: `${kind}.ts`, content: layer.code });
    });
    Object.values(productionLayers).forEach((layer) => {
      files.push({ name: layer.filename, content: layer.code });
    });
    await downloadZip(`${base}_code`, files);
  };
  const copyAll = (map: Record<string, ProductionLayer>) => {
    const text = Object.values(map).map((l) => `// ${l.filename}\n\n${l.code}`).join("\n\n");
    navigator.clipboard.writeText(text);
  };
  const downloadAll = async (zipName: string, map: Record<string, ProductionLayer>) => {
    await downloadZip(zipName, Object.values(map).map((l) => ({ name: l.filename, content: l.code })));
  };

  const cyclValidation = validateProductionLayersMap(productionLayers);
  const hasCyclLayers = Object.keys(productionLayers).length > 0;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--app-font-family)" }}>
      <div style={{ width: "42%", minWidth: 340, borderRight: "1px solid var(--color-border)", background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => importInputRef.current?.click()} style={iconBtn} title="Import files"><Import size={14} /></button>
            <button onClick={() => setShowSaveDialog(true)} disabled={!currentScene} style={{ ...smallBtn, opacity: currentScene ? 1 : 0.5 }}><Save size={14} /> Save</button>
            <select value={itemType} onChange={(e) => setItemType(e.target.value as "object" | "scene")} style={selectStyle}>
              <option value="object">Object</option>
              <option value="scene">Scene</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={tinyLabel}>Complexity</label>
            {[
              { value: "medium", label: "Low" },
              { value: "high", label: "Medium" },
              { value: "ultra", label: "High" },
            ].map((c) => (
              <button
                key={c.value}
                onClick={() => setComplexity(c.value as "medium" | "high" | "ultra")}
                style={{ ...pillBtn, background: complexity === c.value ? "var(--color-primary)" : "var(--color-surface-2)" }}
              >
                {c.label}
              </button>
            ))}
            <label style={tinyLabel}>Materials</label>
            <select value={materialQuality} onChange={(e) => setMaterialQuality(e.target.value as "basic" | "pbr")} style={selectStyle}>
              <option value="basic">Basic</option>
              <option value="pbr">PBR</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {messages.length === 0 && (
            <div style={{ color: "var(--color-text-muted)", fontSize: 13, textAlign: "center", marginTop: 24 }}>
              Describe what to build or attach an image/file.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 10, border: "1px solid var(--color-border)", background: m.role === "user" ? "var(--color-surface-2)" : "var(--color-surface)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>{m.role === "user" ? "You" : "Claude"}</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{m.content}</div>
            </div>
          ))}
          {importWarnings.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#c88" }}>
              {importWarnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ borderTop: "1px solid var(--color-border)", padding: 12, background: "var(--color-surface)" }}>
          {imagePreview && <img src={imagePreview} alt="" style={{ maxWidth: 180, maxHeight: 120, borderRadius: 6, border: "1px solid var(--color-border)", marginBottom: 8 }} />}
          {loading ? (
            <ShimmerBar label="Generating scene..." />
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
              <input ref={attachmentInputRef} type="file" accept="image/*,.json,.js,.ts,.tsx" onChange={handleAttachmentSelect} style={{ display: "none" }} />
              <button type="button" onClick={() => attachmentInputRef.current?.click()} style={iconBtn} title="Attach"><Paperclip size={14} /></button>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={image ? "Describe changes (optional)" : "Describe what to create..."}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="submit" disabled={!prompt.trim() && !image} style={{ ...smallBtn, background: "var(--color-primary)", color: "#fff" }}>
                Generate
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
        <div style={{ padding: 10, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["demo", "code", "layers", "cycl"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ ...pillBtn, background: activeTab === t ? "var(--color-primary)" : "var(--color-surface-2)" }}>{t.toUpperCase()}</button>
            ))}
            {activeTab === "demo" && <button onClick={() => setShowPostControls((s) => !s)} style={pillBtn}>FX</button>}
          </div>
          {activeTab === "code" && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={copyCode} style={smallBtn}>Copy</button>
              {editItem && (
                <>
                  <button
                    onClick={() => downloadTextFile(`${(itemName || currentScene?.id || "scene").replace(/\s+/g, "_")}_scene_config.json`, currentScene ? JSON.stringify(currentScene, null, 2) : currentCode)}
                    style={smallBtn}
                  >
                    Download
                  </button>
                  <button onClick={downloadAllEditableCode} style={smallBtn}>Download All</button>
                </>
              )}
            </div>
          )}
          {activeTab === "layers" && hasCyclLayers && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => copyAll(productionLayers)} style={smallBtn}>Copy All</button>
              <button onClick={() => downloadAll(`${(itemName || currentScene?.id || "scene").replace(/\s+/g, "_")}_layers`, productionLayers)} style={smallBtn}>Download .zip</button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, position: "relative", overflowY: "auto", padding: activeTab === "demo" ? 0 : 12 }}>
          {currentScene ? (
            <>
              {activeTab === "demo" && (
                <div style={{ height: "100%", position: "relative" }}>
                  <Suspense fallback={<div style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading preview...</div>}>
                    <ScenePreview sceneConfig={currentScene} executableLayers={executableLayers} interactionEnabled={true} postProcessing={postSettings} sceneRefOut={sceneRefOut} />
                  </Suspense>
                  <div style={{ position: "absolute", left: 10, top: 10, zIndex: 20, display: "flex", gap: 6 }}>
                    <button onClick={handleUndo} disabled={historyIdx <= 0} style={overlayBtn}><Undo2 size={14} /></button>
                    <button onClick={handleRedo} disabled={historyIdx >= history.length - 1 || historyIdx < 0} style={overlayBtn}><Redo2 size={14} /></button>
                  </div>
                  {showPostControls && (
                    <div style={{ position: "absolute", right: 12, top: 44, width: 240, border: "1px solid var(--color-border)", borderRadius: 8, background: "rgba(0,0,0,0.8)", zIndex: 20 }}>
                      <PostProcessingControls settings={postSettings} onChange={setPostSettings} />
                    </div>
                  )}
                </div>
              )}
              {activeTab === "code" && (
                <pre style={{ background: "#0f0f1e", border: "1px solid #1f1f2e", borderRadius: 8, padding: 12, color: "#c8f", fontSize: 12, overflowX: "auto" }}>{currentCode}</pre>
              )}
              {activeTab === "layers" && (
                <div>
                  {Object.entries(executableLayers).length === 0 && <div style={{ color: "var(--color-text-muted)" }}>No custom executable layers.</div>}
                  {Object.entries(executableLayers).map(([kind, layer]) => (
                    <div key={kind} style={{ marginBottom: 14 }}>
                      <div style={{ marginBottom: 4, color: "var(--color-text)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{kind}</span>
                        {editItem && (
                          <button onClick={() => downloadTextFile(`${kind}.ts`, layer.code)} style={smallBtn}>Download</button>
                        )}
                      </div>
                      <pre style={{ background: "#111", border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, color: "#ddd", fontSize: 11, overflowX: "auto" }}>{layer.code}</pre>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "cycl" && (
                <div>
                  {!hasCyclLayers && <div style={{ color: "var(--color-text-muted)" }}>No Cycl layers yet.</div>}
                  {Object.entries(productionLayers).map(([k, layer]) => {
                    const v = cyclValidation[k] || { errors: [], warnings: [] as string[] };
                    return (
                      <div key={k} style={{ marginBottom: 14 }}>
                        <div style={{ marginBottom: 4, color: "var(--color-text)", fontWeight: 600 }}>{layer.filename}</div>
                        {(v.errors.length > 0 || v.warnings.length > 0) && (
                          <div style={{ marginBottom: 6, fontSize: 11, color: v.errors.length > 0 ? "#f88" : "#cc8" }}>
                            {v.errors.length} error(s), {v.warnings.length} warning(s)
                          </div>
                        )}
                        <pre style={{ background: "#0a1a10", border: "1px solid #1a2a1a", borderRadius: 8, padding: 10, color: "#7fd9a8", fontSize: 11, overflowX: "auto" }}>{layer.code}</pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : loading ? (
            <div style={{ padding: 16 }}>
              <SkeletonCodeBlock title="scene_config.json" lineCount={12} />
            </div>
          ) : (
            <div style={{ padding: 24, color: "var(--color-text-muted)" }}>Generate something to see a preview.</div>
          )}
        </div>
      </div>

      <input ref={importInputRef} type="file" accept=".json,.js,.ts,.tsx" multiple style={{ display: "none" }} onChange={async (e) => {
        if (e.target.files && e.target.files.length > 0) await handleImportFiles(e.target.files);
      }} />

      {showSaveDialog && currentScene && (
        <SaveDialog
          scene={currentScene}
          sceneName={itemName || currentScene.id}
          isEditing={!!editItem}
          executableLayers={executableLayers}
          onSaveScene={async (saveAs, name) => {
            await handleSaveScene(saveAs, name);
            setShowSaveDialog(false);
          }}
          onSaveLayers={async (ids) => {
            const count = await handleSaveLayers(ids);
            setShowSaveDialog(false);
            alert(`Saved ${count} layer(s).`);
          }}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}

function SaveDialog({
  scene,
  sceneName,
  isEditing,
  executableLayers,
  onSaveScene,
  onSaveLayers,
  onClose,
}: {
  scene: SceneDef;
  sceneName: string;
  isEditing: boolean;
  executableLayers: Record<string, ExecutableLayer>;
  onSaveScene: (saveAs: boolean, name: string) => void;
  onSaveLayers: (layerIds: string[]) => void;
  onClose: () => void;
}) {
  const [saveName, setSaveName] = useState(sceneName);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxHeight: "80vh", overflowY: "auto", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Save to Library</h3>
        <div style={{ marginBottom: 10, fontSize: 11, color: "var(--color-text-muted)" }}>NAME</div>
        <input value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => onSaveScene(false, saveName)} style={{ ...smallBtn, flex: 1, background: "#228833", color: "#fff" }}>{isEditing ? `Update "${sceneName}"` : "Save Scene"}</button>
          {isEditing && <button onClick={() => onSaveScene(true, saveName)} style={{ ...smallBtn, flex: 1 }}>Save As New</button>}
        </div>
        <div style={{ borderTop: "1px solid var(--color-border)", margin: "12px 0" }} />
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>SAVE INDIVIDUAL LAYERS AS OBJECTS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {scene.layers.map((layer) => {
            const isCustom = !BUILTIN_LAYERS.includes(layer.kind);
            const hasCode = !!executableLayers[layer.kind];
            const checked = selected.has(layer.id);
            return (
              <label key={layer.id} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--color-border)", borderRadius: 6, padding: 8, background: checked ? "var(--color-surface-2)" : "transparent" }}>
                <input type="checkbox" checked={checked} onChange={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(layer.id)) next.delete(layer.id);
                    else next.add(layer.id);
                    return next;
                  });
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{layer.kind}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{isCustom ? "custom" : "built-in"}{hasCode ? " • has code" : ""}</div>
                </div>
              </label>
            );
          })}
        </div>
        <button onClick={() => onSaveLayers(Array.from(selected))} disabled={selected.size === 0} style={{ ...smallBtn, width: "100%", opacity: selected.size ? 1 : 0.5 }}>
          Save {selected.size} Layer{selected.size === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 6,
  padding: "7px 10px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const pillBtn: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  borderRadius: 6,
  padding: "4px 8px",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  background: "var(--color-surface-2)",
  color: "var(--color-text)",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
};

const tinyLabel: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-text-muted)",
};

const overlayBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(18,122,226,0.9)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
