# Oversized-file splits — IN PROGRESS

> Status: **ongoing**. This is a live refactoring effort to make the codebase
> LLM/AI-readable by splitting big files into small focused modules. See the
> rule in `CLAUDE.md` → "Code Organization". Resume from the **Remaining** list.

## Why

LLMs read whole files into a limited context window; a 1,000–1,700 line file
wastes context and makes edits error-prone even with LSP outlines. Target
**< ~400 lines/file**; **> ~600 = split**; **> ~800 = must split**. One file =
one clear responsibility.

## The proven pattern (pure types/utils/parsers)

Used for every split below — behavior-neutral, verified by `tsc` + the full test
suite each time:

1. Map the file's section dividers (`grep -n '^// ===='`) and top-level exports.
2. `sed -n 'A,Bp' big.ts > module.ts` for each section — **exact bytes, nothing
   retyped** (no risk of altering logic).
3. Prepend each module's import header; `sed 's/^function /export function /'`
   to export cross-called helpers.
4. Turn the original file into a **barrel** (`export * from './module'`) so every
   existing `from '...'` importer is unchanged. **Preserve any `export default`**
   (move the aggregate object into the barrel — some tests import it).
5. `tsc --noEmit` and iterate: add cross-module imports (TS2304), prune
   over-imported types (TS6196/6133). Break any import cycle by moving the shared
   helper next to its primary caller.
6. Run the full suite (`pnpm exec vitest run`) — must stay green (pure move).

**Gotchas learned:**
- `noUnusedLocals` is on — every unused import is an error; prune precisely.
- `sed '/pat/r file'` appends after **every** match — if the matched token also
  appears in a function body, the insert is duplicated mid-file (TS1232).
- A util barrel that `export *`s its own modules must NOT be imported by those
  modules (cycle) — import siblings directly.

## Done (commits on `feature/web-runtime-shim`)

| File | Was | Now | Modules (largest) |
|---|---|---|---|
| `components/OneCanvas/types.ts` | 1242 | 26 barrel | geometry/selection/blocks/wires/circuit/guards/canvas (blocks 429) |
| `LadderEditor/utils/gridConverter.ts` | 1353 | 35 barrel | astFactories/astToGrid/nodeUtils/gridGrouping/gridToAst (431) |
| `LadderEditor/utils/wireGenerator.ts` | 1263 | 34 barrel | wireGeneration/wireDirections/wireTypeResolution/parallelBranches/wireMerge (441) |
| `lib/symbolXmlParser.ts` | 1512 | 22 barrel | symbolXmlTypes/xmlDomUtils/xmlElementParsers/symbolXmlParse/symbolXmlSerialize/symbolXmlUtils (514) |

## In progress

- `components/SymbolEditor/SymbolEditor.tsx` — **partial** (1243 → 999).
  Extracted `editorModel.ts` / `editorReducer.ts` / `editorHelpers.ts` (pure
  parts) and re-export via `export *`. **Stage 2 remaining:** the component body
  is still ~999 lines (handlers + effects + JSX). Extract handler groups into
  custom hooks (`useSymbolClipboard` / `useSymbolHistory` / `useSymbolMultiUnit`)
  — higher-risk because it threads shared state (localSymbol/setLocalSymbol/
  dispatch/historyRef), so it was deferred from the pure-util splits.

## Remaining backlog (live files, 1000+ lines)

Run `find src -name '*.ts*' | xargs wc -l | sort -rn` for the current list. As of
this writing:

- `OneCanvas/interaction/InteractionController` (~1240) — interaction FSM
  (runtime/state; **not** a pure split — needs care).
- `stores/ladderStore` (~1095) — Zustand store (slice pattern; runtime risk).
- `stores/documentRegistry` (~1031) — store (runtime risk).
- … plus ~18 more files over 700 lines.

**Do NOT split `stores/canvasStore` (1754)** — it is `@deprecated`, has a single
non-test consumer (`stores/adapters/globalCanvasAdapter`), and is scheduled for
full removal ("Phase 3.5"). Splitting doomed code is wasted effort. (Always
check for `@deprecated` / single-consumer before picking a target.)

Pure logic (types/utils/parsers) is safest and uses the pattern above verbatim.
Stores (Zustand `create()`/immer) and React components need the slice / custom-
hook patterns respectively and carry real runtime/state-threading risk — verify
with the relevant `tests/qa/web-*.mjs` harness, not just unit tests.
