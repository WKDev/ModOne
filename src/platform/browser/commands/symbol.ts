/**
 * Symbol library command handlers for the browser runtime.
 *
 * Mirrors `src/services/symbolService.ts`. Symbols are persisted in the
 * `symbols` store, keyed by `${scope}:${id}`. Each record is an envelope
 * carrying the full definition plus its library scope so listings can build
 * summaries without a second lookup.
 */
import type { SymbolDefinition, SymbolSummary, LibraryScope } from '../../../types/symbol';
import type { CommandMap, CommandContext } from '../types';

interface SymbolRecord {
  scope: LibraryScope;
  definition: SymbolDefinition;
}

const recordKey = (scope: LibraryScope, id: string) => `${scope}:${id}`;

function toSummary(record: SymbolRecord): SymbolSummary {
  const d = record.definition;
  return {
    id: d.id,
    name: d.name,
    version: d.version,
    category: d.category,
    description: d.description,
    scope: record.scope,
    updatedAt: d.updatedAt,
  };
}

async function allRecords(ctx: CommandContext): Promise<SymbolRecord[]> {
  return ctx.storage.values<SymbolRecord>('symbols');
}

export const symbolCommands: CommandMap = {
  async symbol_save(args, ctx): Promise<null> {
    const symbol = args.symbol as SymbolDefinition;
    const scope = (args.scope as LibraryScope) ?? 'project';
    if (symbol?.id) {
      await ctx.storage.put('symbols', recordKey(scope, symbol.id), { scope, definition: symbol });
    }
    return null;
  },

  async symbol_load(args, ctx): Promise<SymbolDefinition | null> {
    const scope = (args.scope as LibraryScope) ?? 'project';
    const id = String(args.id ?? '');
    const record = await ctx.storage.get<SymbolRecord>('symbols', recordKey(scope, id));
    return record?.definition ?? null;
  },

  async symbol_delete(args, ctx): Promise<null> {
    const scope = (args.scope as LibraryScope) ?? 'project';
    const id = String(args.id ?? '');
    await ctx.storage.del('symbols', recordKey(scope, id));
    return null;
  },

  async symbol_list(args, ctx): Promise<SymbolSummary[]> {
    const scope = (args.scope as LibraryScope) ?? 'project';
    return (await allRecords(ctx)).filter((r) => r.scope === scope).map(toSummary);
  },

  async symbol_list_all(_args, ctx): Promise<SymbolSummary[]> {
    return (await allRecords(ctx)).map(toSummary);
  },
};
