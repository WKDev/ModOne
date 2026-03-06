import { Container, Graphics } from 'pixi.js';
import type { Junction } from '../types';

const JUNCTION_RADIUS = 4;
const JUNCTION_HIT_RADIUS = 8;
const JUNCTION_COLOR = 0x10b981;

const CULL_MARGIN = 200;

type VisibleBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class PixiJunctionRenderer {
  private readonly junctionLayer: Container;

  private readonly junctionGraphics = new Map<string, Graphics>();

  private readonly junctionPositions = new Map<string, { x: number; y: number }>();

  private visibleBounds: VisibleBounds | null = null;

  public constructor(junctionLayer: Container) {
    this.junctionLayer = junctionLayer;
  }

  public sync(junctions: Map<string, Junction>): void {
    const activeIds = new Set<string>();

    for (const [junctionId, junction] of junctions) {
      activeIds.add(junctionId);

      let graphics = this.junctionGraphics.get(junctionId);
      if (!graphics) {
        graphics = new Graphics();
        this.junctionLayer.addChild(graphics);
        this.junctionGraphics.set(junctionId, graphics);
      }

      graphics.clear();
      graphics.circle(junction.position.x, junction.position.y, Math.max(JUNCTION_HIT_RADIUS, JUNCTION_RADIUS));
      graphics.fill({ color: 0xffffff, alpha: 0.00001 });
      graphics.circle(junction.position.x, junction.position.y, JUNCTION_RADIUS);
      graphics.fill(JUNCTION_COLOR);
      graphics.label = `junction:${junction.id}`;
      graphics.eventMode = 'static';
      graphics.cursor = 'pointer';
      this.junctionPositions.set(junctionId, { x: junction.position.x, y: junction.position.y });
    }

    for (const [junctionId, graphics] of this.junctionGraphics) {
      if (activeIds.has(junctionId)) {
        continue;
      }

      if (graphics.parent) {
        graphics.parent.removeChild(graphics);
      }
      graphics.destroy();
      this.junctionGraphics.delete(junctionId);
      this.junctionPositions.delete(junctionId);
    }
  }

  public setVisibleBounds(bounds: VisibleBounds): void {
    this.visibleBounds = bounds;
  }

  public applyViewportCulling(): void {
    if (!this.visibleBounds) {
      return;
    }

    const b = this.visibleBounds;

    for (const [id, graphics] of this.junctionGraphics) {
      const pos = this.junctionPositions.get(id);
      if (!pos) {
        continue;
      }

      graphics.visible =
        pos.x >= b.minX - CULL_MARGIN &&
        pos.x <= b.maxX + CULL_MARGIN &&
        pos.y >= b.minY - CULL_MARGIN &&
        pos.y <= b.maxY + CULL_MARGIN;
    }
  }

  public destroy(): void {
    for (const graphics of this.junctionGraphics.values()) {
      if (graphics.parent) {
        graphics.parent.removeChild(graphics);
      }
      graphics.destroy();
    }

    this.junctionGraphics.clear();
    this.junctionPositions.clear();
  }
}
