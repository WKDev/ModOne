import { BitmapText, Container, Graphics } from 'pixi.js';
import type { Block, GeomApi, Junction, Position, Wire } from '../types';
import { buildWirePolyline } from '../utils/wireSimplifier';
import { ensureFontsInstalled, FONT_LABEL } from './PixiFontManager';

const DEFAULT_WIRE_COLOR = 0x9ca3af;
const VISIBLE_WIRE_WIDTH = 2;
const HIT_WIRE_WIDTH = 8;
const WIRE_LABEL_FONT_SIZE = 10;

interface WireRenderNode {
  graphics: Graphics;
  label?: BitmapText;
}

function cssHexToNumber(hex: string): number {
  const cleaned = hex.replace('#', '');
  return parseInt(cleaned, 16);
}

function resolveWireColor(color?: string): number {
  if (!color) {
    return DEFAULT_WIRE_COLOR;
  }

  const value = cssHexToNumber(color);
  return Number.isFinite(value) ? value : DEFAULT_WIRE_COLOR;
}

function getPolylineMidpoint(polyline: readonly Position[]): Position {
  if (polyline.length === 1) {
    return { x: polyline[0].x, y: polyline[0].y };
  }

  let totalLength = 0;
  for (let i = 1; i < polyline.length; i += 1) {
    const prev = polyline[i - 1];
    const curr = polyline[i];
    totalLength += Math.hypot(curr.x - prev.x, curr.y - prev.y);
  }

  if (totalLength <= 0) {
    return { x: polyline[0].x, y: polyline[0].y };
  }

  const target = totalLength / 2;
  let traversed = 0;

  for (let i = 1; i < polyline.length; i += 1) {
    const start = polyline[i - 1];
    const end = polyline[i];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (traversed + segmentLength >= target) {
      const ratio = (target - traversed) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }

    traversed += segmentLength;
  }

  const last = polyline[polyline.length - 1];
  return { x: last.x, y: last.y };
}

const CULL_MARGIN = 200;

type VisibleBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class PixiWireRenderer {
  private readonly wireLayer: Container;

  private readonly wireNodes = new Map<string, WireRenderNode>();

  private readonly wirePolylines = new Map<string, readonly Position[]>();

  private visibleBounds: VisibleBounds | null = null;

  public constructor(wireLayer: Container) {
    this.wireLayer = wireLayer;
    ensureFontsInstalled();
  }

  public sync(wires: Wire[], components: Map<string, Block>, junctions: Map<string, Junction>): void {
    const geom: GeomApi = { components, junctions };
    const activeWireIds = new Set<string>();

    for (const wire of wires) {
      const polyline = buildWirePolyline(wire, geom);
      if (!polyline || polyline.length < 2) {
        continue;
      }

      activeWireIds.add(wire.id);

      let node = this.wireNodes.get(wire.id);
      if (!node) {
        const graphics = new Graphics();
        this.wireLayer.addChild(graphics);
        node = { graphics };
        this.wireNodes.set(wire.id, node);
      }

      this.wirePolylines.set(wire.id, polyline);
      const color = resolveWireColor(wire.color);
      this.drawWire(node.graphics, wire.id, polyline, color);
      this.syncWireLabel(node, wire.label, polyline);
    }

    for (const [wireId, node] of this.wireNodes) {
      if (activeWireIds.has(wireId)) {
        continue;
      }

      this.destroyNode(node);
      this.wireNodes.delete(wireId);
      this.wirePolylines.delete(wireId);
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

    for (const [wireId, node] of this.wireNodes) {
      const polyline = this.wirePolylines.get(wireId);
      if (!polyline) {
        continue;
      }

      let anyPointVisible = false;
      for (const pt of polyline) {
        if (
          pt.x >= b.minX - CULL_MARGIN &&
          pt.x <= b.maxX + CULL_MARGIN &&
          pt.y >= b.minY - CULL_MARGIN &&
          pt.y <= b.maxY + CULL_MARGIN
        ) {
          anyPointVisible = true;
          break;
        }
      }

      node.graphics.visible = anyPointVisible;
      if (node.label) {
        node.label.visible = anyPointVisible;
      }
    }
  }

  public setLOD(zoom: number): void {
    const showLabels = zoom >= 0.3;

    for (const node of this.wireNodes.values()) {
      if (node.label && node.graphics.visible) {
        node.label.visible = showLabels;
      }
    }
  }

  public destroy(): void {
    for (const node of this.wireNodes.values()) {
      this.destroyNode(node);
    }
    this.wireNodes.clear();
    this.wirePolylines.clear();
  }

  private drawWire(graphics: Graphics, wireId: string, polyline: readonly Position[], color: number): void {
    graphics.clear();

    graphics.moveTo(polyline[0].x, polyline[0].y);
    for (let i = 1; i < polyline.length; i += 1) {
      graphics.lineTo(polyline[i].x, polyline[i].y);
    }
    graphics.stroke({ width: HIT_WIRE_WIDTH, color: 0xffffff, alpha: 0.00001 });

    graphics.moveTo(polyline[0].x, polyline[0].y);
    for (let i = 1; i < polyline.length; i += 1) {
      graphics.lineTo(polyline[i].x, polyline[i].y);
    }
    graphics.stroke({ width: VISIBLE_WIRE_WIDTH, color });

    graphics.label = `wire:${wireId}`;
    graphics.eventMode = 'static';
    graphics.cursor = 'pointer';
  }

  private syncWireLabel(node: WireRenderNode, label: string | undefined, polyline: readonly Position[]): void {
    if (!label) {
      if (node.label) {
        if (node.label.parent) {
          node.label.parent.removeChild(node.label);
        }
        node.label.destroy();
        node.label = undefined;
      }
      return;
    }

    const labelText = label.trim();
    if (labelText.length === 0) {
      if (node.label) {
        if (node.label.parent) {
          node.label.parent.removeChild(node.label);
        }
        node.label.destroy();
        node.label = undefined;
      }
      return;
    }

    if (!node.label) {
      node.label = new BitmapText({
        text: labelText,
        style: {
          fontFamily: FONT_LABEL,
          fontSize: WIRE_LABEL_FONT_SIZE,
        },
      });
      this.wireLayer.addChild(node.label);
    } else if (node.label.text !== labelText) {
      node.label.text = labelText;
    }

    const midpoint = getPolylineMidpoint(polyline);
    node.label.x = midpoint.x - node.label.width / 2;
    node.label.y = midpoint.y - node.label.height / 2;
  }

  private destroyNode(node: WireRenderNode): void {
    if (node.label) {
      if (node.label.parent) {
        node.label.parent.removeChild(node.label);
      }
      node.label.destroy();
    }

    if (node.graphics.parent) {
      node.graphics.parent.removeChild(node.graphics);
    }
    node.graphics.destroy();
  }
}
