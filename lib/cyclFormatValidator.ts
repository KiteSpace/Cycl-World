import type { ProductionLayer } from "../types";

export interface CyclValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function normalizeKindsTs(kindOrFilename: string): string {
  return kindOrFilename.endsWith(".ts") ? kindOrFilename : `${kindOrFilename}.ts`;
}

export function validateCyclLayerCode(
  code: string,
  filename: string,
  typesImportPath = "../types",
): CyclValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const escapedPath = typesImportPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (!/import\s+\*\s+as\s+THREE\s+from\s+["']three["']/.test(code)) {
    errors.push("Missing `import * as THREE from \"three\"`.");
  }
  if (!new RegExp(`import\\s+type\\s+\\{[^}]*EngineContext[^}]*EngineInputs[^}]*LayerHandle[^}]*\\}\\s+from\\s+["']${escapedPath}["']`).test(code)) {
    errors.push(`Missing type import from "${typesImportPath}" with EngineContext, EngineInputs, LayerHandle.`);
  }
  if (!/export\s+function\s+create[A-Za-z0-9_]*Layer\s*\(\s*def\s*:\s*\{\s*id:\s*string;\s*kind:\s*string;\s*params\?:\s*Record<string,\s*any>\s*\}\s*,\s*_ctx\s*:\s*EngineContext\s*,?\s*\)\s*:\s*LayerHandle/.test(code)) {
    errors.push("Factory signature must be create<Name>Layer(def: { id: string; kind: string; params?: Record<string, any> }, _ctx: EngineContext): LayerHandle.");
  }
  if (!/const\s+p\s*=\s*def\.params\s*\?\?\s*\{\s*\}/.test(code)) {
    warnings.push("Expected `const p = def.params ?? {}`.");
  }
  if (!/return\s*\{[\s\S]*id\s*:\s*def\.id[\s\S]*group[\s\S]*dispose\s*\(/.test(code)) {
    errors.push("Return object must include id: def.id, group, and dispose().");
  }
  if (!/const\s+materials\s*:\s*THREE\.Material\[\]\s*=\s*\[\]/.test(code)) {
    errors.push("Missing materials tracking array.");
  }
  if (!/const\s+geometries\s*:\s*THREE\.BufferGeometry\[\]\s*=\s*\[\]/.test(code)) {
    errors.push("Missing geometries tracking array.");
  }
  if (!/dispose\s*\(\)\s*\{[\s\S]*geometries\.forEach\(\s*g\s*=>\s*g\.dispose\(\)\s*\)[\s\S]*materials\.forEach\(\s*m\s*=>\s*m\.dispose\(\)\s*\)/.test(code)) {
    errors.push("dispose() must dispose geometries and materials.");
  }
  if (/\/\/\s*\.\.\./.test(code) || /\(production version\)/i.test(code)) {
    errors.push("Contains placeholder comments.");
  }
  if (/UTILS\./.test(code) && !/from\s+["'][^"']*utils[^"']*["']/.test(code)) {
    warnings.push("Contains UTILS.* usage without explicit Cycl utils imports.");
  }
  if (/group\.position\.set\(\s*[^,]+,\s*[^,]+,\s*-\d{2,}/.test(code)) {
    warnings.push("Detected hardcoded negative Z on root group; Cycl layers should be origin-relative.");
  }
  const cloneCalls = (code.match(/\.clone\(/g) || []).length;
  const trackingPushes = (code.match(/(geometries|materials|textures)\.push\(/g) || []).length;
  if (cloneCalls > 0 && trackingPushes < cloneCalls) {
    warnings.push(
      `Potential resource leak: ${cloneCalls} clone() call(s) but only ${trackingPushes} tracked push() calls.`,
    );
  }

  // #region agent log
  try {
    fetch("http://127.0.0.1:7242/ingest/90c215db-8370-4854-be38-77731fb1c18f",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"pre-fix",hypothesisId:"H2",location:"lib/cyclFormatValidator.ts:validateCyclLayerCode",message:"Cycl validation clone/tracking analysis",data:{filename,cloneCalls,trackingPushes,errorCount:errors.length,warningCount:warnings.length},timestamp:Date.now()})}).catch(()=>{});
  } catch {}
  // #endregion

  const expectedFile = normalizeKindsTs(filename);
  if (!expectedFile.endsWith(".ts")) {
    errors.push("Filename must end with .ts");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateProductionLayersMap(
  layers: Record<string, ProductionLayer>,
  typesImportPath = "../types",
): Record<string, CyclValidationResult> {
  const out: Record<string, CyclValidationResult> = {};
  for (const [key, layer] of Object.entries(layers || {})) {
    const filename = normalizeKindsTs(layer?.filename || key);
    out[filename] = validateCyclLayerCode(layer?.code || "", filename, typesImportPath);
  }
  return out;
}
