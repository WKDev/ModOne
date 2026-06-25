/**
 * ToolInputBinding — the single pointer-input pipeline for the shared canvas engine.
 *
 * Attaches PIXI federated pointer listeners to a pixi-viewport instance, converts
 * each event into a normalized {@link CanvasPointerInput} (world + grid-snapped +
 * client coords), and dispatches to editor-provided handlers. Middle/right button
 * is left to pixi-viewport for native pan and is suppressed from the tool handlers.
 *
 * This is the generalized form of OneCanvas's EventBridge: instead of dispatching
 * to one hard-coded InteractionController, it dispatches normalized input to any
 * editor's handlers, so the Symbol, Schematic and Sheet editors share one
 * coordinate/snap/pan source.
 */

import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';
import type { CoordinateSystem } from '../../components/OneCanvas/core/CoordinateSystem';
import type { PointerInputHandlers } from './Tool';
import { normalizePointer } from './normalizePointer';

export interface ToolInputBindingOptions {
  /** The pixi-viewport Viewport that receives federated pointer events. */
  viewport: Viewport;
  /** Coordinate system used to snap world coordinates to the active grid. */
  coordSys: CoordinateSystem;
  /** Editor handlers that receive normalized primary-button input. */
  handlers: PointerInputHandlers;
}

export class ToolInputBinding {
  private _viewport: Viewport | null = null;
  private _coordSys: CoordinateSystem | null = null;
  private _handlers: PointerInputHandlers = {};
  private _panning = false;
  private _destroyed = false;

  // Bound handler references (kept so destroy() removes exactly these listeners
  // and leaves the viewport's own 'moved'/'zoomed' listeners intact).
  private _onDown: ((e: FederatedPointerEvent) => void) | null = null;
  private _onMove: ((e: FederatedPointerEvent) => void) | null = null;
  private _onUp: ((e: FederatedPointerEvent) => void) | null = null;

  init(options: ToolInputBindingOptions): void {
    if (this._viewport) {
      throw new Error('ToolInputBinding already initialized');
    }
    this._viewport = options.viewport;
    this._coordSys = options.coordSys;
    this._handlers = options.handlers;

    this._onDown = (e) => {
      if (e.button !== 0) {
        // Middle/right → pixi-viewport pans natively; suppress tool dispatch.
        this._panning = true;
        return;
      }
      this._handlers.onPointerDown?.(normalizePointer(this._viewport!, this._coordSys, e));
    };
    this._onMove = (e) => {
      if (this._panning) return; // mid-pan: don't fight the camera
      this._handlers.onPointerMove?.(normalizePointer(this._viewport!, this._coordSys, e));
    };
    this._onUp = (e) => {
      if (e.button !== 0) {
        this._panning = false;
        return;
      }
      this._handlers.onPointerUp?.(normalizePointer(this._viewport!, this._coordSys, e));
    };

    const vp = this._viewport;
    vp.on('pointerdown', this._onDown);
    vp.on('pointermove', this._onMove);
    vp.on('pointerup', this._onUp);
    vp.on('pointerupoutside', this._onUp);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    const vp = this._viewport;
    if (vp) {
      if (this._onDown) vp.off('pointerdown', this._onDown);
      if (this._onMove) vp.off('pointermove', this._onMove);
      if (this._onUp) {
        vp.off('pointerup', this._onUp);
        vp.off('pointerupoutside', this._onUp);
      }
    }

    this._viewport = null;
    this._coordSys = null;
    this._handlers = {};
    this._onDown = null;
    this._onMove = null;
    this._onUp = null;
  }
}
