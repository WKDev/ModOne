/**
 * EventBridge — Translates DOM/Pixi Events into InteractionController calls
 *
 * Coordinates pointer and keyboard events with pixi-viewport's built-in
 * pan/zoom handling. The bridge:
 *
 * 1. Listens to Pixi FederatedPointerEvents on the viewport container
 * 2. Converts screen coords to world coords via viewport.toWorld()
 * 3. Dispatches to the InteractionController (which does its own hit testing)
 *
 * Event routing:
 *   - Middle/right click → pixi-viewport handles pan natively
 *   - Left click → EventBridge dispatches to InteractionController
 *   - Scroll wheel → pixi-viewport handles zoom natively
 *   - Keyboard → EventBridge dispatches to InteractionController
 */

import type { FederatedPointerEvent } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { Position } from '../types';
import type { InteractionController, Modifiers } from './InteractionController';

// ============================================================================
// Types
// ============================================================================

export interface EventBridgeOptions {
  /** The pixi-viewport instance */
  viewport: Viewport;
  /** The DOM element to attach keyboard listeners to */
  domElement: HTMLElement;
  /** The interaction controller to dispatch events to */
  controller: InteractionController;
}

// ============================================================================
// EventBridge
// ============================================================================

export class EventBridge {
  private _viewport: Viewport | null = null;
  private _domElement: HTMLElement | null = null;
  private _controller: InteractionController | null = null;
  private _destroyed = false;

  // Bound handler references (for removeListener)
  private _onPointerDown: ((e: FederatedPointerEvent) => void) | null = null;
  private _onPointerMove: ((e: FederatedPointerEvent) => void) | null = null;
  private _onPointerUp: ((e: FederatedPointerEvent) => void) | null = null;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private _onContextMenu: ((e: Event) => void) | null = null;

  // Track whether a pointer interaction is active (left button down)
  private _isPointerActive = false;

  /**
   * Initialize the event bridge and attach all listeners.
   */
  init(options: EventBridgeOptions): void {
    if (this._viewport) {
      throw new Error('EventBridge already initialized');
    }

    this._viewport = options.viewport;
    this._domElement = options.domElement;
    this._controller = options.controller;

    // Bind handlers
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onContextMenu = (e: Event) => e.preventDefault();

    // Attach Pixi event listeners on the viewport container
    this._viewport.on('pointerdown', this._onPointerDown);
    this._viewport.on('pointermove', this._onPointerMove);
    this._viewport.on('pointerup', this._onPointerUp);
    this._viewport.on('pointerupoutside', this._onPointerUp);
    this._viewport.on('pointercancel', this._onPointerUp);

    // Attach DOM keyboard listeners
    this._domElement.addEventListener('keydown', this._onKeyDown);
    this._domElement.addEventListener('keyup', this._onKeyUp);
    this._domElement.addEventListener('contextmenu', this._onContextMenu);

    // Make the DOM element focusable for keyboard events
    if (!this._domElement.hasAttribute('tabindex')) {
      this._domElement.setAttribute('tabindex', '0');
    }
  }

  /**
   * Clean up all event listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Remove Pixi event listeners
    if (this._viewport && this._onPointerDown) {
      this._viewport.off('pointerdown', this._onPointerDown);
      this._viewport.off('pointermove', this._onPointerMove!);
      this._viewport.off('pointerup', this._onPointerUp!);
      this._viewport.off('pointerupoutside', this._onPointerUp!);
      this._viewport.off('pointercancel', this._onPointerUp!);
    }

    // Remove DOM event listeners
    if (this._domElement) {
      if (this._onKeyDown) this._domElement.removeEventListener('keydown', this._onKeyDown);
      if (this._onKeyUp) this._domElement.removeEventListener('keyup', this._onKeyUp);
      if (this._onContextMenu) this._domElement.removeEventListener('contextmenu', this._onContextMenu);
    }

    this._viewport = null;
    this._domElement = null;
    this._controller = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._onContextMenu = null;
  }

  // --------------------------------------------------------------------------
  // Pointer Event Handlers
  // --------------------------------------------------------------------------

  private _handlePointerDown(e: FederatedPointerEvent): void {
    if (this._destroyed || !this._viewport || !this._controller) return;

    const button = e.button;
    const worldPos = this._toWorld(e);
    const screenPos = this._toScreen(e);
    const modifiers = this._extractModifiers(e);

    if (import.meta.env.DEV) {
      console.debug('[EventBridge] pointerdown', { button, worldPos, screenPos });
    }

    this._isPointerActive = button === 0;

    this._controller.handlePointerDown(worldPos, screenPos, button, modifiers);
  }

  private _handlePointerMove(e: FederatedPointerEvent): void {
    if (this._destroyed || !this._viewport || !this._controller) return;

    // Only send move events when a pointer interaction is active,
    // or when the controller is in placing/wire mode for hover-style previews.
    if (!this._isPointerActive && !this._controller.isPlacing && !this._controller.isWireMode) return;

    const worldPos = this._toWorld(e);
    const screenPos = this._toScreen(e);
    const modifiers = this._extractModifiers(e);

    this._controller.handlePointerMove(worldPos, screenPos, modifiers);
  }

  private _handlePointerUp(e: FederatedPointerEvent): void {
    if (this._destroyed || !this._viewport || !this._controller) return;

    const worldPos = this._toWorld(e);
    const screenPos = this._toScreen(e);
    const modifiers = this._extractModifiers(e);

    if (e.button === 0) {
      this._isPointerActive = false;
    }

    this._controller.handlePointerUp(worldPos, screenPos, e.button, modifiers);
  }

  // --------------------------------------------------------------------------
  // Keyboard Event Handlers
  // --------------------------------------------------------------------------

  private _handleKeyDown(e: KeyboardEvent): void {
    if (this._destroyed || !this._controller) return;

    // Don't capture keyboard events from input elements
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    const modifiers: Modifiers = {
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey,
      space: e.key === ' ',
    };

    this._controller.handleKeyDown(e.key, e.code, modifiers);
  }

  private _handleKeyUp(e: KeyboardEvent): void {
    if (this._destroyed || !this._controller) return;

    // Don't capture keyboard events from input elements
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    this._controller.handleKeyUp(e.key, e.code);
  }

  // --------------------------------------------------------------------------
  // Coordinate Conversion
  // --------------------------------------------------------------------------

  private _toWorld(e: FederatedPointerEvent): Position {
    if (!this._viewport) return { x: 0, y: 0 };
    const worldPoint = this._viewport.toWorld(e.global.x, e.global.y);
    return { x: worldPoint.x, y: worldPoint.y };
  }

  private _toScreen(e: FederatedPointerEvent): Position {
    return { x: e.global.x, y: e.global.y };
  }

  // --------------------------------------------------------------------------
  // Modifier Extraction
  // --------------------------------------------------------------------------

  private _extractModifiers(e: FederatedPointerEvent): Modifiers {
    return {
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey,
      space: false, // Space held state is tracked by the controller itself
    };
  }
}
