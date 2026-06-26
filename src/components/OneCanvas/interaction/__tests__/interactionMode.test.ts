import { describe, expect, it, vi } from 'vitest';
import type { CanvasFacadeReturn } from '@/types/canvasFacade';
import type { HitTestResult, Position } from '../../types';
import { InteractionController, type InteractionVisuals, type Modifiers } from '../InteractionController';

function createVisuals(): InteractionVisuals {
  return {
    renderMarquee: vi.fn(),
    clearMarquee: vi.fn(),
    renderWirePreview: vi.fn(),
    clearWirePreview: vi.fn(),
    setPortsVisible: vi.fn(),
    showPortSnap: vi.fn(),
    hidePortSnap: vi.fn(),
    showGhost: vi.fn(),
    updateGhost: vi.fn(),
    hideGhost: vi.fn(),
    setHover: vi.fn(),
  };
}

function createFacade(): CanvasFacadeReturn {
  return {
    components: new Map(),
    junctions: new Map(),
    wires: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    addComponent: vi.fn(() => 'component-1'),
    moveComponent: vi.fn(),
    updateComponent: vi.fn(),
    removeComponent: vi.fn(),
    moveJunction: vi.fn(),
    addWire: vi.fn(() => 'wire-1'),
    removeWire: vi.fn(),
    createJunctionOnWire: vi.fn(() => null),
    updateWireHandle: vi.fn(),
    recalculateWireHandles: vi.fn(),
    removeWireHandle: vi.fn(),
    moveWireSegment: vi.fn(),
    dragWireSegment: vi.fn(() => null),
    insertEndpointHandle: vi.fn(),
    cleanupOverlappingHandles: vi.fn(),
    commitWirePolyline: vi.fn(),
    alignSelected: vi.fn(),
    distributeSelected: vi.fn(),
    flipSelected: vi.fn(),
    rotateSelected: vi.fn(),
    getCircuitData: vi.fn(),
    loadCircuit: vi.fn(),
    wireDrawing: null,
    startWireDrawing: vi.fn(),
    updateWireDrawing: vi.fn(),
    cancelWireDrawing: vi.fn(),
    selectedIds: new Set<string>(),
    setSelection: vi.fn(),
    addToSelection: vi.fn(),
    toggleSelection: vi.fn(),
    clearSelection: vi.fn(),
    setPan: vi.fn(),
    setZoom: vi.fn(),
    gridSize: 5,
    snapToGrid: true,
    showGrid: true,
    gridStyle: 'dots',
    gridUnit: 'mm',
    toggleGrid: vi.fn(),
    toggleSnap: vi.fn(),
    setGridSize: vi.fn(),
    setGridStyle: vi.fn(),
    setGridUnit: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    isDocumentMode: false,
    documentId: null,
  };
}

const DEFAULT_MODIFIERS: Modifiers = {
  ctrl: false,
  shift: false,
  alt: false,
  meta: false,
  space: false,
};

function makeBlockHit(id: string): HitTestResult {
  return {
    type: 'block',
    id,
    position: { x: 100, y: 100 },
    distance: 0,
  };
}

function makeNoneHit(): HitTestResult {
  return {
    type: 'none',
    id: '',
    position: { x: 0, y: 0 },
    distance: Infinity,
  };
}

describe('InteractionController interaction modes', () => {
  it('keeps block selection behavior in edit mode', () => {
    const facade = createFacade();
    const hitTester = {
      hitTest: vi.fn(() => makeBlockHit('block-1')),
      findNearestPort: vi.fn(() => null),
    };

    const controller = new InteractionController({
      hitTester: hitTester as never,
      spatialIndex: { size: 0, queryRect: vi.fn(() => []) } as never,
      visuals: createVisuals(),
      mode: 'edit',
    });
    controller.setFacade(facade);

    const pos: Position = { x: 100, y: 100 };
    controller.handlePointerDown(pos, pos, 0, DEFAULT_MODIFIERS);
    controller.handlePointerUp(pos, pos, 0, DEFAULT_MODIFIERS);

    expect(facade.setSelection).toHaveBeenCalledWith(['block-1']);
  });

  it('emits operate interactions without mutating edit selection in operate mode', () => {
    const facade = createFacade();
    const hitTester = {
      hitTest: vi
        .fn()
        .mockReturnValueOnce(makeBlockHit('switch-1'))
        .mockReturnValueOnce(makeBlockHit('switch-1')),
      findNearestPort: vi.fn(() => null),
    };
    const phases: Array<'press' | 'release' | 'click'> = [];

    const controller = new InteractionController({
      hitTester: hitTester as never,
      spatialIndex: { size: 0, queryRect: vi.fn(() => []) } as never,
      visuals: createVisuals(),
      mode: 'operate',
      onOperateBlockInteraction: (_id, phase) => {
        phases.push(phase);
      },
    });
    controller.setFacade(facade);

    const pos: Position = { x: 100, y: 100 };
    controller.handlePointerDown(pos, pos, 0, DEFAULT_MODIFIERS);
    controller.handlePointerUp(pos, pos, 0, DEFAULT_MODIFIERS);

    expect(phases).toEqual(['press', 'release', 'click']);
    expect(facade.setSelection).not.toHaveBeenCalled();
    expect(facade.addToSelection).not.toHaveBeenCalled();
    expect(facade.toggleSelection).not.toHaveBeenCalled();
  });

  it('does not emit click when pointer leaves the block before release in operate mode', () => {
    const facade = createFacade();
    const hitTester = {
      hitTest: vi
        .fn()
        .mockReturnValueOnce(makeBlockHit('switch-1'))
        .mockReturnValueOnce(makeNoneHit()),
      findNearestPort: vi.fn(() => null),
    };
    const phases: Array<'press' | 'release' | 'click'> = [];

    const controller = new InteractionController({
      hitTester: hitTester as never,
      spatialIndex: { size: 0, queryRect: vi.fn(() => []) } as never,
      visuals: createVisuals(),
      mode: 'operate',
      onOperateBlockInteraction: (_id, phase) => {
        phases.push(phase);
      },
    });
    controller.setFacade(facade);

    controller.handlePointerDown({ x: 100, y: 100 }, { x: 100, y: 100 }, 0, DEFAULT_MODIFIERS);
    controller.handlePointerMove({ x: 130, y: 100 }, { x: 130, y: 100 }, DEFAULT_MODIFIERS);
    controller.handlePointerUp({ x: 130, y: 100 }, { x: 130, y: 100 }, 0, DEFAULT_MODIFIERS);

    expect(phases).toEqual(['press', 'release']);
  });
});
