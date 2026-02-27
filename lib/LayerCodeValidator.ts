export interface ValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  errors: string[];
}

const FORBIDDEN_PATTERNS = [
  // Dangerous execution -- anchored to avoid matching variable names like "interval"
  { pattern: /\beval\s*\(/g, error: 'eval() is not allowed' },
  { pattern: /\bnew\s+Function\s*\(/g, error: 'Function constructor not allowed' },

  // Network access
  { pattern: /\bfetch\s*\(/g, error: 'Network requests not allowed' },
  { pattern: /\bXMLHttpRequest\b/g, error: 'XMLHttpRequest not allowed' },
  { pattern: /\bWebSocket\b/g, error: 'WebSocket not allowed' },

  // Storage access
  { pattern: /\blocalStorage\b/g, error: 'localStorage not allowed' },
  { pattern: /\bsessionStorage\b/g, error: 'sessionStorage not allowed' },
  { pattern: /\bindexedDB\b/g, error: 'indexedDB not allowed' },

  // Dynamic imports
  { pattern: /\bimport\s*\(/g, error: 'Dynamic imports not allowed' },
  { pattern: /\brequire\s*\(/g, error: 'require() not allowed' },

  // DOM manipulation
  { pattern: /\bdocument\s*\./g, error: 'DOM access not allowed' },
  { pattern: /\bwindow\s*\./g, error: 'Window access not allowed' },
  { pattern: /\bwindow\s*\[/g, error: 'Window access not allowed' },
];

const COMPLEXITY_INDICATORS = {
  customShaders: /ShaderMaterial|fragmentShader|vertexShader/,
  bufferGeometry: /BufferGeometry|BufferAttribute/,
  complexMath: /\b(?:noise|fbm|perlin|simplex)\b/i,
  postProcessing: /EffectComposer|RenderPass|UnrealBloomPass/,
  advancedFeatures: /InstancedMesh|LOD|Skeleton/,
};

export function validateLayerCode(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Reset lastIndex on all patterns since they use /g flag
  for (const { pattern, error } of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(code)) {
      errors.push(error);
    }
  }

  if (!code.includes('layerDefinition')) {
    errors.push('Missing layerDefinition');
  }

  if (!code.includes('create:') && !code.includes('create(') && !code.includes('create :')) {
    errors.push('Missing create function');
  }

  let complexityScore = 0;
  const features: string[] = [];

  if (COMPLEXITY_INDICATORS.customShaders.test(code)) {
    complexityScore += 2;
    features.push('custom shaders');
  }

  if (COMPLEXITY_INDICATORS.bufferGeometry.test(code)) {
    complexityScore += 1;
    features.push('buffer geometry');
  }

  if (COMPLEXITY_INDICATORS.complexMath.test(code)) {
    complexityScore += 2;
    features.push('complex math');
    warnings.push('Complex math functions may impact performance');
  }

  if (COMPLEXITY_INDICATORS.postProcessing.test(code)) {
    complexityScore += 3;
    features.push('post-processing');
    warnings.push('Post-processing effects not supported in preview');
  }

  if (COMPLEXITY_INDICATORS.advancedFeatures.test(code)) {
    complexityScore += 2;
    features.push('advanced features');
  }

  let confidence: 'high' | 'medium' | 'low';
  if (complexityScore === 0) {
    confidence = 'high';
  } else if (complexityScore <= 3) {
    confidence = 'medium';
  } else {
    confidence = 'low';
    warnings.push('High complexity - preview may differ from production');
  }

  if (features.length > 0) {
    warnings.push(`Features detected: ${features.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    confidence,
    warnings,
    errors,
  };
}

export function sanitizeCode(code: string): string {
  let sanitized = code.replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '');

  // Strip export keyword but keep the declaration (handles export const, export var, etc.)
  sanitized = sanitized.replace(/\bexport\s+/g, '');

  return sanitized.trim();
}
