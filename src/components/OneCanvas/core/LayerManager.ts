/**
 * LayerManager — Rendering Layer Hierarchy
 *
 * Manages the z-ordered Container hierarchy within the viewport.
 * Each layer is a named Container with a fixed z-index for predictable
 * rendering order:
 *
 *   grid (0) → wires (10) → junctions (20) → blocks (30)
 *   → ports (40) → selection (50) → overlay (60) → debug (100)
 *
 * Renderers add their display objects to the appropriate layer container.
 */

import { Container } from 'pixi.js';
import type { LayerName, LayerConfig } from '../types';
import { DEFAULT_LAYERS } from '../types';

/**
 * Manages named rendering layers as Pixi.js Containers.
 *
 * Layers are created once during initialization and remain for the
 * lifetime of the canvas. Renderers reference layers by name.
 */
export class LayerManager {
  private _layers: Map<LayerName, Container> = new Map();
  private _destroyed = false;
  /** Get a layer container by name */
  getLayer(name: LayerName): Container {
    const layer = this._layers.get(name);
    if (!layer) throw new Error(`Layer "${name}" not found`);
    return layer;
  }

  /** Check if a layer exists */
  hasLayer(name: LayerName): boolean {
    return this._layers.has(name);
  }

  /** Get all layer names */
  get layerNames(): LayerName[] {
    return Array.from(this._layers.keys());
  }

  /**
   * Create all layers and add them to the parent container.
   * The parent is typically the Viewport container.
   */
  init(parent: Container, layerConfigs?: readonly LayerConfig[]): void {
    if (this._layers.size > 0) {
      throw new Error('LayerManager already initialized');
    }

    const configs = layerConfigs ?? DEFAULT_LAYERS;

    for (const config of configs) {
      const container = new Container();
      container.label = `layer-${config.name}`;
      container.zIndex = config.zIndex;
      container.visible = config.visible ?? true;
      container.interactive = config.interactive ?? false;
      container.interactiveChildren = config.interactive;
      // Enable sortable children within each layer for sub-ordering
      container.sortableChildren = true;

      this._layers.set(config.name, container);
      parent.addChild(container);
    }
  }

  /**
   * Set visibility of a specific layer.
   */
  setLayerVisible(name: LayerName, visible: boolean): void {
    const layer = this._layers.get(name);
    if (layer) {
      layer.visible = visible;
    }
  }

  /**
   * Set interactivity of a specific layer.
   */
  setLayerInteractive(name: LayerName, interactive: boolean): void {
    const layer = this._layers.get(name);
    if (layer) {
      layer.interactive = interactive;
      layer.interactiveChildren = interactive;
    }
  }

  /**
   * Remove all display objects from a specific layer.
   */
  clearLayer(name: LayerName): void {
    const layer = this._layers.get(name);
    if (layer) {
      layer.removeChildren();
    }
  }

  /**
   * Remove all display objects from all layers.
   */
  clearAll(): void {
    for (const layer of this._layers.values()) {
      layer.removeChildren();
    }
  }

  /**
   * Clean up all layers and remove from parent.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const layer of this._layers.values()) {
      layer.removeChildren();
      layer.destroy({ children: true });
    }
    this._layers.clear();
  }
}
