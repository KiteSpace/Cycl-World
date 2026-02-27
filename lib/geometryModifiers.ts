import * as THREE from "three";

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function remap(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  return outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo);
}

// ─── Simplex Noise ────────────────────────────────────────────────────────────
// Based on Stefan Gustavson's implementation (ISC license)

const GRAD3: [number, number, number][] = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

const P_SRC = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
  8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
  35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
  134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
  55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,
  169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,
  124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,
  28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
  129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,
  34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,
  214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,
  93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
];

const perm = new Uint8Array(512);
const pm12 = new Uint8Array(512);
for (let i = 0; i < 256; i++) {
  perm[i] = perm[i + 256] = P_SRC[i];
  pm12[i] = pm12[i + 256] = P_SRC[i] % 12;
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3;
const G3 = 1 / 6;

export function simplex2D(xin: number, yin: number): number {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const gi = pm12[ii + perm[jj]];
    t0 *= t0;
    n0 = t0 * t0 * (GRAD3[gi][0] * x0 + GRAD3[gi][1] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const gi = pm12[ii + i1 + perm[jj + j1]];
    t1 *= t1;
    n1 = t1 * t1 * (GRAD3[gi][0] * x1 + GRAD3[gi][1] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const gi = pm12[ii + 1 + perm[jj + 1]];
    t2 *= t2;
    n2 = t2 * t2 * (GRAD3[gi][0] * x2 + GRAD3[gi][1] * y2);
  }
  return 70 * (n0 + n1 + n2);
}

export function simplex3D(xin: number, yin: number, zin: number): number {
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const z0 = zin - (k - t);

  let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
  if (x0 >= y0) {
    if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
    else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
    else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
  } else {
    if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
    else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
    else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
  }

  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
  const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3;

  const ii = i & 255, jj = j & 255, kk = k & 255;
  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let tt = 0.6 - x0*x0 - y0*y0 - z0*z0;
  if (tt >= 0) { const gi = pm12[ii+perm[jj+perm[kk]]]; tt *= tt; n0 = tt*tt*(GRAD3[gi][0]*x0+GRAD3[gi][1]*y0+GRAD3[gi][2]*z0); }
  tt = 0.6 - x1*x1 - y1*y1 - z1*z1;
  if (tt >= 0) { const gi = pm12[ii+i1+perm[jj+j1+perm[kk+k1]]]; tt *= tt; n1 = tt*tt*(GRAD3[gi][0]*x1+GRAD3[gi][1]*y1+GRAD3[gi][2]*z1); }
  tt = 0.6 - x2*x2 - y2*y2 - z2*z2;
  if (tt >= 0) { const gi = pm12[ii+i2+perm[jj+j2+perm[kk+k2]]]; tt *= tt; n2 = tt*tt*(GRAD3[gi][0]*x2+GRAD3[gi][1]*y2+GRAD3[gi][2]*z2); }
  tt = 0.6 - x3*x3 - y3*y3 - z3*z3;
  if (tt >= 0) { const gi = pm12[ii+1+perm[jj+1+perm[kk+1]]]; tt *= tt; n3 = tt*tt*(GRAD3[gi][0]*x3+GRAD3[gi][1]*y3+GRAD3[gi][2]*z3); }

  return 32 * (n0 + n1 + n2 + n3);
}

// ─── Composite Noise Functions ────────────────────────────────────────────────

export function fbm2D(x: number, y: number, octaves = 6, lacunarity = 2.0, gain = 0.5): number {
  let sum = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += simplex2D(x * freq, y * freq) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / max;
}

export function fbm3D(x: number, y: number, z: number, octaves = 6, lacunarity = 2.0, gain = 0.5): number {
  let sum = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += simplex3D(x * freq, y * freq, z * freq) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / max;
}

export function ridgeNoise(x: number, y: number, z: number, octaves = 5, lacunarity = 2.0, gain = 0.5, offset = 1.0): number {
  let sum = 0, amp = 0.5, freq = 1, prev = 1;
  for (let i = 0; i < octaves; i++) {
    let n = offset - Math.abs(simplex3D(x * freq, y * freq, z * freq));
    n = n * n;
    sum += n * amp * prev;
    prev = n;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

export function voronoi2D(x: number, y: number): { dist1: number; dist2: number; id: number } {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let d1 = 999, d2 = 999, cellId = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const hash = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453;
      const px = cx + (hash - Math.floor(hash));
      const hash2 = Math.sin(cx * 269.5 + cy * 183.3) * 43758.5453;
      const py = cy + (hash2 - Math.floor(hash2));
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < d1) { d2 = d1; d1 = d; cellId = cx * 256 + cy; }
      else if (d < d2) { d2 = d; }
    }
  }
  return { dist1: Math.sqrt(d1), dist2: Math.sqrt(d2), id: cellId };
}

// ─── Procedural Textures ──────────────────────────────────────────────────────

export function makeTexture(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function makeNoiseTexture(
  width: number,
  height: number,
  scale = 4,
  color1 = [0, 0, 0],
  color2 = [255, 255, 255],
  octaves = 4,
): THREE.CanvasTexture {
  return makeTexture(width, height, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = (fbm2D(x / w * scale, y / h * scale, octaves) + 1) * 0.5;
        const i = (y * w + x) * 4;
        img.data[i] = lerp(color1[0], color2[0], n);
        img.data[i + 1] = lerp(color1[1], color2[1], n);
        img.data[i + 2] = lerp(color1[2], color2[2], n);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function makeGradientTexture(
  width: number,
  height: number,
  stops: Array<{ pos: number; color: string }>,
  vertical = true,
): THREE.CanvasTexture {
  return makeTexture(width, height, (ctx, w, h) => {
    const grad = vertical
      ? ctx.createLinearGradient(0, 0, 0, h)
      : ctx.createLinearGradient(0, 0, w, 0);
    stops.forEach((s) => grad.addColorStop(s.pos, s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

// ─── Old Value Noise (kept for compatibility) ─────────────────────────────────

function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  return lerp(
    lerp(
      lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), sx),
      lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), sx), sy),
    lerp(
      lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), sx),
      lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), sx), sy),
    sz);
}

// ─── Geometry Modifiers ───────────────────────────────────────────────────────

export function twist(geo: THREE.BufferGeometry, angle: number): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const bb = geo.boundingBox!;
  const height = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y - bb.min.y) / height;
    const theta = angle * t;
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setX(i, x * Math.cos(theta) - z * Math.sin(theta));
    pos.setZ(i, x * Math.sin(theta) + z * Math.cos(theta));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function bend(geo: THREE.BufferGeometry, angle: number, axis: "x" | "z" = "z"): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const bb = geo.boundingBox!;
  const height = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y - bb.min.y) / height;
    const theta = angle * t;
    const r = y;
    const newY = r * Math.cos(theta);
    if (axis === "z") { pos.setY(i, newY); pos.setZ(i, pos.getZ(i) + r * Math.sin(theta)); }
    else { pos.setY(i, newY); pos.setX(i, pos.getX(i) + r * Math.sin(theta)); }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function taper(geo: THREE.BufferGeometry, factor: number): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const bb = geo.boundingBox!;
  const height = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y - bb.min.y) / height;
    const scale = 1 - factor * t;
    pos.setX(i, pos.getX(i) * scale);
    pos.setZ(i, pos.getZ(i) * scale);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function noiseDisplace(geo: THREE.BufferGeometry, amplitude: number, frequency = 1): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;
  if (!normal) return geo;
  for (let i = 0; i < pos.count; i++) {
    const n = simplex3D(pos.getX(i) * frequency, pos.getY(i) * frequency, pos.getZ(i) * frequency) * amplitude;
    pos.setX(i, pos.getX(i) + normal.getX(i) * n);
    pos.setY(i, pos.getY(i) + normal.getY(i) * n);
    pos.setZ(i, pos.getZ(i) + normal.getZ(i) * n);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function scatterOnPlane(
  count: number,
  rangeX: [number, number],
  rangeZ: [number, number],
  meshFn: (index: number) => THREE.Object3D,
): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const obj = meshFn(i);
    obj.position.x = rangeX[0] + Math.random() * (rangeX[1] - rangeX[0]);
    obj.position.z = rangeZ[0] + Math.random() * (rangeZ[1] - rangeZ[0]);
    group.add(obj);
  }
  return group;
}

// ─── Bundle for sandbox injection ─────────────────────────────────────────────

export const GEOMETRY_UTILS = {
  // Noise
  simplex2D, simplex3D, fbm2D, fbm3D, ridgeNoise, voronoi2D, valueNoise3D,
  // Textures
  makeTexture, makeNoiseTexture, makeGradientTexture,
  // Geometry modifiers
  twist, bend, taper, noiseDisplace, scatterOnPlane,
  // Math helpers
  lerp, smoothstep, clamp, remap,
};
