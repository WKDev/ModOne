/**
 * SheetOverlayRenderer
 *
 * Renders a .sheet.xml document as a non-interactive background overlay
 * on the OneCanvas. The sheet is drawn at world origin (0,0) using PixiJS
 * Graphics, with all coordinates in mm (matching the world coordinate system).
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SheetDocument, SheetElement } from '../../../types/sheet';
import { resolveTemplateString } from '../../../services/sheetXmlService';

export class SheetOverlayRenderer {
  private _layer: Container | null = null;
  private _graphics: Graphics | null = null;
  private _textContainer: Container | null = null;
  private _doc: SheetDocument | null = null;
  private _templateData: Record<string, string> = {};
  private _projectData: Record<string, string> = {};

  get layer(): Container | null { return this._layer; }

  init(layer: Container): void {
    this._layer = layer;

    this._graphics = new Graphics();
    this._graphics.label = 'sheet-overlay-graphics';
    this._graphics.eventMode = 'none'; // non-interactive
    layer.addChild(this._graphics);

    this._textContainer = new Container();
    this._textContainer.label = 'sheet-overlay-text';
    this._textContainer.eventMode = 'none';
    layer.addChild(this._textContainer);
  }

  setDocument(doc: SheetDocument | null): void {
    this._doc = doc;
    this._buildTemplateMap();
    this.render();
  }

  setProjectData(data: Record<string, string>): void {
    this._projectData = data;
    this.render();
  }

  private _buildTemplateMap(): void {
    this._templateData = {};
    if (this._doc) {
      for (const t of this._doc.templates) {
        this._templateData[t.key] = t.value;
      }
    }
  }

  private _resolve(s: string): string {
    return resolveTemplateString(s, this._templateData, this._projectData);
  }

  render(): void {
    if (!this._graphics || !this._textContainer) return;

    this._graphics.clear();
    this._textContainer.removeChildren();

    if (!this._doc) return;

    for (const el of this._doc.elements) {
      this._renderElement(el);
    }
  }

  private _renderElement(el: SheetElement): void {
    const g = this._graphics!;

    switch (el.type) {
      case 'rect': {
        g.setStrokeStyle({ width: el.strokeWidth, color: el.stroke });
        if (el.fill && el.fill !== 'none') {
          g.rect(el.x, el.y, el.w, el.h);
          g.fill({ color: el.fill });
          g.stroke();
        } else {
          g.rect(el.x, el.y, el.w, el.h);
          g.stroke();
        }
        break;
      }
      case 'line': {
        g.setStrokeStyle({ width: el.strokeWidth, color: el.stroke });
        g.moveTo(el.x1, el.y1);
        g.lineTo(el.x2, el.y2);
        g.stroke();
        break;
      }
      case 'text': {
        const style = new TextStyle({
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fill: el.color,
          align: el.align,
        });
        const text = new Text({ text: this._resolve(el.content), style });
        text.x = el.x;
        text.y = el.y - el.fontSize * 0.35; // align to baseline
        text.eventMode = 'none';
        this._textContainer!.addChild(text);
        break;
      }
      case 'table': {
        this._renderTable(el);
        break;
      }
      // Images are rendered as placeholders in the overlay
      case 'image': {
        g.setStrokeStyle({ width: 0.2, color: '#cccccc' });
        g.rect(el.x, el.y, el.w, el.h);
        g.fill({ color: '#f9f9f9' });
        g.stroke();
        break;
      }
    }
  }

  private _renderTable(el: SheetElement & { type: 'table' }): void {
    const g = this._graphics!;
    const totalW = el.columns.reduce((s, c) => s + c.width, 0);
    const totalH = el.rows.reduce((s, r) => s + r.height, 0);

    // Outer border
    g.setStrokeStyle({ width: el.strokeWidth, color: el.stroke });
    g.rect(el.x, el.y, totalW, totalH);
    g.stroke();

    // Column lines
    let cx = el.x;
    for (let ci = 0; ci < el.columns.length - 1; ci++) {
      cx += el.columns[ci].width;
      g.moveTo(cx, el.y);
      g.lineTo(cx, el.y + totalH);
      g.stroke();
    }

    // Row lines
    let ry = el.y;
    for (let ri = 0; ri < el.rows.length - 1; ri++) {
      ry += el.rows[ri].height;
      g.moveTo(el.x, ry);
      g.lineTo(el.x + totalW, ry);
      g.stroke();
    }

    // Cell text
    const style = new TextStyle({
      fontSize: el.fontSize,
      fontFamily: el.fontFamily,
      fill: 'black',
    });

    ry = el.y;
    for (const row of el.rows) {
      cx = el.x;
      for (const col of el.columns) {
        const val = row.cells[col.key];
        if (val) {
          const text = new Text({ text: this._resolve(val), style });
          text.x = cx + 1.5;
          text.y = ry + row.height * 0.2;
          text.eventMode = 'none';
          this._textContainer!.addChild(text);
        }
        cx += col.width;
      }
      ry += row.height;
    }
  }

  destroy(): void {
    if (this._graphics) {
      this._graphics.destroy();
      this._graphics = null;
    }
    if (this._textContainer) {
      this._textContainer.destroy({ children: true });
      this._textContainer = null;
    }
    this._layer = null;
    this._doc = null;
  }
}
