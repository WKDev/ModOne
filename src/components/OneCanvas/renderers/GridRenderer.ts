/**
 * GridRenderer — Procedural GPU Grid (CAD-style, single draw call)
 *
 * Uses a Mesh with a custom GLSL fragment shader placed inside the
 * pixi-viewport child container (world-space coordinates).
 *
 * KEY DESIGN:
 *   Pixi Mesh ignores .width/.height setters — size is determined by vertex
 *   positions. We update geometry.positions each frame via the Pixi v8
 *   positions setter so the quad always covers the visible world-space rectangle.
 */

import {
  Mesh,
  MeshGeometry,
  Shader,
  GlProgram,
  UniformGroup,
  type Container,
} from 'pixi.js';
import type { GridConfig, ViewportBounds } from '../types';
import { DEFAULT_GRID, unitToPx } from '../types';
import {
  GRID_FRAG_GLSL,
  GRID_VERT_GLSL,
} from './GridShader';

// ---------------------------------------------------------------------------
// Grid Renderer options
// ---------------------------------------------------------------------------

export interface GridRendererOptions {
  /** The grid layer container (viewport child, world-space). */
  layer: Container;
  /** Initial grid configuration. */
  config?: GridConfig;
}

// ---------------------------------------------------------------------------
// Utility: parse CSS hex color → [r, g, b] in 0..1 range
// ---------------------------------------------------------------------------
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16 & 0xff) / 255, (n >> 8 & 0xff) / 255, (n & 0xff) / 255];
}

// ---------------------------------------------------------------------------
// GridRenderer
// ---------------------------------------------------------------------------

export class GridRenderer {
  private _mesh: Mesh<MeshGeometry, Shader> | null = null;
  private _geometry: MeshGeometry | null = null;
  private _uniforms: UniformGroup | null = null;

  private _config: GridConfig;
  private _layer: Container;
  private _destroyed: boolean = false;
  private _unit: 'px' | 'mil' | 'mm' = 'mm';

  // Uniform storage for direct access
  private _uBoundsMin = new Float32Array([0, 0]);
  private _uBoundsMax = new Float32Array([1920, 1080]);
  private _uMinorColor = new Float32Array([0.8, 0.8, 0.8]);
  private _uMajorColor = new Float32Array([0.6, 0.6, 0.6]);

  constructor(options: GridRendererOptions) {
    this._config = options.config ?? DEFAULT_GRID;
    this._layer = options.layer;
    this._unit = (this._config.unit) ?? 'mm';
    this._initMesh();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  get config(): GridConfig { return this._config; }
  set config(value: GridConfig) {
    this._config = value;
    this._unit = (value.unit) ?? 'mm';
    this._syncConfigUniforms();
  }

  set unit(value: 'px' | 'mil' | 'mm') {
    this._unit = value;
    this._syncConfigUniforms();
  }

  /**
   * Update per-frame. Call whenever the viewport changes.
   *
   * @param bounds  Visible area in WORLD coordinates (PixiViewport.visibleBounds)
   * @param zoom    Current zoom level (viewport.state.zoom)
   */
  render(bounds: ViewportBounds, zoom: number): void {
    if (this._destroyed || !this._mesh || !this._geometry || !this._uniforms) return;

    const visible = this._config.visible ?? true;
    this._mesh.visible = visible;
    if (!visible) return;

    const { minX, minY, maxX, maxY } = bounds;

    // ── 1. Stretch quad to cover visible world area ─────────────────────
    // Pixi v8: setting positions marks the vertex buffer as dirty.
    this._geometry.positions = new Float32Array([
      minX, minY,   // TL
      maxX, minY,   // TR
      maxX, maxY,   // BR
      minX, maxY,   // BL
    ]);

    // ── 2. Update per-frame uniforms ─────────────────────────────────────
    this._uBoundsMin[0] = minX;
    this._uBoundsMin[1] = minY;
    this._uBoundsMax[0] = maxX;
    this._uBoundsMax[1] = maxY;

    // In Pixi v8, updating the underlying Float32Array is sufficient if it's 
    // bound correctly, but we must mark the uniform group as dirty for scalar changes.
    const ug = this._uniforms.uniforms;
    ug.uZoom = zoom;
    this._uniforms.update(); // Force uniform upload update
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
    this._geometry = null;
    this._uniforms = null;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _initMesh(): void {
    // ── GLSL program (WebGL) ──────────────────────────────────────────────
    const glProgram = new GlProgram({
      vertex: GRID_VERT_GLSL,
      fragment: GRID_FRAG_GLSL,
    });

    // Pixi v8 Note: We omit GpuProgram here to let Pixi's auto-translator 
    // handle it, avoiding potential WGSL binding errors during debugging.

    const uniforms = this._buildUniforms();
    this._uniforms = uniforms;

    const shader = new Shader({
      glProgram,
      resources: {
        gridUniforms: uniforms,
      },
    });

    // Initial geometry
    const geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this._geometry = geometry;

    const mesh = new Mesh<MeshGeometry, Shader>({ geometry, shader });
    mesh.label = 'grid-shader-mesh';
    // Mesh is a child of the grid layer (viewport child), so world coordinates 
    // are passed to the vertex shader.

    this._mesh = mesh;
    this._layer.addChild(mesh as unknown as import('pixi.js').Container);
  }

  private _buildUniforms(): UniformGroup {
    const cfg = this._config;
    const gridSizePx = unitToPx(cfg.size, this._unit);
    const majorFactor = cfg.subdivisions ?? 5;

    const [mr, mg, mb] = hexToRgb(cfg.color ?? '#cccccc');
    const [Mr, Mg, Mb] = hexToRgb(cfg.majorColor ?? '#999999');

    this._uMinorColor.set([mr, mg, mb]);
    this._uMajorColor.set([Mr, Mg, Mb]);

    // Use shorthand initialization for direct value access
    return new UniformGroup({
      uBoundsMin: { value: this._uBoundsMin, type: 'vec2<f32>' },
      uBoundsMax: { value: this._uBoundsMax, type: 'vec2<f32>' },
      uGridSize: { value: gridSizePx, type: 'f32' },
      uMajorFactor: { value: majorFactor, type: 'f32' },
      uMinorColor: { value: this._uMinorColor, type: 'vec3<f32>' },
      uMajorColor: { value: this._uMajorColor, type: 'vec3<f32>' },
      uMinorAlpha: { value: cfg.alpha ?? 0.4, type: 'f32' },
      uMajorAlpha: { value: cfg.majorAlpha ?? 0.6, type: 'f32' },
      uStyle: { value: cfg.style === 'lines' ? 0.0 : 1.0, type: 'f32' },
      uZoom: { value: 1.0, type: 'f32' },
      uLodMinorFade: { value: 0.02, type: 'f32' }, // More generous thresholds
      uLodMajorFade: { value: 0.005, type: 'f32' },
      uDotRadius: { value: 1.5, type: 'f32' },
    });
  }

  private _syncConfigUniforms(): void {
    if (!this._uniforms) return;
    const cfg = this._config;
    const ug = this._uniforms.uniforms;

    ug.uGridSize = unitToPx(cfg.size, this._unit);
    ug.uMajorFactor = cfg.subdivisions ?? 5;
    ug.uStyle = cfg.style === 'lines' ? 0.0 : 1.0;
    ug.uMinorAlpha = cfg.alpha ?? 0.4;
    ug.uMajorAlpha = cfg.majorAlpha ?? 0.6;

    const [mr, mg, mb] = hexToRgb(cfg.color ?? '#cccccc');
    const [Mr, Mg, Mb] = hexToRgb(cfg.majorColor ?? '#999999');
    this._uMinorColor.set([mr, mg, mb]);
    this._uMajorColor.set([Mr, Mg, Mb]);

    this._uniforms.update();
  }
}
