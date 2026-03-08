/**
 * PixiViewport — Pan/Zoom Camera System
 *
 * Wraps pixi-viewport to provide camera controls for the schematic editor.
 * Supports drag-pan, scroll-zoom, pinch-zoom, and programmatic viewport control.
 */

import { Viewport } from 'pixi-viewport';
import type { Application } from 'pixi.js';
import type { ViewportState, ViewportBounds, CanvasConfig } from '../types';
import { DEFAULT_VIEWPORT } from '../types';

export interface PixiViewportOptions {
  /** The Pixi.js Application instance */
  app: Application;
  /** World width in canvas units */
  worldWidth?: number;
  /** World height in canvas units */
  worldHeight?: number;
  /** Canvas configuration for zoom limits */
  config?: CanvasConfig;
  /** Callback when viewport state changes (pan, zoom) */
  onViewportChange?: (state: ViewportState) => void;
}

/**
 * Manages the pixi-viewport instance for pan/zoom camera control.
 *
 * The Viewport is a Container that sits between the Application stage
 * and the layer containers. All content layers are added as children
 * of the viewport, so panning and zooming affect everything uniformly.
 */
export class PixiViewport {
  private _viewport: Viewport | null = null;
  private _config: CanvasConfig | null = null;
  private _onViewportChange: ((state: ViewportState) => void) | null = null;
  private _destroyed = false;

  /** The underlying pixi-viewport instance */
  get viewport(): Viewport {
    if (!this._viewport) throw new Error('PixiViewport not initialized');
    return this._viewport;
  }

  /** Current viewport state */
  get state(): ViewportState {
    if (!this._viewport) return DEFAULT_VIEWPORT;
    return {
      panX: this._viewport.x,
      panY: this._viewport.y,
      zoom: this._viewport.scale.x,
    };
  }

  /** Visible area bounds in world coordinates */
  get visibleBounds(): ViewportBounds {
    if (!this._viewport) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    const vp = this._viewport;
    const left = -vp.x / vp.scale.x;
    const top = -vp.y / vp.scale.y;
    const right = left + vp.screenWidth / vp.scale.x;
    const bottom = top + vp.screenHeight / vp.scale.y;
    return { minX: left, minY: top, maxX: right, maxY: bottom };
  }

  /**
   * Create and configure the viewport.
   * Returns the Viewport instance so it can be added to the stage.
   */
  init(options: PixiViewportOptions): Viewport {
    if (this._viewport) {
      throw new Error('PixiViewport already initialized');
    }

    const {
      app,
      worldWidth = 50000,
      worldHeight = 50000,
      config,
      onViewportChange,
    } = options;

    this._config = config ?? null;
    this._onViewportChange = onViewportChange ?? null;

    const minScale = config?.minZoom ?? 0.05;
    const maxScale = config?.maxZoom ?? 10;

    // Create pixi-viewport with Pixi v8 events integration
    this._viewport = new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth,
      worldHeight,
      events: app.renderer.events,
      // Disable context menu for right-click drag support
      disableOnContextMenu: true,
    });

    // Enable sortable children for layer z-ordering within the viewport
    this._viewport.sortableChildren = true;

    // Pixi v8 requires explicit eventMode for containers to receive pointer events
    this._viewport.eventMode = 'static';

    // Configure interaction plugins
    this._viewport
      .drag({ mouseButtons: 'middle-right' }) // Middle/right button for pan
      .pinch()                                  // Two-finger pinch to zoom
      .wheel({ smooth: 3 })                    // Scroll wheel zoom with smoothing
      .decelerate({ friction: 0.92 })           // Inertial scrolling
      .clampZoom({ minScale, maxScale });       // Zoom limits

    // Listen for viewport changes
    this._viewport.on('moved', () => this._emitChange());
    this._viewport.on('zoomed', () => this._emitChange());

    return this._viewport;
  }

  /**
    * Set the viewport position and zoom programmatically.
    */
  setViewport(state: Partial<ViewportState>): void {
    if (!this._viewport || this._destroyed) return;

    if (state.panX !== undefined) this._viewport.x = state.panX;
    if (state.panY !== undefined) this._viewport.y = state.panY;
    if (state.zoom !== undefined) {
      this._viewport.scale.set(state.zoom, state.zoom);
    }
  }

  /**
   * Center the viewport on a specific world position.
   */
  centerOn(x: number, y: number, zoom?: number): void {
    if (!this._viewport || this._destroyed) return;
    this._viewport.moveCenter(x, y);
    if (zoom !== undefined) {
      this._viewport.scale.set(zoom, zoom);
    }
  }

  /**
   * Fit the viewport to show a specific world area.
   */
  fitBounds(bounds: ViewportBounds, padding: number = 50): void {
    if (!this._viewport || this._destroyed) return;

    const worldWidth = bounds.maxX - bounds.minX + padding * 2;
    const worldHeight = bounds.maxY - bounds.minY + padding * 2;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const scaleX = this._viewport.screenWidth / worldWidth;
    const scaleY = this._viewport.screenHeight / worldHeight;
    const scale = Math.min(scaleX, scaleY);

    const clampedScale = Math.max(
      this._config?.minZoom ?? 0.05,
      Math.min(this._config?.maxZoom ?? 10, scale)
    );

    this._viewport.scale.set(clampedScale, clampedScale);
    this._viewport.moveCenter(centerX, centerY);
  }

  /**
   * Update screen size (e.g., after container resize).
   */
  resize(screenWidth: number, screenHeight: number): void {
    if (!this._viewport || this._destroyed) return;
    this._viewport.resize(screenWidth, screenHeight);
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._viewport) {
      this._viewport.removeAllListeners();
      this._viewport.destroy({ children: true });
      this._viewport = null;
    }

    this._onViewportChange = null;
    this._config = null;
  }

  private _emitChange(): void {
    if (this._onViewportChange && this._viewport && !this._destroyed) {
      this._onViewportChange(this.state);
    }
  }
}
