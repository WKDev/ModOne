/**
 * PixiApplication — Pixi.js v8 Application Wrapper
 *
 * Manages the lifecycle of the Pixi.js Application instance.
 * Creates the GPU-accelerated canvas, manages the rendering loop,
 * and provides the root stage for the layer system.
 */

import { Application, Container } from 'pixi.js';
import type { CanvasConfig } from '../types';
import { DEFAULT_CANVAS_CONFIG } from '../types';

export interface PixiApplicationOptions {
  /** HTML container element to attach the canvas to */
  container: HTMLElement;
  /** Canvas configuration */
  config?: Partial<CanvasConfig>;
  /** Device pixel ratio override (defaults to window.devicePixelRatio) */
  resolution?: number;
}

/**
 * Wrapper around Pixi.js v8 Application.
 *
 * Usage:
 * ```ts
 * const pixiApp = new PixiApplication();
 * await pixiApp.init({ container: document.getElementById('canvas')! });
 * // ... use pixiApp.app and pixiApp.stage
 * pixiApp.destroy();
 * ```
 */
export class PixiApplication {
  private _app: Application | null = null;
  private _container: HTMLElement | null = null;
  private _config: CanvasConfig = DEFAULT_CANVAS_CONFIG;
  private _resizeObserver: ResizeObserver | null = null;
  private _destroyed = false;

  /** The underlying Pixi.js Application (null until init) */
  get app(): Application {
    if (!this._app) throw new Error('PixiApplication not initialized. Call init() first.');
    return this._app;
  }

  /** The root stage container */
  get stage(): Container {
    return this.app.stage;
  }

  /** The canvas element */
  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  /** Current canvas width in CSS pixels */
  get width(): number {
    return this._container?.clientWidth ?? 0;
  }

  /** Current canvas height in CSS pixels */
  get height(): number {
    return this._container?.clientHeight ?? 0;
  }

  /** Whether the application has been initialized */
  get initialized(): boolean {
    return this._app !== null && !this._destroyed;
  }

  /** Current configuration */
  get config(): CanvasConfig {
    return this._config;
  }

  /**
   * Initialize the Pixi.js application.
   * Must be called exactly once before using any other methods.
   */
  async init(options: PixiApplicationOptions): Promise<void> {
    if (this._app) {
      throw new Error('PixiApplication already initialized');
    }

    this._container = options.container;
    this._config = { ...DEFAULT_CANVAS_CONFIG, ...options.config };

    const resolution = options.resolution ?? window.devicePixelRatio ?? 1;

    // Create Pixi v8 Application with async init
    this._app = new Application();
    await this._app.init({
      width: this._container.clientWidth,
      height: this._container.clientHeight,
      resolution,
      autoDensity: true,
      antialias: true,
      backgroundColor: this._config.backgroundColor,
      // Prefer WebGL2 for broad compatibility, WebGPU when available
      preference: 'webgl',
      powerPreference: 'high-performance',
    });

    // Enable sortable children for z-index based layer ordering
    this._app.stage.sortableChildren = true;

    // Append canvas to container
    this._container.appendChild(this._app.canvas as HTMLCanvasElement);

    // Auto-resize when container size changes
    this._resizeObserver = new ResizeObserver((entries) => {
      if (this._destroyed || !this._app) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this._app.renderer.resize(width, height);
        }
      }
    });
    this._resizeObserver.observe(this._container);
  }

  /**
   * Manually trigger a resize to match container dimensions.
   */
  resize(): void {
    if (!this._app || !this._container || this._destroyed) return;
    const { clientWidth, clientHeight } = this._container;
    if (clientWidth > 0 && clientHeight > 0) {
      this._app.renderer.resize(clientWidth, clientHeight);
    }
  }

  /**
   * Clean up all resources.
   * After calling this, the instance cannot be reused.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Stop observing resize
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Remove canvas from DOM
    if (this._app && this._container) {
      const canvas = this._app.canvas as HTMLCanvasElement;
      if (canvas.parentElement === this._container) {
        this._container.removeChild(canvas);
      }
    }

    // Destroy Pixi application and all children
    if (this._app) {
      this._app.destroy(true, { children: true, texture: true });
      this._app = null;
    }

    this._container = null;
  }
}
