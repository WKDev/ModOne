import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useMachine, useSelector } from '@xstate/react';
import type { CanvasFacadeReturn } from '../../../types/canvasFacade';
import {
  interactionMachine,
  type CanvasEvent,
  type InteractionSnapshot,
  type Modifiers,
  type PointerTarget,
} from '../machines/interactionMachine';
import { useCanvasAdapter } from '../interaction/useCanvasAdapter';
import type { Block, Position } from '../types';

interface InteractionProviderProps {
  children: ReactNode;
  facade: CanvasFacadeReturn;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface InteractionApi {
  send: (event: CanvasEvent) => void;
  snapshot: InteractionSnapshot;
  cursor: string;
  selectionBox: { start: Position; end: Position } | null;
  wirePreview: { from: Position; to: Position } | null;
  isSpaceHeld: boolean;
  isDragging: boolean;
  isBoxSelecting: boolean;
  isWireDrawing: boolean;
  wireDraftPolys: ReadonlyMap<string, readonly Position[]>;
}

const InteractionContext = createContext<InteractionApi | null>(null);

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function getPortPosition(components: Map<string, Block>, blockId: string, portId: string): Position | null {
  const block = components.get(blockId);
  if (!block) {
    return null;
  }

  const port = block.ports.find((p) => p.id === portId);
  if (!port) {
    return null;
  }

  const offset = port.offset ?? 0.5;
  switch (port.position) {
    case 'top':
      return { x: block.position.x + block.size.width * offset, y: block.position.y };
    case 'bottom':
      return {
        x: block.position.x + block.size.width * offset,
        y: block.position.y + block.size.height,
      };
    case 'left':
      return { x: block.position.x, y: block.position.y + block.size.height * offset };
    case 'right':
      return {
        x: block.position.x + block.size.width,
        y: block.position.y + block.size.height * offset,
      };
    default:
      return {
        x: block.position.x + block.size.width / 2,
        y: block.position.y + block.size.height / 2,
      };
  }
}

function parseIntAttr(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFloatAttr(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolvePointerTarget(
  event: ReactMouseEvent,
  components: Map<string, Block>
): PointerTarget {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return { kind: 'canvas' };
  }

  const portNode = target.closest('[data-port-id]') as HTMLElement | null;
  if (portNode) {
    const portId = portNode.getAttribute('data-port-id');
    const blockId =
      portNode.getAttribute('data-block-id') ??
      portNode.closest('[data-block-id]')?.getAttribute('data-block-id');
    if (portId && blockId) {
      const portPosition = getPortPosition(components, blockId, portId);
      if (portPosition) {
        return {
          kind: 'port',
          blockId,
          portId,
          portPosition: components.get(blockId)?.ports.find((p) => p.id === portId)?.position ?? 'right',
        };
      }
    }
  }

  const blockNode = target.closest('[data-block-id]') as HTMLElement | null;
  if (blockNode) {
    const blockId = blockNode.getAttribute('data-block-id');
    if (blockId) {
      return { kind: 'block', blockId };
    }
  }

  const junctionNode = target.closest('[data-junction-id]') as HTMLElement | null;
  if (junctionNode) {
    const junctionId = junctionNode.getAttribute('data-junction-id');
    if (junctionId) {
      return { kind: 'junction', junctionId };
    }
  }

  // Wire handles and segments must be checked BEFORE the generic wire check,
  // because they live inside <g data-wire-id> and closest('[data-wire-id]')
  // would match the parent first, swallowing the more specific target.

  const handleNode = target.closest('[data-wire-handle]') as HTMLElement | null;
  if (handleNode) {
    const wireId = handleNode.getAttribute('data-wire-id');
    const handleIndex = parseIntAttr(handleNode.getAttribute('data-handle-index'));
    const constraint = handleNode.getAttribute('data-constraint');
    const x = parseFloatAttr(handleNode.getAttribute('data-handle-x'));
    const y = parseFloatAttr(handleNode.getAttribute('data-handle-y'));
    if (
      wireId &&
      handleIndex !== null &&
      (constraint === 'free' || constraint === 'horizontal' || constraint === 'vertical') &&
      x !== null &&
      y !== null
    ) {
      return {
        kind: 'wire_handle',
        wireId,
        handleIndex,
        constraint,
        handlePosition: { x, y },
      };
    }
  }

  const segmentNode = target.closest('[data-wire-segment]') as HTMLElement | null;
  if (segmentNode) {
    const wireId = segmentNode.getAttribute('data-wire-id');
    const handleA = parseIntAttr(segmentNode.getAttribute('data-handle-a'));
    const handleB = parseIntAttr(segmentNode.getAttribute('data-handle-b'));
    const orientation = segmentNode.getAttribute('data-orientation');
    const ax = parseFloatAttr(segmentNode.getAttribute('data-pos-a-x'));
    const ay = parseFloatAttr(segmentNode.getAttribute('data-pos-a-y'));
    const bx = parseFloatAttr(segmentNode.getAttribute('data-pos-b-x'));
    const by = parseFloatAttr(segmentNode.getAttribute('data-pos-b-y'));
    if (
      wireId &&
      handleA !== null &&
      handleB !== null &&
      (orientation === 'horizontal' || orientation === 'vertical') &&
      ax !== null &&
      ay !== null &&
      bx !== null &&
      by !== null
    ) {
      return {
        kind: 'wire_segment',
        wireId,
        handleA,
        handleB,
        orientation,
        positionA: { x: ax, y: ay },
        positionB: { x: bx, y: by },
      };
    }
  }

  const wireNode = target.closest('[data-wire-id]') as HTMLElement | null;
  if (wireNode) {
    const wireId = wireNode.getAttribute('data-wire-id');
    if (wireId) {
      return { kind: 'wire', wireId };
    }
  }

  return { kind: 'canvas' };
}

export function extractModifiers(event: ReactMouseEvent): Modifiers {
  return {
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
}

export function InteractionProvider({ children, facade, containerRef }: InteractionProviderProps) {
  const adapterRef = useCanvasAdapter(facade, containerRef);

  const [snapshot, send, actorRef] = useMachine(interactionMachine, { input: { adapterRef } });

  const cursor = useSelector(actorRef, (s) => {
    if (s.matches('panning')) {
      return 'grabbing';
    }
    if (s.matches('dragging_items') || s.matches('wire_segment_dragging') || s.matches('wire_handle_dragging')) {
      return 'grabbing';
    }
    if (s.context.isSpaceHeld) {
      return 'grab';
    }
    if (s.matches('wire_drawing')) {
      return 'crosshair';
    }
    return 'default';
  });

  const selectionBoxCanvas = useSelector(actorRef, (s) => {
    if (!s.context.boxSelectStartPos || !s.context.boxSelectCurrentPos || !s.matches('box_selecting')) {
      return null;
    }
    return {
      start: s.context.boxSelectStartPos,
      end: s.context.boxSelectCurrentPos,
    };
  });

  const selectionBox = useMemo(() => {
    if (!selectionBoxCanvas) {
      return null;
    }
    return {
      start: {
        x: selectionBoxCanvas.start.x * facade.zoom + facade.pan.x,
        y: selectionBoxCanvas.start.y * facade.zoom + facade.pan.y,
      },
      end: {
        x: selectionBoxCanvas.end.x * facade.zoom + facade.pan.x,
        y: selectionBoxCanvas.end.y * facade.zoom + facade.pan.y,
      },
    };
  }, [facade.pan.x, facade.pan.y, facade.zoom, selectionBoxCanvas]);

  const wirePreview = useSelector(actorRef, (s) => {
    if (!s.matches('wire_drawing') || !s.context.wireFrom || !s.context.wireTempPosition) {
      return null;
    }

    if ('componentId' in s.context.wireFrom) {
      const fromPos = getPortPosition(facade.components, s.context.wireFrom.componentId, s.context.wireFrom.portId);
      if (!fromPos) {
        return null;
      }
      return {
        from: fromPos,
        to: s.context.wireTempPosition,
      };
    }

    const junction = facade.junctions.get(s.context.wireFrom.junctionId);
    if (!junction) {
      return null;
    }

    return {
      from: junction.position,
      to: s.context.wireTempPosition,
    };
  });

  const isSpaceHeld = useSelector(actorRef, (s) => s.context.isSpaceHeld);
  const isDragging = useSelector(actorRef, (s) => s.matches('dragging_items'));
  const isBoxSelecting = useSelector(actorRef, (s) => s.matches('box_selecting'));
  const isWireDrawing = useSelector(actorRef, (s) => s.matches('wire_drawing'));

  const wireDraftPolys = useSelector(actorRef, (s) => s.context.wireDraftPolys) as ReadonlyMap<string, readonly Position[]>;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        return;
      }

      if (event.key === 'Escape') {
        send({ type: 'ESCAPE' });
        return;
      }

      send({
        type: 'KEY_DOWN',
        key: event.key,
        code: event.code,
        modifiers: {
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      send({
        type: 'KEY_UP',
        key: event.key,
        code: event.code,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [send]);

  const value = useMemo<InteractionApi>(
    () => ({
      send,
      snapshot,
      cursor,
      selectionBox,
      wirePreview,
      isSpaceHeld,
      isDragging,
      isBoxSelecting,
      isWireDrawing,
      wireDraftPolys,
    }),
    [send, snapshot, cursor, selectionBox, wirePreview, isSpaceHeld, isDragging, isBoxSelecting, isWireDrawing, wireDraftPolys]
  );

  return <InteractionContext.Provider value={value}>{children}</InteractionContext.Provider>;
}

export function useInteraction(): InteractionApi {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteraction must be used within InteractionProvider');
  }
  return context;
}
