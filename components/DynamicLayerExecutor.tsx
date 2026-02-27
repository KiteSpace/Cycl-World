import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { validateLayerCode, sanitizeCode, type ValidationResult } from "../lib/LayerCodeValidator";
import { GEOMETRY_UTILS } from "../lib/geometryModifiers";

interface SingleMeshResult {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  animate?: (time: number, mesh: THREE.Mesh) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

interface GroupResult {
  group: THREE.Group;
  animate?: (time: number, group: THREE.Group) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

type LayerCreateResult = SingleMeshResult | GroupResult;

interface LayerDefinition {
  create: (params: any) => LayerCreateResult;
}

interface DynamicLayerExecutorProps {
  layerCode: string;
  layerParams: any;
  layerName: string;
  scene: THREE.Scene;
  onStatusChange?: (status: ExecutionStatus) => void;
}

export type ExecutionStatus =
  | { type: "success"; confidence: "high" | "medium" | "low"; validation: ValidationResult }
  | { type: "error"; message: string; validation: ValidationResult }
  | { type: "loading" };

function isGroupResult(result: LayerCreateResult): result is GroupResult {
  return "group" in result && result.group instanceof THREE.Group;
}

function centerOnOrigin(obj: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;

  const center = new THREE.Vector3();
  box.getCenter(center);

  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);
  const offset = center.clone().sub(worldPos);

  if (offset.lengthSq() < 0.0001) return;

  if (obj instanceof THREE.Mesh && obj.geometry) {
    obj.geometry.computeBoundingBox();
    const geoBox = obj.geometry.boundingBox;
    if (geoBox) {
      const geoCenter = new THREE.Vector3();
      geoBox.getCenter(geoCenter);
      obj.geometry.translate(-geoCenter.x, -geoCenter.y, -geoCenter.z);
      obj.position.add(geoCenter);
    }
  } else {
    for (const child of obj.children) {
      child.position.sub(offset);
    }
    obj.position.add(offset);
  }
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

function createPlaceholder(name: string): THREE.Group {
  const group = new THREE.Group();

  const geo = new THREE.BoxGeometry(2, 2, 2);
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.7 });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  group.add(wireframe);
  geo.dispose();

  const sprite = makeTextSprite(`Warning: ${name}`, { color: "#ff6666", bgColor: "rgba(40,0,0,0.7)" });
  sprite.position.set(0, 2, 0);
  group.add(sprite);

  group.position.set(0, 2, -20);

  wireframe.userData.animate = (time: number) => {
    wireframe.rotation.y = time * 0.5;
    wireframe.rotation.x = Math.sin(time) * 0.2;
  };

  return group;
}

function makeTextSprite(text: string, opts: { color?: string; bgColor?: string } = {}): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = opts.bgColor || "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 24px monospace";
  ctx.fillStyle = opts.color || "#ff6666";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);
  return sprite;
}

export function DynamicLayerExecutor({
  layerCode,
  layerParams,
  layerName,
  scene,
  onStatusChange,
}: DynamicLayerExecutorProps) {
  const objectRef = useRef<THREE.Object3D | null>(null);
  const animateFnRef = useRef<((time: number, obj: THREE.Object3D) => void) | null>(null);
  // Store callback in a ref so it's never a useEffect dependency —
  // changing the callback should not re-execute layer code.
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;
  const [status, setStatus] = useState<ExecutionStatus>({ type: "loading" });

  useEffect(() => {
    let sceneObject: THREE.Object3D | null = null;

    try {
      const validation = validateLayerCode(layerCode);

      if (!validation.isValid) {
        const errorStatus: ExecutionStatus = {
          type: "error",
          message: validation.errors.join(", "),
          validation,
        };
        setStatus(errorStatus);
        onStatusRef.current?.(errorStatus);

        const placeholder = createPlaceholder(layerName);
        scene.add(placeholder);
        sceneObject = placeholder;
        objectRef.current = placeholder;
        return;
      }

      const sanitized = sanitizeCode(layerCode);
      const layerFactory = executeLayerCodeSafely(sanitized);
      const layerInstance = layerFactory.create(layerParams || {});

      if (isGroupResult(layerInstance)) {
        // Multi-mesh path: the generated code returned a THREE.Group
        const group = layerInstance.group;
        group.name = layerName;

        if (layerInstance.position) group.position.set(...layerInstance.position);
        if (layerInstance.rotation) group.rotation.set(...layerInstance.rotation);
        if (layerInstance.scale) group.scale.set(...layerInstance.scale);

        if (layerInstance.animate) {
          const animFn = layerInstance.animate;
          animateFnRef.current = animFn as (time: number, obj: THREE.Object3D) => void;
          group.userData.animate = (time: number) => {
            try {
              animFn(time, group);
            } catch (err) {
              console.warn(`Animation error in ${layerName}:`, err);
              group.userData.animate = undefined;
            }
          };
        }

        centerOnOrigin(group);
        scene.add(group);
        sceneObject = group;
        objectRef.current = group;
      } else {
        // Single mesh path
        if (!layerInstance.geometry || !layerInstance.material) {
          throw new Error("Layer must return geometry+material or a group");
        }

        const mesh = new THREE.Mesh(layerInstance.geometry, layerInstance.material);
        mesh.name = layerName;

        if (layerInstance.position) mesh.position.set(...layerInstance.position);
        if (layerInstance.rotation) mesh.rotation.set(...layerInstance.rotation);
        if (layerInstance.scale) mesh.scale.set(...layerInstance.scale);

        if (layerInstance.animate) {
          const animFn = layerInstance.animate;
          animateFnRef.current = animFn as (time: number, obj: THREE.Object3D) => void;
          mesh.userData.animate = (time: number) => {
            try {
              animFn(time, mesh);
            } catch (err) {
              console.warn(`Animation error in ${layerName}:`, err);
              mesh.userData.animate = undefined;
            }
          };
        }

        centerOnOrigin(mesh);
        scene.add(mesh);
        sceneObject = mesh;
        objectRef.current = mesh;
      }

      const successStatus: ExecutionStatus = {
        type: "success",
        confidence: validation.confidence,
        validation,
      };
      setStatus(successStatus);
      onStatusRef.current?.(successStatus);
    } catch (error: any) {
      console.error(`Error executing layer ${layerName}:`, error);

      const errorStatus: ExecutionStatus = {
        type: "error",
        message: error.message || "Unknown execution error",
        validation: validateLayerCode(layerCode),
      };
      setStatus(errorStatus);
      onStatusRef.current?.(errorStatus);

      // Add placeholder so user sees something in the scene
      const placeholder = createPlaceholder(layerName);
      scene.add(placeholder);
      sceneObject = placeholder;
      objectRef.current = placeholder;
    }

    return () => {
      if (sceneObject) {
        scene.remove(sceneObject);
        disposeObject3D(sceneObject);
      }
      objectRef.current = null;
      animateFnRef.current = null;
    };
  // onStatusChange is accessed via ref — not a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerCode, layerParams, layerName, scene]);

  return null;
}

function executeLayerCodeSafely(code: string): LayerDefinition {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("THREE", "UTILS", `
      ${code}
      if (typeof layerDefinition === 'undefined') {
        throw new Error('layerDefinition not found in generated code');
      }
      return layerDefinition;
    `);

    const layerDef = fn(THREE, GEOMETRY_UTILS);

    if (!layerDef || typeof layerDef.create !== "function") {
      throw new Error("layerDefinition must have a create function");
    }

    return layerDef;
  } catch (error: any) {
    throw new Error(`Code execution failed: ${error.message}`);
  }
}
