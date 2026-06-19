/**
 * Sheet XML Service
 *
 * Parses and serializes .sheet.xml files.
 * Uses the browser's built-in DOMParser and XMLSerializer.
 */

import type {
  SheetDocument,
  SheetElement,
  SheetRect,
  SheetLine,
  SheetText,
  SheetTable,
  SheetImage,
  SheetTableColumn,
  SheetTableRow,
  SheetTableMerge,
  SheetTemplateVar,
  SheetPage,
} from '../types/sheet';

let nextId = 1;
function genId(): string {
  return `el-${nextId++}`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function attr(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback;
}

function numAttr(el: Element, name: string, fallback = 0): number {
  const v = el.getAttribute(name);
  return v != null ? Number(v) : fallback;
}

function parsePage(pageEl: Element): SheetPage {
  const marginsEl = pageEl.querySelector('margins');
  return {
    width: numAttr(pageEl, 'width', 297),
    height: numAttr(pageEl, 'height', 210),
    margins: {
      top: marginsEl ? numAttr(marginsEl, 'top', 10) : 10,
      right: marginsEl ? numAttr(marginsEl, 'right', 10) : 10,
      bottom: marginsEl ? numAttr(marginsEl, 'bottom', 10) : 10,
      left: marginsEl ? numAttr(marginsEl, 'left', 10) : 10,
    },
  };
}

function parseRect(el: Element): SheetRect {
  return {
    id: attr(el, 'id') || genId(),
    type: 'rect',
    x: numAttr(el, 'x'),
    y: numAttr(el, 'y'),
    w: numAttr(el, 'w'),
    h: numAttr(el, 'h'),
    stroke: attr(el, 'stroke', 'black'),
    strokeWidth: numAttr(el, 'strokeWidth', 0.5),
    fill: attr(el, 'fill', 'none'),
  };
}

function parseLine(el: Element): SheetLine {
  return {
    id: attr(el, 'id') || genId(),
    type: 'line',
    x1: numAttr(el, 'x1'),
    y1: numAttr(el, 'y1'),
    x2: numAttr(el, 'x2'),
    y2: numAttr(el, 'y2'),
    stroke: attr(el, 'stroke', 'black'),
    strokeWidth: numAttr(el, 'strokeWidth', 0.5),
  };
}

function parseText(el: Element): SheetText {
  return {
    id: attr(el, 'id') || genId(),
    type: 'text',
    x: numAttr(el, 'x'),
    y: numAttr(el, 'y'),
    content: el.textContent?.trim() ?? '',
    fontSize: numAttr(el, 'size', 10),
    fontFamily: attr(el, 'fontFamily', 'sans-serif'),
    align: (attr(el, 'align', 'left') as SheetText['align']),
    color: attr(el, 'color', 'black'),
  };
}

function parseTable(el: Element): SheetTable {
  const columns: SheetTableColumn[] = [];
  const rows: SheetTableRow[] = [];
  const merges: SheetTableMerge[] = [];

  for (const colEl of el.querySelectorAll(':scope > col')) {
    columns.push({
      key: attr(colEl, 'key'),
      label: attr(colEl, 'label', attr(colEl, 'key')),
      width: numAttr(colEl, 'width', 40),
    });
  }

  for (const rowEl of el.querySelectorAll(':scope > row')) {
    const cells: Record<string, string> = {};
    for (const cellEl of rowEl.querySelectorAll(':scope > cell')) {
      const col = attr(cellEl, 'col');
      if (col) cells[col] = cellEl.textContent?.trim() ?? '';
    }
    rows.push({
      height: numAttr(rowEl, 'height', 8),
      cells,
    });
  }

  for (const mergeEl of el.querySelectorAll(':scope > merge')) {
    merges.push({
      fromRow: numAttr(mergeEl, 'fromRow'),
      fromCol: numAttr(mergeEl, 'fromCol'),
      toRow: numAttr(mergeEl, 'toRow'),
      toCol: numAttr(mergeEl, 'toCol'),
    });
  }

  return {
    id: attr(el, 'id') || genId(),
    type: 'table',
    x: numAttr(el, 'x'),
    y: numAttr(el, 'y'),
    columns,
    rows,
    merges,
    stroke: attr(el, 'stroke', 'black'),
    strokeWidth: numAttr(el, 'strokeWidth', 0.5),
    fontSize: numAttr(el, 'fontSize', 8),
    fontFamily: attr(el, 'fontFamily', 'sans-serif'),
  };
}

function parseImage(el: Element): SheetImage {
  return {
    id: attr(el, 'id') || genId(),
    type: 'image',
    x: numAttr(el, 'x'),
    y: numAttr(el, 'y'),
    w: numAttr(el, 'w'),
    h: numAttr(el, 'h'),
    data: el.textContent?.trim() ?? '',
    mimeType: attr(el, 'mimeType', 'image/png'),
  };
}

function parseElement(el: Element): SheetElement | null {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'rect': return parseRect(el);
    case 'line': return parseLine(el);
    case 'text': return parseText(el);
    case 'table': return parseTable(el);
    case 'image': return parseImage(el);
    default: return null;
  }
}

function parseTemplates(templatesEl: Element | null): SheetTemplateVar[] {
  if (!templatesEl) return [];
  const vars: SheetTemplateVar[] = [];
  for (const varEl of templatesEl.querySelectorAll(':scope > var')) {
    vars.push({
      key: attr(varEl, 'key'),
      value: varEl.textContent?.trim() ?? '',
    });
  }
  return vars;
}

export function parseSheetXml(xml: string): SheetDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const sheetEl = doc.documentElement;
  if (sheetEl.tagName !== 'sheet') {
    throw new Error('Invalid sheet XML: root element must be <sheet>');
  }

  const pageEl = sheetEl.querySelector(':scope > page');
  const elementsEl = sheetEl.querySelector(':scope > elements');
  const templatesEl = sheetEl.querySelector(':scope > templates');

  const page = pageEl
    ? parsePage(pageEl)
    : { width: 297, height: 210, margins: { top: 10, right: 10, bottom: 10, left: 10 } };

  const elements: SheetElement[] = [];
  if (elementsEl) {
    for (const child of elementsEl.children) {
      const el = parseElement(child);
      if (el) elements.push(el);
    }
  }

  return {
    version: attr(sheetEl, 'version', '1.0'),
    unit: 'mm',
    page,
    elements,
    templates: parseTemplates(templatesEl),
  };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeAttrs(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v !== '' && v !== 'none' && v !== 0)
    .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
    .join(' ');
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function serializeElement(el: SheetElement, lvl: number): string {
  const i = indent(lvl);
  const id = el.id ? ` id="${escapeXml(el.id)}"` : '';

  switch (el.type) {
    case 'rect': {
      const a = serializeAttrs({
        x: el.x, y: el.y, w: el.w, h: el.h,
        stroke: el.stroke, strokeWidth: el.strokeWidth, fill: el.fill,
      });
      return `${i}<rect${id} ${a}/>`;
    }
    case 'line': {
      const a = serializeAttrs({
        x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2,
        stroke: el.stroke, strokeWidth: el.strokeWidth,
      });
      return `${i}<line${id} ${a}/>`;
    }
    case 'text': {
      const a = serializeAttrs({
        x: el.x, y: el.y, size: el.fontSize,
        fontFamily: el.fontFamily, align: el.align, color: el.color,
      });
      return `${i}<text${id} ${a}>${escapeXml(el.content)}</text>`;
    }
    case 'table': {
      const lines: string[] = [];
      const a = serializeAttrs({
        x: el.x, y: el.y,
        stroke: el.stroke, strokeWidth: el.strokeWidth,
        fontSize: el.fontSize, fontFamily: el.fontFamily,
      });
      lines.push(`${i}<table${id} ${a}>`);
      for (const col of el.columns) {
        lines.push(`${indent(lvl + 1)}<col key="${escapeXml(col.key)}" label="${escapeXml(col.label)}" width="${col.width}"/>`);
      }
      for (const row of el.rows) {
        lines.push(`${indent(lvl + 1)}<row height="${row.height}">`);
        for (const [colKey, val] of Object.entries(row.cells)) {
          lines.push(`${indent(lvl + 2)}<cell col="${escapeXml(colKey)}">${escapeXml(val)}</cell>`);
        }
        lines.push(`${indent(lvl + 1)}</row>`);
      }
      for (const m of el.merges) {
        lines.push(`${indent(lvl + 1)}<merge fromRow="${m.fromRow}" fromCol="${m.fromCol}" toRow="${m.toRow}" toCol="${m.toCol}"/>`);
      }
      lines.push(`${i}</table>`);
      return lines.join('\n');
    }
    case 'image': {
      const a = serializeAttrs({
        x: el.x, y: el.y, w: el.w, h: el.h, mimeType: el.mimeType,
      });
      return `${i}<image${id} ${a}>${el.data}</image>`;
    }
  }
}

export function serializeSheetXml(doc: SheetDocument): string {
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<sheet version="${escapeXml(doc.version)}" unit="${doc.unit}">`);

  // Page
  const { page } = doc;
  lines.push(`  <page width="${page.width}" height="${page.height}">`);
  const m = page.margins;
  lines.push(`    <margins top="${m.top}" right="${m.right}" bottom="${m.bottom}" left="${m.left}"/>`);
  lines.push(`  </page>`);

  // Elements
  lines.push(`  <elements>`);
  for (const el of doc.elements) {
    lines.push(serializeElement(el, 2));
  }
  lines.push(`  </elements>`);

  // Templates
  lines.push(`  <templates>`);
  for (const tv of doc.templates) {
    lines.push(`    <var key="${escapeXml(tv.key)}">${escapeXml(tv.value)}</var>`);
  }
  lines.push(`  </templates>`);

  lines.push(`</sheet>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Template Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve ${...} template expressions in a string.
 *
 * Resolution order:
 * 1. sheet.<key> → sheet-local templates
 * 2. project.<field> → project settings (name, description, etc.)
 * 3. tag.<tagId>.<field> → tag store values
 * 4. Bare <key> → sheet-local templates (shorthand)
 */
export function resolveTemplateString(
  input: string,
  sheetTemplates: Record<string, string>,
  projectData?: Record<string, string>,
  tagData?: Record<string, string>,
): string {
  return input.replace(/\$\{([^}]+)\}/g, (match, expr: string) => {
    const key = expr.trim();

    // sheet.xxx
    if (key.startsWith('sheet.')) {
      const varName = key.slice(6);
      return sheetTemplates[varName] ?? match;
    }

    // project.xxx
    if (key.startsWith('project.') && projectData) {
      const field = key.slice(8);
      return projectData[field] ?? match;
    }

    // tag.xxx.yyy
    if (key.startsWith('tag.') && tagData) {
      const rest = key.slice(4);
      return tagData[rest] ?? match;
    }

    // Bare key → sheet template shorthand
    return sheetTemplates[key] ?? match;
  });
}
