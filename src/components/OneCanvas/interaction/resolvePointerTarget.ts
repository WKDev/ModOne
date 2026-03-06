import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Block, Position, PortPosition } from '../types';
import type { PointerTarget, Modifiers } from '../machines/interactionMachine';

function getPortPosition(components: Map<string, Block>, blockId: string, portId: string): Position | null {
  const block = components.get(blockId);
  if (!block) return null;

  const port = block.ports.find((p) => p.id === portId);
  if (!port) return null;

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
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFloatAttr(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolve the pointer target from a DOM mouse event by walking up data attributes.
 * This is the DOM-based implementation used by the SVG renderer.
 * A separate Pixi-based implementation will be added for the Pixi renderer.
 */
export function resolvePointerTarget(
  event: ReactMouseEvent,
  components: Map<string, Block>
): PointerTarget {
  const target = event.target as HTMLElement | null;
  if (!target) return { kind: 'canvas' };

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
          portPosition: components.get(blockId)?.ports.find((p) => p.id === portId)?.position ?? ('right' as PortPosition),
        };
      }
    }
  }

  const blockNode = target.closest('[data-block-id]') as HTMLElement | null;
  if (blockNode) {
    const blockId = blockNode.getAttribute('data-block-id');
    if (blockId) return { kind: 'block', blockId };
  }

  const junctionNode = target.closest('[data-junction-id]') as HTMLElement | null;
  if (junctionNode) {
    const junctionId = junctionNode.getAttribute('data-junction-id');
    if (junctionId) return { kind: 'junction', junctionId };
  }

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
    const segIndex = parseIntAttr(segmentNode.getAttribute('data-seg-index'));
    const orientation = segmentNode.getAttribute('data-orientation');
    if (
      wireId &&
      segIndex !== null &&
      (orientation === 'horizontal' || orientation === 'vertical')
    ) {
      return {
        kind: 'wire_segment',
        wireId,
        segIndex,
        orientation,
      };
    }
  }

  const wireNode = target.closest('[data-wire-id]') as HTMLElement | null;
  if (wireNode) {
    const wireId = wireNode.getAttribute('data-wire-id');
    if (wireId) return { kind: 'wire', wireId };
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

export { getPortPosition };
