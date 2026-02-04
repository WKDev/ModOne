/**
 * OneCanvas Component
 *
 * Circuit simulation canvas for placing and connecting electronic components.
 */

// Types
export * from './types';

// Components
export { Canvas } from './Canvas';
export type { CanvasRef } from './Canvas';
export { GridBackground } from './GridBackground';

// Block Components (named to avoid conflicts with types)
export { Port as PortComponent } from './components/Port';
export { BlockRenderer } from './components/BlockRenderer';
export { BlockWrapper } from './components/blocks/BlockWrapper';
export { PowerBlock as PowerBlockComponent } from './components/blocks/PowerBlock';
export { LedBlock as LedBlockComponent } from './components/blocks/LedBlock';
export { PlcOutBlock as PlcOutBlockComponent } from './components/blocks/PlcOutBlock';
export { PlcInBlock as PlcInBlockComponent } from './components/blocks/PlcInBlock';
export { ButtonBlock as ButtonBlockComponent } from './components/blocks/ButtonBlock';
export { ScopeBlock as ScopeBlockComponent } from './components/blocks/ScopeBlock';

// Toolbox and Drag/Drop
export { Toolbox } from './Toolbox';
export { CanvasDropZone } from './CanvasDropZone';
export { BlockDragOverlay } from './DragOverlay';
export { DraggableBlock } from './components/DraggableBlock';

// Wire Components
export { Wire, WirePreview } from './Wire';
export type { WireType } from './Wire';
export { AnimatedWire, wireAnimationStyles } from './components/AnimatedWire';
export { WireHandle } from './components/WireHandle';
export { WireContextMenu } from './components/WireContextMenu';
export type { WireContextMenuAction } from './components/WireContextMenu';

// Hooks
export { useCanvasInteraction } from './hooks/useCanvasInteraction';
export { useBlockDrag } from './hooks/useBlockDrag';
export { useDragDrop } from './hooks/useDragDrop';
export type { DragState } from './hooks/useDragDrop';
export { useWireDrawing } from './hooks/useWireDrawing';
export type { WireDrawingState } from './hooks/useWireDrawing';
export {
  usePlcOutBlock,
  usePlcInBlock,
  useCoilSubscription,
  useDiscreteSubscription,
} from './hooks/usePlcBlock';
export { useSimulation } from './hooks/useSimulation';
export type { UseSimulationReturn, UseSimulationOptions } from './hooks/useSimulation';
export { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts';
export { useSelectionHandler } from './hooks/useSelectionHandler';
export { useWireHandleDrag } from './hooks/useWireHandleDrag';

// Selection
export { SelectionBox, type SelectionBoxState, isPointInBox, doesRectIntersectBox } from './components/SelectionBox';

// Simulation UI
export { SimulationToolbar } from './SimulationToolbar';

// Utilities
export * from './utils';

// Styles (import in app entry point)
// import './styles/simulation.css';
