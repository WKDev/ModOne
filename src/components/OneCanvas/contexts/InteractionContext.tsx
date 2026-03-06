import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useMachine, useSelector } from '@xstate/react';
import type { CanvasFacadeReturn } from '../../../types/canvasFacade';
import {
  interactionMachine,
  type CanvasEvent,
  type InteractionSnapshot,
} from '../machines/interactionMachine';
import { useCanvasAdapter } from '../interaction/useCanvasAdapter';
import { getPortPosition } from '../interaction/resolvePointerTarget';
import type { Position } from '../types';

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

export { resolvePointerTarget, extractModifiers } from '../interaction/resolvePointerTarget';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
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
