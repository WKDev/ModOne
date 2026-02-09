import { useMemo } from 'react';
import { useCanvasStore } from '../../../../stores/canvasStore';
import { useCanvasDocument } from '../../../../stores/hooks/useCanvasDocument';

export function useCanvasState(documentId: string | null) {
  const documentState = useCanvasDocument(documentId);

  const globalComponents = useCanvasStore((state) => state.components);
  const globalJunctions = useCanvasStore((state) => state.junctions);
  const globalWires = useCanvasStore((state) => state.wires);
  const globalZoom = useCanvasStore((state) => state.zoom);
  const globalPan = useCanvasStore((state) => state.pan);
  const globalAddComponent = useCanvasStore((state) => state.addComponent);
  const globalAddWire = useCanvasStore((state) => state.addWire);
  const globalMoveComponent = useCanvasStore((state) => state.moveComponent);
  const globalRemoveWire = useCanvasStore((state) => state.removeWire);
  const globalMoveJunction = useCanvasStore((state) => state.moveJunction);
  const globalUpdateWireHandle = useCanvasStore((state) => state.updateWireHandle);
  const globalRemoveWireHandle = useCanvasStore((state) => state.removeWireHandle);
  const globalMoveWireSegment = useCanvasStore((state) => state.moveWireSegment);
  const globalInsertEndpointHandle = useCanvasStore((state) => state.insertEndpointHandle);
  const globalCleanupOverlappingHandles = useCanvasStore((state) => state.cleanupOverlappingHandles);
  const globalUpdateComponent = useCanvasStore((state) => state.updateComponent);

  const wireDrawing = useCanvasStore((state) => state.wireDrawing);
  const startWireDrawing = useCanvasStore((state) => state.startWireDrawing);
  const updateWireDrawing = useCanvasStore((state) => state.updateWireDrawing);
  const cancelWireDrawing = useCanvasStore((state) => state.cancelWireDrawing);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const setPan = useCanvasStore((state) => state.setPan);
  const alignSelected = useCanvasStore((state) => state.alignSelected);
  const distributeSelected = useCanvasStore((state) => state.distributeSelected);
  const flipSelected = useCanvasStore((state) => state.flipSelected);

  return useMemo(() => {
    if (documentState) {
      return {
        components: documentState.components,
        junctions: documentState.junctions,
        wires: documentState.wires,
        zoom: documentState.zoom,
        pan: documentState.pan,
        addComponent: documentState.addComponent,
        addWire: documentState.addWire,
        moveComponent: documentState.moveComponent,
        moveJunction: documentState.moveJunction,
        removeWire: documentState.removeWire,
        updateComponent: documentState.updateComponent,
        updateWireHandle: documentState.updateWireHandle,
        removeWireHandle: documentState.removeWireHandle,
        moveWireSegment: documentState.moveWireSegment,
        insertEndpointHandle: documentState.insertEndpointHandle,
        cleanupOverlappingHandles: documentState.cleanupOverlappingHandles,
        wireDrawing,
        startWireDrawing,
        updateWireDrawing,
        cancelWireDrawing,
        selectedIds,
        setPan,
        alignSelected,
        distributeSelected,
        flipSelected,
        isDocumentMode: true,
      };
    }

    return {
      components: globalComponents,
      junctions: globalJunctions,
      wires: globalWires,
      zoom: globalZoom,
      pan: globalPan,
      addComponent: globalAddComponent,
      addWire: globalAddWire,
      moveComponent: globalMoveComponent,
      moveJunction: globalMoveJunction,
      removeWire: globalRemoveWire,
      updateComponent: globalUpdateComponent,
      updateWireHandle: globalUpdateWireHandle,
      removeWireHandle: globalRemoveWireHandle,
      moveWireSegment: globalMoveWireSegment,
      insertEndpointHandle: globalInsertEndpointHandle,
      cleanupOverlappingHandles: globalCleanupOverlappingHandles,
      wireDrawing,
      startWireDrawing,
      updateWireDrawing,
      cancelWireDrawing,
      selectedIds,
      setPan,
      alignSelected,
      distributeSelected,
      flipSelected,
      isDocumentMode: false,
    };
  }, [
    documentState,
    globalComponents,
    globalJunctions,
    globalWires,
    globalZoom,
    globalPan,
    globalAddComponent,
    globalAddWire,
    globalMoveComponent,
    globalMoveJunction,
    globalRemoveWire,
    globalUpdateComponent,
    globalUpdateWireHandle,
    globalRemoveWireHandle,
    globalMoveWireSegment,
    globalInsertEndpointHandle,
    globalCleanupOverlappingHandles,
    wireDrawing,
    startWireDrawing,
    updateWireDrawing,
    cancelWireDrawing,
    selectedIds,
    setPan,
    alignSelected,
    distributeSelected,
    flipSelected,
  ]);
}
