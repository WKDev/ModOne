/**
 * Proves symbolToXml() ↔ parseSymbolXml() is a lossless identity for every
 * builtin symbol (modulo object key ORDER, which is semantically irrelevant).
 * This is the gate that lets the builtin .symbol.xml files be regenerated from
 * the .ts definitions and become the single source of truth (R2), and it guards
 * the editor save/load path against future serializer regressions.
 */
import { describe, it, expect } from 'vitest';
import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';
import { symbolToXml, parseSymbolXml } from '@/services/symbolXmlParser';

// Deep key-sorting normalize: key order differs cosmetically (parser emits
// {kind,id,…}, the .ts use {id,kind,…}) but is irrelevant to runtime behaviour.
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}
// createdAt/updatedAt/author/description are metadata, not runtime-relevant.
const IGNORE = new Set(['createdAt', 'updatedAt', 'author', 'description']);
function strip(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (!IGNORE.has(k)) out[k] = v;
  return out;
}
const norm = (v: unknown) => sortKeys(JSON.parse(JSON.stringify(strip(v as Record<string, unknown>))));

describe('symbolToXml ↔ parseSymbolXml is lossless for all builtins', () => {
  it.each([...BUILTIN_SYMBOLS.keys()])('%s round-trips identically', (id) => {
    const ts = BUILTIN_SYMBOLS.get(id)!;
    const [rt] = parseSymbolXml(symbolToXml(ts));
    expect(norm(rt)).toEqual(norm(ts));
  });
});
