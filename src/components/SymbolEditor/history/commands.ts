import type { GraphicPrimitive, SymbolDefinition, SymbolPin } from '../../../types/symbol';
import type { EditorCommand } from './EditorCommand';

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
