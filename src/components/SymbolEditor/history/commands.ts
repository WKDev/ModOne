import type { GraphicPrimitive, SymbolDefinition, SymbolPin } from '../../../types/symbol';
import type { EditorCommand } from './EditorCommand';
import type { PortDef } from '../../../types/port';
import { portDefToSymbolPin } from '../../../types/port';

type SymbolUpdater = (fn: (prev: SymbolDefinition) => SymbolDefinition) => void;

export class AddPrimitiveCommand implements EditorCommand {
  description: string;
  constructor(
    private updater: SymbolUpdater,
    private primitive: GraphicPrimitive,
  ) {
    this.description = `Add ${primitive.kind}`;
  }

  execute(): void {
    this.updater((prev) => ({
      ...prev,
      graphics: [...prev.graphics, this.primitive],
      updatedAt: new Date().toISOString(),
    }));
  }

  undo(): void {
    this.updater((prev) => ({
      ...prev,
      graphics: prev.graphics.slice(0, -1),
      updatedAt: new Date().toISOString(),
    }));
  }
}

export class RemovePrimitivesCommand implements EditorCommand {
  description: string;
  private removed: { index: number; prim: GraphicPrimitive }[] = [];

  constructor(
    private updater: SymbolUpdater,
    private indices: number[],
  ) {
    this.description = `Remove ${indices.length} primitive(s)`;
  }

  execute(): void {
    this.updater((prev) => {
      this.removed = this.indices
        .map((i) => ({ index: i, prim: prev.graphics[i] }))
        .filter((item) => item.prim !== undefined);
      return {
        ...prev,
        graphics: prev.graphics.filter((_, i) => !this.indices.includes(i)),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  undo(): void {
    this.updater((prev) => {
      const graphics = [...prev.graphics];
      for (const item of this.removed.sort((a, b) => a.index - b.index)) {
        graphics.splice(item.index, 0, item.prim);
      }
      return { ...prev, graphics, updatedAt: new Date().toISOString() };
    });
  }
}

export class AddPinCommand implements EditorCommand {
  description: string;
  constructor(
    private updater: SymbolUpdater,
    private pin: SymbolPin,
  ) {
    this.description = `Add pin ${pin.name || pin.id}`;
  }

  execute(): void {
    this.updater((prev) => ({
      ...prev,
      pins: [...prev.pins, this.pin],
      updatedAt: new Date().toISOString(),
    }));
  }

  undo(): void {
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.filter((p) => p.id !== this.pin.id),
      updatedAt: new Date().toISOString(),
    }));
  }
}

export class RemovePinsCommand implements EditorCommand {
  description: string;
  private removed: { index: number; pin: SymbolPin }[] = [];

  constructor(
    private updater: SymbolUpdater,
    private pinIds: string[],
  ) {
    this.description = `Remove ${pinIds.length} pin(s)`;
  }

  execute(): void {
    this.updater((prev) => {
      this.removed = prev.pins
        .map((pin, index) => ({ index, pin }))
        .filter((item) => this.pinIds.includes(item.pin.id));
      return {
        ...prev,
        pins: prev.pins.filter((p) => !this.pinIds.includes(p.id)),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  undo(): void {
    this.updater((prev) => {
      const pins = [...prev.pins];
      for (const item of this.removed.sort((a, b) => a.index - b.index)) {
        pins.splice(item.index, 0, item.pin);
      }
      return { ...prev, pins, updatedAt: new Date().toISOString() };
    });
  }
}

export class MovePinsCommand implements EditorCommand {
  description: string;
  private prevPositions: Array<{ id: string; position: { x: number; y: number } }> = [];

  constructor(
    private updater: SymbolUpdater,
    private moves: Array<{ id: string; newPosition: { x: number; y: number } }>,
  ) {
    this.description = `Move ${moves.length} pin(s)`;
  }

  execute(): void {
    this.updater((prev) => {
      // Capture previous positions for undo
      this.prevPositions = this.moves.map((m) => {
        const pin = prev.pins.find((p) => p.id === m.id);
        return { id: m.id, position: pin?.position ?? { x: 0, y: 0 } };
      });
      return {
        ...prev,
        pins: prev.pins.map((p) => {
          const move = this.moves.find((m) => m.id === p.id);
          return move ? { ...p, position: move.newPosition } : p;
        }),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  undo(): void {
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.map((p) => {
        const prevPos = this.prevPositions.find((m) => m.id === p.id);
        return prevPos ? { ...p, position: prevPos.position } : p;
      }),
      updatedAt: new Date().toISOString(),
    }));
  }
}

// ============================================================================
// TranslatePinsCommand — translate pins by (dx, dy) delta
// ============================================================================

/**
 * Undoable command that moves one or more pins by a delta (dx, dy).
 * Supports clean undo via negating the delta (no snapshot needed).
 */
export class TranslatePinsCommand implements EditorCommand {
  description: string;

  constructor(
    private updater: SymbolUpdater,
    private pinIds: string[],
    private dx: number,
    private dy: number,
  ) {
    this.description = `Move ${pinIds.length} pin(s)`;
  }

  execute(): void {
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.map((p) =>
        this.pinIds.includes(p.id)
          ? { ...p, position: { x: p.position.x + this.dx, y: p.position.y + this.dy } }
          : p,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  undo(): void {
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.map((p) =>
        this.pinIds.includes(p.id)
          ? { ...p, position: { x: p.position.x - this.dx, y: p.position.y - this.dy } }
          : p,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }
}

// ============================================================================
// UpdatePinCommand — edit pin fields in-place
// ============================================================================

/**
 * Undoable command that updates the fields of an existing pin.
 * Accepts a partial PortDef of changes; applies them to the matching SymbolPin.
 */
export class UpdatePinCommand implements EditorCommand {
  description: string;
  private prevPin: SymbolPin | undefined;

  constructor(
    private updater: SymbolUpdater,
    private pinId: string,
    private changes: Partial<Omit<PortDef, 'id'>>,
  ) {
    this.description = `Update pin ${pinId}`;
  }

  execute(): void {
    this.updater((prev) => {
      const pins = prev.pins.map((p) => {
        if (p.id !== this.pinId) return p;
        this.prevPin = { ...p }; // capture snapshot for undo
        // Apply changes field-by-field, preserving SymbolPin shape
        const updated: SymbolPin = {
          ...p,
          name: this.changes.name !== undefined ? this.changes.name : p.name,
          number: this.changes.number !== undefined ? this.changes.number : p.number,
          type: ((this.changes.canvasType ?? this.changes.electricalType) ?? p.type) as SymbolPin['type'],
          shape: this.changes.shape
            ? (this.changes.shape === 'inverted' || this.changes.shape === 'inverted_clock'
                ? 'inverted'
                : this.changes.shape === 'clock' || this.changes.shape === 'input_low'
                  || this.changes.shape === 'clock_low' || this.changes.shape === 'output_low'
                  || this.changes.shape === 'edge_clock_high'
                  ? 'clock'
                  : 'line')
            : p.shape,
          orientation: this.changes.orientation ?? p.orientation,
          length: this.changes.length ?? p.length,
          hidden: this.changes.hidden !== undefined ? this.changes.hidden : p.hidden,
          nameVisible: this.changes.nameVisible !== undefined ? this.changes.nameVisible : p.nameVisible,
          numberVisible: this.changes.numberVisible !== undefined ? this.changes.numberVisible : p.numberVisible,
          sortOrder: this.changes.sortOrder ?? p.sortOrder,
          electricalType: (this.changes.electricalType ?? p.electricalType) as SymbolPin['electricalType'],
          functionalRole: this.changes.functionalRole ?? p.functionalRole,
          description: this.changes.description !== undefined ? this.changes.description : p.description,
          group: this.changes.group !== undefined ? this.changes.group : p.group,
          locked: this.changes.locked !== undefined ? this.changes.locked : p.locked,
          color: this.changes.color !== undefined ? this.changes.color : p.color,
          labelOffset: this.changes.labelOffset !== undefined ? this.changes.labelOffset : p.labelOffset,
        };
        if (this.changes.position) {
          updated.position = { ...this.changes.position };
        }
        return updated;
      });
      return { ...prev, pins, updatedAt: new Date().toISOString() };
    });
  }

  undo(): void {
    if (!this.prevPin) return;
    const snapshot = this.prevPin;
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.map((p) => (p.id === this.pinId ? { ...snapshot } : p)),
      updatedAt: new Date().toISOString(),
    }));
  }
}

// ============================================================================
// ReorderPinsCommand — change sortOrder of all pins atomically
// ============================================================================

/**
 * Undoable command that reorders pins by assigning sortOrder values
 * matching the position of each pin ID in the provided ordered array.
 */
export class ReorderPinsCommand implements EditorCommand {
  description = 'Reorder pins';
  private prevSortOrders: Array<{ id: string; sortOrder: number }> = [];

  constructor(
    private updater: SymbolUpdater,
    /** Ordered list of pin IDs defining the new sort order */
    private orderedIds: string[],
  ) {}

  execute(): void {
    this.updater((prev) => {
      // Snapshot current sort orders for undo
      this.prevSortOrders = prev.pins.map((p) => ({ id: p.id, sortOrder: p.sortOrder ?? 0 }));

      const orderMap = new Map(this.orderedIds.map((id, i) => [id, i]));
      const pins = prev.pins.map((p) => ({
        ...p,
        sortOrder: orderMap.has(p.id) ? (orderMap.get(p.id) as number) : (p.sortOrder ?? 0),
      }));
      return { ...prev, pins, updatedAt: new Date().toISOString() };
    });
  }

  undo(): void {
    const snapshot = this.prevSortOrders;
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.map((p) => {
        const saved = snapshot.find((s) => s.id === p.id);
        return saved ? { ...p, sortOrder: saved.sortOrder } : p;
      }),
      updatedAt: new Date().toISOString(),
    }));
  }
}

// ============================================================================
// resizePrimitive helper (exported so SymbolEditor can reuse it)
// ============================================================================

/**
 * Minimum pixel size enforced for primitive resize operations.
 * Prevents primitives from being collapsed to zero or negative dimensions.
 */
const MIN_PRIMITIVE_SIZE = 10;

/**
 * Returns a new primitive resized to the given bounding box.
 * - rect  → direct x/y/width/height
 * - circle → cx/cy/r derived from the bounding box (r = min(w,h)/2)
 * - text  → x/y stay; fontSize derived from the bounding height
 * - Other kinds are returned unchanged (polyline/arc/line do not support resize)
 */
export function resizePrimitive(
  prim: GraphicPrimitive,
  bounds: { x: number; y: number; width: number; height: number },
): GraphicPrimitive {
  const w = Math.max(MIN_PRIMITIVE_SIZE, bounds.width);
  const h = Math.max(MIN_PRIMITIVE_SIZE, bounds.height);

  switch (prim.kind) {
    case 'rect':
      return { ...prim, x: bounds.x, y: bounds.y, width: w, height: h };

    case 'circle': {
      // Keep the circle inscribed in the bounding box — r = min(w, h) / 2
      const r = Math.min(w, h) / 2;
      return {
        ...prim,
        cx: bounds.x + w / 2,
        cy: bounds.y + h / 2,
        r,
      };
    }

    case 'text': {
      // Approximate: fontSize ≈ height / 1.2
      const fontSize = Math.max(4, Math.round(h / 1.2));
      return {
        ...prim,
        x: bounds.x,
        // Keep baseline at original relative position; anchor at bottom-left
        y: bounds.y + h,
        fontSize,
      };
    }

    default:
      // polyline, arc, line — not resizable via handles
      return prim;
  }
}

// ============================================================================
// ResizePrimitiveCommand — resize a single graphic primitive
// ============================================================================

/**
 * Undoable command that resizes a graphic primitive to a new bounding box.
 * Captures a snapshot of the original primitive on first execute() for undo.
 *
 * Supports: rect, circle, text.
 * (Polyline point editing and arc are handled separately.)
 */
export class ResizePrimitiveCommand implements EditorCommand {
  description: string;
  private snapshot: GraphicPrimitive | null = null;

  constructor(
    private updater: SymbolUpdater,
    private index: number,
    private newBounds: { x: number; y: number; width: number; height: number },
  ) {
    this.description = 'Resize primitive';
  }

  execute(): void {
    this.updater((prev) => {
      const prim = prev.graphics[this.index];
      if (!prim) return prev;
      // Capture original state only on first execute (not on redo)
      if (!this.snapshot) this.snapshot = prim;
      const resized = resizePrimitive(prim, this.newBounds);
      const graphics = prev.graphics.map((g, i) => (i === this.index ? resized : g));
      return { ...prev, graphics, updatedAt: new Date().toISOString() };
    });
  }

  undo(): void {
    if (!this.snapshot) return;
    const snap = this.snapshot;
    this.updater((prev) => {
      const graphics = prev.graphics.map((g, i) => (i === this.index ? snap : g));
      return { ...prev, graphics, updatedAt: new Date().toISOString() };
    });
  }
}

// ============================================================================
// translatePrimitive helper (exported so SymbolEditor can reuse it)
// ============================================================================

/**
 * Returns a new primitive translated by (dx, dy) in symbol-space units.
 * Used by MovePrimitivesCommand and the multi-unit path in SymbolEditor.
 */
export function translatePrimitive(prim: GraphicPrimitive, dx: number, dy: number): GraphicPrimitive {
  switch (prim.kind) {
    case 'rect':
      return { ...prim, x: prim.x + dx, y: prim.y + dy };
    case 'circle':
      return { ...prim, cx: prim.cx + dx, cy: prim.cy + dy };
    case 'polyline':
      return { ...prim, points: prim.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case 'arc':
      return { ...prim, cx: prim.cx + dx, cy: prim.cy + dy };
    case 'text':
      return { ...prim, x: prim.x + dx, y: prim.y + dy };
    default:
      return prim;
  }
}

// ============================================================================
// MovePrimitivesCommand — translate selected graphic primitives
// ============================================================================

/**
 * Undoable command that translates one or more graphic primitives by (dx, dy).
 * Captures snapshots of affected primitives on first execute() for correct undo.
 */
export class MovePrimitivesCommand implements EditorCommand {
  description: string;
  private snapshots: Array<{ index: number; prim: GraphicPrimitive }> = [];

  constructor(
    private updater: SymbolUpdater,
    private indices: number[],
    private dx: number,
    private dy: number,
  ) {
    this.description = `Move ${indices.length} primitive(s)`;
  }

  execute(): void {
    this.updater((prev) => {
      // Capture snapshots only on first execute (not on redo)
      if (this.snapshots.length === 0) {
        this.snapshots = this.indices
          .map((i) => ({ index: i, prim: prev.graphics[i] }))
          .filter((s) => s.prim !== undefined);
      }

      const graphics = prev.graphics.map((prim, i) =>
        this.indices.includes(i) ? translatePrimitive(prim, this.dx, this.dy) : prim,
      );
      return { ...prev, graphics, updatedAt: new Date().toISOString() };
    });
  }

  undo(): void {
    this.updater((prev) => {
      const graphics = prev.graphics.map((prim, i) => {
        const snap = this.snapshots.find((s) => s.index === i);
        return snap ? snap.prim : prim;
      });
      return { ...prev, graphics, updatedAt: new Date().toISOString() };
    });
  }
}

// ============================================================================
// AddPortCommand — add a port defined as PortDef (convenience wrapper)
// ============================================================================

/**
 * Convenience command that accepts a PortDef and converts it to SymbolPin
 * before adding it. Lets callers work entirely in PortDef space.
 */
export class AddPortCommand implements EditorCommand {
  description: string;
  private readonly pin: SymbolPin;

  constructor(
    private updater: SymbolUpdater,
    portDef: PortDef,
  ) {
    this.pin = portDefToSymbolPin(portDef);
    this.description = `Add port ${portDef.name || portDef.id}`;
  }

  execute(): void {
    this.updater((prev) => ({
      ...prev,
      pins: [...prev.pins, this.pin],
      updatedAt: new Date().toISOString(),
    }));
  }

  undo(): void {
    this.updater((prev) => ({
      ...prev,
      pins: prev.pins.filter((p) => p.id !== this.pin.id),
      updatedAt: new Date().toISOString(),
    }));
  }
}
