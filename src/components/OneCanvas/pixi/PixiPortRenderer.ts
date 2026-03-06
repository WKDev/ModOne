import { Container, Graphics } from 'pixi.js';
import type { Block, Port } from '../types';

const PORT_RADIUS = 3;
const PORT_STROKE_COLOR = 0x666666;
const PORT_FILL_COLOR = 0x4a4a4a;
const PORT_CONNECTED_FILL_COLOR = 0x10b981;
const PORT_HIT_MIN_SIZE = 10;

interface PortConnectionRuntime {
  connected?: boolean;
  isConnected?: boolean;
  connectionCount?: number;
  connections?: unknown[];
}

type VisibleBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class PixiPortRenderer {
  private readonly portLayer: Container;

  private readonly portGraphics = new Map<string, Graphics>();

  private readonly portBlockIds = new Map<string, string>();

  private blockVisibilityLookup: ((blockId: string) => boolean) | null = null;

  public constructor(portLayer: Container) {
    this.portLayer = portLayer;
  }

  public setBlockVisibilityLookup(lookup: (blockId: string) => boolean): void {
    this.blockVisibilityLookup = lookup;
  }

  public setVisibleBounds(_bounds: VisibleBounds): void {
    void _bounds;
  }

  public syncPorts(components: Map<string, Block>): void {
    const activePortKeys = new Set<string>();

    for (const [blockId, block] of components) {
      for (const port of block.ports) {
        const key = this.getPortKey(blockId, port.id);
        activePortKeys.add(key);

        let graphics = this.portGraphics.get(key);
        if (!graphics) {
          graphics = new Graphics();
          graphics.label = `port:${blockId}:${port.id}`;
          this.portLayer.addChild(graphics);
          this.portGraphics.set(key, graphics);
          this.portBlockIds.set(key, blockId);
        }

        const position = this.getPortAbsolutePosition(block, port);
        const fillColor = this.isPortConnected(port) ? PORT_CONNECTED_FILL_COLOR : PORT_FILL_COLOR;
        const hitSize = Math.max(PORT_HIT_MIN_SIZE, PORT_RADIUS * 2);
        const hitHalf = hitSize / 2;

        graphics.clear();
        graphics
          .rect(position.x - hitHalf, position.y - hitHalf, hitSize, hitSize)
          .fill({ color: 0xffffff, alpha: 0.00001 });
        graphics.circle(position.x, position.y, PORT_RADIUS).fill(fillColor).stroke({ width: 1, color: PORT_STROKE_COLOR });
      }
    }

    for (const [key, graphics] of this.portGraphics) {
      if (activePortKeys.has(key)) {
        continue;
      }

      if (graphics.parent) {
        graphics.parent.removeChild(graphics);
      }
      graphics.destroy();
      this.portGraphics.delete(key);
      this.portBlockIds.delete(key);
    }
  }

  public applyViewportCulling(): void {
    if (!this.blockVisibilityLookup) {
      return;
    }

    for (const [key, graphics] of this.portGraphics) {
      const blockId = this.portBlockIds.get(key);
      if (!blockId) {
        continue;
      }
      graphics.visible = this.blockVisibilityLookup(blockId);
    }
  }

  public setLOD(zoom: number): void {
    const showPorts = zoom >= 0.1;
    for (const graphics of this.portGraphics.values()) {
      if (graphics.visible) {
        graphics.visible = showPorts;
      }
    }
  }

  public destroy(): void {
    for (const graphics of this.portGraphics.values()) {
      if (graphics.parent) {
        graphics.parent.removeChild(graphics);
      }
      graphics.destroy();
    }
    this.portGraphics.clear();
    this.portBlockIds.clear();
  }

  private getPortKey(blockId: string, portId: string): string {
    return `${blockId}:${portId}`;
  }

  private getPortAbsolutePosition(block: Block, port: Port): { x: number; y: number } {
    if (port.absolutePosition) {
      return {
        x: block.position.x + port.absolutePosition.x,
        y: block.position.y + port.absolutePosition.y,
      };
    }

    const offset = port.offset ?? 0.5;
    const { width, height } = block.size;

    switch (port.position) {
      case 'left':
        return { x: block.position.x, y: block.position.y + height * offset };
      case 'right':
        return { x: block.position.x + width, y: block.position.y + height * offset };
      case 'top':
        return { x: block.position.x + width * offset, y: block.position.y };
      case 'bottom':
      default:
        return { x: block.position.x + width * offset, y: block.position.y + height };
    }
  }

  private isPortConnected(port: Port): boolean {
    const runtime = port as Port & PortConnectionRuntime;

    if (typeof runtime.connected === 'boolean') {
      return runtime.connected;
    }
    if (typeof runtime.isConnected === 'boolean') {
      return runtime.isConnected;
    }
    if (typeof runtime.connectionCount === 'number') {
      return runtime.connectionCount > 0;
    }
    if (Array.isArray(runtime.connections)) {
      return runtime.connections.length > 0;
    }

    return false;
  }
}
