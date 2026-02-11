import type {
  Block,
  BoundingBox,
  Junction,
  Position,
  PortPosition,
  Wire,
  WireEndpoint,
} from '../types';
import type { SpatialItem } from '../utils/SpatialIndex';

export interface CanvasInteractionAdapter {
  // Reads
  getComponents(): Map<string, Block>;
  getWires(): Wire[];
  getJunctions(): Map<string, Junction>;
  getSelectedIds(): Set<string>;
  getZoom(): number;
  getPan(): Position;
  getGridSize(): number;
  getSnapToGrid(): boolean;
  getContainerRect(): DOMRect | null;

  // Selection writes
  setSelection(ids: string[]): void;
  addToSelection(id: string): void;
  clearSelection(): void;

  // Viewport writes
  setPan(pan: Position): void;
  setZoom(zoom: number): void;

  // Component writes
  moveComponent(id: string, position: Position, skipHistory?: boolean): void;
  moveJunction(id: string, position: Position, skipHistory?: boolean): void;

  // Wire writes
  addWire(
    from: WireEndpoint,
    to: WireEndpoint,
    options?: { fromExitDirection?: PortPosition; toExitDirection?: PortPosition }
  ): string | null;
  createJunctionOnWire(wireId: string, position: Position): string | null;
  moveWireSegment(
    wireId: string,
    handleIndexA: number,
    handleIndexB: number,
    delta: Position,
    isFirstMove?: boolean
  ): void;
  updateWireHandle(wireId: string, handleIndex: number, position: Position, isFirstMove?: boolean): void;
  cleanupOverlappingHandles(wireId: string): void;

  // Spatial queries
  queryPoint(pos: Position, margin: number): SpatialItem[];
  queryBox(bounds: BoundingBox): SpatialItem[];
}
