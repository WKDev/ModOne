/**
 * KeyboardShortcuts — Canvas Keyboard Action Handler
 *
 * Handles keyboard shortcuts that trigger commands (delete, copy, paste, etc.)
 * independently from the interaction FSM. The FSM handles space-to-pan and
 * escape; this module handles everything else.
 *
 * Shortcuts are disabled when focus is on input/textarea/select/contenteditable
 * elements to avoid interfering with text editing.
 *
 * Usage:
 *   const shortcuts = new KeyboardShortcuts();
 *   shortcuts.init({ domElement, callbacks });
 *   // ... later
 *   shortcuts.destroy();
 */

import type { Position } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Callbacks for keyboard shortcut actions */
export interface ShortcutCallbacks {
  /** Delete selected items */
  deleteSelection?: () => void;
  /** Select all items */
  selectAll?: () => void;
  /** Copy selection to clipboard */
  copy?: () => void;
  /** Paste from clipboard */
  paste?: () => void;
  /** Cut selection (copy + delete) */
  cut?: () => void;
  /** Duplicate selection (copy + paste in-place with offset) */
  duplicate?: () => void;
  /** Undo last action */
  undo?: () => void;
  /** Redo last undone action */
  redo?: () => void;
  /** Clear current selection */
  clearSelection?: () => void;
  /** Toggle grid visibility */
  toggleGrid?: () => void;
  /** Toggle snap-to-grid */
  toggleSnap?: () => void;
  /** Toggle wire drawing mode */
  startWireMode?: () => void;
  /** Rotate selected blocks 90° clockwise */
  rotateSelection?: () => void;
  /** Nudge selected items by delta */
  nudgeSelection?: (delta: Position) => void;
  /** Zoom to fit all content */
  zoomToFit?: () => void;
  /** Reset zoom to 100% */
  resetZoom?: () => void;
  /** Zoom in */
  zoomIn?: () => void;
  /** Zoom out */
  zoomOut?: () => void;
  /** Rotate placing block 90° clockwise */
  rotatePlacing?: () => void;
  /** Flip placing block horizontally */
  flipPlacingH?: () => void;
  /** Flip placing block vertically */
  flipPlacingV?: () => void;
  /** Cancel current placement */
  cancelPlacing?: () => void;
}

export interface KeyboardShortcutsOptions {
  /** DOM element to attach keyboard listener to */
  domElement: HTMLElement;
  /** Shortcut callbacks */
  callbacks: ShortcutCallbacks;
  /** Grid size for nudge distance (default: 20) */
  gridSize?: number;
}

// ============================================================================
// KeyboardShortcuts
// ============================================================================

export class KeyboardShortcuts {
  private _domElement: HTMLElement | null = null;
  private _callbacks: ShortcutCallbacks | null = null;
  private _gridSize = 20;
  private _destroyed = false;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Initialize keyboard shortcut handling.
   */
  init(options: KeyboardShortcutsOptions): void {
    if (this._domElement) {
      throw new Error('KeyboardShortcuts already initialized');
    }

    this._domElement = options.domElement;
    this._callbacks = options.callbacks;
    this._gridSize = options.gridSize ?? 20;

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._domElement.addEventListener('keydown', this._onKeyDown);
  }

  /**
   * Update callbacks (e.g., when selection changes).
   */
  setCallbacks(callbacks: ShortcutCallbacks): void {
    this._callbacks = callbacks;
  }

  /**
   * Update grid size for nudge operations.
   */
  setGridSize(size: number): void {
    this._gridSize = Math.max(1, size);
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._domElement && this._onKeyDown) {
      this._domElement.removeEventListener('keydown', this._onKeyDown);
    }

    this._domElement = null;
    this._callbacks = null;
    this._onKeyDown = null;
  }

  // --------------------------------------------------------------------------
  // Key Handler
  // --------------------------------------------------------------------------

  private _handleKeyDown(e: KeyboardEvent): void {
    if (this._destroyed || !this._callbacks) return;

    // Don't capture when focus is on input elements
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.target as HTMLElement)?.isContentEditable) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key.toLowerCase();

    // --- Ctrl/Cmd shortcuts ---
    if (ctrl) {
      switch (key) {
        case 'a':
          e.preventDefault();
          this._callbacks.selectAll?.();
          return;

        case 'c':
          e.preventDefault();
          this._callbacks.copy?.();
          return;

        case 'v':
          e.preventDefault();
          this._callbacks.paste?.();
          return;

        case 'x':
          e.preventDefault();
          this._callbacks.cut?.();
          return;

        case 'd':
          e.preventDefault();
          this._callbacks.duplicate?.();
          return;

        case 'z':
          e.preventDefault();
          if (shift) {
            this._callbacks.redo?.();
          } else {
            this._callbacks.undo?.();
          }
          return;

        case 'y':
          e.preventDefault();
          this._callbacks.redo?.();
          return;

        case '=':
        case '+':
          e.preventDefault();
          this._callbacks.zoomIn?.();
          return;

        case '-':
          e.preventDefault();
          this._callbacks.zoomOut?.();
          return;

        case '0':
          e.preventDefault();
          this._callbacks.resetZoom?.();
          return;
      }
      return;
    }

    // --- Non-modifier shortcuts ---
    switch (key) {
      case 'delete':
      case 'backspace':
        e.preventDefault();
        this._callbacks.deleteSelection?.();
        return;

      case 'escape':
        // Escape is handled by EventBridge → FSM, but we also clear selection
        this._callbacks.clearSelection?.();
        return;

      case 'g':
        this._callbacks.toggleGrid?.();
        return;

      case 's':
        this._callbacks.toggleSnap?.();
        return;

      case 'w':
        this._callbacks.startWireMode?.();
        return;

      case 'r':
        if (this._callbacks.rotatePlacing) {
          this._callbacks.rotatePlacing();
        } else {
          this._callbacks.rotateSelection?.();
        }
        return;

      case 'x':
        this._callbacks.flipPlacingH?.();
        return;

      case 'y':
        this._callbacks.flipPlacingV?.();
        return;

      case 'f':
        this._callbacks.zoomToFit?.();
        return;

      // Arrow key nudging
      case 'arrowup':
        e.preventDefault();
        this._callbacks.nudgeSelection?.({ x: 0, y: -this._gridSize });
        return;

      case 'arrowdown':
        e.preventDefault();
        this._callbacks.nudgeSelection?.({ x: 0, y: this._gridSize });
        return;

      case 'arrowleft':
        e.preventDefault();
        this._callbacks.nudgeSelection?.({ x: -this._gridSize, y: 0 });
        return;

      case 'arrowright':
        e.preventDefault();
        this._callbacks.nudgeSelection?.({ x: this._gridSize, y: 0 });
        return;
    }
  }
}
