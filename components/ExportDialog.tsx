import { useState } from "react";
import * as THREE from "three";

interface ExportDialogProps {
  sceneRef: React.RefObject<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer } | null>;
  onClose: () => void;
}

export default function ExportDialog({ sceneRef, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<"glb" | "gltf" | "obj">("glb");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const internals = sceneRef.current;
    if (!internals) return;

    setExporting(true);
    try {
      const { scene } = internals;

      const removed: THREE.Object3D[] = [];
      [...scene.children].forEach((c) => {
        if (c.userData.noExport || c.userData.isControl) {
          removed.push(c);
          scene.remove(c);
        }
      });

      if (format === "glb" || format === "gltf") {
        const { GLTFExporter } = await import(
          // @ts-ignore -- dynamic import of Three.js example
          "three/examples/jsm/exporters/GLTFExporter.js"
        );
        const exporter = new GLTFExporter();
        const options = { binary: format === "glb" };
        exporter.parse(
          scene,
          (result: any) => {
            removed.forEach((c) => scene.add(c));
            if (result instanceof ArrayBuffer) {
              downloadBlob(
                new Blob([result], { type: "model/gltf-binary" }),
                `scene.${format}`,
              );
            } else {
              const json = JSON.stringify(result, null, 2);
              downloadBlob(
                new Blob([json], { type: "model/gltf+json" }),
                `scene.${format}`,
              );
            }
            setExporting(false);
          },
          (error: any) => {
            removed.forEach((c) => scene.add(c));
            console.error("Export error:", error);
            setExporting(false);
          },
          options,
        );
        return;
      }

      if (format === "obj") {
        const { OBJExporter } = await import(
          // @ts-ignore -- dynamic import of Three.js example
          "three/examples/jsm/exporters/OBJExporter.js"
        );
        const exporter = new OBJExporter();
        const result = exporter.parse(scene);
        removed.forEach((c) => scene.add(c));
        downloadBlob(new Blob([result], { type: "text/plain" }), "scene.obj");
      }
    } catch (e) {
      console.error("Export failed:", e);
    }
    setExporting(false);
  };

  const handleScreenshot = () => {
    const internals = sceneRef.current;
    if (!internals) return;
    const { renderer } = internals;
    const dataUrl = renderer.domElement.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "scene-screenshot.png";
    link.click();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1a1a2e",
          border: "1px solid #333",
          borderRadius: 12,
          padding: 24,
          width: 380,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <h3 style={{ margin: "0 0 16px", color: "#fff", fontSize: 16 }}>
          Export Scene
        </h3>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: "#888",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            FORMAT
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["glb", "gltf", "obj"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  fontSize: 12,
                  fontWeight: 600,
                  background: format === f ? "var(--color-primary)" : "#111",
                  border:
                    format === f ? "1px solid #8866ee" : "1px solid #333",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
            {format === "glb" && "Binary glTF. Best for most use cases."}
            {format === "gltf" && "JSON glTF + separate binary buffer."}
            {format === "obj" && "Wavefront OBJ. Geometry only, no materials."}
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            width: "100%",
            padding: "10px 0",
            marginBottom: 12,
            background: exporting ? "#444" : "#228833",
            border: "none",
            color: "#fff",
            borderRadius: 6,
            cursor: exporting ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {exporting ? "Exporting..." : `Export as ${format.toUpperCase()}`}
        </button>

        <div style={{ borderTop: "1px solid #333", margin: "12px 0" }} />

        <button
          onClick={handleScreenshot}
          style={{
            width: "100%",
            padding: "8px 0",
            background: "#2a3a5a",
            border: "none",
            color: "#88ccff",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Download Screenshot
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "8px 0",
            marginTop: 12,
            background: "transparent",
            border: "1px solid #333",
            color: "#888",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
