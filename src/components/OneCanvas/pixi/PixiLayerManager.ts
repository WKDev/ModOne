import { Container } from 'pixi.js';

/**
 * PixiLayerManager
 * Manages a 7-layer Container hierarchy for the Pixi.js canvas.
 * Layers are ordered from bottom to top (z-order).
 */
export interface PixiLayerManager {
  /** Background grid lines */
  gridLayer: Container;
  /** Wire paths */
  wireLayer: Container;
  /** Junction dots */
  junctionLayer: Container;
  /** Schematic blocks */
  blockLayer: Container;
  /** Port connection points */
  portLayer: Container;
  /** Selection highlights and selection box */
  selectionLayer: Container;
  /** Temporary UI overlays (wire preview, hover, etc.) */
  overlayLayer: Container;
  /** Destroy all layers and remove from parent */
  destroy(): void;
}

/**
 * Factory function to create a PixiLayerManager.
 * Creates 7 Container instances, adds them to the parent in z-order,
 * and returns an object satisfying the PixiLayerManager interface.
 *
 * @param parent - The parent Container (typically a pixi-viewport Viewport)
 * @returns A PixiLayerManager object with all 7 layers
 */
export function createLayerManager(parent: Container): PixiLayerManager {
  // Create all 7 layers in z-order (bottom to top)
  const gridLayer = new Container();
  gridLayer.label = 'gridLayer';

  const wireLayer = new Container();
  wireLayer.label = 'wireLayer';

  const junctionLayer = new Container();
  junctionLayer.label = 'junctionLayer';

  const blockLayer = new Container();
  blockLayer.label = 'blockLayer';

  const portLayer = new Container();
  portLayer.label = 'portLayer';

  const selectionLayer = new Container();
  selectionLayer.label = 'selectionLayer';

  const overlayLayer = new Container();
  overlayLayer.label = 'overlayLayer';

  // Add all layers to parent in z-order
  parent.addChild(gridLayer);
  parent.addChild(wireLayer);
  parent.addChild(junctionLayer);
  parent.addChild(blockLayer);
  parent.addChild(portLayer);
  parent.addChild(selectionLayer);
  parent.addChild(overlayLayer);

  // Return the manager object
  return {
    gridLayer,
    wireLayer,
    junctionLayer,
    blockLayer,
    portLayer,
    selectionLayer,
    overlayLayer,
    destroy() {
      // Destroy each layer with its children
      gridLayer.destroy({ children: true });
      wireLayer.destroy({ children: true });
      junctionLayer.destroy({ children: true });
      blockLayer.destroy({ children: true });
      portLayer.destroy({ children: true });
      selectionLayer.destroy({ children: true });
      overlayLayer.destroy({ children: true });
    },
  };
}
