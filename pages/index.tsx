import { useState, useCallback, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import type { LibraryItem } from "../types";
import CreateEditView from "../components/CreateEditView";
import LibraryView from "../components/LibraryView";
import ComposeView from "../components/ComposeView";
import { useTheme } from "../lib/theme";

type View = "create" | "library" | "compose";

export default function App() {
  const { mode, toggle } = useTheme();
  const [view, setView] = useState<View>("create");
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [pendingCompose, setPendingCompose] = useState<LibraryItem | null>(null);
  const [pendingCompId, setPendingCompId] = useState<string | null>(null);
  // #region agent log
  useEffect(() => {
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index:App:mount',message:'App MOUNTED',data:{initialView:'create'},timestamp:Date.now()})}).catch(()=>{});
  }, []);
  // #endregion

  const handleEdit = useCallback((item: LibraryItem) => {
    setEditItem(item);
    setView("create");
  }, []);

  const handleAddToComposer = useCallback((item: LibraryItem) => {
    setPendingCompose(item);
    setView("compose");
  }, []);

  const handleOpenComposition = useCallback((compId: string) => {
    setPendingCompId(compId);
    setView("compose");
  }, []);

  const handleSaved = useCallback((_item: LibraryItem) => {
    setEditItem(null);
  }, []);

  const handleDiscard = useCallback(() => {
    setEditItem(null);
  }, []);

  const handleNewCreate = useCallback(() => {
    setEditItem(null);
    setView("create");
  }, []);

  const navBtn = (v: View, label: string) => (
    <button
      key={v}
      onClick={() => v === "create" ? handleNewCreate() : setView(v)}
      style={{
        padding: "8px 16px",
        background: view === v ? "var(--color-primary)" : "transparent",
        border: "none",
        color: view === v ? "#fff" : "var(--color-text-muted)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "var(--app-font-family)", background: "var(--color-bg)" }}>
      {/* Navigation bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "6px 16px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <span style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 15, marginRight: 8 }}>
          Scene Builder
        </span>
        {navBtn("create", editItem ? `Editing: ${editItem.name}` : "Create")}
        {navBtn("library", "Library")}
        {navBtn("compose", "Compose")}
        <button
          onClick={toggle}
          style={{
            marginLeft: "auto",
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface-2)",
            color: "var(--color-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          aria-label="Toggle light and dark theme"
        >
          {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {view === "create" && (
          <CreateEditView
            editItem={editItem}
            onSaved={handleSaved}
            onDiscard={handleDiscard}
          />
        )}
        {view === "library" && (
          <LibraryView
            onEdit={handleEdit}
            onAddToComposer={handleAddToComposer}
            onOpenComposition={handleOpenComposition}
          />
        )}
        {view === "compose" && (
          <ComposeView
            pendingAdd={pendingCompose}
            onPendingConsumed={() => setPendingCompose(null)}
            pendingCompId={pendingCompId}
            onPendingCompConsumed={() => setPendingCompId(null)}
          />
        )}
      </div>
    </div>
  );
}
