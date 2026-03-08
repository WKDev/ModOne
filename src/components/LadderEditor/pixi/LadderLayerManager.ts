import { Container } from 'pixi.js';

/**
 * LadderLayerManager
 * Manages a 6-layer Container hierarchy for the Ladder Editor.
 * Layers are ordered from bottom to top (z-order).
 */
export interface LadderLayerManager {
  /** Background grid lines and cell markers */
  gridLayer: Container;
  /** Power rail (left) and neutral rail (right) vertical lines */
  railLayer: Container;
  /** Wire connections between elements */
  wireLayer: Container;
  /** Contacts, coils, timers, counters, comparisons */
  elementLayer: Container;
  /** Selection highlights and rubber-band selection box */
  selectionLayer: Container;
  /** Temporary UI overlays (wire preview, hover, drag ghost, cursor cell) */
  overlayLayer: Container;
  /** Destroy all layers and remove from parent */
  destroy(): void;
}

/**
 * Factory function to create a LadderLayerManager.
 * Creates 6 Container instances, adds them to the parent in z-order,
 * and returns an object satisfying the LadderLayerManager interface.
 *
 * @param parent - The parent Container (typically a pixi-viewport Viewport)
 * @returns A LadderLayerManager object with all 6 layers
 */
export function createLadderLayerManager(parent: Container): LadderLayerManager {
  // Create all 6 layers in z-order (bottom to top)
  const gridLayer = new Container();
  gridLayer.label = 'gridLayer';

  const railLayer = new Container();
  railLayer.label = 'railLayer';

  const wireLayer = new Container();
  wireLayer.label = 'wireLayer';

  const elementLayer = new Container();
  elementLayer.label = 'elementLayer';

  const selectionLayer = new Container();
  selectionLayer.label = 'selectionLayer';

  const overlayLayer = new Container();
  overlayLayer.label = 'overlayLayer';

  // Add all layers to parent in z-order
  parent.addChild(gridLayer);
  parent.addChild(railLayer);
  parent.addChild(wireLayer);
  parent.addChild(elementLayer);
  parent.addChild(selectionLayer);
  parent.addChild(overlayLayer);

  // Return the manager object
  return {
    gridLayer,
    railLayer,
    wireLayer,
    elementLayer,
    selectionLayer,
    overlayLayer,
    destroy() {
      // Destroy each layer with its children
      gridLayer.destroy({ children: true });
      railLayer.destroy({ children: true });
      wireLayer.destroy({ children: true });
      elementLayer.destroy({ children: true });
      selectionLayer.destroy({ children: true });
      overlayLayer.destroy({ children: true });
    },
  };
}
