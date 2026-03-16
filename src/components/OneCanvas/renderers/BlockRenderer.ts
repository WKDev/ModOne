/**
 * BlockRenderer — Circuit Block Rendering
 *
 * The previous implementation assumed a single shared GraphicsContext per block.
 * That was efficient, but it prevented stateful visuals, text primitives, and
 * animation targets. This renderer now manages a small visual tree per block:
 *
 * - block container
 * - symbol root (rotation/flip at block level)
 * - symbol layer (primitive/text nodes in symbol coordinates)
 * - label/designation text
 *
 * Visual state transitions rebuild only the affected block's symbol subtree.
 */

import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type GraphicsContext,
  type TextStyle as PixiTextStyle,
} from 'pixi.js';
import type { ComponentBehaviorState } from '@/types/behavior';
import type {
  GraphicPrimitive,
  GraphicPrimitiveOverride,
  SymbolAnimationSpec,
  SymbolDefinition,
  SymbolVisualTransform,
  TextPrimitive,
} from '@/types/symbol';
import type { Block } from '../types';
import { SYMBOL_PX_TO_MM } from '../canvasUnits';
import {
  getCustomSymbolDefinition,
  getCustomSymbolContext,
  getCustomSymbolSize,
  getSymbolContext,
  getSymbolContextForBlockType,
  getSymbolDefinitionForBlockType,
  getSymbolSize,
  getSymbolSizeForBlockType,
} from './symbols';

// ============================================================================
// Configuration
// ============================================================================

export interface BlockStyle {
  selectedTint: number;
  hoverTint: number;
  labelFontSize: number;
  labelColor: string;
  designationFontSize: number;
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

const DEFAULT_TINT = 0xffffff;

export interface BlockRendererOptions {
  layer: Container;
  style?: Partial<BlockStyle>;
}

type PrimitiveDisplayObject = Graphics | Text;
type TintableDisplayNode = PrimitiveDisplayObject & { tint: number; alpha: number };

export interface BlockAnimationTarget {
  displayObject: PrimitiveDisplayObject;
  baseRotation: number;
  spec: SymbolAnimationSpec;
}

export interface BlockVisualHandle {
  container: Container;
  symbolRoot: Container;
  tintables: readonly TintableDisplayNode[];
  animationTargets: ReadonlyMap<string, BlockAnimationTarget>;
  activeVisualState: string | null;
  definitionId: string | null;
}

interface BlockDisplayObject {
  container: Container;
  symbolRoot: Container;
  symbolLayer: Container;
  label: Text | null;
  designation: Text | null;
  tintables: TintableDisplayNode[];
  animationTargets: Map<string, BlockAnimationTarget>;
  primaryGraphics: Graphics | null;
  definitionId: string | null;
  activeVisualState: string | null;
  runtimeTint: number;
  fallbackContext: GraphicsContext | null;
}

interface ResolvedSymbolSource {
  definition: SymbolDefinition | null;
  definitionId: string | null;
  fallbackContext: GraphicsContext;
}

// ============================================================================
// Helpers
// ============================================================================

function cssColorToHex(color: string): number {
  if (!color || color === 'none' || color === 'transparent') return 0x000000;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    }
    return parseInt(hex, 16);
  }

  return 0xd0d4da;
}

function isTransparent(color: string): boolean {
  return !color || color === 'none' || color === 'transparent' || color === '';
}

function resolveSymbolDefinition(block: Block): SymbolDefinition | null {
  const byType = getSymbolDefinitionForBlockType(block.type);
  if (byType) return byType;
  if ('symbolId' in block && block.symbolId) {
    return getCustomSymbolDefinition(block.symbolId);
  }
  return null;
}

function resolveSymbolSource(block: Block): ResolvedSymbolSource {
  const definition = resolveSymbolDefinition(block);
  const ctxByType = getSymbolContextForBlockType(block.type);
  if (ctxByType) {
    return {
      definition,
      definitionId: definition?.id ?? null,
      fallbackContext: ctxByType,
    };
  }

  if ('symbolId' in block && block.symbolId) {
    const ctxById = getCustomSymbolContext(block.symbolId);
    if (ctxById) {
      return {
        definition,
        definitionId: definition?.id ?? block.symbolId,
        fallbackContext: ctxById,
      };
    }
  }

  return {
    definition,
    definitionId: definition?.id ?? null,
    fallbackContext: getSymbolContext(block.type),
  };
}

function resolveSymbolSize(block: Block): { width: number; height: number } {
  return block.size;
}

function resolveSymbolGeometrySize(block: Block): { width: number; height: number } {
  const sizeByType = getSymbolSizeForBlockType(block.type);
  if (sizeByType) return sizeByType;
  if ('symbolId' in block && block.symbolId) {
    const sizeById = getCustomSymbolSize(block.symbolId);
    if (sizeById) return sizeById;
  }
  return getSymbolSize(block.type);
}

function resolvePrimitiveOverride(
  primitive: GraphicPrimitive,
  state: ComponentBehaviorState | null,
  definition: SymbolDefinition | null,
): GraphicPrimitiveOverride | undefined {
  if (!definition || !primitive.id) return undefined;
  const visualState = state?.visualState ?? 'idle';
  return definition.visualStates?.[visualState]?.primitiveOverrides?.[primitive.id];
}

function resolveGraphicsForState(
  definition: SymbolDefinition | null,
  state: ComponentBehaviorState | null,
): GraphicPrimitive[] | null {
  if (!definition) return null;
  return definition.visualStates?.[state?.visualState ?? 'idle']?.graphics ?? definition.graphics;
}

function applyTransform(display: PrimitiveDisplayObject, transform?: SymbolVisualTransform): void {
  if (!transform) return;

  display.position.set(
    display.position.x + (transform.translateX ?? 0),
    display.position.y + (transform.translateY ?? 0),
  );
  display.rotation = ((transform.rotation ?? 0) * Math.PI) / 180;
  display.scale.set(transform.scaleX ?? 1, transform.scaleY ?? 1);
  if ('pivot' in display) {
    display.pivot.set(transform.pivotX ?? 0, transform.pivotY ?? 0);
  }
}

function anchorToValue(anchor: TextPrimitive['anchor']): number {
  switch (anchor) {
    case 'end':
      return 1;
    case 'middle':
      return 0.5;
    case 'start':
    default:
      return 0;
  }
}

function drawPrimitive(
  graphics: Graphics,
  primitive: GraphicPrimitive,
  override?: GraphicPrimitiveOverride,
): void {
  const stroke = override?.stroke ?? ('stroke' in primitive ? primitive.stroke : 'transparent');
  const fill = override?.fill ?? ('fill' in primitive ? primitive.fill : 'transparent');
  const strokeWidth = override?.strokeWidth ?? ('strokeWidth' in primitive ? primitive.strokeWidth : 0);

  switch (primitive.kind) {
    case 'rect':
      graphics.rect(primitive.x, primitive.y, primitive.width, primitive.height);
      break;
    case 'circle':
      graphics.circle(primitive.cx, primitive.cy, primitive.r);
      break;
    case 'polyline':
      if (primitive.points.length < 2) return;
      graphics.moveTo(primitive.points[0].x, primitive.points[0].y);
      for (let i = 1; i < primitive.points.length; i += 1) {
        graphics.lineTo(primitive.points[i].x, primitive.points[i].y);
      }
      break;
    case 'arc':
      graphics.arc(primitive.cx, primitive.cy, primitive.r, primitive.startAngle, primitive.endAngle);
      break;
    case 'text':
      return;
  }

  if (!isTransparent(fill)) {
    graphics.fill({ color: cssColorToHex(fill) });
  }
  if (!isTransparent(stroke) && strokeWidth > 0) {
    graphics.stroke({ color: cssColorToHex(stroke), width: strokeWidth });
  }
}

function createDisplayObjectForPrimitive(
  primitive: GraphicPrimitive,
  override?: GraphicPrimitiveOverride,
): { display: PrimitiveDisplayObject; tintable: TintableDisplayNode | null } | null {
  if (override?.visible === false) {
    return null;
  }

  if (primitive.kind === 'text') {
    const text = new Text({
      text: override?.text ?? primitive.text,
      style: {
        fontFamily: override?.fontFamily ?? primitive.fontFamily,
        fontSize: override?.fontSize ?? primitive.fontSize,
        fill: override?.fill ?? primitive.fill,
      },
      resolution: 2,
    });
    text.anchor.set(anchorToValue(override?.anchor ?? primitive.anchor));
    text.position.set(primitive.x, primitive.y);
    text.alpha = override?.opacity ?? 1;
    applyTransform(text, override?.transform);
    return { display: text, tintable: text as TintableDisplayNode };
  }

  const graphics = new Graphics();
  drawPrimitive(graphics, primitive, override);
  graphics.alpha = override?.opacity ?? 1;
  applyTransform(graphics, override?.transform);
  return { display: graphics, tintable: graphics as TintableDisplayNode };
}

function getAnimationsForState(
  definition: SymbolDefinition | null,
  state: ComponentBehaviorState | null,
): SymbolAnimationSpec[] {
  if (!definition) return [];
  const visualState = state?.visualState ?? 'idle';
  return definition.animations?.[visualState] ?? [];
}

// ============================================================================
// BlockRenderer
// ============================================================================

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

  renderAll(blocks: Record<string, Block>): void {
    if (this._destroyed) return;

    const blockIds = new Set(Object.keys(blocks));
    for (const [id, dobj] of this._blocks) {
      if (!blockIds.has(id)) {
        this._destroyBlockDO(dobj);
        this._blocks.delete(id);
      }
    }

    for (const block of Object.values(blocks)) {
      this._renderBlock(block);
    }
  }

  renderBlock(block: Block): void {
    if (this._destroyed) return;
    this._renderBlock(block);
  }

  removeBlock(blockId: string): void {
    const dobj = this._blocks.get(blockId);
    if (dobj) {
      this._destroyBlockDO(dobj);
      this._blocks.delete(blockId);
    }
    this._selectedBlockIds.delete(blockId);
  }

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

  setBlockRuntimeTint(blockId: string, tint: number): void {
    const dobj = this._blocks.get(blockId);
    if (!dobj) return;
    dobj.runtimeTint = tint;
    this._updateBlockTint(blockId);
  }

  setBlockBehaviorState(blockId: string, state: ComponentBehaviorState | null): void {
    const dobj = this._blocks.get(blockId);
    if (!dobj) return;

    const definition = dobj.definitionId ? resolveSymbolDefinitionForId(dobj.definitionId) : null;
    const rawState = state?.visualState ?? 'idle';
    const hasVariant = Boolean(definition?.visualStates?.[rawState]);
    const hasAnimation = Boolean(definition?.animations?.[rawState]?.length);
    const nextState = hasVariant || hasAnimation ? rawState : null;

    if (dobj.activeVisualState === nextState && !hasAnimation) {
      return;
    }

    this._rebuildSymbolVisual(blockId, definition, nextState ? state : null, dobj.fallbackContext);
  }

  resetBlockRuntimeVisual(blockId: string): void {
    const dobj = this._blocks.get(blockId);
    if (!dobj) return;
    dobj.runtimeTint = DEFAULT_TINT;
    if (dobj.activeVisualState !== null) {
      const definition = dobj.definitionId ? resolveSymbolDefinitionForId(dobj.definitionId) : null;
      this._rebuildSymbolVisual(blockId, definition, null, dobj.fallbackContext);
    }
    this._updateBlockTint(blockId);
  }

  getBlockGraphics(blockId: string): Graphics | null {
    return this._blocks.get(blockId)?.primaryGraphics ?? null;
  }

  getBlockVisual(blockId: string): BlockVisualHandle | null {
    const dobj = this._blocks.get(blockId);
    if (!dobj) return null;

    return {
      container: dobj.container,
      symbolRoot: dobj.symbolRoot,
      tintables: dobj.tintables,
      animationTargets: dobj.animationTargets,
      activeVisualState: dobj.activeVisualState,
      definitionId: dobj.definitionId,
    };
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const dobj of this._blocks.values()) {
      this._destroyBlockDO(dobj);
    }
    this._blocks.clear();
  }

  private _renderBlock(block: Block): void {
    if (block.visible === false) {
      const existing = this._blocks.get(block.id);
      if (existing) {
        existing.container.visible = false;
      }
      return;
    }

    let dobj = this._blocks.get(block.id);
    const resolved = resolveSymbolSource(block);

    if (!dobj) {
      dobj = this._createBlockDO();
      this._blocks.set(block.id, dobj);
      this._layer.addChild(dobj.container);
    }

    dobj.container.position.set(block.position.x, block.position.y);
    dobj.container.visible = true;

    const shouldRebuild =
      dobj.definitionId !== resolved.definitionId ||
      dobj.fallbackContext !== resolved.fallbackContext ||
      (resolved.definition === null && dobj.primaryGraphics?.context !== resolved.fallbackContext);

    dobj.definitionId = resolved.definitionId;
    dobj.fallbackContext = resolved.fallbackContext;

    if (shouldRebuild) {
      this._rebuildSymbolVisual(block.id, resolved.definition, null, resolved.fallbackContext);
    }

    this._applyTransform(dobj, block);
    this._updateLabels(dobj, block);
    this._updateBlockTint(block.id);

    const size = resolveSymbolSize(block);
    dobj.container.cullArea = new Rectangle(-10, -20, size.width + 20, size.height + 40);
  }

  private _createBlockDO(): BlockDisplayObject {
    const container = new Container();
    container.cullable = true;

    const symbolRoot = new Container();
    symbolRoot.label = 'symbol-root';
    const symbolLayer = new Container();
    symbolLayer.label = 'symbol-layer';
    symbolLayer.scale.set(SYMBOL_PX_TO_MM, SYMBOL_PX_TO_MM);
    symbolRoot.addChild(symbolLayer);
    container.addChild(symbolRoot);

    return {
      container,
      symbolRoot,
      symbolLayer,
      label: null,
      designation: null,
      tintables: [],
      animationTargets: new Map(),
      primaryGraphics: null,
      definitionId: null,
      activeVisualState: null,
      runtimeTint: DEFAULT_TINT,
      fallbackContext: null,
    };
  }

  private _rebuildSymbolVisual(
    blockId: string,
    definition: SymbolDefinition | null,
    state: ComponentBehaviorState | null,
    fallbackContext: GraphicsContext | null,
  ): void {
    const dobj = this._blocks.get(blockId);
    if (!dobj) return;

    dobj.symbolLayer.removeChildren().forEach((child) => child.destroy());
    dobj.tintables = [];
    dobj.animationTargets.clear();
    dobj.primaryGraphics = null;
    dobj.activeVisualState = state?.visualState ?? null;

    if (!definition || !fallbackContext) {
      const symbol = new Graphics(fallbackContext ?? undefined);
      symbol.label = 'symbol';
      dobj.symbolLayer.addChild(symbol);
      dobj.primaryGraphics = symbol;
      dobj.tintables.push(symbol as TintableDisplayNode);
      return;
    }

    const graphics = resolveGraphicsForState(definition, state) ?? definition.graphics;
    for (const primitive of graphics) {
      const override = resolvePrimitiveOverride(primitive, state, definition);
      const rendered = createDisplayObjectForPrimitive(primitive, override);
      if (!rendered) continue;

      dobj.symbolLayer.addChild(rendered.display);
      if (rendered.tintable) {
        dobj.tintables.push(rendered.tintable);
        if (!dobj.primaryGraphics && rendered.display instanceof Graphics) {
          dobj.primaryGraphics = rendered.display;
        }
      }

      if (primitive.id) {
        const animationSpec = getAnimationsForState(definition, state).find((spec) => spec.target === primitive.id);
        if (animationSpec) {
          dobj.animationTargets.set(primitive.id, {
            displayObject: rendered.display,
            baseRotation: rendered.display.rotation,
            spec: animationSpec,
          });
        }
      }
    }

    if (dobj.tintables.length === 0 && fallbackContext) {
      const symbol = new Graphics(fallbackContext);
      symbol.label = 'symbol-fallback';
      dobj.symbolLayer.addChild(symbol);
      dobj.primaryGraphics = symbol;
      dobj.tintables.push(symbol as TintableDisplayNode);
    }
  }

  private _applyTransform(dobj: BlockDisplayObject, block: Block): void {
    const size = resolveSymbolSize(block);
    const geometrySize = resolveSymbolGeometrySize(block);
    const symbol = dobj.symbolRoot;

    symbol.position.set(0, 0);
    symbol.rotation = 0;
    symbol.scale.set(1, 1);
    symbol.pivot.set(0, 0);

    const rotation = block.rotation ?? 0;
    if (rotation !== 0) {
      const cx = geometrySize.width / 2;
      const cy = geometrySize.height / 2;
      symbol.pivot.set(cx * SYMBOL_PX_TO_MM, cy * SYMBOL_PX_TO_MM);
      symbol.position.set(size.width / 2, size.height / 2);
      symbol.rotation = (rotation * Math.PI) / 180;
    }

    const flip = block.flip;
    if (flip) {
      if (flip.horizontal) {
        symbol.scale.x = -1;
        if (rotation === 0) {
          symbol.pivot.set(geometrySize.width * SYMBOL_PX_TO_MM, symbol.pivot.y);
          symbol.position.set(size.width, symbol.position.y);
        }
      }
      if (flip.vertical) {
        symbol.scale.y = -1;
        if (rotation === 0) {
          symbol.pivot.set(symbol.pivot.x, geometrySize.height * SYMBOL_PX_TO_MM);
          symbol.position.set(symbol.position.x, size.height);
        }
      }
    }
  }

  private _updateLabels(dobj: BlockDisplayObject, block: Block): void {
    const size = resolveSymbolSize(block);

    const labelText = block.label || '';
    if (labelText) {
      if (!dobj.label) {
        dobj.label = new Text({ text: labelText, style: LABEL_STYLE, resolution: 2 });
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

    const desText = block.designation || '';
    if (desText) {
      if (!dobj.designation) {
        dobj.designation = new Text({ text: desText, style: DESIGNATION_STYLE, resolution: 2 });
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

    const tint = this._selectedBlockIds.has(blockId)
      ? this._style.selectedTint
      : this._hoveredBlockId === blockId
        ? this._style.hoverTint
        : dobj.runtimeTint;

    for (const display of dobj.tintables) {
      display.tint = tint;
    }
  }

  private _destroyBlockDO(dobj: BlockDisplayObject): void {
    dobj.symbolRoot.destroy({ children: true });
    dobj.label?.destroy();
    dobj.designation?.destroy();
    dobj.container.destroy({ children: true });
  }
}

function resolveSymbolDefinitionForId(symbolId: string): SymbolDefinition | null {
  if (symbolId.startsWith('builtin:')) {
    return getCustomSymbolDefinition(symbolId) ?? null;
  }
  return getCustomSymbolDefinition(symbolId);
}
