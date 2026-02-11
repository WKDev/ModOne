import { useEffect, useRef } from 'react';
import type { CanvasFacadeReturn } from '../../../types/canvasFacade';
import type { CanvasInteractionAdapter } from './types';
import { SpatialIndex } from '../utils/SpatialIndex';

export function useCanvasAdapter(
  facade: CanvasFacadeReturn,
  containerRef: React.RefObject<HTMLDivElement | null>
): React.RefObject<CanvasInteractionAdapter> {
  const spatialIndexRef = useRef(new SpatialIndex());
  const adapterRef = useRef<CanvasInteractionAdapter>(null!);

  // Rebuild spatial index when data changes
  useEffect(() => {
    spatialIndexRef.current.rebuild(facade.components, facade.wires, facade.junctions);
  }, [facade.components, facade.wires, facade.junctions]);

  // Update adapter on every render — ref is stable, contents always current
  adapterRef.current = {
    getComponents: () => facade.components,
    getWires: () => facade.wires,
    getJunctions: () => facade.junctions,
    getSelectedIds: () => facade.selectedIds,
    getZoom: () => facade.zoom,
    getPan: () => facade.pan,
    getGridSize: () => facade.gridSize,
    getSnapToGrid: () => facade.snapToGrid,
    getContainerRect: () => containerRef.current?.getBoundingClientRect() ?? null,

    setSelection: facade.setSelection,
    addToSelection: facade.addToSelection,
    clearSelection: facade.clearSelection,
    setPan: facade.setPan,
    setZoom: facade.setZoom,

    moveComponent: facade.moveComponent,
    moveJunction: facade.moveJunction,
    addWire: facade.addWire,
    createJunctionOnWire: facade.createJunctionOnWire,
    moveWireSegment: facade.moveWireSegment,
    updateWireHandle: facade.updateWireHandle,
    cleanupOverlappingHandles: facade.cleanupOverlappingHandles,

    queryPoint: (pos, margin) => spatialIndexRef.current.queryPoint(pos, margin),
    queryBox: (bounds) => spatialIndexRef.current.queryBox(bounds),
  };

  return adapterRef;
}
