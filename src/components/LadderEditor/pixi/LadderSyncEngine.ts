import type { Container } from 'pixi.js';
import type { LadderLayerManager } from './LadderLayerManager';
import type {
  DerivedTopology,
  HorizontalEdgeEntity,
  LadderElement,
  LadderGridConfig,
  LadderMonitoringState,
  VerticalEdgeEntity,
} from '../../../types/ladder';
import { LadderGridRenderer } from './renderers/LadderGridRenderer';
import { LadderRailRenderer } from './renderers/LadderRailRenderer';
import { LadderWireRenderer } from './renderers/LadderWireRenderer';
import { LadderSelectionRenderer } from './renderers/LadderSelectionRenderer';
import { LadderElementFactory } from './renderers/LadderElementFactory';
import { LadderMonitoringRenderer } from './renderers/LadderMonitoringRenderer';

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

  private elementContainers = new Map<string, Container>();
  private edgeContainers = new Map<string, Container>();

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

  fullSync(
    elements: Map<string, LadderElement>,
    horizontalEdges: Map<string, HorizontalEdgeEntity>,
    verticalEdges: Map<string, VerticalEdgeEntity>,
    topology: DerivedTopology | undefined,
    config: LadderGridConfig,
    selectedIds: Set<string>,
    cursorCell?: { row: number; col: number } | null,
  ): void {
    this.currentConfig = config;
    this.currentRowCount = this.computeRowCount(elements, horizontalEdges, verticalEdges);

    this.gridRenderer.render(config, this.currentRowCount);
    this.railRenderer.render(
      config.columns,
      config.cellWidth,
      config.cellHeight,
      this.currentRowCount,
    );

    this.clearElements();
    this.clearEdges();

    for (const element of elements.values()) {
      this.addElementContainer(element);
    }
    for (const edge of horizontalEdges.values()) {
      this.addHorizontalEdgeContainer(edge);
    }
    for (const edge of verticalEdges.values()) {
      this.addVerticalEdgeContainer(edge);
    }

    this.syncSelection(selectedIds, cursorCell, config, elements, horizontalEdges, verticalEdges, topology);
  }

  syncSelection(
    selectedIds: Set<string>,
    cursorCell: { row: number; col: number } | null | undefined,
    config: LadderGridConfig,
    elements: Map<string, LadderElement>,
    horizontalEdges: Map<string, HorizontalEdgeEntity>,
    verticalEdges: Map<string, VerticalEdgeEntity>,
    topology?: DerivedTopology,
  ): void {
    const selectedCells: Array<{ row: number; col: number }> = [];
    const selectedHorizontalEdges: Array<{ row: number; startBoundaryCol: number; endBoundaryCol: number }> = [];
    const selectedVerticalEdges: Array<{ row: number; col: number }> = [];

    for (const id of selectedIds) {
      const element = elements.get(id);
      if (element) {
        selectedCells.push({ row: element.position.row, col: element.position.col });
        continue;
      }

      const horizontalEdge = horizontalEdges.get(id);
      if (horizontalEdge) {
        selectedHorizontalEdges.push({
          row: horizontalEdge.position.row,
          startBoundaryCol: horizontalEdge.position.startBoundaryCol,
          endBoundaryCol: horizontalEdge.position.endBoundaryCol,
        });
        continue;
      }

      const verticalEdge = verticalEdges.get(id);
      if (verticalEdge) {
        selectedVerticalEdges.push({
          row: verticalEdge.position.row,
          col: verticalEdge.position.col,
        });
        continue;
      }

      const chain = topology?.verticalChains.find((item) => item.id === id);
      if (chain) {
        for (const edgeId of chain.edgeIds) {
          const verticalChainEdge = verticalEdges.get(edgeId);
          if (verticalChainEdge) {
            selectedVerticalEdges.push({
              row: verticalChainEdge.position.row,
              col: verticalChainEdge.position.col,
            });
          }
        }
      }
    }

    this.selectionRenderer.renderSelection(
      selectedCells,
      selectedHorizontalEdges,
      selectedVerticalEdges,
      cursorCell ?? null,
      config.cellWidth,
      config.cellHeight,
    );
  }

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

  get overlayLayer(): Container {
    return this.layers.overlayLayer;
  }

  /** Public access to selection renderer for rubber-band drag-select */
  get selection(): LadderSelectionRenderer {
    return this.selectionRenderer;
  }

  getElementContainers(): Map<string, Container> {
    return this.elementContainers;
  }

  getWireContainers(): Map<string, Container> {
    return this.edgeContainers;
  }

  applyMonitoring(
    monitoringState: LadderMonitoringState,
    elements: Map<string, LadderElement>,
  ): void {
    this.monitoringRenderer.applyMonitoring(
      this.elementContainers,
      this.edgeContainers,
      monitoringState,
      this.currentConfig,
      elements as Map<string, { id: string; position: { row: number; col: number }; properties?: { address?: string } }>,
    );
  }

  clearMonitoring(): void {
    this.monitoringRenderer.clearMonitoring(
      this.elementContainers,
      this.edgeContainers,
    );
  }

  destroy(): void {
    this.clearElements();
    this.clearEdges();
    this.gridRenderer.destroy();
    this.railRenderer.destroy();
    this.wireRenderer.destroy();
    this.selectionRenderer.destroy();
    this.elementFactory.destroy();
    this.monitoringRenderer.destroy();
  }

  private computeRowCount(
    elements: Map<string, LadderElement>,
    horizontalEdges: Map<string, HorizontalEdgeEntity>,
    verticalEdges: Map<string, VerticalEdgeEntity>,
  ): number {
    let maxRow = 20;
    for (const element of elements.values()) {
      maxRow = Math.max(maxRow, element.position.row + 1);
    }
    for (const edge of horizontalEdges.values()) {
      maxRow = Math.max(maxRow, edge.position.row + 1);
    }
    for (const edge of verticalEdges.values()) {
      maxRow = Math.max(maxRow, edge.position.row + 2);
    }
    return maxRow + 5;
  }

  private addElementContainer(element: LadderElement): void {
    const container = this.elementFactory.createElement(
      element,
      this.currentConfig.cellWidth,
      this.currentConfig.cellHeight,
    );
    if (!container) return;
    this.layers.elementLayer.addChild(container);
    this.elementContainers.set(element.id, container);
  }

  private addHorizontalEdgeContainer(edge: HorizontalEdgeEntity): void {
    const container = this.wireRenderer.createHorizontal(edge, this.currentConfig.cellWidth, this.currentConfig.cellHeight);
    this.layers.wireLayer.addChild(container);
    this.edgeContainers.set(edge.id, container);
  }

  private addVerticalEdgeContainer(edge: VerticalEdgeEntity): void {
    const container = this.wireRenderer.createVertical(edge, this.currentConfig.cellWidth, this.currentConfig.cellHeight);
    this.layers.wireLayer.addChild(container);
    this.edgeContainers.set(edge.id, container);
  }

  private clearElements(): void {
    for (const container of this.elementContainers.values()) {
      container.destroy({ children: true });
    }
    this.elementContainers.clear();
  }

  private clearEdges(): void {
    for (const container of this.edgeContainers.values()) {
      container.destroy({ children: true });
    }
    this.edgeContainers.clear();
  }
}
