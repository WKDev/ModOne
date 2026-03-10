/**
 * GridShader — Procedural GPU Grid via GLSL Fragment Shader
 *
 * Single draw call, zero per-line/per-dot CPU loop.
 * The fragment shader computes grid lines/dots per pixel using:
 *  - mod() for repeating grid cells
 *  - fwidth() for antialiased subpixel edges (device-pixel-ratio aware)
 *  - LOD alpha fade when grid cells become too small in screen space
 *
 * Uniforms (updated each pan/zoom):
 *  uBoundsMin, uBoundsMax — visible world-coordinate rect
 *  uGridSize              — minor grid cell size in world units
 *  uMajorFactor           — major = minor * majorFactor  (e.g. 5)
 *  uMinorColor            — vec3 RGB for minor grid
 *  uMajorColor            — vec3 RGB for major grid
 *  uMinorAlpha            — minor grid base alpha
 *  uMajorAlpha            — major grid base alpha
 *  uStyle                 — 0.0 = lines, 1.0 = dots
 *  uLodMinorFade          — zoom below which minor disappears (e.g. 0.25)
 *  uLodMajorFade          — zoom below which major disappears (e.g. 0.05)
 *  uZoom                  — current zoom level (for LOD fade calculation)
 *  uDotRadius             — dot radius in screen pixels (dots mode only)
 */

// ---------------------------------------------------------------------------
// Vertex Shader (GLSL ES 3.0)
// ---------------------------------------------------------------------------
export const GRID_VERT_GLSL = /* glsl */ `#version 300 es
precision highp float;

in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;

void main() {
  vUV = aUV;
  vec3 worldPos = uWorldTransformMatrix * vec3(aPosition, 1.0);
  gl_Position = vec4((uProjectionMatrix * worldPos).xy, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Fragment Shader (GLSL ES 3.0)
// ---------------------------------------------------------------------------
export const GRID_FRAG_GLSL = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform vec2 uBoundsMin;
uniform vec2 uBoundsMax;
uniform float uGridSize;
uniform float uMajorFactor;
uniform vec3 uMinorColor;
uniform vec3 uMajorColor;
uniform float uMinorAlpha;
uniform float uMajorAlpha;
uniform float uStyle;      // 0 = lines, 1 = dots
uniform float uZoom;
uniform float uLodMinorFade;
uniform float uLodMajorFade;
uniform float uDotRadius;  // screen pixels

// ------------------------------------------------------------------
// Antialiased line helper: returns 0..1 where 1 = on a grid line.
// Uses fwidth() so line appears exactly 1 screen-pixel wide at all
// zoom levels (device-pixel-ratio included).
// ------------------------------------------------------------------
float gridLine(vec2 worldPos, float cellSize) {
  vec2 f = fract(worldPos / cellSize);
  // distance from nearest grid line (0..0.5)
  vec2 df = min(f, 1.0 - f) * cellSize;
  // derivative in world space per screen pixel
  vec2 fw = fwidth(worldPos);
  // smooth step over half a pixel
  vec2 strength = 1.0 - smoothstep(fw * 0.5, fw * 1.5, df);
  return max(strength.x, strength.y);
}

// ------------------------------------------------------------------
// Antialiased dot helper: returns 1 at grid intersections.
// ------------------------------------------------------------------
float gridDot(vec2 worldPos, float cellSize) {
  // snap worldPos to nearest grid point
  vec2 nearest = round(worldPos / cellSize) * cellSize;
  vec2 diff = worldPos - nearest;
  // screen-space distance
  vec2 fw = fwidth(worldPos);
  float dx = length(diff / fw);
  // dot radius in screen pixels
  float r = uDotRadius;
  return 1.0 - smoothstep(r - 0.5, r + 0.5, dx);
}

// ------------------------------------------------------------------
// LOD fade: linear ramp from 0 to 1 over one octave above threshold
// ------------------------------------------------------------------
float lodFade(float zoom, float threshold) {
  return clamp((zoom - threshold) / threshold, 0.0, 1.0);
}

void main() {
  // Map UV [0,1] to world coordinates
  vec2 worldPos = mix(uBoundsMin, uBoundsMax, vUV);

  float majorSize = uGridSize * uMajorFactor;

  // LOD alphas
  float minorFade = lodFade(uZoom, uLodMinorFade);
  float majorFade = lodFade(uZoom, uLodMajorFade);

  float minorMask = 0.0;
  float majorMask = 0.0;

  if (uStyle < 0.5) {
    // ── Lines mode ───────────────────────────────────────────────
    if (majorFade > 0.001) {
      majorMask = gridLine(worldPos, majorSize);
    }
    if (minorFade > 0.001) {
      float m = gridLine(worldPos, uGridSize);
      // Subtract major lines so they don't overlap (major wins)
      m = m * (1.0 - majorMask);
      minorMask = m;
    }
  } else {
    // ── Dots mode ────────────────────────────────────────────────
    if (majorFade > 0.001) {
      majorMask = gridDot(worldPos, majorSize);
    }
    if (minorFade > 0.001) {
      float m = gridDot(worldPos, uGridSize);
      m = m * (1.0 - majorMask);
      minorMask = m;
    }
  }

  // Compose colors
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (majorMask > 0.001 && majorFade > 0.001) {
    float a = majorMask * uMajorAlpha * majorFade;
    color = uMajorColor;
    alpha = a;
  }
  if (minorMask > 0.001 && minorFade > 0.001) {
    float a = minorMask * uMinorAlpha * minorFade;
    // Porter-Duff "over" composite on top of major
    float outA = a + alpha * (1.0 - a);
    color = outA > 0.0 ? (uMinorColor * a + color * alpha * (1.0 - a)) / outA : color;
    alpha = outA;
  }

  fragColor = vec4(color * alpha, alpha);
}
`;

export const GRID_VERT_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

struct GlobalUniforms {
  uProjectionMatrix: mat3x3<f32>,
  uWorldTransformMatrix: mat3x3<f32>,
}
@group(0) @binding(0) var<uniform> global: GlobalUniforms;

@vertex
fn main(@location(0) aPosition: vec2<f32>, @location(1) aUV: vec2<f32>) -> VertexOutput {
  var out: VertexOutput;
  let worldPos = global.uWorldTransformMatrix * vec3<f32>(aPosition, 1.0);
  let proj = global.uProjectionMatrix * worldPos;
  out.position = vec4<f32>(proj.xy, 0.0, 1.0);
  out.uv = aUV;
  return out;
}
`;

export const GRID_FRAG_WGSL = /* wgsl */ `
struct GridUniforms {
  uBoundsMin: vec2<f32>,
  uBoundsMax: vec2<f32>,
  uGridSize: f32,
  uMajorFactor: f32,
  uMinorColor: vec3<f32>,
  uMajorColor: vec3<f32>,
  uMinorAlpha: f32,
  uMajorAlpha: f32,
  uStyle: f32,
  uZoom: f32,
  uLodMinorFade: f32,
  uLodMajorFade: f32,
  uDotRadius: f32,
}

@group(1) @binding(0) var<uniform> grid: GridUniforms;

fn lodFade(zoom: f32, threshold: f32) -> f32 {
  // Linear fade over one octave
  return clamp((zoom - threshold) / threshold, 0.0, 1.0);
}

fn gridLine(worldPos: vec2<f32>, cellSize: f32) -> f32 {
  let f = fract(worldPos / cellSize);
  let df = min(f, 1.0 - f) * cellSize;
  let fw = fwidth(worldPos);
  let strength = 1.0 - smoothstep(fw * 0.5, fw * 1.5, df);
  return max(strength.x, strength.y);
}

fn gridDot(worldPos: vec2<f32>, cellSize: f32) -> f32 {
  let nearest = round(worldPos / cellSize) * cellSize;
  let diff = worldPos - nearest;
  let fw = fwidth(worldPos);
  let dx = length(diff / fw);
  return 1.0 - smoothstep(grid.uDotRadius - 0.5, grid.uDotRadius + 0.5, dx);
}

@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let worldPos = mix(grid.uBoundsMin, grid.uBoundsMax, uv);
  let majorSize = grid.uGridSize * grid.uMajorFactor;
  let minorFade = lodFade(grid.uZoom, grid.uLodMinorFade);
  let majorFade = lodFade(grid.uZoom, grid.uLodMajorFade);

  var minorMask = 0.0;
  var majorMask = 0.0;

  if (grid.uStyle < 0.5) {
    if (majorFade > 0.001) { majorMask = gridLine(worldPos, majorSize); }
    if (minorFade > 0.001) { 
      minorMask = gridLine(worldPos, grid.uGridSize) * (1.0 - majorMask); 
    }
  } else {
    if (majorFade > 0.001) { majorMask = gridDot(worldPos, majorSize); }
    if (minorFade > 0.001) { 
      minorMask = gridDot(worldPos, grid.uGridSize) * (1.0 - majorMask); 
    }
  }

  var color = vec3<f32>(0.0);
  var alpha = 0.0;

  if (majorMask > 0.001 && majorFade > 0.001) {
    alpha = majorMask * grid.uMajorAlpha * majorFade;
    color = grid.uMajorColor;
  }
  if (minorMask > 0.001 && minorFade > 0.001) {
    let a = minorMask * grid.uMinorAlpha * minorFade;
    let outA = a + alpha * (1.0 - a);
    color = select(color, (grid.uMinorColor * a + color * alpha * (1.0 - a)) / outA, outA > 0.0);
    alpha = outA;
  }

  return vec4<f32>(color * alpha, alpha);
}
`;
