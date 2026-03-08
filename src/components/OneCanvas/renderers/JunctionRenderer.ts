/**
 * JunctionRenderer — Wire Junction Dot Rendering
 *
 * Renders filled circles at wire junction points.
 * Junctions indicate electrical connections where wires cross/meet.
 *
 * Performance strategy:
 * - Shared GraphicsContext for normal/selected states
 * - One Graphics instance per junction (shared geometry via context)
 * - Culling enabled per junction
 */

import { Graphics, GraphicsContext, type Container } from 'pixi.js';
import type { Junction } from '../types';

// ============================================================================
// Configuration
// ============================================================================

export interface JunctionStyle {
  /** Junction dot radius */
  radius: number;
  /** Fill color */
  color: number;
  /** Selected fill color */
  selectedColor: number;
  /** Hover fill color */
  hoverColor: number;
}

const DEFAULT_JUNCTION_STYLE: JunctionStyle = {
  radius: 5,
  color: 0xd0d4da,
  selectedColor: 0x4dabf7,
  hoverColor: 0x74c0fc,
};

export interface JunctionRendererOptions {
  /** The junction layer container */
  layer: Container;
  /** Junction visual style */
  style?: Partial<JunctionStyle>;
}

// ============================================================================
// JunctionRenderer
// ============================================================================

export class JunctionRenderer {
  private _layer: Container;
  private _style: JunctionStyle;
  private _junctionGraphics: Map<string, Graphics> = new Map();
  private _normalContext: GraphicsContext;
  private _selectedContext: GraphicsContext;
  private _hoverContext: GraphicsContext;
  private _selectedJunctionIds: Set<string> = new Set();
  private _hoveredJunctionId: string | null = null;
  private _destroyed = false;

  constructor(options: JunctionRendererOptions) {
    this._layer = options.layer;
    this._style = { ...DEFAULT_JUNCTION_STYLE, ...options.style };

    const s = this._style;
    this._normalContext = new GraphicsContext()
      .circle(0, 0, s.radius)
      .fill(s.color);
    this._selectedContext = new GraphicsContext()
      .circle(0, 0, s.radius)
      .fill(s.selectedColor);
    this._hoverContext = new GraphicsContext()
      .circle(0, 0, s.radius)
      .fill(s.hoverColor);
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  /**
   * Render all junctions.
   */
  renderAll(junctions: Record<string, Junction>): void {
    if (this._destroyed) return;

    // Remove stale junction graphics
    const junctionIds = new Set(Object.keys(junctions));
    for (const [id, g] of this._junctionGraphics) {
      if (!junctionIds.has(id)) {
        g.destroy();
        this._junctionGraphics.delete(id);
      }
    }

    // Render each junction
    for (const junction of Object.values(junctions)) {
      this._renderJunction(junction);
    }
  }

  /**
   * Render/update a single junction.
   */
  renderJunction(junction: Junction): void {
    if (this._destroyed) return;
    this._renderJunction(junction);
  }

  /**
   * Remove a junction from the display.
   */
  removeJunction(junctionId: string): void {
    const g = this._junctionGraphics.get(junctionId);
    if (g) {
      g.destroy();
      this._junctionGraphics.delete(junctionId);
    }
    this._selectedJunctionIds.delete(junctionId);
  }

  // --------------------------------------------------------------------------
  // Selection & Hover
  // --------------------------------------------------------------------------

  setSelectedJunctions(ids: Set<string>): void {
    const changed = new Set<string>();
    for (const id of this._selectedJunctionIds) {
      if (!ids.has(id)) changed.add(id);
    }
    for (const id of ids) {
      if (!this._selectedJunctionIds.has(id)) changed.add(id);
    }
    this._selectedJunctionIds = new Set(ids);

    for (const id of changed) {
      this._updateJunctionContext(id);
    }
  }

  setHoveredJunction(junctionId: string | null): void {
    if (this._hoveredJunctionId === junctionId) return;
    const prev = this._hoveredJunctionId;
    this._hoveredJunctionId = junctionId;

    if (prev) this._updateJunctionContext(prev);
    if (junctionId) this._updateJunctionContext(junctionId);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private _renderJunction(junction: Junction): void {
    let g = this._junctionGraphics.get(junction.id);
    if (!g) {
      g = new Graphics(this._getContext(junction.id));
      g.label = `junction-${junction.id}`;
      g.cullable = true;
      this._junctionGraphics.set(junction.id, g);
      this._layer.addChild(g);
    }

    g.position.set(junction.position.x, junction.position.y);
    g.context = this._getContext(junction.id);
  }

  private _updateJunctionContext(id: string): void {
    const g = this._junctionGraphics.get(id);
    if (!g) return;
    g.context = this._getContext(id);
  }

  private _getContext(id: string): GraphicsContext {
    if (this._selectedJunctionIds.has(id)) return this._selectedContext;
    if (this._hoveredJunctionId === id) return this._hoverContext;
    return this._normalContext;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const g of this._junctionGraphics.values()) {
      g.destroy();
    }
    this._junctionGraphics.clear();

    this._normalContext.destroy();
    this._selectedContext.destroy();
    this._hoverContext.destroy();
  }
}
