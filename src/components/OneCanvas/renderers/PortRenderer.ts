/**
 * PortRenderer — Connection Port Rendering
 *
 * Renders ports as small circles/squares on block edges.
 * Ports become visible and interactive during wire-drawing mode
 * or when hovering near them.
 *
 * Performance strategy:
 * - Shared GraphicsContext for each port type (input/output/power/passive)
 * - One Graphics instance per port, parented to block position
 * - Visibility toggled based on interaction mode
 */

import { Graphics, GraphicsContext, type Container } from 'pixi.js';
import type {
  Block,
  PortType,
  Position,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

export interface PortStyle {
  /** Port circle radius */
  radius: number;
  /** Default port color (passive/bidirectional) */
  defaultColor: number;
  /** Input port color */
  inputColor: number;
  /** Output port color */
  outputColor: number;
  /** Power port color */
  powerColor: number;
  /** Connected port fill alpha */
  connectedAlpha: number;
  /** Unconnected port fill alpha */
  unconnectedAlpha: number;
  /** Snap highlight color */
  snapHighlightColor: number;
  /** Snap highlight radius */
  snapHighlightRadius: number;
  /** Port stroke width */
  strokeWidth: number;
  /** Port stroke color */
  strokeColor: number;
}

const DEFAULT_PORT_STYLE: PortStyle = {
  radius: 4,
  defaultColor: 0xa5b0bb,
  inputColor: 0x51cf66,
  outputColor: 0xff6b6b,
  powerColor: 0xffd43b,
  connectedAlpha: 1.0,
  unconnectedAlpha: 0.7,
  snapHighlightColor: 0x4dabf7,
  snapHighlightRadius: 8,
  strokeWidth: 1.5,
  strokeColor: 0xd0d4da,
};

export interface PortRendererOptions {
  /** The port layer container */
  layer: Container;
  /** Port visual style */
  style?: Partial<PortStyle>;
}

// ============================================================================
// Shared GraphicsContexts
// ============================================================================

function createPortContext(color: number, radius: number, strokeWidth: number, strokeColor: number): GraphicsContext {
  return new GraphicsContext()
    .circle(0, 0, radius)
    .fill({ color, alpha: 0.8 })
    .stroke({ color: strokeColor, width: strokeWidth });
}

function createSnapContext(color: number, radius: number): GraphicsContext {
  return new GraphicsContext()
    .circle(0, 0, radius)
    .fill({ color, alpha: 0.3 })
    .stroke({ color, width: 2, alpha: 0.8 });
}

// ============================================================================
// PortRenderer
// ============================================================================

export class PortRenderer {
  private _layer: Container;
  private _style: PortStyle;
  private _portGraphics: Map<string, Graphics> = new Map();
  private _snapGraphics: Graphics | null = null;
  private _portContexts: Record<string, GraphicsContext>;
  private _snapContext: GraphicsContext;
  private _showAll = false; // toggled via setShowAll()
  private _destroyed = false;

  constructor(options: PortRendererOptions) {
    this._layer = options.layer;
    this._style = { ...DEFAULT_PORT_STYLE, ...options.style };

    // Create shared contexts for each port type
    const s = this._style;
    this._portContexts = {
      input: createPortContext(s.inputColor, s.radius, s.strokeWidth, s.strokeColor),
      output: createPortContext(s.outputColor, s.radius, s.strokeWidth, s.strokeColor),
      power: createPortContext(s.powerColor, s.radius, s.strokeWidth, s.strokeColor),
      passive: createPortContext(s.defaultColor, s.radius, s.strokeWidth, s.strokeColor),
      bidirectional: createPortContext(s.defaultColor, s.radius, s.strokeWidth, s.strokeColor),
    };
    this._snapContext = createSnapContext(s.snapHighlightColor, s.snapHighlightRadius);
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  /**
   * Render all ports for all blocks.
   */
  renderAll(blocks: Record<string, Block>): void {
    if (this._destroyed) return;

    // Remove stale ports
    const validKeys = new Set<string>();
    for (const block of Object.values(blocks)) {
      if (block.visible === false) continue;
      for (const port of block.ports) {
        validKeys.add(`${block.id}:${port.id}`);
      }
    }

    for (const [key, g] of this._portGraphics) {
      if (!validKeys.has(key)) {
        g.destroy();
        this._portGraphics.delete(key);
      }
    }

    // Render each port
    for (const block of Object.values(blocks)) {
      if (block.visible === false) continue;
      this._renderBlockPorts(block);
    }
  }

  /**
   * Update ports for a single block.
   */
  renderBlockPorts(block: Block): void {
    if (this._destroyed) return;
    this._renderBlockPorts(block);
  }

  /**
   * Remove all ports for a block.
   */
  removeBlockPorts(blockId: string): void {
    for (const [key, g] of this._portGraphics) {
      if (key.startsWith(`${blockId}:`)) {
        g.destroy();
        this._portGraphics.delete(key);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Visibility & Snap
  // --------------------------------------------------------------------------

  /** Whether all ports are currently visible */
  get showAll(): boolean {
    return this._showAll;
  }

  /**
   * Show all ports (e.g., during wire drawing mode).
   */
  setShowAll(show: boolean): void {
    this._showAll = show;
    this._layer.visible = show;
  }

  /**
   * Show a snap highlight at a specific port position.
   */
  showSnapHighlight(position: Position): void {
    if (this._destroyed) return;
    if (!this._snapGraphics) {
      this._snapGraphics = new Graphics(this._snapContext);
      this._snapGraphics.label = 'port-snap-highlight';
      this._layer.addChild(this._snapGraphics);
    }
    this._snapGraphics.position.set(position.x, position.y);
    this._snapGraphics.visible = true;
  }

  /**
   * Hide the snap highlight.
   */
  hideSnapHighlight(): void {
    if (this._snapGraphics) {
      this._snapGraphics.visible = false;
    }
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private _renderBlockPorts(block: Block): void {
    for (const port of block.ports) {
      const key = `${block.id}:${port.id}`;
      let g = this._portGraphics.get(key);

      if (!g) {
        const ctx = this._getPortContext(port.type);
        g = new Graphics(ctx);
        g.label = `port-${key}`;
        g.cullable = true;
        this._portGraphics.set(key, g);
        this._layer.addChild(g);
      }

       // Position the port at block.position + port.absolutePosition
       const worldX = block.position.x + (port.absolutePosition?.x ?? 0);
       const worldY = block.position.y + (port.absolutePosition?.y ?? 0);
       g.position.set(worldX, worldY);
    }
  }

  private _getPortContext(type: PortType): GraphicsContext {
    return this._portContexts[type] ?? this._portContexts.passive;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const g of this._portGraphics.values()) {
      g.destroy();
    }
    this._portGraphics.clear();

    if (this._snapGraphics) {
      this._snapGraphics.destroy();
      this._snapGraphics = null;
    }

    // Destroy shared contexts
    for (const ctx of Object.values(this._portContexts)) {
      ctx.destroy();
    }
    this._snapContext.destroy();
  }
}
