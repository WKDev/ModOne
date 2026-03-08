/**
 * GhostPreviewRenderer — Semi-transparent block preview during placement mode
 *
 * Renders a ghost/phantom block that follows the cursor on the overlay layer.
 * Used for click-to-place block placement (EDA industry standard).
 *
 * Features:
 * - Semi-transparent rendering (alpha 0.5)
 * - Grid-snapped positioning
 * - Rotation/flip support during placement
 * - Efficient update (reuses Container, only updates transform)
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import type { BlockType } from '../types';
import { getSymbolContext, getSymbolSize } from './symbols';

// ============================================================================
// Configuration
// ============================================================================

const GHOST_ALPHA = 0.5;
const GHOST_TINT = 0x4dabf7; // Light blue tint

// ============================================================================
// Types
// ============================================================================

export interface GhostPreviewConfig {
  /** The overlay layer container to render on */
  layer: Container;
}

export interface GhostState {
  blockType: string;
  position: { x: number; y: number };
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

// ============================================================================
// GhostPreviewRenderer
// ============================================================================

export class GhostPreviewRenderer {
  private _layer: Container | null = null;
  private _container: Container | null = null;
  private _symbol: Graphics | null = null;
  private _currentBlockType: string | null = null;
  private _destroyed = false;

  /**
   * Initialize the ghost preview renderer.
   */
  init(config: GhostPreviewConfig): void {
    if (this._layer) {
      throw new Error('GhostPreviewRenderer already initialized');
    }
    this._layer = config.layer;
  }

  /**
   * Show the ghost preview for a block type.
   * Creates or updates the ghost graphics.
   */
  show(blockType: string): void {
    if (this._destroyed || !this._layer) return;

    // If block type changed, recreate the graphics
    if (this._currentBlockType !== blockType) {
      this._destroyGhost();
      this._createGhost(blockType);
      this._currentBlockType = blockType;
    }

    if (this._container) {
      this._container.visible = true;
    }
  }

  /**
   * Update the ghost position and transform.
   */
  update(state: GhostState): void {
    if (this._destroyed || !this._container || !this._symbol) return;

    // Ensure correct block type
    if (state.blockType !== this._currentBlockType) {
      this.show(state.blockType);
    }

    // Update position
    this._container.position.set(state.position.x, state.position.y);

    // Apply rotation and flip
    this._applyTransform(state);
  }

  /**
   * Hide the ghost preview (keeps graphics alive for reuse).
   */
  hide(): void {
    if (this._container) {
      this._container.visible = false;
    }
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._destroyGhost();
    this._layer = null;
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private _createGhost(blockType: string): void {
    if (!this._layer) return;

    const container = new Container();
    container.label = 'ghost-preview';
    container.alpha = GHOST_ALPHA;
    container.cullable = true;

    const ctx = getSymbolContext(blockType as BlockType);
    const symbol = new Graphics(ctx);
    symbol.label = 'ghost-symbol';
    symbol.tint = GHOST_TINT;
    container.addChild(symbol);

    // Set cull area for performance
    const size = getSymbolSize(blockType as BlockType);
    container.cullArea = new Rectangle(
      -10,
      -20,
      size.width + 20,
      size.height + 40,
    );

    this._container = container;
    this._symbol = symbol;
    this._layer.addChild(container);
  }

  private _applyTransform(state: GhostState): void {
    const symbol = this._symbol;
    if (!symbol) return;

    const size = getSymbolSize(state.blockType as BlockType);

    // Reset transform
    symbol.position.set(0, 0);
    symbol.rotation = 0;
    symbol.scale.set(1, 1);
    symbol.pivot.set(0, 0);

    // Apply rotation around center
    if (state.rotation !== 0) {
      const cx = size.width / 2;
      const cy = size.height / 2;
      symbol.pivot.set(cx, cy);
      symbol.position.set(cx, cy);
      symbol.rotation = (state.rotation * Math.PI) / 180;
    }

    // Apply flip
    if (state.flipH) {
      symbol.scale.x = -1;
      if (state.rotation === 0) {
        symbol.pivot.set(size.width, symbol.pivot.y);
        symbol.position.set(size.width, symbol.position.y);
      }
    }
    if (state.flipV) {
      symbol.scale.y = -1;
      if (state.rotation === 0) {
        symbol.pivot.set(symbol.pivot.x, size.height);
        symbol.position.set(symbol.position.x, size.height);
      }
    }
  }

  private _destroyGhost(): void {
    if (this._symbol) {
      this._symbol.destroy();
      this._symbol = null;
    }
    if (this._container) {
      this._container.destroy({ children: true });
      this._container = null;
    }
    this._currentBlockType = null;
  }
}
