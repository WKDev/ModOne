/**
 * GridShader — Procedural GPU Grid via GLSL Fragment Shader
 *
 * Single draw call, zero per-line/per-dot CPU loop.
 * The fragment shader computes grid lines/dots per pixel using fwidth().
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
  // worldPos = viewport child local coords = world coords
  vec3 worldPos = uWorldTransformMatrix * vec3(aPosition, 1.0);
  // gl_Position = NDC [-1, 1]
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

// Uniform block matching GridUniforms in GridRenderer.ts
// PixiJS v8 maps the 'gridUniforms' resource to this block.
layout(std140) uniform gridUniforms {
  vec2 uBoundsMin;
  vec2 uBoundsMax;
  float uGridSize;
  float uMajorFactor;
  vec3 uMinorColor;
  vec3 uMajorColor;
  float uMinorAlpha;
  float uMajorAlpha;
  float uStyle;      // 0 = lines, 1 = dots
  float uZoom;
  float uLodMinorFade;
  float uLodMajorFade;
  float uDotRadius;
};

float lodFade(float zoom, float threshold) {
  return clamp((zoom - threshold) / threshold, 0.0, 1.0);
}

float gridLine(vec2 worldPos, float cellSize) {
  vec2 f = fract(worldPos / cellSize);
  vec2 df = min(f, 1.0 - f) * cellSize;
  vec2 fw = fwidth(worldPos);
  vec2 strength = 1.0 - smoothstep(fw * 0.5, fw * 1.5, df);
  return max(strength.x, strength.y);
}

float gridDot(vec2 worldPos, float cellSize) {
  vec2 nearest = round(worldPos / cellSize) * cellSize;
  vec2 diff = worldPos - nearest;
  vec2 fw = fwidth(worldPos);
  float dx = length(diff / fw);
  return 1.0 - smoothstep(uDotRadius - 0.5, uDotRadius + 0.5, dx);
}

void main() {
  // Map UV [0,1] to world bounds passed from renderer
  vec2 worldPos = mix(uBoundsMin, uBoundsMax, vUV);

  float majorSize = uGridSize * uMajorFactor;
  float minorFade = lodFade(uZoom, uLodMinorFade);
  float majorFade = lodFade(uZoom, uLodMajorFade);

  float minorMask = 0.0;
  float majorMask = 0.0;

  if (uStyle < 0.5) {
    if (majorFade > 0.0) {
      majorMask = gridLine(worldPos, majorSize);
    }
    if (minorFade > 0.0) {
      minorMask = gridLine(worldPos, uGridSize) * (1.0 - majorMask);
    }
  } else {
    if (majorFade > 0.0) {
      majorMask = gridDot(worldPos, majorSize);
    }
    if (minorFade > 0.0) {
      minorMask = gridDot(worldPos, uGridSize) * (1.0 - majorMask);
    }
  }

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (majorMask > 0.001) {
    color = uMajorColor;
    alpha = majorMask * uMajorAlpha * majorFade;
  }
  if (minorMask > 0.001) {
    float a = minorMask * uMinorAlpha * minorFade;
    float outA = a + alpha * (1.0 - a);
    color = outA > 0.0 ? (uMinorColor * a + color * alpha * (1.0 - a)) / outA : color;
    alpha = outA;
  }

  // Final color output
  fragColor = vec4(color * alpha, alpha);
  
  // Debug: Force a faint background if requested (uncomment for visual test)
  // fragColor += vec4(0.1, 0.0, 0.0, 0.05);
}
`;

// WGSL versions omitted for brevity in this debug phase; 
// GridRenderer is currently using only glProgram for stability.
export const GRID_VERT_WGSL = '';
export const GRID_FRAG_WGSL = '';
