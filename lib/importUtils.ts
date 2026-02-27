import type {
  SceneDef,
  LayerDef,
  ExecutableLayer,
  ProductionLayer,
} from "../types";

// ─── Detected format types ──────────────────────────────────────────────────

export type ImportedFormat =
  | { type: "scene_config"; sceneDef: SceneDef }
  | { type: "bundle"; name: string; sceneDef: SceneDef; layers: BundleLayer[] }
  | { type: "executable_layer"; kind: string; code: string }
  | { type: "cycl_layer"; kind: string; filename: string; code: string }
  | { type: "multi_executable"; layers: Record<string, string> }
  | { type: "multi_cycl"; layers: Record<string, string> }
  | { type: "unknown"; raw: string };

interface BundleLayer {
  kind: string;
  params?: Record<string, any>;
  visible?: boolean;
  executableCode: string | null;
  description: string | null;
}

// ─── Format detection ───────────────────────────────────────────────────────

const CYCL_PATTERN = /export\s+function\s+create(\w+)Layer\s*\(\s*def\s*:\s*\{\s*id:\s*string;\s*kind:\s*string;\s*params\?:\s*Record<string,\s*any>\s*\}\s*,\s*_ctx\s*:\s*EngineContext/;
const CYCL_PATTERN_LOOSE = /export\s+function\s+create(\w+)Layer/;
const EXEC_PATTERN = /var\s+layerDefinition\s*=\s*\{/;
const EXEC_SECTION_PATTERN = /\/\/\s*──\s*(\S+?)(?:\s+\(executable\))?\s*──/g;
const CYCL_SECTION_PATTERN = /\/\/\s*──\s*(\S+?\.ts)\s*──/g;

function camelToSnake(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

export function normalizeProductionLayerKey(key: string): string {
  return key.endsWith(".ts") ? key : `${key}.ts`;
}

export function normalizeProductionLayersMap(
  input: Record<string, ProductionLayer>,
): Record<string, ProductionLayer> {
  const out: Record<string, ProductionLayer> = {};
  for (const [key, layer] of Object.entries(input || {})) {
    const normalizedKey = normalizeProductionLayerKey(
      layer?.filename || key,
    );
    out[normalizedKey] = {
      filename: normalizedKey,
      code: layer?.code || "",
      description:
        layer?.description ||
        `Production implementation of ${normalizedKey.replace(/\.ts$/, "")} layer`,
    };
  }
  return out;
}

export function detectFormat(content: string, filename: string): ImportedFormat {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (ext === "json") {
    return detectJsonFormat(content);
  }

  if (ext === "ts" || ext === "tsx") {
    return detectTypeScriptFormat(content, filename);
  }

  if (ext === "js") {
    return detectJavaScriptFormat(content, filename);
  }

  // Try content-based detection for unknown extensions
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return detectJsonFormat(content);
  }
  if (CYCL_PATTERN.test(content) || CYCL_PATTERN_LOOSE.test(content)) {
    return detectTypeScriptFormat(content, filename);
  }
  if (EXEC_PATTERN.test(content)) {
    return detectJavaScriptFormat(content, filename);
  }

  return { type: "unknown", raw: content };
}

function detectJsonFormat(content: string): ImportedFormat {
  try {
    const parsed = JSON.parse(content);

    // Bundle format: { name, sceneConfig, layers[] }
    if (parsed.sceneConfig && Array.isArray(parsed.layers)) {
      return {
        type: "bundle",
        name: parsed.name || "Imported Scene",
        sceneDef: parsed.sceneConfig as SceneDef,
        layers: parsed.layers as BundleLayer[],
      };
    }

    // Scene config: { id, layers[] }
    if (parsed.id && Array.isArray(parsed.layers)) {
      return {
        type: "scene_config",
        sceneDef: parsed as SceneDef,
      };
    }

    return { type: "unknown", raw: content };
  } catch {
    return { type: "unknown", raw: content };
  }
}

function detectTypeScriptFormat(content: string, filename: string): ImportedFormat {
  // Check for multiple Cycl layers in one file (concatenated export)
  const cyclSections: Record<string, string> = {};
  CYCL_SECTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  const sectionStarts: { kind: string; index: number }[] = [];

  while ((match = CYCL_SECTION_PATTERN.exec(content)) !== null) {
    sectionStarts.push({ kind: match[1].replace(/\.ts$/, ""), index: match.index });
  }

  if (sectionStarts.length > 1) {
    for (let i = 0; i < sectionStarts.length; i++) {
      const start = sectionStarts[i].index;
      const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : content.length;
      cyclSections[sectionStarts[i].kind] = content.slice(start, end).trim();
    }
    return { type: "multi_cycl", layers: cyclSections };
  }

  // Single Cycl layer
  const cyclMatch = content.match(CYCL_PATTERN) || content.match(CYCL_PATTERN_LOOSE);
  if (cyclMatch) {
    const fnName = cyclMatch[1];
    const kind = camelToSnake(fnName);
    const fn = filename.endsWith(".ts") ? filename : `${kind}.ts`;
    return { type: "cycl_layer", kind, filename: fn, code: content };
  }

  // Could be a TS file with executable code wrapped in `export const sceneConfig = ...`
  if (content.includes("export const sceneConfig")) {
    return detectMultiExecFromFullFile(content);
  }

  return { type: "unknown", raw: content };
}

function detectJavaScriptFormat(content: string, filename: string): ImportedFormat {
  // Check for multiple executable layers (concatenated with section headers)
  const sections: Record<string, string> = {};
  EXEC_SECTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  const sectionStarts: { kind: string; index: number }[] = [];

  while ((match = EXEC_SECTION_PATTERN.exec(content)) !== null) {
    sectionStarts.push({ kind: match[1], index: match.index });
  }

  if (sectionStarts.length > 1) {
    for (let i = 0; i < sectionStarts.length; i++) {
      const start = sectionStarts[i].index;
      const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].index : content.length;
      sections[sectionStarts[i].kind] = content.slice(start, end).trim();
    }
    return { type: "multi_executable", layers: sections };
  }

  // Single executable layer
  if (EXEC_PATTERN.test(content)) {
    const kind = filename
      .replace(/\.js$/, "")
      .replace(/[^a-zA-Z0-9_]/g, "_");
    return { type: "executable_layer", kind, code: content };
  }

  return { type: "unknown", raw: content };
}

function detectMultiExecFromFullFile(content: string): ImportedFormat {
  // "Full scene code" .ts files have `export const sceneConfig = { ... };`
  // followed by `// ── Layer: kind ──` sections
  const layerPattern = /\/\/\s*──\s*Layer:\s*(\S+)\s*──/g;
  const starts: { kind: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = layerPattern.exec(content)) !== null) {
    starts.push({ kind: m[1], index: m.index });
  }

  if (starts.length > 0) {
    const layers: Record<string, string> = {};
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i].index;
      const end = i + 1 < starts.length ? starts[i + 1].index : content.length;
      layers[starts[i].kind] = content.slice(start, end).trim();
    }
    return { type: "multi_executable", layers };
  }

  return { type: "unknown", raw: content };
}

// ─── Cycl-to-Sandbox transpiler ─────────────────────────────────────────────

export function cyclToSandbox(cyclCode: string, layerKind: string): string {
  // Strip import statements
  let code = cyclCode.replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, "");
  // Strip import type statements
  code = code.replace(/import\s+type\s+.*?from\s+['"].*?['"];?\n?/g, "");
  // Strip export keyword
  code = code.replace(/\bexport\s+/g, "");

  // Strip TypeScript type annotations from the code while preserving structure
  code = stripTypeAnnotations(code);

  // Find the factory function name
  const fnMatch = code.match(/function\s+(create\w+Layer)/);
  if (!fnMatch) {
    throw new Error(`Could not find create*Layer function in Cycl code for "${layerKind}"`);
  }
  const fnName = fnMatch[1];

  // Wrap the stripped code in the sandbox format
  return `${code}

var layerDefinition = { create: function(params) {
  var def = { id: "${layerKind}", kind: "${layerKind}", attachTo: "world", params: params || {} };
  var ctx = { world: new THREE.Group(), background: new THREE.Group(), scene: new THREE.Group() };
  var handle;
  try {
    handle = ${fnName}(def, ctx);
  } catch (_e) {
    handle = ${fnName}(ctx, def);
  }
  return {
    group: handle.group,
    animate: function(time, grp) {
      handle.update({ dt: 0.016, time: time, grade: 0, speed: 5, worldZ: time * 5, sceneId: "", distanceMeters: time * 5, courseLength: 1000 });
    }
  };
} };`;
}

function stripTypeAnnotations(code: string): string {
  // Remove `: Type` annotations on parameters and variables, handling generics
  // This is a simplified TS-to-JS strip — handles the common patterns in layer code

  // Remove `: TypeName` after variable declarations (const x: Type = ...)
  code = code.replace(/:\s*(?:THREE\.)?[A-Z]\w+(?:<[^>]*>)?(?:\[\])?\s*(?==)/g, " ");

  // Remove parameter type annotations like `(ctx: LayerContext, def: LayerDef)`
  // but keep the parameter names
  code = code.replace(
    /(\w+)\s*:\s*(?:THREE\.)?[A-Z]\w+(?:<[^>]*>)?(?:\[\])?/g,
    "$1"
  );

  // Remove return type annotations `: LayerHandle`
  code = code.replace(/\)\s*:\s*(?:THREE\.)?[A-Z]\w+(?:<[^>]*>)?(?:\[\])?\s*\{/g, ") {");

  // Remove `as Type` casts
  code = code.replace(/\s+as\s+\w+(?:\[\])?/g, "");

  return code;
}

// ─── Conversion helpers ─────────────────────────────────────────────────────

export interface ImportResult {
  sceneDef: SceneDef | null;
  name: string;
  executableLayers: Record<string, ExecutableLayer>;
  productionLayers: Record<string, ProductionLayer>;
  warnings: string[];
}

export function processImportedFiles(files: { name: string; content: string }[]): ImportResult {
  const result: ImportResult = {
    sceneDef: null,
    name: "Imported Scene",
    executableLayers: {},
    productionLayers: {},
    warnings: [],
  };

  for (const file of files) {
    const detected = detectFormat(file.content, file.name);
    // #region agent log
    try {
      fetch("http://127.0.0.1:7242/ingest/90c215db-8370-4854-be38-77731fb1c18f",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"pre-fix",hypothesisId:"H6",location:"lib/importUtils.ts:processImportedFiles-detect",message:"Imported file detected format",data:{fileName:file.name,detectedType:detected.type,contentLength:file.content.length},timestamp:Date.now()})}).catch(()=>{});
    } catch {}
    // #endregion

    switch (detected.type) {
      case "scene_config":
        result.sceneDef = detected.sceneDef;
        result.name = detected.sceneDef.id?.replace(/_/g, " ") || "Imported Scene";
        break;

      case "bundle": {
        result.sceneDef = detected.sceneDef;
        result.name = detected.name;
        for (const layer of detected.layers) {
          if (layer.executableCode) {
            result.executableLayers[layer.kind] = {
              code: layer.executableCode,
              description: layer.description || `Imported ${layer.kind}`,
              confidence: "medium",
            };
          }
        }
        break;
      }

      case "executable_layer":
        result.executableLayers[detected.kind] = {
          code: detected.code,
          description: `Imported from ${file.name}`,
          confidence: "medium",
        };
        break;

      case "multi_executable":
        for (const [kind, code] of Object.entries(detected.layers)) {
          result.executableLayers[kind] = {
            code,
            description: `Imported from ${file.name}`,
            confidence: "medium",
          };
        }
        break;

      case "cycl_layer": {
        const prodKey = detected.filename.endsWith(".ts")
          ? detected.filename
          : `${detected.kind}.ts`;
        result.productionLayers[prodKey] = {
          filename: prodKey,
          code: detected.code,
          description: `Imported Cycl layer from ${file.name}`,
        };
        try {
          const sandboxCode = cyclToSandbox(detected.code, detected.kind);
          result.executableLayers[detected.kind] = {
            code: sandboxCode,
            description: `Auto-converted from Cycl: ${file.name}`,
            confidence: "medium",
          };
        } catch (err: any) {
          result.warnings.push(`Could not auto-convert "${file.name}" to sandbox: ${err.message}`);
        }
        break;
      }

      case "multi_cycl":
        for (const [kind, code] of Object.entries(detected.layers)) {
          const fn = `${kind}.ts`;
          result.productionLayers[fn] = {
            filename: fn,
            code,
            description: `Imported Cycl layer from ${file.name}`,
          };
          try {
            const sandboxCode = cyclToSandbox(code, kind);
            result.executableLayers[kind] = {
              code: sandboxCode,
              description: `Auto-converted from Cycl: ${file.name}`,
              confidence: "medium",
            };
          } catch (err: any) {
            result.warnings.push(`Could not auto-convert "${kind}" to sandbox: ${err.message}`);
          }
        }
        break;

      case "unknown":
        result.warnings.push(`Unrecognized format: ${file.name}`);
        break;
    }
  }

  // If we got executable layers but no scene config, generate a minimal one
  if (!result.sceneDef && Object.keys(result.executableLayers).length > 0) {
    const layers: LayerDef[] = Object.keys(result.executableLayers).map((kind, i) => ({
      id: `${kind}_${i}`,
      kind,
      attachTo: "world" as const,
      params: {},
    }));
    // Add default lighting and road
    layers.unshift(
      { id: "sky", kind: "background_gradient", attachTo: "scene", params: { colorTop: "#000011", colorMid: "#001133", colorHorizon: "#2244ff" } },
      { id: "road", kind: "road_v9", attachTo: "world", params: { style: "grid", colors: { road: "#1a0022", edge: "#ff69b4", line: "#ff1493" } } },
      { id: "lights", kind: "lighting", attachTo: "scene", params: { color: "#ffffff", intensity: 1, ambientColor: "#404040", ambientIntensity: 0.5 } },
    );
    result.sceneDef = {
      id: result.name.replace(/\s+/g, "_").toLowerCase(),
      camera: { posY: 2.5, lookY: 1.5, lookZ: -25 },
      layers,
    };
    result.warnings.push("No scene config found — generated default scene with imported layers.");
  }

  result.productionLayers = normalizeProductionLayersMap(result.productionLayers);
  // #region agent log
  try {
    const prodStats = Object.fromEntries(
      Object.entries(result.productionLayers).map(([k, v]) => [
        k,
        {
          cloneCalls: ((v.code || "").match(/\.clone\(/g) || []).length,
          trackingPushes: ((v.code || "").match(/(geometries|materials|textures)\.push\(/g) || []).length,
        },
      ]),
    );
    fetch("http://127.0.0.1:7242/ingest/90c215db-8370-4854-be38-77731fb1c18f",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"pre-fix",hypothesisId:"H7",location:"lib/importUtils.ts:processImportedFiles-result",message:"Processed import aggregate layer stats",data:{sceneId:result.sceneDef?.id || null,execCount:Object.keys(result.executableLayers).length,prodCount:Object.keys(result.productionLayers).length,warningCount:result.warnings.length,prodStats},timestamp:Date.now()})}).catch(()=>{});
  } catch {}
  // #endregion
  return result;
}

// ─── File reading helper ────────────────────────────────────────────────────

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}
