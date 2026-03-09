import type { CanvasFacadeReturn } from '@/types/canvasFacade';
import type {
  HandleConstraint,
  HitTestResult,
  Position,
  PortPosition,
  WireEndpoint,
} from '../types';
import { isPortEndpoint } from '../types';
import type { HitTester } from '../core/HitTester';
import type { SpatialIndex } from '../core/SpatialIndex';

// ============================================================================
// Types
// ============================================================================

export interface Modifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  space: boolean;
}

export type InteractionState =
  | 'idle'
  | 'panning'
  | 'item_pending'
  | 'dragging_items'
  | 'box_pending'
  | 'box_selecting'
  | 'wire_drawing'
  | 'wire_segment_dragging'
  | 'wire_handle_dragging'
  | 'placing'
  | 'wire_mode';

type WireSnapTarget = {
  type: 'port' | 'junction' | 'wire';
  id: string;
  parentId?: string;
  position: Position;
};

interface DragGroupItem {
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
  onPlaceBlock?: (
    blockType: string,
    position: Position,
    rotation: number,
    flipH: boolean,
    flipV: boolean
  ) => void;
  onStateChange?: (state: InteractionState) => void;
}

// ============================================================================
// Constants
// ============================================================================

const GRID_SNAP_PX = 20;
const DRAG_THRESHOLD_PX = 4;
const WIRE_SNAP_STICKY_RADIUS_PX = 10;
const PORT_DIRECTIONS: readonly PortPosition[] = [
  'top',
  'right',
  'bottom',
  'left',
];

// ============================================================================
// InteractionController
// ============================================================================

export class InteractionController {
  private _state: InteractionState = 'idle';
  private _hitTester: HitTester;
  private _spatialIndex: SpatialIndex;
  private _visuals: InteractionVisuals;
  private _onPlaceBlock: InteractionControllerConfig['onPlaceBlock'];
  private _onStateChange: InteractionControllerConfig['onStateChange'];
  private _destroyed = false;

  // Facade ref — updated externally on every React render
  private _facade: CanvasFacadeReturn | null = null;

  // Pointer tracking
  private _pointerStartWorld: Position | null = null;
  private _pointerStartScreen: Position | null = null;
  private _downModifiers: Modifiers | null = null;
  private _lastMoveWorld: Position | null = null;

  // Item drag state
  private _dragPrimaryId: string | null = null;
  private _dragGroup: Map<string, DragGroupItem> | null = null;
  private _dragThresholdPassed = false;

  // Box select state
  private _boxSelectStart: Position | null = null;
  private _boxSelectCurrent: Position | null = null;

  // Wire drawing state
  private _wireFrom: WireEndpoint | null = null;
  private _wireFromExitDirection: PortPosition | null = null;
  private _wireSnapTarget: WireSnapTarget | null = null;
  private _wireDrawingReturnState: 'idle' | 'wire_mode' = 'idle';
  private _wireDrawingFromPos: Position = { x: 0, y: 0 };
  private _wireBendPoints: Position[] = [];

  // Wire segment dragging
  private _segmentWireId: string | null = null;
  private _segmentHandleA = -1;
  private _segmentHandleB = -1;
  private _segmentOrientation: 'horizontal' | 'vertical' | null = null;
  private _segmentPrevDelta: Position = { x: 0, y: 0 };
  private _segmentIsFirstMove = true;

  // Wire handle dragging
  private _handleWireId: string | null = null;
  private _handleIndex = -1;
  private _handleConstraint: HandleConstraint = 'free';
  private _handleStartPosition: Position | null = null;

  // Placing state
  private _placingBlockType: string | null = null;
  private _placingPosition: Position | null = null;
  private _placingRotation = 0;
  private _placingFlipH = false;
  private _placingFlipV = false;

  // Key state
  private _isSpaceHeld = false;

  constructor(config: InteractionControllerConfig) {
    this._hitTester = config.hitTester;
    this._spatialIndex = config.spatialIndex;
    this._visuals = config.visuals;
    this._onPlaceBlock = config.onPlaceBlock;
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

  setFacade(facade: CanvasFacadeReturn | null): void {
    this._facade = facade;
  }

  setOnPlaceBlock(cb: InteractionControllerConfig['onPlaceBlock']): void {
    this._onPlaceBlock = cb;
  }

  setOnStateChange(cb: InteractionControllerConfig['onStateChange']): void {
    this._onStateChange = cb;
  }

  // ==========================================================================
  // Public Commands
  // ==========================================================================

  startPlacing(blockType: string): void {
    this._resetTransient();
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
    this._resetTransient();
    this._state = 'wire_mode';
    this._visuals.setPortsVisible(true);
    this._onStateChange?.(this._state);
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
    this._resetTransient();
    this._state = 'idle';
    this._onStateChange?.(this._state);
  }

  destroy(): void {
    this._destroyed = true;
    this._facade = null;
  }

  // ==========================================================================
  // Pointer Events (called by EventBridge)
  // ==========================================================================

  handlePointerDown(
    worldPos: Position,
    screenPos: Position,
    button: number,
    modifiers: Modifiers
  ): void {
    if (this._destroyed) return;

    this._downModifiers = modifiers;

    switch (this._state) {
      case 'idle':
        this._handleIdlePointerDown(worldPos, screenPos, button, modifiers);
        break;
      case 'placing':
        this._handlePlacingPointerDown(worldPos, button);
        break;
      case 'wire_mode':
        this._handleWireModePointerDown(worldPos, button);
        break;
      case 'wire_drawing':
        this._handleWireDrawingPointerDown(worldPos, button);
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
      case 'panning':
        break;

      case 'item_pending':
        this._handleItemPendingMove(worldPos, screenPos);
        break;

      case 'dragging_items':
        this._handleDraggingItemsMove(worldPos);
        break;

      case 'box_pending':
        this._handleBoxPendingMove(worldPos, screenPos);
        break;

      case 'box_selecting':
        this._boxSelectCurrent = worldPos;
        this._visuals.renderMarquee(this._boxSelectStart!, worldPos);
        break;

      case 'wire_drawing':
        this._handleWireDrawingMove(worldPos);
        break;

      case 'wire_segment_dragging':
        this._handleSegmentDraggingMove(worldPos);
        break;

      case 'wire_handle_dragging':
        this._handleHandleDraggingMove(worldPos);
        break;

      case 'placing':
        this._handlePlacingMove(worldPos);
        break;

      case 'wire_mode':
        break;

      default:
        break;
    }
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
        this._clearPointerTracking();
        break;

      case 'item_pending':
        this._handleItemPendingUp(modifiers);
        break;

      case 'dragging_items':
        this._handleDraggingItemsUp();
        break;

      case 'box_pending':
        this._facade?.clearSelection();
        this._visuals.clearMarquee();
        this._state = 'idle';
        this._clearPointerTracking();
        break;

      case 'box_selecting':
        this._handleBoxSelectingUp(modifiers);
        break;

      case 'wire_drawing':
        this._handleWireDrawingUp(worldPos, button);
        break;

      case 'wire_segment_dragging':
        this._handleSegmentDraggingUp();
        break;

      case 'wire_handle_dragging':
        this._handleHandleDraggingUp();
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
      if (this._state === 'wire_drawing') {
        if (this._wireBendPoints.length > 0) {
          // Last bend becomes the endpoint; remove it from handles to avoid duplication
          const lastBend = this._wireBendPoints.pop()!;
          this._completeWire(lastBend);
        } else {
          this._resetWireDrawing();
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
        this._updateGhostPreview();
      } else if (k === 'x') {
        this._placingFlipH = !this._placingFlipH;
        this._updateGhostPreview();
      } else if (k === 'y') {
        this._placingFlipV = !this._placingFlipV;
        this._updateGhostPreview();
      }
    }
  }

  handleKeyUp(key: string, _code: string): void {
    if (this._destroyed) return;
    if (key === ' ') {
      this._isSpaceHeld = false;
    }
  }

  // ==========================================================================
  // Idle State Handlers
  // ==========================================================================

  private _handleIdlePointerDown(
    worldPos: Position,
    screenPos: Position,
    button: number,
    modifiers: Modifiers
  ): void {
    if (button === 1 || (button === 0 && this._isSpaceHeld)) {
      this._state = 'panning';
      this._pointerStartWorld = worldPos;
      this._pointerStartScreen = screenPos;
      return;
    }

    if (button !== 0) return;

    const target = this._hitTester.hitTest(worldPos);

    if (import.meta.env.DEV) {
      console.debug(
        '[InteractionController] idle hitTest →', target.type, target.id || '',
        '| spatialIndex.size:', this._spatialIndex.size,
        '| worldPos:', worldPos,
        '| facade?:', !!this._facade,
        '| facade.components.size:', this._facade?.components?.size ?? 'N/A'
      );
    }

    this._pointerStartWorld = worldPos;
    this._pointerStartScreen = screenPos;

    switch (target.type) {
      case 'port':
        this._startWireDrawing(worldPos, target);
        break;

      case 'handle':
        this._startWireHandleDragging(target);
        break;

      case 'segment':
        this._startWireSegmentDragging(worldPos, target);
        break;

      case 'block':
      case 'junction':
      case 'wire':
        this._startItemPending(target, modifiers);
        break;

      case 'none':
      default:
        // In wire_mode-like behavior: if wire_mode is active, start wire from empty canvas
        // Otherwise, start box selection
        this._state = 'box_pending';
        this._boxSelectStart = worldPos;
        this._boxSelectCurrent = worldPos;
        break;
    }
  }

  // ==========================================================================
  // Item Click / Drag
  // ==========================================================================

  private _startItemPending(
    target: HitTestResult,
    _modifiers: Modifiers
  ): void {
    this._state = 'item_pending';
    this._dragPrimaryId = target.id;
    this._dragThresholdPassed = false;

    const facade = this._facade;
    if (!facade) return;

    if (target.id && facade.selectedIds.has(target.id)) {
      const group = new Map<string, DragGroupItem>();
      for (const id of facade.selectedIds) {
        const block = facade.components.get(id);
        if (block) {
          group.set(id, {
            originalPos: { x: block.position.x, y: block.position.y },
            isJunction: false,
          });
          continue;
        }
        const junction = facade.junctions.get(id);
        if (junction) {
          group.set(id, {
            originalPos: {
              x: junction.position.x,
              y: junction.position.y,
            },
            isJunction: true,
          });
        }
      }
      this._dragGroup = group.size > 0 ? group : null;
    } else {
      this._dragGroup = null;
    }
  }

  private _handleItemPendingMove(
    worldPos: Position,
    screenPos: Position
  ): void {
    if (!this._pointerStartScreen) return;

    if (
      getDistance(this._pointerStartScreen, screenPos) > DRAG_THRESHOLD_PX
    ) {
      this._dragThresholdPassed = true;

      if (!this._dragGroup && this._dragPrimaryId) {
        const facade = this._facade;
        if (facade) {
          const block = facade.components.get(this._dragPrimaryId);
          if (block) {
            this._dragGroup = new Map([
              [
                this._dragPrimaryId,
                {
                  originalPos: {
                    x: block.position.x,
                    y: block.position.y,
                  },
                  isJunction: false,
                },
              ],
            ]);
          } else {
            const junction = facade.junctions.get(this._dragPrimaryId);
            if (junction) {
              this._dragGroup = new Map([
                [
                  this._dragPrimaryId,
                  {
                    originalPos: {
                      x: junction.position.x,
                      y: junction.position.y,
                    },
                    isJunction: true,
                  },
                ],
              ]);
            }
          }
        }
      }

      this._state = 'dragging_items';
      this._handleDraggingItemsMove(worldPos);
    }
  }

  private _handleDraggingItemsMove(worldPos: Position): void {
    if (!this._pointerStartWorld || !this._dragGroup) return;
    this._lastMoveWorld = worldPos;

    const facade = this._facade;
    if (!facade) return;

    const delta = snapDelta(subtract(worldPos, this._pointerStartWorld));

    for (const [id, { originalPos, isJunction }] of this._dragGroup) {
      const newPos = add(originalPos, delta);
      if (isJunction) {
        facade.moveJunction(id, newPos, true, true);
      } else {
        facade.moveComponent(id, newPos, true, true);
      }
    }
  }

  private _handleItemPendingUp(_modifiers: Modifiers): void {
    if (!this._dragThresholdPassed && this._dragPrimaryId) {
      const facade = this._facade;
      const mods = this._downModifiers;
      if (facade && mods) {
        if (mods.shift) {
          facade.addToSelection(this._dragPrimaryId);
        } else if (mods.ctrl || mods.meta) {
          facade.toggleSelection(this._dragPrimaryId);
        } else {
          facade.setSelection([this._dragPrimaryId]);
        }
      }
    }

    this._dragPrimaryId = null;
    this._dragGroup = null;
    this._dragThresholdPassed = false;
    this._state = 'idle';
    this._clearPointerTracking();
  }

  private _handleDraggingItemsUp(): void {
    if (this._dragGroup && this._pointerStartWorld) {
      const facade = this._facade;
      if (facade) {
        const lastWorld = this._pointerStartWorld;
        const delta = snapDelta(
          subtract(
            this._lastMoveWorld ?? lastWorld,
            this._pointerStartWorld
          )
        );

        for (const [id, { originalPos, isJunction }] of this._dragGroup) {
          const newPos = add(originalPos, delta);
          if (isJunction) {
            facade.moveJunction(id, newPos, false, false);
          } else {
            facade.moveComponent(id, newPos, false, false);
          }
        }
      }
    }

    this._dragPrimaryId = null;
    this._dragGroup = null;
    this._dragThresholdPassed = false;
    this._state = 'idle';
    this._clearPointerTracking();
  }

  // ==========================================================================
  // Box Selection
  // ==========================================================================

  private _handleBoxPendingMove(
    worldPos: Position,
    screenPos: Position
  ): void {
    if (!this._pointerStartScreen) return;

    if (
      getDistance(this._pointerStartScreen, screenPos) > DRAG_THRESHOLD_PX
    ) {
      this._state = 'box_selecting';
      this._boxSelectCurrent = worldPos;
      this._visuals.renderMarquee(this._boxSelectStart!, worldPos);
    }
  }

  private _handleBoxSelectingUp(modifiers: Modifiers): void {
    const facade = this._facade;
    if (facade && this._boxSelectStart && this._boxSelectCurrent) {
      const bounds = rectFromTwoPoints(
        this._boxSelectStart,
        this._boxSelectCurrent
      );
      const items = this._spatialIndex.queryRect(bounds);
      const ids = items
        .filter(
          (item) =>
            item.type === 'block' ||
            item.type === 'junction' ||
            item.type === 'wire'
        )
        .map((item) => item.id);

      if (modifiers.shift) {
        const currentIds = Array.from(facade.selectedIds);
        const merged = new Set([...currentIds, ...ids]);
        facade.setSelection(Array.from(merged));
      } else {
        facade.setSelection(ids);
      }
    }

    this._visuals.clearMarquee();
    this._boxSelectStart = null;
    this._boxSelectCurrent = null;
    this._state = 'idle';
    this._clearPointerTracking();
  }

  // ==========================================================================
  // Wire Drawing
  // ==========================================================================

  private _startWireDrawing(
    _worldPos: Position,
    target: HitTestResult
  ): void {
    this._wireDrawingReturnState = this._state === 'wire_mode' ? 'wire_mode' : 'idle';
    this._state = 'wire_drawing';
    this._wireFrom = {
      componentId: target.parentId ?? '',
      portId: target.id,
    };
    this._wireFromExitDirection = getPortDirection(target);
    // Use the exact port center position (from hit test), not the raw mouse position.
    // This ensures preview matches the final rendered wire, which resolves
    // endpoints from block.position + port.absolutePosition.
    this._wireDrawingFromPos = target.position;
    this._lastMoveWorld = target.position;
    this._wireSnapTarget = null;
    this._wireBendPoints = [];
  }

  private _handleWireDrawingMove(worldPos: Position): void {
    this._lastMoveWorld = worldPos;

    // Check snap target sticky
    if (this._wireSnapTarget) {
      const dist = getDistance(worldPos, this._wireSnapTarget.position);
      if (dist > WIRE_SNAP_STICKY_RADIUS_PX) {
        this._wireSnapTarget = null;
      }
    }

    // Find new snap target
    if (!this._wireSnapTarget) {
      const fromBlockId =
        this._wireFrom && isPortEndpoint(this._wireFrom)
          ? this._wireFrom.componentId
          : undefined;
      const portHit = this._hitTester.findNearestPort(worldPos, fromBlockId);
      if (portHit) {
        this._wireSnapTarget = {
          type: 'port',
          id: portHit.id,
          parentId: portHit.parentId,
          position: portHit.position,
        };
      }
    }

    // Visual feedback — straight lines through bend points, grid-snap only
    const fromPos = this._wireDrawingFromPos;
    const currentTarget = this._wireSnapTarget?.position ?? this._snapToGrid(worldPos);
    const previewPoints: Position[] = [fromPos, ...this._wireBendPoints, currentTarget];

    this._visuals.renderWirePreview(previewPoints);

    if (this._wireSnapTarget) {
      this._visuals.showPortSnap(this._wireSnapTarget.position);
    } else {
      this._visuals.hidePortSnap();
    }
  }

  private _handleWireDrawingUp(_worldPos: Position, button: number): void {
    if (button !== 0) return;
    // Wire completion is now handled by _handleWireDrawingPointerDown
    // (port click / snap target) and ESC key. Mouse up is a no-op
    // during multi-click wire drawing.
  }

  private _handleWireModePointerDown(
    worldPos: Position,
    button: number
  ): void {
    if (button !== 0) return;

    const target = this._hitTester.hitTest(worldPos);
    if (target.type === 'port') {
      // Start from port (existing behavior)
      this._pointerStartWorld = worldPos;
      this._pointerStartScreen = worldPos;
      this._startWireDrawing(worldPos, target);
    } else {
      // Start from empty canvas — FloatingEndpoint
      const snappedPos = this._snapToGrid(worldPos);
      this._wireDrawingReturnState = 'wire_mode';
      this._state = 'wire_drawing';
      this._wireFrom = { position: snappedPos };
      this._wireFromExitDirection = null;
      this._wireDrawingFromPos = snappedPos;
      this._lastMoveWorld = snappedPos;
      this._wireSnapTarget = null;
      this._wireBendPoints = [];
    }
  }

  private _handleWireDrawingPointerDown(
    worldPos: Position,
    button: number
  ): void {
    if (button !== 0) return;

    // If there's a snap target, complete the wire
    if (this._wireSnapTarget) {
      this._completeWire();
      return;
    }

    // If clicking on a port, complete wire there
    const target = this._hitTester.hitTest(worldPos);
    if (target.type === 'port') {
      this._wireSnapTarget = {
        type: 'port',
        id: target.id,
        parentId: target.parentId,
        position: target.position,
      };
      this._completeWire();
      return;
    }

    // Click on empty canvas — record bend point exactly where clicked (grid-snapped)
    const snappedPos = this._snapToGrid(worldPos);
    this._wireBendPoints.push(snappedPos);
  }

  private _completeWire(endPosition?: Position): void {
    if (!this._wireFrom) {
      this._resetWireDrawing();
      return;
    }

    let to: WireEndpoint | null = null;

    if (this._wireSnapTarget) {
      const snapTarget = this._wireSnapTarget;
      if (snapTarget.type === 'port' && snapTarget.parentId) {
        to = { componentId: snapTarget.parentId, portId: snapTarget.id };
      } else if (snapTarget.type === 'junction') {
        to = { junctionId: snapTarget.id } as WireEndpoint;
      }
    } else if (endPosition) {
      to = { position: this._snapToGrid(endPosition) };
    }

    if (to && this._facade) {
      // Convert user bend points to WireHandle format
      const handles = this._wireBendPoints.length > 0
        ? this._wireBendPoints.map(pos => ({
            position: pos,
            constraint: 'free' as const,
            source: 'user' as const,
          }))
        : undefined;

      this._facade.addWire(this._wireFrom, to, {
        fromExitDirection: this._wireFromExitDirection ?? undefined,
        handles,
      });
    }

    this._resetWireDrawing();
  }

  private _resetWireDrawing(): void {
    this._visuals.clearWirePreview();
    this._visuals.hidePortSnap();
    this._wireFrom = null;
    this._wireFromExitDirection = null;
    this._lastMoveWorld = null;
    this._wireSnapTarget = null;
    this._wireDrawingFromPos = { x: 0, y: 0 };
    this._wireBendPoints = [];
    this._state = this._wireDrawingReturnState;
    this._onStateChange?.(this._state);
  }

  private _snapToGrid(pos: Position): Position {
    return {
      x: Math.round(pos.x / GRID_SNAP_PX) * GRID_SNAP_PX,
      y: Math.round(pos.y / GRID_SNAP_PX) * GRID_SNAP_PX,
    };
  }

  // ==========================================================================
  // Wire Segment Dragging
  // ==========================================================================

  private _startWireSegmentDragging(
    _worldPos: Position,
    target: HitTestResult
  ): void {
    const facade = this._facade;
    const wireId = target.id || null;
    this._state = 'wire_segment_dragging';
    const segHandleA =
      typeof target.subIndex === 'number' ? target.subIndex : 0;
    this._segmentWireId = wireId;
    this._segmentHandleA = segHandleA;
    this._segmentHandleB = segHandleA + 1;
    this._segmentOrientation = inferSegmentOrientation(target);
    this._segmentPrevDelta = { x: 0, y: 0 };
    this._segmentIsFirstMove = true;

    if (!facade || !wireId) return;

    const wire = facade.wires.find((candidate) => candidate.id === wireId);
    if (!wire) return;

    const handleCount = wire.handles?.length ?? 0;
    const isFromConnectedSegment = segHandleA === 0;
    const isToConnectedSegment = segHandleA >= handleCount;

    if (isFromConnectedSegment && isPortEndpoint(wire.from)) {
      const fromPos = resolvePortEndpointPosition(wire.from, facade);
      if (fromPos) {
        facade.insertEndpointHandle(wireId, 'from', [
          { position: fromPos, constraint: 'free' },
        ]);
      }
    }

    if (isToConnectedSegment && isPortEndpoint(wire.to)) {
      const toPos = resolvePortEndpointPosition(wire.to, facade);
      if (toPos) {
        facade.insertEndpointHandle(wireId, 'to', [
          { position: toPos, constraint: 'free' },
        ]);
      }
    }

    const wireAfterInsertion = facade.wires.find((candidate) => candidate.id === wireId);
    if (!wireAfterInsertion) return;

    if (isFromConnectedSegment) {
      this._segmentHandleA = 0;
      this._segmentHandleB = 1;
      return;
    }

    if (isToConnectedSegment) {
      const lastIndex = Math.max(0, (wireAfterInsertion.handles?.length ?? 0) - 1);
      this._segmentHandleA = Math.max(0, lastIndex - 1);
      this._segmentHandleB = lastIndex;
    }
  }

  private _handleSegmentDraggingMove(worldPos: Position): void {
    if (!this._pointerStartWorld || !this._segmentWireId) return;
    const facade = this._facade;
    if (!facade) return;

    const snapped = snapDelta(subtract(worldPos, this._pointerStartWorld));
    const constrained = constrainSegmentDelta(snapped, this._segmentOrientation);

    const incrementalDelta = {
      x: constrained.x - this._segmentPrevDelta.x,
      y: constrained.y - this._segmentPrevDelta.y,
    };
    this._segmentPrevDelta = constrained;

    if (incrementalDelta.x !== 0 || incrementalDelta.y !== 0) {
      const isFirstMove = this._segmentIsFirstMove;
      this._segmentIsFirstMove = false;
      facade.moveWireSegment(
        this._segmentWireId,
        this._segmentHandleA,
        this._segmentHandleB,
        incrementalDelta,
        isFirstMove
      );
    }
  }

  private _handleSegmentDraggingUp(): void {
    // Handles are already at the correct final position from incremental move handler.
    // No duplicate delta application needed.
    if (this._segmentWireId) {
      this._facade?.cleanupOverlappingHandles(this._segmentWireId);
    }
    this._segmentWireId = null;
    this._segmentHandleA = -1;
    this._segmentHandleB = -1;
    this._segmentOrientation = null;
    this._segmentPrevDelta = { x: 0, y: 0 };
    this._segmentIsFirstMove = true;
    this._state = 'idle';
    this._clearPointerTracking();
  }

  // ==========================================================================
  // Wire Handle Dragging
  // ==========================================================================

  private _startWireHandleDragging(target: HitTestResult): void {
    this._state = 'wire_handle_dragging';
    this._handleWireId = target.id || null;
    this._handleIndex =
      typeof target.subIndex === 'number' ? target.subIndex : -1;
    this._handleConstraint =
      target.subIndex === 0
        ? 'horizontal'
        : target.subIndex === 1
          ? 'vertical'
          : 'free';
    this._handleStartPosition = target.position;
  }

  private _handleHandleDraggingMove(worldPos: Position): void {
    if (
      !this._pointerStartWorld ||
      !this._handleWireId ||
      !this._handleStartPosition
    )
      return;
    this._lastMoveWorld = worldPos;

    const facade = this._facade;
    if (!facade) return;

    const snapped = snapDelta(subtract(worldPos, this._pointerStartWorld));
    const constrained = constrainDelta(snapped, this._handleConstraint);
    const newPos = add(this._handleStartPosition, constrained);
    facade.updateWireHandle(
      this._handleWireId,
      this._handleIndex,
      newPos,
      true
    );
  }

  private _handleHandleDraggingUp(): void {
    if (
      this._handleWireId &&
      this._handleStartPosition &&
      this._pointerStartWorld
    ) {
      const facade = this._facade;
      if (facade) {
        const lastMove = this._lastMoveWorld;
        if (lastMove) {
          const snapped = snapDelta(
            subtract(lastMove, this._pointerStartWorld)
          );
          const constrained = constrainDelta(
            snapped,
            this._handleConstraint
          );
          const newPos = add(this._handleStartPosition, constrained);
          facade.updateWireHandle(
            this._handleWireId,
            this._handleIndex,
            newPos,
            false
          );
        }
      }
    }

    this._handleWireId = null;
    this._handleIndex = -1;
    this._handleConstraint = 'free';
    this._handleStartPosition = null;
    this._state = 'idle';
    this._clearPointerTracking();
  }

  // ==========================================================================
  // Placing Mode
  // ==========================================================================

  private _handlePlacingPointerDown(
    worldPos: Position,
    button: number
  ): void {
    if (button !== 0 || !this._placingBlockType) return;

    const snappedPos = snapToGrid(worldPos);
    this._onPlaceBlock?.(
      this._placingBlockType,
      snappedPos,
      this._placingRotation,
      this._placingFlipH,
      this._placingFlipV
    );
  }

  private _handlePlacingMove(worldPos: Position): void {
    this._placingPosition = snapToGrid(worldPos);
    this._updateGhostPreview();
  }

  private _updateGhostPreview(): void {
    if (this._placingBlockType && this._placingPosition) {
      this._visuals.updateGhost({
        blockType: this._placingBlockType,
        position: this._placingPosition,
        rotation: this._placingRotation,
        flipH: this._placingFlipH,
        flipV: this._placingFlipV,
      });
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private _clearPointerTracking(): void {
    this._pointerStartWorld = null;
    this._pointerStartScreen = null;
    this._lastMoveWorld = null;
  }

  private _resetTransient(): void {
    this._dragPrimaryId = null;
    this._dragGroup = null;
    this._dragThresholdPassed = false;
    this._boxSelectStart = null;
    this._boxSelectCurrent = null;
    this._wireFrom = null;
    this._wireFromExitDirection = null;
    this._lastMoveWorld = null;
    this._wireSnapTarget = null;
    this._wireDrawingReturnState = 'idle';
    this._wireDrawingFromPos = { x: 0, y: 0 };
    this._segmentWireId = null;
    this._segmentHandleA = -1;
    this._segmentHandleB = -1;
    this._segmentOrientation = null;
    this._segmentPrevDelta = { x: 0, y: 0 };
    this._segmentIsFirstMove = true;
    this._handleWireId = null;
    this._handleIndex = -1;
    this._handleConstraint = 'free';
    this._handleStartPosition = null;
    this._placingBlockType = null;
    this._placingPosition = null;
    this._placingRotation = 0;
    this._placingFlipH = false;
    this._placingFlipV = false;
    this._clearPointerTracking();
  }
}

// ============================================================================
// Geometry Helpers
// ============================================================================

function getDistance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function subtract(a: Position, b: Position): Position {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Position, b: Position): Position {
  return { x: a.x + b.x, y: a.y + b.y };
}

function snapDelta(delta: Position): Position {
  return {
    x: Math.round(delta.x / GRID_SNAP_PX) * GRID_SNAP_PX,
    y: Math.round(delta.y / GRID_SNAP_PX) * GRID_SNAP_PX,
  };
}

function snapToGrid(pos: Position): Position {
  return {
    x: Math.round(pos.x / GRID_SNAP_PX) * GRID_SNAP_PX,
    y: Math.round(pos.y / GRID_SNAP_PX) * GRID_SNAP_PX,
  };
}

function constrainDelta(
  delta: Position,
  constraint: HandleConstraint
): Position {
  if (constraint === 'horizontal') return { x: delta.x, y: 0 };
  if (constraint === 'vertical') return { x: 0, y: delta.y };
  return delta;
}

function constrainSegmentDelta(
  delta: Position,
  orientation: 'horizontal' | 'vertical' | null
): Position {
  if (orientation === 'horizontal') return { x: 0, y: delta.y };
  if (orientation === 'vertical') return { x: delta.x, y: 0 };
  return delta;
}

function getPortDirection(target: HitTestResult): PortPosition | null {
  if (typeof target.subIndex !== 'number') return null;
  return PORT_DIRECTIONS[target.subIndex] ?? null;
}

function inferSegmentOrientation(
  target: HitTestResult
): 'horizontal' | 'vertical' | null {
  if (typeof target.subIndex !== 'number') return null;
  return target.subIndex % 2 === 0 ? 'horizontal' : 'vertical';
}

function resolvePortEndpointPosition(
  endpoint: WireEndpoint,
  facade: CanvasFacadeReturn
): Position | null {
  if (!isPortEndpoint(endpoint)) return null;

  const block = facade.components.get(endpoint.componentId);
  if (!block) return null;

  const port = block.ports.find((candidate) => candidate.id === endpoint.portId);
  if (!port) return null;

  return {
    x: block.position.x + (port.absolutePosition?.x ?? 0),
    y: block.position.y + (port.absolutePosition?.y ?? 0),
  };
}

function rectFromTwoPoints(a: Position, b: Position) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
