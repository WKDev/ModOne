import RBush, { type BBox } from 'rbush';

import type { Block, BoundingBox, Junction, Position, Wire } from '../types';

export interface SpatialItem extends BBox {
  id: string;
  kind: 'block' | 'wire-segment' | 'junction' | 'port';
}

function getPortWorldPosition(block: Block, portId: string): Position | null {
  const port = block.ports.find((p) => p.id === portId);
  if (!port) {
    return null;
  }

  const portOffset = port.offset ?? 0.5;
  let x = block.position.x;
  let y = block.position.y;

  switch (port.position) {
    case 'top':
      x = block.position.x + block.size.width * portOffset;
      y = block.position.y;
      break;
    case 'bottom':
      x = block.position.x + block.size.width * portOffset;
      y = block.position.y + block.size.height;
      break;
    case 'left':
      x = block.position.x;
      y = block.position.y + block.size.height * portOffset;
      break;
    case 'right':
      x = block.position.x + block.size.width;
      y = block.position.y + block.size.height * portOffset;
      break;
  }

  return { x, y };
}

function createCenteredBox(position: Position, halfSize: number): Pick<SpatialItem, 'minX' | 'minY' | 'maxX' | 'maxY'> {
  return {
    minX: position.x - halfSize,
    minY: position.y - halfSize,
    maxX: position.x + halfSize,
    maxY: position.y + halfSize,
  };
}

export class SpatialIndex {
  private tree = new RBush<SpatialItem>();

  private itemMap = new Map<string, SpatialItem>();

  rebuild(blocks: Map<string, Block>, wires: Wire[], junctions: Map<string, Junction>): void {
    this.clear();

    const items: SpatialItem[] = [];

    for (const block of blocks.values()) {
      const blockItem: SpatialItem = {
        id: block.id,
        kind: 'block',
        minX: block.position.x,
        minY: block.position.y,
        maxX: block.position.x + block.size.width,
        maxY: block.position.y + block.size.height,
      };
      items.push(blockItem);

      for (const port of block.ports) {
        const portPosition = getPortWorldPosition(block, port.id);
        if (!portPosition) {
          continue;
        }

        items.push({
          id: `port:${block.id}:${port.id}`,
          kind: 'port',
          ...createCenteredBox(portPosition, 2),
        });
      }
    }

    for (const junction of junctions.values()) {
      items.push({
        id: junction.id,
        kind: 'junction',
        ...createCenteredBox(junction.position, 4),
      });
    }

    const resolveEndpointPosition = (endpoint: Wire['from']): Position | null => {
      if ('componentId' in endpoint) {
        const block = blocks.get(endpoint.componentId);
        if (!block) {
          return null;
        }
        return getPortWorldPosition(block, endpoint.portId);
      }

      const junction = junctions.get(endpoint.junctionId);
      return junction ? junction.position : null;
    };

    for (const wire of wires) {
      const from = resolveEndpointPosition(wire.from);
      const to = resolveEndpointPosition(wire.to);

      if (!from || !to) {
        continue;
      }

      const points: Position[] = [from, ...(wire.handles?.map((handle) => handle.position) ?? []), to];

      for (let segIndex = 0; segIndex < points.length - 1; segIndex += 1) {
        const start = points[segIndex];
        const end = points[segIndex + 1];

        items.push({
          id: `wire-seg:${wire.id}:${segIndex}`,
          kind: 'wire-segment',
          minX: Math.min(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxX: Math.max(start.x, end.x),
          maxY: Math.max(start.y, end.y),
        });
      }
    }

    this.tree.load(items);
    for (const item of items) {
      this.itemMap.set(item.id, item);
    }
  }

  upsert(item: SpatialItem): void {
    this.remove(item.id);
    this.tree.insert(item);
    this.itemMap.set(item.id, item);
  }

  remove(id: string): void {
    const existing = this.itemMap.get(id);
    if (!existing) {
      return;
    }

    this.tree.remove(existing, (a, b) => a.id === b.id);
    this.itemMap.delete(id);
  }

  queryPoint(pos: Position, margin: number): SpatialItem[] {
    return this.tree.search({
      minX: pos.x - margin,
      minY: pos.y - margin,
      maxX: pos.x + margin,
      maxY: pos.y + margin,
    });
  }

  queryBox(bounds: BoundingBox): SpatialItem[] {
    return this.tree.search(bounds);
  }

  clear(): void {
    this.tree.clear();
    this.itemMap.clear();
  }

  get size(): number {
    return this.itemMap.size;
  }
}

export function createSpatialIndex(): SpatialIndex {
  return new SpatialIndex();
}
