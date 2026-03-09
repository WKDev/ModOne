/**
 * WireRenderer — Orthogonal Wire Path Rendering
 *
 * Renders circuit wires as orthogonal polylines through their handle points.
 * Supports wire highlighting, selection state, and simulation voltage coloring.
 *
 * Performance strategy:
 * - One Graphics object per wire (allows individual culling/updates)
 * - Shared GraphicsContext for selected-state overlays
 * - Only redraws wires flagged as dirty
 * - Uses viewport culling (cullable + cullArea on each wire graphic)
 */

import { Graphics, Rectangle, type Container } from 'pixi.js';
import type {
  Wire,
  Position,
  Block,
  Junction,
} from '../types';
import {
  isPortEndpoint,
  isJunctionEndpoint,
  isFloatingEndpoint,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

export interface WireStyle {
  /** Default wire color */
  color: number;
  /** Wire stroke width in world units */
  width: number;
  /** Selected wire color */
  selectedColor: number;
  /** Selected wire width */
  selectedWidth: number;
  /** Hover wire color */
  hoverColor: number;
  /** Preview/in-progress wire color */
  previewColor: number;
  /** Preview wire alpha */
  previewAlpha: number;
}

const DEFAULT_WIRE_STYLE: WireStyle = {
  color: 0x4a4f57,
  width: 2,
  selectedColor: 0x4dabf7,
  selectedWidth: 2.5,
  hoverColor: 0x74c0fc,
  previewColor: 0x4dabf7,
  previewAlpha: 0.6,
};

export interface WireRendererOptions {
  /** The wire layer container */
  layer: Container;
  /** Wire visual style */
  style?: Partial<WireStyle>;
}

// ============================================================================
// WireRenderer
// ============================================================================

export class WireRenderer {
  private _layer: Container;
  private _style: WireStyle;
  private _wireGraphics: Map<string, Graphics> = new Map();
  private _previewGraphics: Graphics | null = null;
  private _hoveredWireId: string | null = null;
  private _selectedWireIds: Set<string> = new Set();
  private _destroyed = false;

  constructor(options: WireRendererOptions) {
    this._layer = options.layer;
    this._style = { ...DEFAULT_WIRE_STYLE, ...options.style };
  }

  // --------------------------------------------------------------------------
  // Full Render
  // --------------------------------------------------------------------------

  /**
   * Render all wires from scratch.
   */
  renderAll(
    wires: Record<string, Wire>,
    blocks: Record<string, Block>,
    junctions: Record<string, Junction>
  ): void {
    if (this._destroyed) return;

    // Remove stale wire graphics
    const wireIds = new Set(Object.keys(wires));
    for (const [id, g] of this._wireGraphics) {
      if (!wireIds.has(id)) {
        g.destroy();
        this._wireGraphics.delete(id);
      }
    }

    // Render each wire
    for (const wire of Object.values(wires)) {
      this._renderWire(wire, blocks, junctions);
    }
  }

  /**
   * Render a single wire (create or update).
   */
  renderWire(
    wire: Wire,
    blocks: Record<string, Block>,
    junctions: Record<string, Junction>
  ): void {
    if (this._destroyed) return;
    this._renderWire(wire, blocks, junctions);
  }

  /**
   * Remove a wire from the display.
   */
  removeWire(wireId: string): void {
    const g = this._wireGraphics.get(wireId);
    if (g) {
      g.destroy();
      this._wireGraphics.delete(wireId);
    }
    this._selectedWireIds.delete(wireId);
  }

  // --------------------------------------------------------------------------
  // Selection & Hover
  // --------------------------------------------------------------------------

  setSelectedWires(ids: Set<string>): void {
    const changed = new Set<string>();
    // Find newly deselected
    for (const id of this._selectedWireIds) {
      if (!ids.has(id)) changed.add(id);
    }
    // Find newly selected
    for (const id of ids) {
      if (!this._selectedWireIds.has(id)) changed.add(id);
    }
    this._selectedWireIds = new Set(ids);

    // Redraw changed wires (just update their tint/style)
    for (const id of changed) {
      const g = this._wireGraphics.get(id);
      if (g) {
        // Will be fully redrawn on next renderAll; for now toggle tint
        g.tint = ids.has(id) ? this._style.selectedColor : 0xffffff;
      }
    }
  }

  setHoveredWire(wireId: string | null): void {
    if (this._hoveredWireId === wireId) return;
    const prev = this._hoveredWireId;
    this._hoveredWireId = wireId;

    if (prev) {
      const g = this._wireGraphics.get(prev);
      if (g && !this._selectedWireIds.has(prev)) {
        g.tint = 0xffffff;
      }
    }
    if (wireId) {
      const g = this._wireGraphics.get(wireId);
      if (g && !this._selectedWireIds.has(wireId)) {
        g.tint = this._style.hoverColor;
      }
    }
  }

  /** Get the Graphics object for a wire (used by SimulationRenderer) */
  getWireGraphics(wireId: string): Graphics | null {
    return this._wireGraphics.get(wireId) ?? null;
  }

  // --------------------------------------------------------------------------
  // Preview Wire (wire drawing mode)
  // --------------------------------------------------------------------------

  renderPreview(points: Position[]): void {
    if (this._destroyed) return;
    if (!this._previewGraphics) {
      this._previewGraphics = new Graphics();
      this._previewGraphics.label = 'wire-preview';
      this._layer.addChild(this._previewGraphics);
    }

    const g = this._previewGraphics;
    g.clear();

    if (points.length < 2) {
      g.visible = false;
      return;
    }
    g.visible = true;

    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.stroke({
      color: this._style.previewColor,
      width: this._style.width,
      alpha: this._style.previewAlpha,
    });
  }

  clearPreview(): void {
    if (this._previewGraphics) {
      this._previewGraphics.clear();
      this._previewGraphics.visible = false;
    }
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private _renderWire(
    wire: Wire,
    blocks: Record<string, Block>,
    junctions: Record<string, Junction>
  ): void {
    let g = this._wireGraphics.get(wire.id);
    if (!g) {
      g = new Graphics();
      g.label = `wire-${wire.id}`;
      g.cullable = true;
      this._wireGraphics.set(wire.id, g);
      this._layer.addChild(g);
    }

    g.clear();

    // Build the point sequence: from → handles → to
    const points = this._buildWirePoints(wire, blocks, junctions);
    if (points.length < 2) return;

    // Determine style
    const isSelected = this._selectedWireIds.has(wire.id);
    const isHovered = this._hoveredWireId === wire.id;
    const color = isSelected
      ? this._style.selectedColor
      : isHovered
        ? this._style.hoverColor
        : this._style.color;
    const width = isSelected ? this._style.selectedWidth : this._style.width;

    // Draw the polyline
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.stroke({ color, width });

    // Reset tint (selection color is drawn directly)
    g.tint = 0xffffff;

    // Update cull area for viewport culling
    this._updateCullArea(g, points);
  }

  /**
   * Resolve wire endpoint positions and build the complete point sequence.
   */
  private _buildWirePoints(
    wire: Wire,
    blocks: Record<string, Block>,
    junctions: Record<string, Junction>
  ): Position[] {
    const points: Position[] = [];

    // Resolve "from" endpoint
    const fromPos = this._resolveEndpointPosition(wire.from, blocks, junctions);
    if (fromPos) points.push(fromPos);

    // Add handle positions
    for (const handle of (wire.handles ?? [])) {
      points.push(handle.position);
    }

    // Resolve "to" endpoint
    const toPos = this._resolveEndpointPosition(wire.to, blocks, junctions);
    if (toPos) points.push(toPos);

    return points;
  }

  /**
   * Resolve a wire endpoint to a world position.
   */
  private _resolveEndpointPosition(
    endpoint: Wire['from'],
    blocks: Record<string, Block>,
    junctions: Record<string, Junction>
  ): Position | null {
    if (isFloatingEndpoint(endpoint)) {
      return endpoint.position;
    }

    if (isPortEndpoint(endpoint)) {
      const blockId = endpoint.componentId;
      if (!blockId) return null;
      const block = blocks[blockId];
      if (!block) return null;
      const port = block.ports.find((p) => p.id === endpoint.portId);
      if (!port) return null;
      return {
        x: block.position.x + (port.absolutePosition?.x ?? 0),
        y: block.position.y + (port.absolutePosition?.y ?? 0),
      };
    }

    if (isJunctionEndpoint(endpoint)) {
      const junction = junctions[endpoint.junctionId];
      if (!junction) return null;
      return junction.position;
    }

    return null;
  }

  /**
   * Set cullArea for viewport-based culling.
   */
  private _updateCullArea(g: Graphics, points: Position[]): void {
    if (points.length === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = 10;
    g.cullArea = new Rectangle(
      minX - pad,
      minY - pad,
      maxX - minX + pad * 2,
      maxY - minY + pad * 2,
    );
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const g of this._wireGraphics.values()) {
      g.destroy();
    }
    this._wireGraphics.clear();

    if (this._previewGraphics) {
      this._previewGraphics.destroy();
      this._previewGraphics = null;
    }
  }
}
