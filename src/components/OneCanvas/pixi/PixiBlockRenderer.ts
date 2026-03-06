import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';
import type { Block } from '../types';
import { drawBlock } from './PixiBlockFactory';

const CULL_MARGIN = 200;

type VisibleBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class PixiBlockRenderer {
  private readonly blockLayer: Container;

  private readonly blockContainers = new Map<string, Container>();

  private readonly blockPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

  private readonly renderSignatures = new Map<string, string>();

  private visibleBounds: VisibleBounds | null = null;

  private currentLodLevel = 2;

  public constructor(blockLayer: Container) {
    this.blockLayer = blockLayer;
  }

  public sync(components: Map<string, Block>): void {
    const activeIds = new Set<string>();

    for (const [id, block] of components) {
      activeIds.add(id);

      let container = this.blockContainers.get(id);
      const isNew = !container;
      if (!container) {
        container = new Container();
        container.label = `block:${id}`;
        this.blockLayer.addChild(container);
        this.blockContainers.set(id, container);
      }

      container.position.set(block.position.x, block.position.y);
      container.hitArea = new Rectangle(0, 0, block.size.width, block.size.height);
      container.eventMode = 'static';
      container.cursor = 'pointer';
      this.blockPositions.set(id, { x: block.position.x, y: block.position.y, w: block.size.width, h: block.size.height });

      const nextSignature = this.getRenderSignature(block);
      const prevSignature = this.renderSignatures.get(id);
      const shouldRedraw = isNew || prevSignature !== nextSignature;

      if (shouldRedraw) {
        drawBlock(container, block);
        this.renderSignatures.set(id, nextSignature);
      }
    }

    for (const [id, container] of this.blockContainers) {
      if (activeIds.has(id)) {
        continue;
      }

      if (container.parent) {
        container.parent.removeChild(container);
      }
      container.destroy({ children: true });
      this.blockContainers.delete(id);
      this.renderSignatures.delete(id);
      this.blockPositions.delete(id);
    }
  }

  public getContainerById(id: string): Container | undefined {
    return this.blockContainers.get(id);
  }

  public isBlockVisible(blockId: string): boolean {
    const container = this.blockContainers.get(blockId);
    return container ? container.visible : false;
  }

  public setVisibleBounds(bounds: VisibleBounds): void {
    this.visibleBounds = bounds;
  }

  public applyViewportCulling(): void {
    if (!this.visibleBounds) {
      return;
    }

    const b = this.visibleBounds;

    for (const [id, container] of this.blockContainers) {
      const pos = this.blockPositions.get(id);
      if (!pos) {
        continue;
      }

      container.visible =
        pos.x + pos.w >= b.minX - CULL_MARGIN &&
        pos.x <= b.maxX + CULL_MARGIN &&
        pos.y + pos.h >= b.minY - CULL_MARGIN &&
        pos.y <= b.maxY + CULL_MARGIN;
    }
  }

  public setLOD(zoom: number): void {
    const level = zoom < 0.1 ? 0 : zoom < 0.3 ? 1 : 2;
    if (level === this.currentLodLevel) {
      return;
    }
    this.currentLodLevel = level;

    for (const container of this.blockContainers.values()) {
      if (!container.visible) {
        continue;
      }

      for (const child of container.children) {
        if (child instanceof BitmapText) {
          child.visible = level >= 2;
        } else if (child instanceof Graphics) {
          child.visible = level >= 1;
        }
      }
    }
  }

  public destroy(): void {
    for (const container of this.blockContainers.values()) {
      if (container.parent) {
        container.parent.removeChild(container);
      }
      container.destroy({ children: true });
    }

    this.blockContainers.clear();
    this.renderSignatures.clear();
    this.blockPositions.clear();
  }

  private getRenderSignature(block: Block): string {
    const { position, ...renderData } = block;
    return JSON.stringify(renderData);
  }
}
