import { Container, type FederatedPointerEvent } from 'pixi.js';
import type { PointerTarget } from '../machines/interactionMachine';

export function resolvePointerTargetFromPixi(event: FederatedPointerEvent): PointerTarget {
  let current: Container | null = event.target instanceof Container ? event.target : null;

  while (current) {
    const label = current.label ?? '';

    if (label.startsWith('port:')) {
      const parts = label.split(':');
      if (parts.length >= 3) {
        const blockId = parts[1];
        const portId = parts.slice(2).join(':');
        return { kind: 'port', blockId, portId, portPosition: 'right' };
      }
    }

    if (label.startsWith('block:')) {
      const blockId = label.substring(6);
      return { kind: 'block', blockId };
    }

    if (label.startsWith('wire:')) {
      const wireId = label.substring(5);
      return { kind: 'wire', wireId };
    }

    if (label.startsWith('junction:')) {
      const junctionId = label.substring(9);
      return { kind: 'junction', junctionId };
    }

    current = current.parent;
  }

  return { kind: 'canvas' };
}
