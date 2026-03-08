/**
 * LadderSyncEngine
 *
 * Synchronizes the Zustand store state (elements, wires, grid config, selection)
 * with the Pixi.js rendering layer.
 *
 * Responsibilities:
 * - Initial full render from store snapshot
 * - Incremental updates (add/remove/update elements)
 * - Grid/rail re-render on config change
 * - Selection visual sync
 */

import type { Container } from 'pixi.js';
import type { LadderLayerManager } from './LadderLayerManager';
import type {
  LadderElement,
  LadderWire,
  LadderGridConfig,
  WireElement,
} from '../../../types/ladder';
import { isWireType } from '../../../types/ladder';
import { LadderGridRenderer } from './renderers/LadderGridRenderer';
import { LadderRailRenderer } from './renderers/LadderRailRenderer';
import { LadderWireRenderer } from './renderers/LadderWireRenderer';
import { LadderSelectionRenderer } from './renderers/LadderSelectionRenderer';
import { LadderElementFactory } from './renderers/LadderElementFactory';
import { LadderMonitoringRenderer } from './renderers/LadderMonitoringRenderer';
import type { LadderMonitoringState } from '../../../types/ladder';

/** Default grid config fallback */
const DEFAULT_CONFIG: LadderGridConfig = {
  columns: 10,
  cellWidth: 80,
  cellHeight: 60,
  showGridLines: true,
  snapToGrid: true,
};

export class LadderSyncEngine {
  private layers: LadderLayerManager;
  private gridRenderer: LadderGridRenderer;
  private railRenderer: LadderRailRenderer;
  private wireRenderer: LadderWireRenderer;
  private selectionRenderer: LadderSelectionRenderer;
  private elementFactory: LadderElementFactory;
  private monitoringRenderer: LadderMonitoringRenderer;

  /** Map of element id → Pixi Container for fast lookup */
  private elementContainers = new Map<string, Container>();
  /** Map of wire element id → Pixi Container */
  private wireContainers = new Map<string, Container>();

  private currentConfig: LadderGridConfig = DEFAULT_CONFIG;
  private currentRowCount = 20;

  constructor(layers: LadderLayerManager) {
    this.layers = layers;
    this.gridRenderer = new LadderGridRenderer(layers.gridLayer);
    this.railRenderer = new LadderRailRenderer(layers.railLayer);
    this.wireRenderer = new LadderWireRenderer();
    this.selectionRenderer = new LadderSelectionRenderer(layers.selectionLayer);
    this.elementFactory = new LadderElementFactory();
    this.monitoringRenderer = new LadderMonitoringRenderer(layers.overlayLayer);
  }

  // ===========================================================================
  // Full Sync
  // ===========================================================================

  /**
   * Perform a full sync — clears and re-renders everything from a store snapshot.
   */
  fullSync(
    elements: Map<string, LadderElement>,
    _wires: LadderWire[],
    config: LadderGridConfig,
    selectedIds: Set<string>,
  ): void {
    this.currentConfig = config;

    // Determine row count from elements
    let maxRow = 20;
    for (const el of elements.values()) {
      if (el.position.row + 1 > maxRow) {
        maxRow = el.position.row + 1;
      }
    }
    // Add some buffer rows
    this.currentRowCount = maxRow + 5;

    // 1. Grid
    this.gridRenderer.render(config, this.currentRowCount);

    // 2. Rails
    this.railRenderer.render(
      config.columns,
      config.cellWidth,
      config.cellHeight,
      this.currentRowCount,
    );

    // 3. Clear existing element/wire containers
    this.clearElements();
    this.clearWires();

    // 4. Render logic elements
    for (const element of elements.values()) {
      if (isWireType(element.type)) {
        this.addWireContainer(element as WireElement);
      } else {
        this.addElementContainer(element);
      }
    }

    // 5. Selection
    this.syncSelection(selectedIds, config);
  }

  // ===========================================================================
  // Incremental Operations
  // ===========================================================================

  /**
   * Add a single element to the canvas.
   */
  addElement(element: LadderElement): void {
    if (isWireType(element.type)) {
      this.addWireContainer(element as WireElement);
    } else {
      this.addElementContainer(element);
    }
  }

  /**
   * Remove an element from the canvas by id.
   */
  removeElement(id: string): void {
    const elContainer = this.elementContainers.get(id);
    if (elContainer) {
      elContainer.destroy({ children: true });
      this.elementContainers.delete(id);
      return;
    }

    const wireContainer = this.wireContainers.get(id);
    if (wireContainer) {
      wireContainer.destroy({ children: true });
      this.wireContainers.delete(id);
    }
  }

  /**
   * Update an existing element's visual.
   */
  updateElement(element: LadderElement): void {
    if (isWireType(element.type)) {
      const container = this.wireContainers.get(element.id);
      if (container) {
        this.wireRenderer.update(container, element as WireElement);
      }
    } else {
      const container = this.elementContainers.get(element.id);
      if (container) {
        this.elementFactory.updateElement(container, element);
        // Update position
        container.position.set(
          element.position.col * this.currentConfig.cellWidth,
          element.position.row * this.currentConfig.cellHeight,
        );
      }
    }
  }

  /**
   * Sync selection highlights.
   */
  syncSelection(
    selectedIds: Set<string>,
    config?: LadderGridConfig,
  ): void {
    const cfg = config ?? this.currentConfig;
    const cells: Array<{ row: number; col: number }> = [];

    // Find grid positions for selected elements
    for (const id of selectedIds) {
      const container = this.elementContainers.get(id);
      if (container) {
        cells.push({
          row: Math.round(container.position.y / cfg.cellHeight),
          col: Math.round(container.position.x / cfg.cellWidth),
        });
      }
    }

    this.selectionRenderer.renderSelection(cells, cfg.cellWidth, cfg.cellHeight);
  }

  /**
   * Update grid config (e.g., column count changed).
   */
  updateGridConfig(config: LadderGridConfig): void {
    this.currentConfig = config;
    this.gridRenderer.render(config, this.currentRowCount);
    this.railRenderer.render(
      config.columns,
      config.cellWidth,
      config.cellHeight,
      this.currentRowCount,
    );
  }

  // ===========================================================================
  // Overlay / Cursor helpers
  // ===========================================================================

  /**
   * Get the overlay layer for temporary visuals (cursor cell, wire preview, etc.)
   */
  get overlayLayer(): Container {
    return this.layers.overlayLayer;
  }

  /**
   * Get element containers for monitoring renderer.
   */
  getElementContainers(): Map<string, Container> {
    return this.elementContainers;
  }

  /**
   * Get wire containers for monitoring renderer.
   */
  getWireContainers(): Map<string, Container> {
    return this.wireContainers;
  }

  /**
   * Apply monitoring visualization overlays.
   */
  applyMonitoring(
    monitoringState: LadderMonitoringState,
    elements: Map<string, LadderElement>,
  ): void {
    this.monitoringRenderer.applyMonitoring(
      this.elementContainers,
      this.wireContainers,
      monitoringState,
      this.currentConfig,
      elements as Map<string, { id: string; position: { row: number; col: number }; properties?: { address?: string } }>,
    );
  }

  /**
   * Clear monitoring visualization overlays.
   */
  clearMonitoring(): void {
    this.monitoringRenderer.clearMonitoring(
      this.elementContainers,
      this.wireContainers,
    );
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private addElementContainer(element: LadderElement): void {
    const container = this.elementFactory.createElement(
      element,
      this.currentConfig.cellWidth,
      this.currentConfig.cellHeight,
    );
    if (container) {
      this.layers.elementLayer.addChild(container);
      this.elementContainers.set(element.id, container);
    }
  }

  private addWireContainer(element: WireElement): void {
    const container = this.wireRenderer.create(
      element,
      this.currentConfig.cellWidth,
      this.currentConfig.cellHeight,
    );
    this.layers.wireLayer.addChild(container);
    this.wireContainers.set(element.id, container);
  }

  private clearElements(): void {
    for (const container of this.elementContainers.values()) {
      container.destroy({ children: true });
    }
    this.elementContainers.clear();
  }

  private clearWires(): void {
    for (const container of this.wireContainers.values()) {
      container.destroy({ children: true });
    }
    this.wireContainers.clear();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  destroy(): void {
    this.clearElements();
    this.clearWires();
    this.gridRenderer.destroy();
    this.railRenderer.destroy();
    this.wireRenderer.destroy();
    this.selectionRenderer.destroy();
    this.elementFactory.destroy();
    this.monitoringRenderer.destroy();
  }
}
