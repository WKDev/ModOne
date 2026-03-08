/**
 * BlockRenderer — Circuit Block Rendering
 *
 * Renders circuit blocks using shared GraphicsContext from the SymbolLibrary.
 * Each block gets its own Graphics instance (positioned at block.position)
 * and an optional Text label.
 *
 * Performance strategy:
 * - GraphicsContext is shared across all instances of the same block type
 *   (memory-efficient: geometry defined once, referenced many times)
 * - Text labels use Pixi Text with caching
 * - Per-block culling via cullable + cullArea
 * - Selection/hover via tint (no redraw)
 * - Rotation/flip via Graphics transform
 */

import { Graphics, GraphicsContext, Text, Container, Rectangle, type TextStyle as PixiTextStyle } from 'pixi.js';
import type {
  Block,
} from '../types';
import { getSymbolContext, getSymbolSize, getCustomSymbolContext, getCustomSymbolSize, getSymbolContextForBlockType, getSymbolSizeForBlockType } from './symbols';

// ============================================================================
// Configuration
// ============================================================================

export interface BlockStyle {
  /** Selected block tint color */
  selectedTint: number;
  /** Hovered block tint color */
  hoverTint: number;
  /** Label font size */
  labelFontSize: number;
  /** Label color */
  labelColor: string;
  /** Designation font size */
  designationFontSize: number;
  /** Designation color */
  designationColor: string;
}

const DEFAULT_BLOCK_STYLE: BlockStyle = {
  selectedTint: 0x4dabf7,
  hoverTint: 0x74c0fc,
  labelFontSize: 11,
  labelColor: '#a5b0bb',
  designationFontSize: 10,
  designationColor: '#888888',
};

const LABEL_STYLE: Partial<PixiTextStyle> = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: DEFAULT_BLOCK_STYLE.labelFontSize,
  fill: DEFAULT_BLOCK_STYLE.labelColor,
  align: 'center',
};

const DESIGNATION_STYLE: Partial<PixiTextStyle> = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: DEFAULT_BLOCK_STYLE.designationFontSize,
  fill: DEFAULT_BLOCK_STYLE.designationColor,
  align: 'center',
};

export interface BlockRendererOptions {
  /** The block layer container */
  layer: Container;
  /** Block visual style */
  style?: Partial<BlockStyle>;
}

// ============================================================================
// Internal types
// ============================================================================

interface BlockDisplayObject {
  /** Container holding symbol + labels */
  container: Container;
  /** The symbol graphics */
  symbol: Graphics;
  /** Label text (block type or custom label) */
  label: Text | null;
  /** Designation text (e.g., "K1", "M1") */
  designation: Text | null;
}

// ============================================================================
// BlockRenderer
// ============================================================================

function resolveSymbolContext(block: Block): GraphicsContext {
  // Try unified bridge by block type (covers all registered builtins)
  const ctxByType = getSymbolContextForBlockType(block.type);
  if (ctxByType) return ctxByType;
  // Try by explicit symbolId (custom user symbols)
  if ('symbolId' in block && block.symbolId) {
    const ctxById = getCustomSymbolContext(block.symbolId);
    if (ctxById) return ctxById;
  }
  // Fallback to legacy SymbolLibrary (hardcoded Pixi.js drawing)
  return getSymbolContext(block.type);
}

function resolveSymbolSize(block: Block): { width: number; height: number } {
  // Try unified bridge by block type
  const sizeByType = getSymbolSizeForBlockType(block.type);
  if (sizeByType) return sizeByType;
  // Try by explicit symbolId
  if ('symbolId' in block && block.symbolId) {
    const sizeById = getCustomSymbolSize(block.symbolId);
    if (sizeById) return sizeById;
  }
  // Fallback to legacy SymbolLibrary
  return getSymbolSize(block.type);
}

export class BlockRenderer {
  private _layer: Container;
  private _style: BlockStyle;
  private _blocks: Map<string, BlockDisplayObject> = new Map();
  private _selectedBlockIds: Set<string> = new Set();
  private _hoveredBlockId: string | null = null;
  private _destroyed = false;

  constructor(options: BlockRendererOptions) {
    this._layer = options.layer;
    this._style = { ...DEFAULT_BLOCK_STYLE, ...options.style };
  }

  // --------------------------------------------------------------------------
  // Full Render
  // --------------------------------------------------------------------------

  /**
   * Render all blocks from scratch.
   */
  renderAll(blocks: Record<string, Block>): void {
    if (this._destroyed) return;

    // Remove stale block display objects
    const blockIds = new Set(Object.keys(blocks));
    for (const [id, dobj] of this._blocks) {
      if (!blockIds.has(id)) {
        this._destroyBlockDO(dobj);
        this._blocks.delete(id);
      }
    }

    // Render each block
    for (const block of Object.values(blocks)) {
      this._renderBlock(block);
    }
  }

  /**
   * Render/update a single block.
   */
  renderBlock(block: Block): void {
    if (this._destroyed) return;
    this._renderBlock(block);
  }

  /**
   * Remove a block from the display.
   */
  removeBlock(blockId: string): void {
    const dobj = this._blocks.get(blockId);
    if (dobj) {
      this._destroyBlockDO(dobj);
      this._blocks.delete(blockId);
    }
    this._selectedBlockIds.delete(blockId);
  }

  // --------------------------------------------------------------------------
  // Selection & Hover
  // --------------------------------------------------------------------------

  setSelectedBlocks(ids: Set<string>): void {
    const changed = new Set<string>();
    for (const id of this._selectedBlockIds) {
      if (!ids.has(id)) changed.add(id);
    }
    for (const id of ids) {
      if (!this._selectedBlockIds.has(id)) changed.add(id);
    }
    this._selectedBlockIds = new Set(ids);

    for (const id of changed) {
      this._updateBlockTint(id);
    }
  }

  setHoveredBlock(blockId: string | null): void {
    if (this._hoveredBlockId === blockId) return;
    const prev = this._hoveredBlockId;
    this._hoveredBlockId = blockId;

    if (prev) this._updateBlockTint(prev);
    if (blockId) this._updateBlockTint(blockId);
  }

  /** Get the symbol Graphics for a block (used by SimulationRenderer) */
  getBlockGraphics(blockId: string): Graphics | null {
    return this._blocks.get(blockId)?.symbol ?? null;
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private _renderBlock(block: Block): void {
    if (block.visible === false) {
      // Hide if exists
      const existing = this._blocks.get(block.id);
      if (existing) {
        existing.container.visible = false;
      }
      return;
    }

    let dobj = this._blocks.get(block.id);

    if (!dobj) {
      dobj = this._createBlockDO(block);
      this._blocks.set(block.id, dobj);
      this._layer.addChild(dobj.container);
    }

    // Update position
    dobj.container.position.set(block.position.x, block.position.y);
    dobj.container.visible = true;

    // Update transform (rotation/flip)
    this._applyTransform(dobj, block);

    const expectedCtx = resolveSymbolContext(block);
    if (dobj.symbol.context !== expectedCtx) {
      dobj.symbol.context = expectedCtx;
    }

    this._updateLabels(dobj, block);
    this._updateBlockTint(block.id);

    const size = resolveSymbolSize(block);
    dobj.container.cullArea = new Rectangle(
      -10,
      -20,
      size.width + 20,
      size.height + 40,
    );
  }

  private _createBlockDO(block: Block): BlockDisplayObject {
    const container = new Container();
    container.label = `block-${block.id}`;
    container.cullable = true;

    const ctx = resolveSymbolContext(block);
    const symbol = new Graphics(ctx);
    symbol.label = 'symbol';
    container.addChild(symbol);

    return {
      container,
      symbol,
      label: null,
      designation: null,
    };
  }

  private _applyTransform(dobj: BlockDisplayObject, block: Block): void {
    const size = resolveSymbolSize(block);
    const symbol = dobj.symbol;

    // Reset transform
    symbol.position.set(0, 0);
    symbol.rotation = 0;
    symbol.scale.set(1, 1);

    // Apply rotation around center
    const rotation = block.rotation ?? 0;
    if (rotation !== 0) {
      const cx = size.width / 2;
      const cy = size.height / 2;
      symbol.pivot.set(cx, cy);
      symbol.position.set(cx, cy);
      symbol.rotation = (rotation * Math.PI) / 180;
    } else {
      symbol.pivot.set(0, 0);
    }

    // Apply flip
    const flip = block.flip;
    if (flip) {
      if (flip.horizontal) {
        symbol.scale.x = -1;
        if (rotation === 0) {
          symbol.pivot.set(size.width, symbol.pivot.y);
          symbol.position.set(size.width, symbol.position.y);
        }
      }
      if (flip.vertical) {
        symbol.scale.y = -1;
        if (rotation === 0) {
          symbol.pivot.set(symbol.pivot.x, size.height);
          symbol.position.set(symbol.position.x, size.height);
        }
      }
    }
  }

  private _updateLabels(dobj: BlockDisplayObject, block: Block): void {
    const size = resolveSymbolSize(block);

    // Label (below symbol)
    const labelText = block.label || '';
    if (labelText) {
      if (!dobj.label) {
        dobj.label = new Text({ text: labelText, style: LABEL_STYLE });
        dobj.label.label = 'block-label';
        dobj.label.anchor.set(0.5, 0);
        dobj.container.addChild(dobj.label);
      }
      dobj.label.text = labelText;
      dobj.label.position.set(size.width / 2, size.height + 4);
      dobj.label.visible = true;
    } else if (dobj.label) {
      dobj.label.visible = false;
    }

    // Designation (above symbol)
    const desText = block.designation || '';
    if (desText) {
      if (!dobj.designation) {
        dobj.designation = new Text({ text: desText, style: DESIGNATION_STYLE });
        dobj.designation.label = 'block-designation';
        dobj.designation.anchor.set(0.5, 1);
        dobj.container.addChild(dobj.designation);
      }
      dobj.designation.text = desText;
      dobj.designation.position.set(size.width / 2, -4);
      dobj.designation.visible = true;
    } else if (dobj.designation) {
      dobj.designation.visible = false;
    }
  }

  private _updateBlockTint(blockId: string): void {
    const dobj = this._blocks.get(blockId);
    if (!dobj) return;

    if (this._selectedBlockIds.has(blockId)) {
      dobj.symbol.tint = this._style.selectedTint;
    } else if (this._hoveredBlockId === blockId) {
      dobj.symbol.tint = this._style.hoverTint;
    } else {
      dobj.symbol.tint = 0xffffff;
    }
  }

  private _destroyBlockDO(dobj: BlockDisplayObject): void {
    dobj.symbol.destroy();
    dobj.label?.destroy();
    dobj.designation?.destroy();
    dobj.container.destroy({ children: true });
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const dobj of this._blocks.values()) {
      this._destroyBlockDO(dobj);
    }
    this._blocks.clear();
  }
}
