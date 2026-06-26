import type {
  GraphicPrimitive,
  GraphicPrimitiveOverride,
  SymbolVisualVariant,
} from '../../types/symbol';
import type { LocalSymbol } from './editorModel';

// ============================================================================
// AC 7: Edge-snap helper — snaps a pin's body position to the nearest symbol edge
// ============================================================================

const EDGE_SNAP_THRESHOLD = 8; // distance in symbol-space units to trigger snap

/**
 * Snaps a pin position to the nearest edge of the symbol boundary (0,0)→(w,h).
 * Also updates orientation to point outward from the snapped edge.
 * Returns adjusted position + orientation, or original values if outside snap range.
 */
export function snapPinToEdge(
  pos: { x: number; y: number },
  symbolWidth: number,
  symbolHeight: number,
): { position: { x: number; y: number }; orientation: 'left' | 'right' | 'up' | 'down' } | null {
  if (symbolWidth <= 0 || symbolHeight <= 0) return null;

  // Distances to each edge
  const distLeft = Math.abs(pos.x);
  const distRight = Math.abs(pos.x - symbolWidth);
  const distTop = Math.abs(pos.y);
  const distBottom = Math.abs(pos.y - symbolHeight);
  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist > EDGE_SNAP_THRESHOLD) return null;

  // Clamp the other axis to stay within bounds
  const clampX = Math.max(0, Math.min(symbolWidth, pos.x));
  const clampY = Math.max(0, Math.min(symbolHeight, pos.y));

  if (minDist === distLeft) {
    return { position: { x: 0, y: clampY }, orientation: 'left' };
  }
  if (minDist === distRight) {
    return { position: { x: symbolWidth, y: clampY }, orientation: 'right' };
  }
  if (minDist === distTop) {
    return { position: { x: clampX, y: 0 }, orientation: 'up' };
  }
  // distBottom
  return { position: { x: clampX, y: symbolHeight }, orientation: 'down' };
}

/**
 * Apply resize bounds to a primitive, updating its geometry.
 * Only supports rect, circle, text (not polyline/pin).
 */
export function applyResizeToPrimitive(
  prim: GraphicPrimitive,
  bounds: { x: number; y: number; width: number; height: number },
): GraphicPrimitive {
  switch (prim.kind) {
    case 'rect':
      return { ...prim, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    case 'circle': {
      // Use the smaller dimension as diameter to keep it circular
      const r = Math.min(bounds.width, bounds.height) / 2;
      return { ...prim, cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2, r };
    }
    case 'arc': {
      const r = Math.min(bounds.width, bounds.height) / 2;
      return { ...prim, cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2, r };
    }
    case 'text': {
      // Move position and scale fontSize proportionally based on height change
      const oldHeight = prim.fontSize * 1.2;
      const scale = bounds.height / oldHeight;
      const newFontSize = Math.max(4, prim.fontSize * scale);
      return { ...prim, x: bounds.x, y: bounds.y + newFontSize, fontSize: newFontSize };
    }
    default:
      return prim;
  }
}

export function createBlankSymbol(): LocalSymbol {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: 'New Symbol',
    version: '1.0.0',
    category: 'Custom',
    description: '',
    pins: [],
    graphics: [],
    width: 80,
    height: 60,
    properties: [],
    author: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {},
  };
}

// ============================================================================
// Visual State override helpers (module-level, pure functions)
// ============================================================================

/**
 * Apply primitive overrides from a SymbolVisualVariant to a graphics array.
 *
 * Priority:
 *   1. variant.graphics — replaces base graphics entirely
 *   2. variant.primitiveOverrides — merged onto matching primitives by ID
 *   3. No override present — returns original graphics unchanged
 */
export function applyVisualStateOverrides(
  graphics: GraphicPrimitive[],
  variant: SymbolVisualVariant | undefined,
): GraphicPrimitive[] {
  if (!variant) return graphics;

  // Full replacement takes priority
  if (variant.graphics && variant.graphics.length > 0) {
    return variant.graphics;
  }

  // Per-primitive overrides
  const overrides = variant.primitiveOverrides;
  if (!overrides || Object.keys(overrides).length === 0) return graphics;

  return graphics.map((prim) => {
    const key = prim.id;
    if (!key) return prim;
    const ov: GraphicPrimitiveOverride | undefined = overrides[key];
    if (!ov) return prim;
    // Merge override fields — only copy defined values
    const merged = { ...prim } as Record<string, unknown>;
    if (ov.stroke !== undefined) merged['stroke'] = ov.stroke;
    if (ov.fill !== undefined) merged['fill'] = ov.fill;
    if (ov.strokeWidth !== undefined) merged['strokeWidth'] = ov.strokeWidth;
    if (ov.opacity !== undefined) merged['opacity'] = ov.opacity;
    if (prim.kind === 'text') {
      if (ov.text !== undefined) merged['text'] = ov.text;
      if (ov.fontSize !== undefined) merged['fontSize'] = ov.fontSize;
    }
    return merged as unknown as GraphicPrimitive;
  });
}

