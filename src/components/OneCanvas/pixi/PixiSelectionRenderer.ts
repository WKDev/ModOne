import { Container, Graphics } from 'pixi.js';
import type { Block, Junction, Wire } from '../types';
import { buildWirePolyline } from '../utils/wireSimplifier';
import type { PixiBlockRenderer } from './PixiBlockRenderer';
import type { PixiJunctionRenderer } from './PixiJunctionRenderer';
import type { PixiWireRenderer } from './PixiWireRenderer';

const SELECTION_COLOR = 0x3b82f6;
const BLOCK_PADDING = 2;
const BLOCK_RADIUS = 4;
const BLOCK_WIDTH = 2;
const BLOCK_ALPHA = 0.8;
const WIRE_WIDTH = 4;
const WIRE_ALPHA = 0.8;
const JUNCTION_RADIUS = 6;
const JUNCTION_WIDTH = 2;
const JUNCTION_ALPHA = 0.8;

export class PixiSelectionRenderer {
  private readonly selectionLayer: Container;

  private readonly blockRenderer: PixiBlockRenderer;

  private readonly highlights: Graphics[] = [];

  private activeHighlightCount = 0;

  public constructor(
    selectionLayer: Container,
    blockRenderer: PixiBlockRenderer,
    _wireRenderer: PixiWireRenderer,
    _junctionRenderer: PixiJunctionRenderer,
  ) {
    this.selectionLayer = selectionLayer;
    this.blockRenderer = blockRenderer;
  }

  public update(
    selectedIds: string[],
    components: Map<string, Block>,
    wires: Wire[],
    junctions: Map<string, Junction>
  ): void {
    this.activeHighlightCount = 0;

    for (const id of selectedIds) {
      const block = components.get(id);
      if (block) {
        this.drawBlockSelection(block);
        continue;
      }

      const wire = wires.find((candidate) => candidate.id === id);
      if (wire) {
        this.drawWireSelection(wire, components, junctions);
        continue;
      }

      const junction = junctions.get(id);
      if (junction) {
        this.drawJunctionSelection(junction);
      }
    }

    for (let i = this.activeHighlightCount; i < this.highlights.length; i += 1) {
      this.highlights[i].clear();
      this.highlights[i].visible = false;
    }
  }

  public destroy(): void {
    for (const graphics of this.highlights) {
      if (graphics.parent) {
        graphics.parent.removeChild(graphics);
      }
      graphics.destroy();
    }
    this.highlights.length = 0;
    this.activeHighlightCount = 0;
  }

  private acquireHighlight(): Graphics {
    if (this.activeHighlightCount < this.highlights.length) {
      const graphics = this.highlights[this.activeHighlightCount];
      this.activeHighlightCount += 1;
      graphics.visible = true;
      graphics.clear();
      return graphics;
    }

    const graphics = new Graphics();
    graphics.eventMode = 'none';
    this.selectionLayer.addChild(graphics);
    this.highlights.push(graphics);
    this.activeHighlightCount += 1;
    return graphics;
  }

  private drawBlockSelection(block: Block): void {
    const container = this.blockRenderer.getContainerById(block.id);
    if (!container) {
      return;
    }

    const graphics = this.acquireHighlight();
    graphics
      .roundRect(
        block.position.x - BLOCK_PADDING,
        block.position.y - BLOCK_PADDING,
        block.size.width + BLOCK_PADDING * 2,
        block.size.height + BLOCK_PADDING * 2,
        BLOCK_RADIUS,
      )
      .stroke({
        color: SELECTION_COLOR,
        width: BLOCK_WIDTH,
        alpha: BLOCK_ALPHA,
      });
  }

  private drawWireSelection(
    wire: Wire,
    components: Map<string, Block>,
    junctions: Map<string, Junction>
  ): void {
    const polyline = buildWirePolyline(wire, { components, junctions });
    if (!polyline || polyline.length < 2) {
      return;
    }

    const graphics = this.acquireHighlight();
    graphics.moveTo(polyline[0].x, polyline[0].y);
    for (let i = 1; i < polyline.length; i += 1) {
      graphics.lineTo(polyline[i].x, polyline[i].y);
    }
    graphics.stroke({
      color: SELECTION_COLOR,
      width: WIRE_WIDTH,
      alpha: WIRE_ALPHA,
    });
  }

  private drawJunctionSelection(junction: Junction): void {
    const graphics = this.acquireHighlight();
    graphics
      .circle(junction.position.x, junction.position.y, JUNCTION_RADIUS)
      .stroke({
        color: SELECTION_COLOR,
        width: JUNCTION_WIDTH,
        alpha: JUNCTION_ALPHA,
      });
  }
}
