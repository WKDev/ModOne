import type { SymbolDefinition, GraphicPrimitive } from '../types/symbol';

export interface ValidationError {
  rule: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const BOUNDS_MIN = -500;
const BOUNDS_MAX = 1500;
const GRID = 20;
const DIM_MIN = 1;
const DIM_MAX = 1000;

function inBounds(v: number): boolean {
  return v >= BOUNDS_MIN && v <= BOUNDS_MAX;
}

function checkPrimitiveBounds(p: GraphicPrimitive): string[] {
  const msgs: string[] = [];

  switch (p.kind) {
    case 'rect': {
      if (!inBounds(p.x) || !inBounds(p.y)) {
        msgs.push(`rect origin (${p.x}, ${p.y}) out of bounds`);
      }
      if (!inBounds(p.x + p.width) || !inBounds(p.y + p.height)) {
        msgs.push(`rect far corner (${p.x + p.width}, ${p.y + p.height}) out of bounds`);
      }
      break;
    }
    case 'circle': {
      if (
        !inBounds(p.cx - p.r) ||
        !inBounds(p.cx + p.r) ||
        !inBounds(p.cy - p.r) ||
        !inBounds(p.cy + p.r)
      ) {
        msgs.push(
          `circle extents (cx=${p.cx}, cy=${p.cy}, r=${p.r}) out of bounds`,
        );
      }
      break;
    }
    case 'polyline': {
      p.points.forEach((pt, i) => {
        if (!inBounds(pt.x) || !inBounds(pt.y)) {
          msgs.push(`polyline point[${i}] (${pt.x}, ${pt.y}) out of bounds`);
        }
      });
      break;
    }
    case 'arc': {
      if (
        !inBounds(p.cx - p.r) ||
        !inBounds(p.cx + p.r) ||
        !inBounds(p.cy - p.r) ||
        !inBounds(p.cy + p.r)
      ) {
        msgs.push(
          `arc extents (cx=${p.cx}, cy=${p.cy}, r=${p.r}) out of bounds`,
        );
      }
      break;
    }
    case 'text': {
      if (!inBounds(p.x) || !inBounds(p.y)) {
        msgs.push(`text position (${p.x}, ${p.y}) out of bounds`);
      }
      break;
    }
    default: {
      // Exhaustive check: TypeScript will error if a new kind is added
      // and not handled above.
      const _exhaustive: never = p;
      return _exhaustive;
    }
  }

  return msgs;
}

export function validateSymbol(symbol: SymbolDefinition): ValidationResult {
  const errors: ValidationError[] = [];

  if (symbol.pins.length === 0) {
    errors.push({
      rule: 'at_least_one_pin',
      message: 'Symbol must have at least one pin.',
    });
  }

  const pinIds = symbol.pins.map((p) => p.id);
  const seenIds = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of pinIds) {
    if (seenIds.has(id)) {
      duplicates.add(id);
    }
    seenIds.add(id);
  }
  if (duplicates.size > 0) {
    errors.push({
      rule: 'unique_pin_ids',
      message: `Duplicate pin IDs detected: ${[...duplicates].join(', ')}.`,
    });
  }

  for (const pin of symbol.pins) {
    const { x, y } = pin.position;
    if (x % GRID !== 0 || y % GRID !== 0) {
      errors.push({
        rule: 'pin_grid_snap',
        message: `Pin "${pin.id}" position (${x}, ${y}) is not snapped to the ${GRID}px grid.`,
      });
    }
  }

  if (
    symbol.width < DIM_MIN ||
    symbol.width > DIM_MAX ||
    symbol.height < DIM_MIN ||
    symbol.height > DIM_MAX
  ) {
    errors.push({
      rule: 'valid_dimensions',
      message: `Symbol dimensions (${symbol.width}x${symbol.height}) must be within ${DIM_MIN}..${DIM_MAX} on each axis.`,
    });
  }

  if (symbol.name.trim().length === 0) {
    errors.push({
      rule: 'non_empty_name',
      message: 'Symbol name must not be empty or whitespace-only.',
    });
  }

  for (const primitive of symbol.graphics) {
    const msgs = checkPrimitiveBounds(primitive);
    for (const msg of msgs) {
      errors.push({
        rule: 'primitive_bounds',
        message: msg,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
