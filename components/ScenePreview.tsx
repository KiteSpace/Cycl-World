import {
  useEffect,
  useRef,
  useState,
  useCallback,
  Component,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type {
  SceneDef,
  ExecutableLayer,
  PostProcessingSettings,
  SelectedObjectInfo,
  SceneObjectEntry,
} from "../types";
import { DynamicLayerExecutor, type ExecutionStatus } from "./DynamicLayerExecutor";
import ViewportToolbar from "./ViewportToolbar";
import SceneHierarchy from "./SceneHierarchy";
import PropertyPanel from "./PropertyPanel";
import { InlineShimmer } from "./SkeletonLoader";

export interface SceneInternals {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

interface ScenePreviewProps {
  sceneConfig: SceneDef;
  executableLayers?: Record<string, ExecutableLayer>;
  animateCamera?: boolean;
  cameraSpeed?: number;
  onThumbnail?: (dataUrl: string) => void;
  interactionEnabled?: boolean;
  onObjectSelected?: (info: SelectedObjectInfo | null) => void;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
  onLayerDelete?: (layerId: string) => void;
  postProcessing?: PostProcessingSettings;
  sceneRefOut?: React.MutableRefObject<SceneInternals | null>;
}

export const BUILTIN_LAYERS = [
  "background_gradient",
  "road_v9",
  "mountains_v9",
  "asteroids_v9",
  "star_trails",
  "haze",
  "lighting",
  "bloom",
];

// ─── Helpers (pure, outside component) ────────────────────────────────────────

function getObjectInfo(obj: THREE.Object3D): SelectedObjectInfo {
  let vertexCount = 0;
  let triangleCount = 0;
  const materialInfo: Partial<SelectedObjectInfo> = { hasMaterial: false };

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry;
      if (geo.index) {
        vertexCount += geo.attributes.position.count;
        triangleCount += geo.index.count / 3;
      } else {
        vertexCount += geo.attributes.position.count;
        triangleCount += geo.attributes.position.count / 3;
      }
    }
  });

  let firstMesh: THREE.Mesh | undefined;
  obj.traverse((child) => {
    if (!firstMesh && child instanceof THREE.Mesh) firstMesh = child as THREE.Mesh;
  });

  if (firstMesh) {
    const mat = (firstMesh as THREE.Mesh).material;
    if (mat && !Array.isArray(mat)) {
      materialInfo.hasMaterial = true;
      materialInfo.materialType = mat.type;
      if ("color" in mat && (mat as any).color)
        materialInfo.materialColor = "#" + (mat as any).color.getHexString();
      if ("roughness" in mat) materialInfo.materialRoughness = (mat as any).roughness;
      if ("metalness" in mat) materialInfo.materialMetalness = (mat as any).metalness;
      if ("emissive" in mat && (mat as any).emissive)
        materialInfo.materialEmissive = "#" + (mat as any).emissive.getHexString();
      if ("emissiveIntensity" in mat)
        materialInfo.materialEmissiveIntensity = (mat as any).emissiveIntensity;
      if ("opacity" in mat) materialInfo.materialOpacity = mat.opacity;
      if ("wireframe" in mat) materialInfo.materialWireframe = (mat as any).wireframe;
    }
  }

  let bbox: [number, number, number] | undefined;
  const box = new THREE.Box3().setFromObject(obj);
  if (box.min.x !== Infinity) {
    const size = new THREE.Vector3();
    box.getSize(size);
    bbox = [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)];
  }

  return {
    uuid: obj.uuid,
    name: obj.name || obj.type,
    type: obj.type,
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    vertexCount,
    triangleCount: Math.floor(triangleCount),
    ...(materialInfo as any),
    boundingBox: bbox,
  };
}

function ensureCenteredOrigin(obj: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;

  const worldCenter = new THREE.Vector3();
  box.getCenter(worldCenter);

  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);
  const offset = worldCenter.clone().sub(worldPos);

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
  } else if (obj.children.length > 0) {
    for (const child of obj.children) {
      child.position.sub(offset);
    }
    obj.position.add(offset);
  }
}

function buildSceneTree(
  scene: THREE.Scene,
  exclude: Set<THREE.Object3D>,
): SceneObjectEntry[] {
  return scene.children
    .filter((c) => !exclude.has(c) && !c.userData.noExport)
    .map(buildEntry);
}
function buildEntry(obj: THREE.Object3D): SceneObjectEntry {
  return {
    uuid: obj.uuid,
    name: obj.name || obj.type,
    type: obj.type,
    visible: obj.visible,
    children: obj.children.map(buildEntry),
  };
}

// ─── Error boundary ───────────────────────────────────────────────────────────

class PreviewErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 20,
            background: "rgba(100,0,0,0.85)",
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,100,100,0.3)",
            color: "#f88",
            fontSize: 12,
            maxWidth: 300,
          }}
        >
          Dynamic layer crashed: {this.state.error?.message || "Unknown error"}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScenePreview({
  sceneConfig,
  executableLayers,
  animateCamera = true,
  cameraSpeed = 1,
  onThumbnail,
  interactionEnabled = false,
  onObjectSelected,
  onLayerVisibilityChange,
  onLayerDelete,
  postProcessing,
  sceneRefOut,
}: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalsRef = useRef<SceneInternals | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [layerStatuses, setLayerStatuses] = useState<Record<string, ExecutionStatus>>(
    {},
  );

  // Interaction state
  const [cameraMode, setCameraMode] = useState<"orbit" | "drive">(
    interactionEnabled ? "orbit" : "drive",
  );
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<SelectedObjectInfo | null>(null);
  const [sceneObjects, setSceneObjects] = useState<SceneObjectEntry[]>([]);
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Stable refs
  const thumbnailTaken = useRef(false);
  const onThumbnailRef = useRef(onThumbnail);
  onThumbnailRef.current = onThumbnail;
  const onObjectSelectedRef = useRef(onObjectSelected);
  onObjectSelectedRef.current = onObjectSelected;
  const onLayerVisibilityChangeRef = useRef(onLayerVisibilityChange);
  onLayerVisibilityChangeRef.current = onLayerVisibilityChange;
  const onLayerDeleteRef = useRef(onLayerDelete);
  onLayerDeleteRef.current = onLayerDelete;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  const orbitRef = useRef<OrbitControls | null>(null);
  const transformCtrlRef = useRef<TransformControls | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  const selectedObjRef = useRef<THREE.Object3D | null>(null);
  const savedCamState = useRef<{
    pos: THREE.Vector3; target: THREE.Vector3;
  } | null>(null);
  const [cursorMode, setCursorMode] = useState<"default" | "hand">("default");

  // Camera / transform mode syncs (non-scene-rebuilding)
  useEffect(() => {
    if (orbitRef.current) {
      orbitRef.current.enabled = cameraMode === "orbit";
    }
  }, [cameraMode]);

  useEffect(() => {
    if (transformCtrlRef.current) {
      transformCtrlRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  // External selection (from hierarchy or property panel)
  const handleExternalSelect = useCallback((uuid: string | null) => {
    const scene = internalsRef.current?.scene;
    if (!scene) return;

    if (!uuid) {
      selectedObjRef.current = null;
      setSelectedUuid(null);
      setSelectedInfo(null);
      transformCtrlRef.current?.detach();
      if (outlinePassRef.current) outlinePassRef.current.selectedObjects = [];
      onObjectSelectedRef.current?.(null);
      return;
    }

    const obj = scene.getObjectByProperty("uuid", uuid);
    if (!obj) return;

    ensureCenteredOrigin(obj);
    selectedObjRef.current = obj;
    setSelectedUuid(uuid);
    const info = getObjectInfo(obj);
    setSelectedInfo(info);
    transformCtrlRef.current?.attach(obj);

    if (outlinePassRef.current) {
      const meshes: THREE.Object3D[] = [];
      obj.traverse((c) => {
        if (c instanceof THREE.Mesh) meshes.push(c);
      });
      outlinePassRef.current.selectedObjects = meshes.length > 0 ? meshes : [obj];
    }
    onObjectSelectedRef.current?.(info);
  }, []);

  // Property change handler
  const handlePropertyChange = useCallback(
    (uuid: string, property: string, value: any) => {
      const scene = internalsRef.current?.scene;
      if (!scene) return;
      const obj = scene.getObjectByProperty("uuid", uuid);
      if (!obj) return;

      const parts = property.split(".");
      if (parts[0] === "position")
        (obj.position as any)[parts[1]] = value;
      else if (parts[0] === "rotation")
        (obj.rotation as any)[parts[1]] = value;
      else if (parts[0] === "scale")
        (obj.scale as any)[parts[1]] = value;
      else if (parts[0] === "material") {
        let mesh: THREE.Mesh | null = null;
        obj.traverse((c) => {
          if (!mesh && c instanceof THREE.Mesh) mesh = c;
        });
        if (mesh) {
          const mat = (mesh as THREE.Mesh).material as any;
          if (parts[1] === "color" && mat.color) mat.color.set(value);
          else if (parts[1] === "roughness") mat.roughness = value;
          else if (parts[1] === "metalness") mat.metalness = value;
          else if (parts[1] === "emissive" && mat.emissive) mat.emissive.set(value);
          else if (parts[1] === "emissiveIntensity") mat.emissiveIntensity = value;
          else if (parts[1] === "opacity") {
            mat.opacity = value;
            mat.transparent = value < 1;
          } else if (parts[1] === "wireframe") mat.wireframe = value;
        }
      }
    },
    [],
  );

  // ─── Main scene setup ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    thumbnailTaken.current = false;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 600);
    const cam = sceneConfig.camera || { posY: 1.6, lookY: 1.4, lookZ: -15 };
    const startY = cam.posY ?? 1.6;
    const lookY = cam.lookY ?? 1.4;
    const lookZ = cam.lookZ ?? -15;

    const defaultCamPos = new THREE.Vector3(0, startY + 3, 8);
    const defaultCamTarget = new THREE.Vector3(0, lookY, lookZ);

    if (savedCamState.current) {
      camera.position.copy(savedCamState.current.pos);
      camera.lookAt(savedCamState.current.target);
    } else {
      camera.position.copy(defaultCamPos);
      camera.lookAt(defaultCamTarget);
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // ── EffectComposer ──
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const ssaoEnabled = postProcessing?.ssao?.enabled ?? false;
    if (ssaoEnabled) {
      const ssaoPass = new SSAOPass(scene, camera, width, height);
      ssaoPass.kernelRadius = postProcessing?.ssao?.kernelRadius ?? 16;
      composer.addPass(ssaoPass);
    }

    const visibleLayers = sceneConfig.layers.filter((l) => l.visible !== false);
    const bloomLayerDef = visibleLayers.find((l) => l.kind === "bloom");
    const bloomEnabled = postProcessing?.bloom?.enabled ?? !!bloomLayerDef;
    if (bloomEnabled) {
      const str =
        postProcessing?.bloom?.strength ?? bloomLayerDef?.params?.strength ?? 1.5;
      const rad = postProcessing?.bloom?.radius ?? 0.5;
      const thr = postProcessing?.bloom?.threshold ?? 0.0;
      composer.addPass(
        new UnrealBloomPass(new THREE.Vector2(width, height), str, rad, thr),
      );
    }

    let outlinePass: OutlinePass | null = null;
    if (interactionEnabled) {
      outlinePass = new OutlinePass(
        new THREE.Vector2(width, height),
        scene,
        camera,
      );
      outlinePass.edgeStrength = 3;
      outlinePass.edgeGlow = 0.7;
      outlinePass.edgeThickness = 1;
      outlinePass.visibleEdgeColor.set("#ffffff");
      outlinePass.hiddenEdgeColor.set("#444444");
      composer.addPass(outlinePass);
      outlinePassRef.current = outlinePass;
    }

    composer.addPass(new OutputPass());

    // ── Controls ──
    let orbitControls: OrbitControls | null = null;
    let transformControls: TransformControls | null = null;
    const excludeFromTree = new Set<THREE.Object3D>();
    let cleanupListeners: (() => void) | null = null;

    if (interactionEnabled) {
      orbitControls = new OrbitControls(camera, renderer.domElement);
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.1;
      orbitControls.enabled = cameraModeRef.current === "orbit";
      if (savedCamState.current) {
        orbitControls.target.copy(savedCamState.current.target);
      } else {
        orbitControls.target.copy(defaultCamTarget);
      }
      orbitRef.current = orbitControls;

      transformControls = new TransformControls(camera, renderer.domElement);
      transformControls.userData.isControl = true;
      transformControls.userData.noExport = true;
      transformControls.addEventListener("dragging-changed", (event: any) => {
        if (orbitControls) {
          orbitControls.enabled = !event.value && cameraModeRef.current === "orbit";
        }
      });
      transformControls.addEventListener("objectChange", () => {
        if (selectedObjRef.current) {
          const info = getObjectInfo(selectedObjRef.current);
          setSelectedInfo(info);
          onObjectSelectedRef.current?.(info);
        }
      });
      scene.add(transformControls);
      transformCtrlRef.current = transformControls;
      excludeFromTree.add(transformControls);

      // Raycaster
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const pointerDownPos = new THREE.Vector2();

      const onPointerDown = (e: PointerEvent) => {
        pointerDownPos.set(e.clientX, e.clientY);
      };
      const onPointerUp = (e: PointerEvent) => {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        const isControlDescendant = (obj: THREE.Object3D): boolean => {
          let p: THREE.Object3D | null = obj;
          while (p) {
            if (p === transformControls) return true;
            if (p.userData.isControl) return true;
            p = p.parent;
          }
          return false;
        };

        const validHit = intersects.find(
          (hit) =>
            !isControlDescendant(hit.object) &&
            !hit.object.userData.noSelect &&
            hit.object.name !== "background_sphere",
        );

        if (validHit) {
          let target = validHit.object;
          while (target.parent && target.parent !== scene) {
            if (target.parent === transformControls) break;
            target = target.parent;
          }
          selectObject(target);
        } else {
          selectObject(null);
        }
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      // Keyboard shortcuts
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.target !== document.body) return;

        if (e.key === "w") setTransformMode("translate");
        else if (e.key === "e") setTransformMode("rotate");
        else if (e.key === "t") setTransformMode("scale");
        else if (e.key === "Escape") selectObject(null);
        else if (e.key === "h") {
          setCursorMode("hand");
          setCameraMode("orbit");
          if (orbitControls) {
            orbitControls.mouseButtons = {
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.ROTATE,
            };
            orbitControls.enabled = true;
          }
          renderer.domElement.style.cursor = "grab";
        } else if (e.key === "v") {
          setCursorMode("default");
          setCameraMode("orbit");
          if (orbitControls) {
            orbitControls.mouseButtons = {
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            };
            orbitControls.enabled = true;
          }
          renderer.domElement.style.cursor = "default";
        } else if (e.key === "r") {
          camera.position.copy(defaultCamPos);
          if (orbitControls) {
            orbitControls.target.copy(defaultCamTarget);
            orbitControls.update();
          }
          camera.lookAt(defaultCamTarget);
          setCameraMode("orbit");
          setCursorMode("default");
          renderer.domElement.style.cursor = "default";
        } else if (
          ["1", "2", "3", "4", "5", "6"].includes(e.key) &&
          selectedObjRef.current
        ) {
          const obj = selectedObjRef.current;
          const box = new THREE.Box3().setFromObject(obj);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          const dist = Math.max(size.x, size.y, size.z, 2) * 2;

          let camPos: THREE.Vector3;
          let up = new THREE.Vector3(0, 1, 0);
          switch (e.key) {
            case "1": camPos = center.clone().add(new THREE.Vector3(0, 0, dist)); break;
            case "2": camPos = center.clone().add(new THREE.Vector3(0, dist, 0.001)); up = new THREE.Vector3(0, 0, -1); break;
            case "3": camPos = center.clone().add(new THREE.Vector3(0, -dist, 0.001)); up = new THREE.Vector3(0, 0, 1); break;
            case "4": camPos = center.clone().add(new THREE.Vector3(0, 0, -dist)); break;
            case "5": camPos = center.clone().add(new THREE.Vector3(dist, 0, 0)); break;
            case "6": camPos = center.clone().add(new THREE.Vector3(-dist, 0, 0)); break;
            default: return;
          }
          camera.position.copy(camPos);
          camera.up.copy(up);
          camera.lookAt(center);
          if (orbitControls) {
            orbitControls.target.copy(center);
            orbitControls.update();
          }
        }
      };
      document.addEventListener("keydown", onKeyDown);

      cleanupListeners = () => {
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("keydown", onKeyDown);
      };
    }

    function selectObject(obj: THREE.Object3D | null) {
      if (!obj) {
        selectedObjRef.current = null;
        setSelectedUuid(null);
        setSelectedInfo(null);
        transformControls?.detach();
        if (outlinePass) outlinePass.selectedObjects = [];
        onObjectSelectedRef.current?.(null);
        return;
      }
      ensureCenteredOrigin(obj);
      selectedObjRef.current = obj;
      setSelectedUuid(obj.uuid);
      const info = getObjectInfo(obj);
      setSelectedInfo(info);
      transformControls?.attach(obj);
      if (outlinePass) {
        const meshes: THREE.Object3D[] = [];
        obj.traverse((c) => {
          if (c instanceof THREE.Mesh) meshes.push(c);
        });
        outlinePass.selectedObjects = meshes.length > 0 ? meshes : [obj];
      }
      onObjectSelectedRef.current?.(info);
    }

    // ── Built-in layers ──
    const shadowsEnabled = true;
    const builtinGroups: Map<string, THREE.Group> = new Map();
    visibleLayers.forEach((layer) => {
      if (!BUILTIN_LAYERS.includes(layer.kind)) return;
      if (layer.kind === "bloom") return;
      const group = new THREE.Group();
      group.name = `builtin-${layer.id}`;
      switch (layer.kind) {
        case "background_gradient":
          createBackgroundGradient(group, layer.params);
          break;
        case "road_v9":
          createSimpleRoad(group, layer.params, shadowsEnabled);
          break;
        case "mountains_v9":
          createSimpleMountains(group, layer.params, shadowsEnabled);
          break;
        case "asteroids_v9":
          createSimpleAsteroids(group, layer.params, shadowsEnabled);
          break;
        case "star_trails":
          createSimpleStarTrails(group, layer.params);
          break;
        case "haze":
          createSimpleHaze(scene, group, layer.params);
          break;
        case "lighting":
          createSimpleLighting(group, layer.params, shadowsEnabled);
          break;
      }
      scene.add(group);
      builtinGroups.set(layer.id, group);
    });

    // Default lighting
    const hasLightingLayer = visibleLayers.some((l) => l.kind === "lighting");
    if (!hasLightingLayer) {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 5);
      if (shadowsEnabled) {
        light.castShadow = true;
        light.shadow.mapSize.set(2048, 2048);
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 200;
        light.shadow.camera.left = -50;
        light.shadow.camera.right = 50;
        light.shadow.camera.top = 50;
        light.shadow.camera.bottom = -50;
      }
      scene.add(light);
      scene.add(new THREE.AmbientLight(0x404040, 0.5));
    }

    // ── Environment map for PBR reflections ──
    try {
      const pmremGen = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const bgParams =
        visibleLayers.find((l) => l.kind === "background_gradient")?.params || {};
      createBackgroundGradient(envScene, bgParams);
      const envMap = pmremGen.fromScene(envScene, 0, 0.1, 1000).texture;
      scene.environment = envMap;
      envScene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else if (m) (m as THREE.Material).dispose();
        }
      });
      pmremGen.dispose();
    } catch {
      /* non-critical */
    }

    // ── Animation loop ──
    let animationId = 0;
    const clock = new THREE.Clock();
    const speed = 3 * cameraSpeed;
    let elapsed = 0;

    const animate = () => {
      const dt = clock.getDelta();
      elapsed += dt;

      if (cameraModeRef.current === "drive" && animateCamera && speed > 0) {
        camera.position.z -= speed * dt;
        camera.lookAt(camera.position.x, lookY, camera.position.z + lookZ);
        if (camera.position.z < -300) camera.position.z = 0;
      }

      if (orbitControls && (cameraModeRef.current === "orbit")) {
        orbitControls.update();
      }

      scene.traverse((obj) => {
        if (obj.userData.animate) obj.userData.animate(elapsed);
      });

      composer.render();

      if (!thumbnailTaken.current && onThumbnailRef.current) {
        thumbnailTaken.current = true;
        try {
          onThumbnailRef.current(renderer.domElement.toDataURL("image/png", 0.5));
        } catch {
          /* ignore */
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    // Store internals
    internalsRef.current = { scene, camera, renderer };
    if (sceneRefOut) sceneRefOut.current = { scene, camera, renderer };

    // Build scene tree (delay so custom layers have time to mount)
    setTimeout(() => {
      setSceneObjects(buildSceneTree(scene, excludeFromTree));
    }, 200);

    setSceneReady(true);
    animate();

    return () => {
      savedCamState.current = {
        pos: camera.position.clone(),
        target: orbitControls?.target.clone() ?? defaultCamTarget.clone(),
      };

      cancelAnimationFrame(animationId);
      setSceneReady(false);
      setSelectedUuid(null);
      setSelectedInfo(null);
      selectedObjRef.current = null;

      cleanupListeners?.();
      transformControls?.detach();
      transformControls?.dispose();
      if (transformControls) scene.remove(transformControls);
      orbitControls?.dispose();

      composer.dispose();

      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.LineSegments ||
          obj instanceof THREE.Points
        ) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material))
            obj.material.forEach((m) => m.dispose());
          else if (obj.material) obj.material.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);

      internalsRef.current = null;
      if (sceneRefOut) sceneRefOut.current = null;
      orbitRef.current = null;
      transformCtrlRef.current = null;
      outlinePassRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneConfig, animateCamera, cameraSpeed, interactionEnabled, postProcessing]);

  // Rebuild scene tree when custom layers finish loading
  useEffect(() => {
    if (!sceneReady || !internalsRef.current) return;
    const id = setTimeout(() => {
      setSceneObjects(
        buildSceneTree(internalsRef.current!.scene, new Set()),
      );
    }, 300);
    return () => clearTimeout(id);
  }, [sceneReady, layerStatuses]);

  // ── Derived values ──
  const visibleCustomLayers = sceneConfig.layers.filter(
    (l) => l.visible !== false && !BUILTIN_LAYERS.includes(l.kind),
  );
  const customLayerCount = visibleCustomLayers.length;
  const hasExecutableErrors = Object.values(layerStatuses).some(
    (s) => s.type === "error",
  );

  const handleStatus = useCallback(
    (layerId: string, status: ExecutionStatus) => {
      setLayerStatuses((prev) => ({ ...prev, [layerId]: status }));
    },
    [],
  );

  const resolveLayerIdFromObject = useCallback(
    (obj: THREE.Object3D): string | null => {
      if (!obj.name) return null;
      if (obj.name.startsWith("builtin-")) {
        return obj.name.replace(/^builtin-/, "");
      }
      if (sceneConfig.layers.some((l) => l.id === obj.name)) {
        return obj.name;
      }
      return null;
    },
    [sceneConfig.layers],
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Toolbar */}
      {interactionEnabled && (
        <ViewportToolbar
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          transformMode={transformMode}
          onTransformModeChange={setTransformMode}
          showHierarchy={showHierarchy}
          onToggleHierarchy={() => setShowHierarchy((s) => !s)}
          onDeselect={selectedUuid ? () => handleExternalSelect(null) : undefined}
          onExport={() => setShowExport(true)}
        />
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", background: "#000" }}
      />

      {/* Scene hierarchy */}
      {interactionEnabled && showHierarchy && (
        <SceneHierarchy
          objects={sceneObjects}
          selectedUuid={selectedUuid}
          onSelect={handleExternalSelect}
          onToggleVisibility={(uuid, visible) => {
            const s = internalsRef.current?.scene;
            if (!s) return;
            const obj = s.getObjectByProperty("uuid", uuid);
            if (!obj) return;
            obj.visible = visible;
            const layerId = resolveLayerIdFromObject(obj);
            if (layerId) {
              onLayerVisibilityChangeRef.current?.(layerId, visible);
            }
            setSceneObjects(buildSceneTree(s, new Set()));
          }}
          onDelete={(uuid) => {
            const s = internalsRef.current?.scene;
            if (!s) return;
            const obj = s.getObjectByProperty("uuid", uuid);
            if (!obj) return;
            const layerId = resolveLayerIdFromObject(obj);
            s.remove(obj);
            if (selectedUuid === uuid) {
              handleExternalSelect(null);
            }
            if (layerId) {
              onLayerDeleteRef.current?.(layerId);
            }
            setSceneObjects(buildSceneTree(s, new Set()));
          }}
        />
      )}

      {/* Property panel */}
      {interactionEnabled && selectedInfo && (
        <PropertyPanel
          selectedInfo={selectedInfo}
          onPropertyChange={handlePropertyChange}
          onAction={(uuid, action) => {
            const s = internalsRef.current?.scene;
            if (!s) return;
            const obj = s.getObjectByProperty("uuid", uuid);
            if (!obj) return;
            if (action === "focus") {
              const box = new THREE.Box3().setFromObject(obj);
              const center = new THREE.Vector3();
              box.getCenter(center);
              if (orbitRef.current) orbitRef.current.target.copy(center);
              const cam = internalsRef.current?.camera;
              if (cam) {
                cam.position.copy(
                  center
                    .clone()
                    .add(new THREE.Vector3(5, 5, 5)),
                );
                cam.lookAt(center);
              }
            } else if (action === "duplicate") {
              const clone = obj.clone(true);
              clone.position.x += 2;
              clone.name = obj.name + "_copy";
              s.add(clone);
              setSceneObjects(buildSceneTree(s, new Set()));
            } else if (action === "delete") {
              s.remove(obj);
              handleExternalSelect(null);
              setSceneObjects(buildSceneTree(s, new Set()));
            }
          }}
        />
      )}

      {/* Export dialog (lazy import to avoid SSR issues) */}
      {showExport && internalsRef.current && (
        <ExportDialogLazy
          sceneRef={internalsRef}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Dynamic layer executors */}
      <PreviewErrorBoundary>
        {sceneReady &&
          internalsRef.current &&
          executableLayers &&
          visibleCustomLayers.map((layer) => {
            const executable = executableLayers[layer.kind];
            if (!executable) return null;
            return (
              <DynamicLayerExecutor
                key={layer.id}
                layerCode={executable.code}
                layerParams={layer.params}
                layerName={layer.id}
                scene={internalsRef.current!.scene}
                onStatusChange={(status) => handleStatus(layer.id, status)}
              />
            );
          })}
      </PreviewErrorBoundary>

      {/* Status overlay */}
      {customLayerCount > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            background: "rgba(0,0,0,0.85)",
            padding: "12px 16px",
            borderRadius: 8,
            border: hasExecutableErrors
              ? "1px solid rgba(255,100,100,0.3)"
              : "1px solid rgba(100,255,100,0.3)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            fontSize: 12,
            maxWidth: 300,
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {hasExecutableErrors ? "Warning" : "Custom"} Layers ({customLayerCount})
          </div>
          {Object.entries(layerStatuses).map(([id, s]) => (
            <div key={id} style={{ marginBottom: 4, fontSize: 11 }}>
              {s.type === "success" && (
                <div style={{ color: "#0f0" }}>
                  {id} - {s.confidence} confidence
                </div>
              )}
              {s.type === "error" && (
                <div style={{ color: "#f66" }}>
                  {id} - {s.message}
                </div>
              )}
              {s.type === "loading" && (
                <div style={{ color: "#88f", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{id}</span>
                  <InlineShimmer width={80} height={10} theme="default" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Lazy ExportDialog wrapper to prevent SSR issues with three/examples
function ExportDialogLazy({
  sceneRef,
  onClose,
}: {
  sceneRef: React.MutableRefObject<SceneInternals | null>;
  onClose: () => void;
}) {
  const [Comp, setComp] = useState<any>(null);
  useEffect(() => {
    import("./ExportDialog").then((m) => setComp(() => m.default));
  }, []);
  if (!Comp) return null;
  return <Comp sceneRef={sceneRef} onClose={onClose} />;
}

// ─── Built-in layer helpers ──────────────────────────────────────────────────

function createBackgroundGradient(parent: THREE.Object3D, params: any) {
  const geo = new THREE.SphereGeometry(500, 32, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      colorTop: { value: new THREE.Color(params?.colorTop || "#000011") },
      colorMid: { value: new THREE.Color(params?.colorMid || "#001133") },
      colorBottom: { value: new THREE.Color(params?.colorBottom || "#000011") },
      colorHorizon: {
        value: new THREE.Color(params?.colorHorizon || "#2244ff"),
      },
    },
    vertexShader: `varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform vec3 colorTop,colorMid,colorBottom,colorHorizon; varying vec3 vP;
      void main(){
        vec3 d=normalize(vP); float v=d.y*.5+.5;
        vec3 c=v>.5?mix(colorMid,colorTop,(v-.5)*2.):mix(colorBottom,colorMid,v*2.);
        float h=exp(-pow((v-.42)*8.,2.))*.3; c=mix(c,colorHorizon,h);
        gl_FragColor=vec4(c,1.);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "background_sphere";
  mesh.userData.noSelect = true;
  mesh.userData.noExport = true;
  parent.add(mesh);
}

function createSimpleRoad(
  parent: THREE.Object3D,
  params: any,
  shadows = false,
) {
  const style = params?.style || "grid";
  const colors = params?.colors || {};
  const roadColor = new THREE.Color(colors.road || "#1a0022");
  const edgeColor = new THREE.Color(colors.edge || "#ff69b4");
  const lineColor = new THREE.Color(colors.line || "#ff1493");

  const roadGeo = new THREE.PlaneGeometry(5, 600, 1, 60);
  const roadMat = new THREE.MeshStandardMaterial({
    color: roadColor,
    transparent: true,
    opacity: 0.8,
    roughness: 0.9,
    metalness: 0.0,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -300;
  if (shadows) road.receiveShadow = true;
  parent.add(road);

  const edgeGeo = new THREE.PlaneGeometry(0.2, 600);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: edgeColor,
    transparent: true,
    opacity: 0.9,
  });
  const le = new THREE.Mesh(edgeGeo, edgeMat);
  le.rotation.x = -Math.PI / 2;
  le.position.set(-2.5, 0.05, -300);
  parent.add(le);
  const re = new THREE.Mesh(edgeGeo, edgeMat);
  re.rotation.x = -Math.PI / 2;
  re.position.set(2.5, 0.05, -300);
  parent.add(re);

  if (style === "grid") {
    for (let i = 0; i < 30; i++) {
      const lg = new THREE.PlaneGeometry(5, 0.1);
      const lm = new THREE.MeshBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: 0.6,
      });
      const l = new THREE.Mesh(lg, lm);
      l.rotation.x = -Math.PI / 2;
      l.position.set(0, 0.06, -i * 20);
      parent.add(l);
    }
  }
}

function createSimpleMountains(
  parent: THREE.Object3D,
  params: any,
  shadows = false,
) {
  const lineColor = new THREE.Color(params?.lineColor || "#ff2244");
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.PlaneGeometry(30, 40, 30, 40);
      const v = geo.attributes.position.array as Float32Array;
      for (let j = 0; j < v.length; j += 3) {
        const x = v[j],
          y = v[j + 1];
        v[j + 2] =
          Math.max(0, Math.sin(x * 0.3 + i) * Math.cos(y * 0.2) * 5 + Math.abs(x) * 0.3);
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({
        color: lineColor,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(side * 20, 0, -i * 40 - 20);
      if (shadows) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      parent.add(m);
    }
  }
}

function createSimpleAsteroids(
  parent: THREE.Object3D,
  params: any,
  shadows = false,
) {
  const count = Math.min(params?.count || 30, 40);
  const baseColor = new THREE.Color(params?.baseColor || "#444455");
  for (let i = 0; i < count; i++) {
    const geo = new THREE.IcosahedronGeometry(0.5 + Math.random() * 2, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      wireframe: Math.random() > 0.5,
      transparent: true,
      opacity: 0.8,
      roughness: 0.7,
      metalness: 0.3,
    });
    const m = new THREE.Mesh(geo, mat);
    const a = Math.random() * Math.PI * 2,
      d = 10 + Math.random() * 40;
    m.position.set(
      Math.cos(a) * d,
      Math.random() * 20 + 2,
      -Math.random() * 400 - 50,
    );
    if (shadows) m.castShadow = true;
    m.userData.animate = () => {
      m.rotation.x += 0.01;
      m.rotation.y += 0.01;
    };
    parent.add(m);
  }
}

function createSimpleStarTrails(parent: THREE.Object3D, params: any) {
  const count = Math.min(params?.count || 500, 600);
  const color = new THREE.Color(params?.color || "#8855ff");
  const pos: number[] = [],
    cols: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2,
      r = 5 + Math.random() * 30;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r,
      z = -Math.random() * 500 - 50,
      len = 5 + Math.random() * 15;
    pos.push(x, y, z, x, y, z - len);
    cols.push(
      color.r,
      color.g,
      color.b,
      color.r * 0.2,
      color.g * 0.2,
      color.b * 0.2,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  parent.add(
    new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
      }),
    ),
  );
}

function createSimpleHaze(
  scene: THREE.Scene,
  parent: THREE.Object3D,
  params: any,
) {
  const color = new THREE.Color(params?.color || "#4400ff");
  const intensity = params?.intensity || 0.6;
  scene.fog = new THREE.FogExp2(color.getHex(), 0.002 * intensity);
  const pos: number[] = [];
  for (let i = 0; i < 100; i++)
    pos.push(
      (Math.random() - 0.5) * 100,
      Math.random() * 20,
      -Math.random() * 300,
    );
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  parent.add(
    new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color,
        size: 2,
        transparent: true,
        opacity: intensity * 0.3,
      }),
    ),
  );
}

function createSimpleLighting(
  parent: THREE.Object3D,
  params: any,
  shadows = false,
) {
  const d = new THREE.DirectionalLight(
    new THREE.Color(params?.color || "#ffffff"),
    params?.intensity ?? 1,
  );
  d.position.set(params?.dirX ?? 5, params?.dirY ?? 10, params?.dirZ ?? 5);
  if (shadows) {
    d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048);
    d.shadow.camera.near = 0.1;
    d.shadow.camera.far = 200;
    d.shadow.camera.left = -50;
    d.shadow.camera.right = 50;
    d.shadow.camera.top = 50;
    d.shadow.camera.bottom = -50;
  }
  parent.add(d);
  parent.add(
    new THREE.AmbientLight(
      new THREE.Color(params?.ambientColor || "#404040"),
      params?.ambientIntensity ?? 0.5,
    ),
  );
}
