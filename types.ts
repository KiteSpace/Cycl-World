export interface SceneDef {
  id: string;
  camera?: {
    posY?: number;
    lookY?: number;
    lookZ?: number;
  };
  lightingProfileId?: string;
  postProfileId?: string;
  layers: LayerDef[];
}

export interface LayerDef {
  id: string;
  kind: string;
  attachTo: "world" | "scene";
  params?: Record<string, any>;
  visible?: boolean;
}

export interface GenerateSceneRequest {
  prompt: string;
  imageBase64?: string;
  sceneType?: "canyon" | "space" | "tunnel" | "custom";
  conversationHistory?: Message[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sceneConfig?: SceneDef;
}

export interface ExecutableLayer {
  code: string;
  description: string;
  confidence: "high" | "medium" | "low";
}

export interface ProductionLayer {
  filename: string;
  code: string;
  description: string;
}

export interface GenerateSceneResponse {
  sceneConfig: SceneDef;
  explanation: string;
  code: string;
  executableLayers?: Record<string, ExecutableLayer>;
  productionLayers?: Record<string, ProductionLayer>;
  hasCustomLayers?: boolean;
  editMode?: boolean;
  changedLayers?: string[];
  error?: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  type: "object" | "scene";
  description: string;
  layers: LayerDef[];
  executableLayers: Record<string, ExecutableLayer>;
  productionLayers: Record<string, ProductionLayer>;
  camera?: SceneDef["camera"];
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface Composition {
  id: string;
  name: string;
  camera?: SceneDef["camera"];
  entries: CompositionEntry[];
}

export interface CompositionEntry {
  id: string;
  libraryItemId?: string;
  layer: LayerDef;
  executableLayer?: ExecutableLayer;
  productionLayer?: ProductionLayer;
  visible: boolean;
}

export interface PostProcessingSettings {
  bloom?: { enabled: boolean; strength: number; threshold: number; radius: number };
  ssao?: { enabled: boolean; kernelRadius: number };
  shadows?: boolean;
}

export interface SelectedObjectInfo {
  uuid: string;
  name: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  vertexCount: number;
  triangleCount: number;
  hasMaterial: boolean;
  materialType?: string;
  materialColor?: string;
  materialRoughness?: number;
  materialMetalness?: number;
  materialEmissive?: string;
  materialEmissiveIntensity?: number;
  materialOpacity?: number;
  materialWireframe?: boolean;
  boundingBox?: [number, number, number];
}

export interface SceneObjectEntry {
  uuid: string;
  name: string;
  type: string;
  visible: boolean;
  children: SceneObjectEntry[];
}
