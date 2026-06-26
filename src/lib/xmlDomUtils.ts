import { SYMBOL_SCHEMA_NS } from "./symbolXmlTypes";
import type { XmlParseIssue } from "./symbolXmlTypes";

// DOM Utilities
// ============================================================================

export const NS = SYMBOL_SCHEMA_NS;

/** First direct child with matching localName in the schema namespace */
export function childEl(parent: Element, localName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName && child.namespaceURI === NS) {
      return child;
    }
  }
  return null;
}

/** All direct children with matching localName in the schema namespace */
export function childEls(parent: Element, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === localName && child.namespaceURI === NS) {
      result.push(child);
    }
  }
  return result;
}

export function attr(el: Element, name: string): string | undefined {
  const val = el.getAttribute(name);
  return val === null ? undefined : val;
}

export function requiredAttr(
  el: Element,
  name: string,
  path: string,
  issues: XmlParseIssue[],
): string {
  const val = el.getAttribute(name);
  if (val === null) {
    issues.push({
      message: `Missing required attribute '${name}' on <${el.localName}>`,
      level: 'error',
      path,
    });
    return '';
  }
  return val;
}

export function numAttr(el: Element, name: string, defaultVal = 0): number {
  const val = el.getAttribute(name);
  if (val === null) return defaultVal;
  const n = parseFloat(val);
  return isNaN(n) ? defaultVal : n;
}

export function boolAttr(el: Element, name: string, defaultVal = false): boolean {
  const val = el.getAttribute(name);
  if (val === null) return defaultVal;
  return val === 'true' || val === '1';
}

export function elText(el: Element | null): string {
  return el?.textContent?.trim() ?? '';
}

export function childText(parent: Element, localName: string): string | undefined {
  const el = childEl(parent, localName);
  if (!el) return undefined;
  const t = elText(el);
  return t || undefined;
}

// ============================================================================
