# Code Generation Feature - Implementation Guide

This guide explains how to add dynamic code execution to the scene builder.

## Files Created ✅

1. **lib/LayerCodeValidator.ts** - Validates generated code safety
2. **components/DynamicLayerExecutor.tsx** - Executes generated layers
3. **components/ScenePreview.tsx** - Enhanced with dynamic layer support
4. **types.ts** - Updated with new types

## Files To Update

### 1. pages/api/generate-scene.ts

Add to SYSTEM_PROMPT (after the existing guidelines section):

```typescript
# CODE GENERATION MODE

When the user requests features not available in built-in layers, generate CUSTOM LAYER CODE.

## Decision Matrix:
- Water effects → GENERATE CODE
- Vegetation (trees, grass, kelp) → GENERATE CODE  
- Architecture (buildings, tunnels) → GENERATE CODE
- Custom particle effects → GENERATE CODE
- Novel geometries → GENERATE CODE

## Response Format for Custom Layers:

{
  "sceneConfig": { ...normal scene config... },
  "explanation": "Scene uses custom water_surface layer...",
  "executableLayers": {
    "water_surface": "export const layerDefinition = {...}"
  },
  "productionLayers": {
    "water_surface.ts": "import * as THREE from 'three';..."
  },
  "hasCustomLayers": true
}

## Executable Layer Format (STRICT):

Must follow this EXACT pattern for demo preview to work:

\`\`\`javascript
export const layerDefinition = {
  create: function(params) {
    // Use THREE (available globally in scope)
    const geometry = new THREE.PlaneGeometry(200, 200, 50, 50);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waveHeight: { value: params.waveHeight || 2.0 },
        color: { value: new THREE.Color(params.color || '#0066ff') }
      },
      vertexShader: \`
        uniform float time;
        uniform float waveHeight;
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          // Wave animation
          pos.z += sin(pos.x * 0.5 + time) * waveHeight;
          pos.z += cos(pos.y * 0.3 + time * 0.8) * waveHeight * 0.5;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      \`,
      fragmentShader: \`
        uniform vec3 color;
        varying vec2 vUv;
        
        void main() {
          // Depth fade
          float depth = 1.0 - vUv.y;
          vec3 finalColor = color * (0.5 + depth * 0.5);
          
          gl_FragColor = vec4(finalColor, 0.8);
        }
      \`,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    return {
      geometry,
      material,
      position: [0, -2, -100],  // Optional positioning
      rotation: [-Math.PI / 2, 0, 0],  // Optional rotation
      animate: (time, mesh) => {
        // Animation function called every frame
        mesh.material.uniforms.time.value = time;
      }
    };
  }
};
\`\`\`

## Production Layer Format:

Full TypeScript file for user's app:

\`\`\`typescript
import * as THREE from "three";
import type { EngineContext, EngineInputs, LayerHandle } from "../types";

export function createWaterSurfaceLayer(
  def: { id: string; kind: string; params?: Record<string, any> },
  _ctx: EngineContext,
): LayerHandle {
  const p = def.params ?? {};
  const waveHeight = p.waveHeight ?? 2.0;
  const color = new THREE.Color(p.color ?? "#0066ff");

  const group = new THREE.Group();
  const materials: THREE.Material[] = [];

  // Create water surface
  const geometry = new THREE.PlaneGeometry(200, 200, 50, 50);
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      waveHeight: { value: waveHeight },
      color: { value: color }
    },
    vertexShader: \`...\`,
    fragmentShader: \`...\`,
    transparent: true,
    side: THREE.DoubleSide
  });
  materials.push(material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -2;
  mesh.position.z = -100;
  group.add(mesh);

  return {
    id: def.id,
    group,
    update(inputs: EngineInputs) {
      material.uniforms.time.value = inputs.time;
    },
    dispose() {
      geometry.dispose();
      materials.forEach(m => m.dispose());
    },
  };
}
\`\`\`

## Safety Rules for Executable Code:

1. ❌ NO eval, Function constructor
2. ❌ NO fetch, XMLHttpRequest, WebSocket
3. ❌ NO localStorage, sessionStorage
4. ❌ NO import(), require()
5. ❌ NO document, window access
6. ✅ ONLY THREE.js API
7. ✅ Inline shaders only
8. ✅ Self-contained logic

## Examples:

### Water Scene:
User: "Create water with waves"
→ Generate water_surface layer
→ Executable for demo
→ Production .ts file

### Jungle Scene:
User: "Create swaying palm trees"
→ Generate palm_trees layer
→ Executable shows simplified trees
→ Production has full detail

### City Scene:
User: "Create tall neon buildings"
→ Generate neon_buildings layer
→ Executable shows box geometries
→ Production has detailed models
```

Then update the response parsing:

```typescript
// In the handler, after getting response from Claude:
let parsed;
try {
  const jsonMatch = textContent.text.match(/```json\n([\s\S]+?)\n```/);
  const jsonText = jsonMatch ? jsonMatch[1] : textContent.text;
  parsed = JSON.parse(jsonText);
} catch (e) {
  return res.status(200).json({
    sceneConfig: null,
    explanation: textContent.text,
    code: "",
    error: "Failed to parse JSON response",
  });
}

// Generate code representation
const code = JSON.stringify(parsed.sceneConfig, null, 2);

return res.status(200).json({
  sceneConfig: parsed.sceneConfig,
  explanation: parsed.explanation || "Scene generated successfully",
  code,
  executableLayers: parsed.executableLayers || {},
  productionLayers: parsed.productionLayers || {},
  hasCustomLayers: parsed.hasCustomLayers || false,
});
```

---

### 2. pages/index.tsx

Add new state for executable layers:

```typescript
const [executableLayers, setExecutableLayers] = useState<Record<string, ExecutableLayer>>({});
const [productionLayers, setProductionLayers] = useState<Record<string, ProductionLayer>>({});
const [hasCustomLayers, setHasCustomLayers] = useState(false);
```

Update the handleSubmit response handling:

```typescript
if (data.sceneConfig) {
  setCurrentScene(data.sceneConfig);
  setCurrentCode(data.code);
  setExecutableLayers(data.executableLayers || {});
  setProductionLayers(data.productionLayers || {});
  setHasCustomLayers(data.hasCustomLayers || false);
  
  // ... rest of message handling
}
```

Add Layer Code tab (after Code and Demo tabs):

```typescript
{hasCustomLayers && (
  <button
    onClick={() => setActiveTab("layers")}
    style={{
      padding: "6px 12px",
      background: activeTab === "layers" ? "#6644cc" : "transparent",
      border: "none",
      color: "#fff",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
    }}
  >
    📦 Layer Code
  </button>
)}
```

Add layers tab content:

```typescript
{activeTab === "layers" && hasCustomLayers && (
  <div style={{ padding: "20px" }}>
    <h3 style={{ color: "#888", fontSize: "14px", marginBottom: "16px" }}>
      CUSTOM LAYER FILES
    </h3>
    
    {Object.entries(productionLayers).map(([name, layer]) => (
      <div key={name} style={{ marginBottom: "24px" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "8px"
        }}>
          <h4 style={{ color: "#0f0", fontSize: "13px", margin: 0 }}>
            {layer.filename}
          </h4>
          <button
            onClick={() => {
              navigator.clipboard.writeText(layer.code);
              alert(`Copied ${layer.filename}!`);
            }}
            style={{
              padding: "4px 12px",
              background: "#2a2a3e",
              border: "1px solid #3a3a4e",
              color: "#fff",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            📋 Copy
          </button>
        </div>
        
        <p style={{ 
          color: "#aaa", 
          fontSize: "12px", 
          marginBottom: "8px",
          fontStyle: "italic"
        }}>
          {layer.description}
        </p>
        
        <pre style={{
          background: "#0f0f1e",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #1f1f2e",
          color: "#0f0",
          fontSize: "11px",
          lineHeight: "1.5",
          overflowX: "auto",
          maxHeight: "400px",
          overflowY: "auto",
          fontFamily: "'Fira Code', monospace",
        }}>
          {layer.code}
        </pre>
      </div>
    ))}
    
    <div style={{
      marginTop: "24px",
      padding: "16px",
      background: "#0f0f1e",
      borderRadius: "8px",
      border: "1px solid #1f1f2e",
    }}>
      <h4 style={{ color: "#fff", fontSize: "13px", marginBottom: "12px" }}>
        📝 Installation
      </h4>
      <ol style={{ color: "#aaa", fontSize: "12px", lineHeight: "1.8", paddingLeft: "20px" }}>
        <li>Copy each layer file above</li>
        <li>Create files in <code style={{ color: "#0f0" }}>client/src/engine/layers/</code></li>
        <li>Register in <code style={{ color: "#0f0" }}>EngineSceneManager.ts</code>:
          <pre style={{
            background: "#0a0a0a",
            padding: "8px",
            borderRadius: "4px",
            marginTop: "8px",
            fontSize: "11px",
            color: "#0f0",
          }}>
{`// Add imports
${Object.keys(productionLayers).map(name => 
  `import { create${name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Layer } from "./layers/${name}";`
).join('\n')}

// Add to switch statement
${Object.keys(productionLayers).map(name => 
  `case "${name}":\n  return create${name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Layer(layerDef, this.ctx);`
).join('\n')}`}
          </pre>
        </li>
        <li>Use the scene config from Code tab</li>
        <li>Test in your app!</li>
      </ol>
    </div>
  </div>
)}
```

Pass executableLayers to ScenePreview:

```typescript
<ScenePreview 
  sceneConfig={currentScene} 
  executableLayers={executableLayers}
/>
```

---

## Testing

### Test 1: Water Scene
```
Prompt: "Create underwater scene with flowing water surface"
Expected:
- Scene config with water_surface layer
- Executable code for demo
- Production .ts file
- Demo tab shows animated water ✅
```

### Test 2: Forest Scene
```
Prompt: "Create forest with swaying trees"
Expected:
- Scene config with tree_layer
- Both code versions
- Demo shows simplified trees ✅
```

### Test 3: Fallback
```
Prompt: "Create extremely complex ray-marched volumetric clouds"
Expected:
- Code generated
- Demo shows placeholder (too complex) ⚠️
- Production code still works in app
```

---

## Success Metrics

- **80-90%** of generated layers execute in demo
- **Clear status indicators** for each layer
- **Safe execution** (no security issues)
- **Helpful fallbacks** when execution fails

---

## Next Steps

1. Copy this guide
2. Update generate-scene.ts API with new prompt
3. Update index.tsx with layer code tab
4. Test with various prompts
5. Iterate on system prompt based on results

The foundation is built - now it's about refining the prompt to generate good code!
