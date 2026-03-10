/**
 * GridRenderer — Shader-based Procedural Grid (CAD-style, single draw call)
 *
 * Implements an infinite grid using a full-viewport Mesh with a custom GLSL
 * fragment shader. The shader computes every grid line/dot mathematically
 * per-pixel on the GPU — no per-element CPU loop, no Graphics.clear() overhead.
 *
 * Performance characteristics:
 *  - CPU: O(1) uniform upload per frame (panX, panY, zoom)
 *  - GPU: 1 draw call, parallel pixel computation via fragment shader
 *  - fwidth() provides perfect antialiasing at any zoom level
 */

import {
  Mesh,
  MeshGeometry,
  Shader,
  GlProgram,
  UniformGroup,
  GpuProgram,
  type Container,
} from 'pixi.js';
import type { GridConfig, ViewportBounds } from '../types';
import { DEFAULT_GRID } from '../types';
import {
  GRID_FRAG_GLSL,
  GRID_FRAG_WGSL,
  GRID_VERT_GLSL,
  GRID_VERT_WGSL,
} from './GridShader';

// Typed uniforms object to avoid `unknown` indexing on UniformGroup.uniforms
interface GridUniforms {
  uBoundsMin: Float32Array;
  uBoundsMax: Float32Array;
  uGridSize: number;
  uMajorFactor: number;
  uMinorColor: Float32Array;
  uMajorColor: Float32Array;
  uMinorAlpha: number;
  uMajorAlpha: number;
  uStyle: number;
  uZoom: number;
  uLodMinorFade: number;
  uLodMajorFade: number;
  uDotRadius: number;
}

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/** Physical unit for the grid spacing. */
export type GridUnit = 'px' | 'mil' | 'mm';

/** Pixels per mil (1 mil = 1/1000 inch, 1 inch = 96 CSS px). */
const PX_PER_MIL = 96 / 1000;
/** Pixels per millimeter (1 mm = 96/25.4 CSS px). */
const PX_PER_MM = 96 / 25.4;

/**
 * Convert a value from the given unit to canvas pixels.
 * The canvas coordinate system uses 1 px = 1 unit by default.
 */
export function unitToPx(value: number, unit: GridUnit): number {
  switch (unit) {
    case 'mil': return value * PX_PER_MIL;
    case 'mm': return value * PX_PER_MM;
    default: return value;
  }
}

// ---------------------------------------------------------------------------
// Grid Renderer options
// ---------------------------------------------------------------------------

export interface GridRendererOptions {
  /** Stage layer to add the grid mesh to. */
  layer: Container;
  /** Initial grid configuration. */
  config?: GridConfig;
}

// ---------------------------------------------------------------------------
// Helper: parse a CSS hex color string into a [r, g, b] triple (0..1 range)
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16 & 0xff) / 255, (n >> 8 & 0xff) / 255, (n & 0xff) / 255];
}

// ---------------------------------------------------------------------------
// GridRenderer
// ---------------------------------------------------------------------------

/**
 * Renders an infinite grid via a single GPU draw call.
 * Update `render(bounds, zoom)` once per frame — the shader does the rest.
 */
export class GridRenderer {
  // ----- Pixi objects -------------------------------------------------------
  private _mesh: Mesh<MeshGeometry, Shader> | null = null;
  private _uniforms: UniformGroup | null = null;
  private _uniformData: GridUniforms | null = null;

  // ----- State --------------------------------------------------------------
  private _config: GridConfig;
  private _layer: Container;
  private _destroyed = false;

  // Full-screen quad vertices (two triangles): covers [-1, 1] NDC range,
  // but we position in world-space by passing bounds as uniforms.
  private static readonly QUAD_POSITIONS = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  private static readonly QUAD_UVS = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ]);
  private static readonly QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

  constructor(options: GridRendererOptions) {
    this._config = options.config ?? DEFAULT_GRID;
    this._layer = options.layer;
    this._initMesh();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  get config(): GridConfig {
    return this._config;
  }

  set config(value: GridConfig) {
    this._config = value;
    this._syncConfigUniforms();
  }

  /**
   * Call once per viewport change. Passes pan/zoom/bounds to the shader.
   * No geometry rebuilt — just uniform upload (bytes, not draw calls).
   */
  render(bounds: ViewportBounds, zoom: number): void {
    if (this._destroyed || !this._mesh || !this._uniforms) return;

    const visible = this._config.visible ?? true;
    this._mesh.visible = visible;
    if (!visible) return;

    const u = this._uniformData!;
    u.uBoundsMin[0] = bounds.minX;
    u.uBoundsMin[1] = bounds.minY;
    u.uBoundsMax[0] = bounds.maxX;
    u.uBoundsMax[1] = bounds.maxY;
    u.uZoom = zoom;
    // Propagate scalar changes back into the UniformGroup so Pixi uploads them
    const ug = this._uniforms!.uniforms as Record<string, unknown>;
    ug['uZoom'] = zoom;

    // Resize the mesh quad to cover the world-space viewport area exactly
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    this._mesh.x = bounds.minX;
    this._mesh.y = bounds.minY;
    this._mesh.width = w;
    this._mesh.height = h;
  }

  setVisible(visible: boolean): void {
    this._config = { ...this._config, visible };
    if (this._mesh) this._mesh.visible = visible;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._mesh?.destroy();
    this._mesh = null;
    this._uniforms = null;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _initMesh(): void {
    const geometry = new MeshGeometry({
      positions: GridRenderer.QUAD_POSITIONS,
      uvs: GridRenderer.QUAD_UVS,
      indices: GridRenderer.QUAD_INDICES,
    });

    const uniforms = this._buildUniforms();
    this._uniforms = uniforms;

    const glProgram = new GlProgram({
      vertex: GRID_VERT_GLSL,
      fragment: GRID_FRAG_GLSL,
    });

    let gpuProgram: GpuProgram | undefined;
    try {
      gpuProgram = new GpuProgram({
        vertex: { source: GRID_VERT_WGSL, entryPoint: 'main' },
        fragment: { source: GRID_FRAG_WGSL, entryPoint: 'main' },
      });
    } catch {
      // WebGPU not available — fine, WebGL will be used.
    }

    const shader = new Shader({
      glProgram,
      ...(gpuProgram ? { gpuProgram } : {}),
      resources: {
        gridUniforms: uniforms,
      },
    });

    const mesh = new Mesh<MeshGeometry, Shader>({ geometry, shader });
    mesh.label = 'grid-shader-mesh';

    // The mesh lives in world-space — its position and dimensions are
    // updated each render() call to match the visible viewport bounds.
    this._mesh = mesh;
    this._layer.addChild(mesh as unknown as import('pixi.js').Container);
  }

  private _buildUniforms(): UniformGroup {
    const cfg = this._config;
    const unit = (cfg as GridConfig & { unit?: GridUnit }).unit ?? 'px';
    const gridSizePx = unitToPx(cfg.size, unit);
    const majorFactor = cfg.subdivisions ?? 5;

    const [mr, mg, mb] = hexToRgb(cfg.color ?? '#cccccc');
    const [Mr, Mg, Mb] = hexToRgb(cfg.majorColor ?? '#999999');

    const data: GridUniforms = {
      uBoundsMin: new Float32Array([0, 0]),
      uBoundsMax: new Float32Array([100, 100]),
      uGridSize: gridSizePx,
      uMajorFactor: majorFactor,
      uMinorColor: new Float32Array([mr, mg, mb]),
      uMajorColor: new Float32Array([Mr, Mg, Mb]),
      uMinorAlpha: cfg.alpha ?? 0.4,
      uMajorAlpha: cfg.majorAlpha ?? 0.55,
      uStyle: cfg.style === 'lines' ? 0.0 : 1.0,
      uZoom: 1.0,
      uLodMinorFade: 0.1,    // Fade minor grid below 0.1 zoom
      uLodMajorFade: 0.02,   // Fade major grid below 0.02 zoom (extremely zoomed out)
      uDotRadius: 1.5,
    };
    // Keep a typed reference for direct field access in render() / _syncConfigUniforms()
    this._uniformData = data;

    return new UniformGroup({
      uBoundsMin: { value: data.uBoundsMin, type: 'vec2<f32>' },
      uBoundsMax: { value: data.uBoundsMax, type: 'vec2<f32>' },
      uGridSize: { value: data.uGridSize, type: 'f32' },
      uMajorFactor: { value: data.uMajorFactor, type: 'f32' },
      uMinorColor: { value: data.uMinorColor, type: 'vec3<f32>' },
      uMajorColor: { value: data.uMajorColor, type: 'vec3<f32>' },
      uMinorAlpha: { value: data.uMinorAlpha, type: 'f32' },
      uMajorAlpha: { value: data.uMajorAlpha, type: 'f32' },
      uStyle: { value: data.uStyle, type: 'f32' },
      uZoom: { value: data.uZoom, type: 'f32' },
      uLodMinorFade: { value: data.uLodMinorFade, type: 'f32' },
      uLodMajorFade: { value: data.uLodMajorFade, type: 'f32' },
      uDotRadius: { value: data.uDotRadius, type: 'f32' },
    });
  }

  private _syncConfigUniforms(): void {
    if (!this._uniformData || !this._uniforms) return;
    const cfg = this._config;
    const unit = (cfg as GridConfig & { unit?: GridUnit }).unit ?? 'px';
    const d = this._uniformData;
    const ug = this._uniforms.uniforms as Record<string, unknown>;

    d.uGridSize = unitToPx(cfg.size, unit);
    d.uMajorFactor = cfg.subdivisions ?? 5;
    d.uStyle = cfg.style === 'lines' ? 0.0 : 1.0;
    d.uMinorAlpha = cfg.alpha ?? 0.4;
    d.uMajorAlpha = cfg.majorAlpha ?? 0.55;

    const [mr, mg, mb] = hexToRgb(cfg.color ?? '#cccccc');
    const [Mr, Mg, Mb] = hexToRgb(cfg.majorColor ?? '#999999');
    d.uMinorColor[0] = mr; d.uMinorColor[1] = mg; d.uMinorColor[2] = mb;
    d.uMajorColor[0] = Mr; d.uMajorColor[1] = Mg; d.uMajorColor[2] = Mb;

    // Sync scalar values to UniformGroup (arrays are shared by reference so auto-dirty)
    ug['uGridSize'] = d.uGridSize;
    ug['uMajorFactor'] = d.uMajorFactor;
    ug['uStyle'] = d.uStyle;
    ug['uMinorAlpha'] = d.uMinorAlpha;
    ug['uMajorAlpha'] = d.uMajorAlpha;
  }
}
