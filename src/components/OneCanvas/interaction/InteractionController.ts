// OneCanvas 상호작용 FSM — 상태/디스패치만 보유, 핸들러 로직은 interaction*Handlers 모듈에 위임
import type { CanvasFacadeReturn } from '@/types/canvasFacade';
import type { Position, PortPosition, WireEndpoint } from '../types';
import type { HitTester } from '../core/HitTester';
import type { SpatialIndex } from '../core/SpatialIndex';
import { getDistance, DRAG_THRESHOLD_PX } from './interactionGeometry';

// Shared FSM types — split into interactionTypes.ts (CLAUDE.md → Code Org).
// Re-exported below so existing importers keep `from './InteractionController'`.
import type {
  CanvasInteractionMode,
  InteractionState,
  WireSnapTarget,
  DragGroupItem,
  InteractionVisuals,
  InteractionControllerConfig,
  Modifiers,
} from './interactionTypes';

export type {
  Modifiers,
  CanvasInteractionMode,
  InteractionState,
  InteractionVisuals,
  InteractionControllerConfig,
} from './interactionTypes';

// FSM handler groups — free functions taking the controller as their context
// (`self`). They read/write the public `_*` fields declared below.
import { resetTransient, clearPointerTracking } from './interactionHelpers';
import {
  handleOperatePointerDown,
  handleOperatePointerUp,
  handleOperateCancel,
  handleIdlePointerDown,
  handleItemPendingMove,
  handleDraggingItemsMove,
  handleItemPendingUp,
  handleDraggingItemsUp,
  handleBoxPendingMove,
  handleBoxSelectingUp,
} from './interactionPointerHandlers';
import {
  handleWireDrawingMove,
  handleWireDrawingUp,
  handleWireModePointerDown,
  handleWireDrawingPointerDown,
  completeWire,
  resetWireDrawing,
} from './interactionWireHandlers';
import {
  handleSegmentDraggingMove,
  handleSegmentDraggingUp,
} from './interactionSegmentHandlers';
import {
  handlePlacingPointerDown,
  handlePlacingMove,
  updateGhostPreview,
} from './interactionPlacingHandlers';

// ============================================================================
// InteractionController
// ============================================================================

/**
 * Interaction state machine. Holds all FSM state in public `_*` fields and
 * dispatches pointer/key events to handler free functions (which mutate those
 * fields). The `_`-prefix marks them as internal — only the handler modules in
 * this folder should touch them.
 */
export class InteractionController {
  _state: InteractionState = 'idle';
  _mode: CanvasInteractionMode;
  _hitTester: HitTester;
  _spatialIndex: SpatialIndex;
  _visuals: InteractionVisuals;
  _onPlaceBlock: InteractionControllerConfig['onPlaceBlock'];
  _onOperateBlockInteraction: InteractionControllerConfig['onOperateBlockInteraction'];
  _onStateChange: InteractionControllerConfig['onStateChange'];
  _destroyed = false;

  // Facade ref — updated externally on every React render
  _facade: CanvasFacadeReturn | null = null;

  // Pointer tracking
  _pointerStartWorld: Position | null = null;
  _pointerStartScreen: Position | null = null;
  _downModifiers: Modifiers | null = null;
  _lastMoveWorld: Position | null = null;

  // Item drag state
  _dragPrimaryId: string | null = null;
  _dragGroup: Map<string, DragGroupItem> | null = null;
  _dragThresholdPassed = false;
  _operateBlockId: string | null = null;
  _operatePointerMoved = false;

  // Box select state
  _boxSelectStart: Position | null = null;
  _boxSelectCurrent: Position | null = null;

  // Wire drawing state
  _wireFrom: WireEndpoint | null = null;
  _wireFromExitDirection: PortPosition | null = null;
  _wireSnapTarget: WireSnapTarget | null = null;
  _wireDrawingReturnState: 'idle' | 'wire_mode' = 'idle';
  _wireDrawingFromPos: Position = { x: 0, y: 0 };
  _wireBendPoints: Position[] = [];

  // Wire segment dragging
  _segmentWireId: string | null = null;
  _segmentPolyIndex = 0;
  _segmentHandleA = -1;
  _segmentHandleB = -1;
  _segmentOrientation: 'horizontal' | 'vertical' | null = null;
  _segmentPrevDelta: Position = { x: 0, y: 0 };
  _segmentIsFirstMove = true;

  // Placing state
  _placingBlockType: string | null = null;
  _placingPosition: Position | null = null;
  _placingRotation = 0;
  _placingFlipH = false;
  _placingFlipV = false;

  // Key state
  _isSpaceHeld = false;

  // Mouse presence state
  _isMouseOverCanvas = false;

  // Hover state (drives cursor + hover highlight while idle)
  _hoverType: 'block' | 'wire' | 'junction' | 'port' | 'segment' | null = null;
  _hoverId: string | null = null;

  constructor(config: InteractionControllerConfig) {
    this._mode = config.mode ?? 'edit';
    this._hitTester = config.hitTester;
    this._spatialIndex = config.spatialIndex;
    this._visuals = config.visuals;
    this._onPlaceBlock = config.onPlaceBlock;
    this._onOperateBlockInteraction = config.onOperateBlockInteraction;
    this._onStateChange = config.onStateChange;
  }

  get state(): InteractionState {
    return this._state;
  }

  get isPlacing(): boolean {
    return this._state === 'placing';
  }

  get isWireMode(): boolean {
    return this._state === 'wire_mode' || this._state === 'wire_drawing';
  }

  get mode(): CanvasInteractionMode {
    return this._mode;
  }

  setFacade(facade: CanvasFacadeReturn | null): void {
    this._facade = facade;
  }

  setOnPlaceBlock(cb: InteractionControllerConfig['onPlaceBlock']): void {
    this._onPlaceBlock = cb;
  }

  setOnOperateBlockInteraction(
    cb: InteractionControllerConfig['onOperateBlockInteraction']
  ): void {
    this._onOperateBlockInteraction = cb;
  }

  setOnStateChange(cb: InteractionControllerConfig['onStateChange']): void {
    this._onStateChange = cb;
  }

  setMode(mode: CanvasInteractionMode): void {
    if (this._mode === mode) return;
    this.cancel();
    this._mode = mode;
    this._operateBlockId = null;
    this._operatePointerMoved = false;
  }

  // ==========================================================================
  // Public Commands
  // ==========================================================================

  startPlacing(blockType: string): void {
    if (this._mode !== 'edit') return;
    resetTransient(this);
    this._state = 'placing';
    this._placingBlockType = blockType;
    this._placingPosition = null;
    this._placingRotation = 0;
    this._placingFlipH = false;
    this._placingFlipV = false;
    this._visuals.showGhost(blockType);
    this._onStateChange?.(this._state);
  }

  startWireMode(): void {
    if (this._mode !== 'edit') return;
    resetTransient(this);
    this._state = 'wire_mode';
    this._visuals.setPortsVisible(true);
    this._onStateChange?.(this._state);

    // If mouse is already over canvas, immediately start wire drawing from current position
    if (this._isMouseOverCanvas && this._lastMoveWorld) {
      if (import.meta.env.DEV) {
        console.debug('[InteractionController] w-key immediate wire start at', this._lastMoveWorld);
      }
      handleWireModePointerDown(this, this._lastMoveWorld, 0);
    }
  }

  handlePointerOver(): void {
    this._isMouseOverCanvas = true;
  }

  handlePointerOut(): void {
    this._isMouseOverCanvas = false;
    this._clearHover();
  }

  cancel(): void {
    if (this._state === 'placing') {
      this._visuals.hideGhost();
    }
    if (this._state === 'wire_drawing' || this._state === 'wire_mode') {
      this._visuals.clearWirePreview();
      this._visuals.hidePortSnap();
      this._visuals.setPortsVisible(false);
      this._wireBendPoints = [];
    }
    if (this._state === 'box_selecting' || this._state === 'box_pending') {
      this._visuals.clearMarquee();
    }
    resetTransient(this);
    this._state = 'idle';
    this._onStateChange?.(this._state);
  }

  destroy(): void {
    this._destroyed = true;
    this._facade = null;
  }

  // ==========================================================================
  // Pointer Events (called by EventBridge) — dispatch to handler free functions
  // ==========================================================================

  handlePointerDown(
    worldPos: Position,
    screenPos: Position,
    button: number,
    modifiers: Modifiers
  ): void {
    if (this._destroyed) return;

    this._downModifiers = modifiers;

    if (this._mode === 'operate') {
      handleOperatePointerDown(this, worldPos, screenPos, button);
      return;
    }

    switch (this._state) {
      case 'idle':
        handleIdlePointerDown(this, worldPos, screenPos, button, modifiers);
        break;
      case 'placing':
        handlePlacingPointerDown(this, worldPos, button);
        break;
      case 'wire_mode':
        handleWireModePointerDown(this, worldPos, button);
        break;
      case 'wire_drawing':
        handleWireDrawingPointerDown(this, worldPos, button);
        break;
      default:
        break;
    }
  }

  handlePointerMove(
    worldPos: Position,
    screenPos: Position,
    _modifiers: Modifiers
  ): void {
    if (this._destroyed) return;

    switch (this._state) {
      case 'idle':
        this._updateHover(worldPos);
        break;

      case 'panning':
        break;

      case 'operating_pressing':
        if (
          this._pointerStartScreen
          && getDistance(this._pointerStartScreen, screenPos) > DRAG_THRESHOLD_PX
        ) {
          this._operatePointerMoved = true;
        }
        break;

      case 'item_pending':
        handleItemPendingMove(this, worldPos, screenPos);
        break;

      case 'dragging_items':
        handleDraggingItemsMove(this, worldPos);
        break;

      case 'box_pending':
        handleBoxPendingMove(this, worldPos, screenPos);
        break;

      case 'box_selecting':
        this._boxSelectCurrent = worldPos;
        this._visuals.renderMarquee(this._boxSelectStart!, worldPos);
        break;

      case 'wire_drawing':
        handleWireDrawingMove(this, worldPos);
        break;

      case 'wire_segment_dragging':
        handleSegmentDraggingMove(this, worldPos);
        break;

      case 'placing':
        handlePlacingMove(this, worldPos);
        break;

      case 'wire_mode':
        break;

      default:
        break;
    }
  }

  /**
   * Hover hit-test while idle: updates the cursor + hover highlight to signal
   * what's under the pointer. No-op outside edit mode; only emits on change.
   */
  _updateHover(worldPos: Position): void {
    if (this._mode !== 'edit') {
      this._clearHover();
      return;
    }
    const hit = this._hitTester.hitTest(worldPos);
    const type = hit.type === 'none' ? null : hit.type;
    const id = type ? hit.id : null;
    if (type === this._hoverType && id === this._hoverId) return;
    this._hoverType = type;
    this._hoverId = id;
    this._visuals.setHover(type, id);
  }

  _clearHover(): void {
    if (this._hoverType === null && this._hoverId === null) return;
    this._hoverType = null;
    this._hoverId = null;
    this._visuals.setHover(null, null);
  }

  handlePointerUp(
    worldPos: Position,
    _screenPos: Position,
    button: number,
    modifiers: Modifiers
  ): void {
    if (this._destroyed) return;

    switch (this._state) {
      case 'panning':
        this._state = 'idle';
        clearPointerTracking(this);
        break;

      case 'operating_pressing':
        handleOperatePointerUp(this, worldPos, button);
        break;

      case 'item_pending':
        handleItemPendingUp(this, modifiers);
        break;

      case 'dragging_items':
        handleDraggingItemsUp(this);
        break;

      case 'box_pending':
        this._facade?.clearSelection();
        this._visuals.clearMarquee();
        this._state = 'idle';
        clearPointerTracking(this);
        break;

      case 'box_selecting':
        handleBoxSelectingUp(this, modifiers);
        break;

      case 'wire_drawing':
        handleWireDrawingUp(this, worldPos, button);
        break;

      case 'wire_segment_dragging':
        handleSegmentDraggingUp(this);
        break;

      default:
        break;
    }
  }

  handleKeyDown(key: string, _code: string, _modifiers: Modifiers): void {
    if (this._destroyed) return;

    if (key === ' ') {
      this._isSpaceHeld = true;
      return;
    }

    if (key === 'Escape') {
      if (this._state === 'operating_pressing') {
        handleOperateCancel(this);
        return;
      }
      if (this._state === 'wire_drawing') {
        if (this._wireBendPoints.length > 0) {
          // Last bend becomes the endpoint; remove it from handles to avoid duplication
          const lastBend = this._wireBendPoints.pop()!;
          completeWire(this, lastBend);
        } else {
          resetWireDrawing(this);
        }
        return;
      }
      this.cancel();
      return;
    }

    if (this._state === 'placing') {
      const k = key.toLowerCase();
      if (k === 'r') {
        this._placingRotation = (this._placingRotation + 90) % 360;
        updateGhostPreview(this);
      } else if (k === 'x') {
        this._placingFlipH = !this._placingFlipH;
        updateGhostPreview(this);
      } else if (k === 'y') {
        this._placingFlipV = !this._placingFlipV;
        updateGhostPreview(this);
      }
    }
  }

  handleKeyUp(key: string, _code: string): void {
    if (this._destroyed) return;
    if (key === ' ') {
      this._isSpaceHeld = false;
    }
  }
}
