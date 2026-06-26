// InteractionController FSM의 공유 타입 선언 (상태/모디파이어/비주얼/설정/스냅 타깃)
import type { Position } from '../types';
import type { HitTester } from '../core/HitTester';
import type { SpatialIndex } from '../core/SpatialIndex';

export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  space: boolean;
}

export type CanvasInteractionMode = 'edit' | 'operate';

export type InteractionState =
  | 'idle'
  | 'panning'
  | 'item_pending'
  | 'dragging_items'
  | 'box_pending'
  | 'box_selecting'
  | 'wire_drawing'
  | 'wire_segment_dragging'
  | 'operating_pressing'
  | 'placing'
  | 'wire_mode';

export type WireSnapTarget = {
  type: 'port' | 'junction' | 'wire';
  id: string;
  parentId?: string;
  position: Position;
};

export interface DragGroupItem {
  originalPos: Position;
  isJunction: boolean;
}

export interface InteractionVisuals {
  renderMarquee(start: Position | null, end: Position | null): void;
  clearMarquee(): void;
  renderWirePreview(points: Position[]): void;
  clearWirePreview(): void;
  setPortsVisible(visible: boolean): void;
  showPortSnap(position: Position): void;
  hidePortSnap(): void;
  showGhost(blockType: string): void;
  updateGhost(options: {
    blockType: string;
    position: Position;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
  }): void;
  hideGhost(): void;
}

export interface InteractionControllerConfig {
  hitTester: HitTester;
  spatialIndex: SpatialIndex;
  visuals: InteractionVisuals;
  mode?: CanvasInteractionMode;
  onPlaceBlock?: (
    blockType: string,
    position: Position,
    rotation: number,
    flipH: boolean,
    flipV: boolean
  ) => void;
  onOperateBlockInteraction?: (
    blockId: string,
    phase: 'press' | 'release' | 'click'
  ) => void;
  onStateChange?: (state: InteractionState) => void;
}
