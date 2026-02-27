import Anthropic from "@anthropic-ai/sdk";
import type { NextApiRequest, NextApiResponse } from "next";
import { validateCyclLayerCode } from "../../lib/cyclFormatValidator";

const DEFAULT_TYPES_IMPORT = "../types";
const TYPES_IMPORT_PATH = process.env.CYCL_TYPES_IMPORT_PATH || DEFAULT_TYPES_IMPORT;

const CONVERSION_PROMPT = `You are a TypeScript expert converting Three.js sandbox code to Cycl app production format.

Convert the given executable sandbox layer code to Cycl-compatible TypeScript production layer code.

## Input format (sandbox executable)
The input uses \`var layerDefinition = { create: function(params) { ... } }\` with optional \`animate(time, group)\`.
It uses \`var\` (not const/let), has no imports, and receives THREE and UTILS as globals.

## Output format (Cycl production)
Output a complete TypeScript file with:

import * as THREE from "three";
import type { EngineContext, EngineInputs, LayerHandle } from "${TYPES_IMPORT_PATH}";

export function create<Name>Layer(
  def: { id: string; kind: string; params?: Record<string, any> },
  _ctx: EngineContext,
): LayerHandle {
  const p = def.params ?? {};
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const textures: THREE.Texture[] = [];

  // FULL translated creation logic

  return {
    id: def.id,
    group,
    update(inputs: EngineInputs) {
      // map animate(time, group) -> update(inputs)
      // use inputs.time, inputs.dt, inputs.speed, inputs.grade
    },
    dispose() {
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
    },
  };
}

## Rules
1. Output ONLY TypeScript code, no markdown fences and no commentary.
2. Use EXACT function signature above: (def, _ctx) and inline def type.
3. Return LayerHandle shape with id/group/dispose and optional update.
4. Track/dispose geometries, materials, and textures.
5. Use const/let, not var.
6. DO NOT use UTILS.* unless you explicitly add valid Cycl utility imports.
7. Avoid hardcoded world-space Z offsets on the root group. Keep placement origin-relative.
8. Never return sandbox animate(time, group) shape in production code.`;

function stripMarkdownFences(code: string): string {
  return code
    .replace(/^```(?:typescript|ts)?\n?/gm, "")
    .replace(/```\s*$/gm, "")
    .trim();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { kind, executableCode } = req.body;

    if (!kind || !executableCode) {
      return res.status(400).json({ error: "Missing kind or executableCode" });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY not configured",
      });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const pascalKind = kind
      .split(/[_-]/)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: CONVERSION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Convert this sandbox layer "${kind}" (function name should be create${pascalKind}Layer) to Cycl production format:\n\n${executableCode}`,
        },
      ],
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    let code = textBlock ? (textBlock as any).text : "";
    code = stripMarkdownFences(code);

    const validation = validateCyclLayerCode(code, `${kind}.ts`, TYPES_IMPORT_PATH);
    // #region agent log
    try {
      fetch("http://127.0.0.1:7242/ingest/90c215db-8370-4854-be38-77731fb1c18f",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({runId:"pre-fix",hypothesisId:"H3",location:"pages/api/convert-to-cycl.ts:post-validate",message:"convert-to-cycl validation result",data:{kind,isValid:validation.isValid,errorCount:validation.errors.length,warningCount:validation.warnings.length,errors:validation.errors.slice(0,5),warnings:validation.warnings.slice(0,5)},timestamp:Date.now()})}).catch(()=>{});
    } catch {}
    // #endregion
    if (!validation.isValid) {
      return res.status(422).json({
        error: "Converted code failed Cycl contract validation.",
        details: validation.errors,
        warnings: validation.warnings,
        kind,
      });
    }

    return res.status(200).json({
      filename: `${kind}.ts`,
      code,
      kind,
    });
  } catch (error: any) {
    console.error("Convert to Cycl error:", error);
    return res.status(500).json({
      error: error.message || "Conversion failed",
    });
  }
}
