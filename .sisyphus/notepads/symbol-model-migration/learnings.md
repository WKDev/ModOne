# Symbol Model Migration — Learnings

## [2026-03-08] Session Resume

### Tasks 1-7 Status: COMPLETE
- v2 types in symbol.ts, circuit.ts, types.rs, schema.json ✅
- 42 builtin symbols in src/assets/builtin-symbols/ with v2 pin fields ✅
- symbolBridge.ts created, BlockRenderer uses bridge-first resolution ✅

### Current Build State (36 errors total)
Pre-existing errors (IGNORE):
- src/__tests__/wire-routing-verification.test.ts — stale golden values
- src/components/LadderEditor/utils/__tests__/gridConverter.test.ts — LadderItem rename
- src/hooks/useAppIntegration.ts — missing @tauri-apps/plugin-deep-link
- src/components/SymbolEditor/SymbolEditorHost.tsx — snapToGrid, GhostShape, ViewportState issues

NEW errors from Task 6 (new canonical types added to BlockType but not to legacy maps):
- src/components/OneCanvas/blockDefinitions.ts:26 — Record<BlockType, BlockDefinition> missing 20+ new types
- src/components/OneCanvas/utils/bomGenerator.ts:52 — Record<BlockType, string> missing new types
- src/components/panels/content/canvas/BlockDragPreview.tsx:10 — Record<BlockType, string> missing new types

### Key Architecture Facts
- blockDefinitions.ts uses OLD type names (powersource, plc_out, plc_in, relay, button)
- BlockType now has NEW canonical names (power_source, plc_output, plc_input, relay_coil, push_button_no)
- The Record<BlockType, BlockDefinition> type check fails because new canonical types aren't in the object
- LEGACY_BLOCK_TYPE_MAP in circuit.ts MUST NOT be removed
- symbolBridge.ts auto-registers all 42 builtins on module load
- BlockRenderer.ts already uses getSymbolContextForBlockType() from symbolBridge as primary path

### Task 8 Scope
Task 8 is the highest-risk task. It must:
1. 8a: Add ComponentInstance interface to circuit.ts, update stores
2. 8b: Update renderers (BlockRenderer, SimulationRenderer, PortRenderer)
3. 8c: Update UI + serialization (serialization.ts, InteractionController, canvasCommands)

The build errors from blockDefinitions.ts/bomGenerator.ts/BlockDragPreview.tsx are part of Task 8's scope.
The fix: change Record<BlockType, X> to Partial<Record<BlockType, X>> OR add entries for all new types.
Preferred approach: use symbolBridge to get size/ports for new types, keep old entries for legacy types.

## [2026-03-08] Task 10: Cleanup Dead Code

### SymbolLibrary.ts — NOT DELETED (active references remain)
Checked via `grep -rn "getSymbolContext\|getSymbolSize" src/`:
- `GhostPreviewRenderer.ts:132,139,156` — imports `getSymbolContext`, `getSymbolSize` from `'./symbols'` barrel and uses them directly
- `BlockRenderer.ts:101,114` — uses as fallback after `getSymbolContextForBlockType` returns null
- `renderers/index.ts:31` — re-exports both functions
- `symbols/index.ts:1` — barrel re-exports everything from SymbolLibrary.ts

**Decision: Keep SymbolLibrary.ts.** It is the fallback rendering path for types not yet registered in symbolBridge.

### PinConfigPopover.tsx — v2 fields added
Added `electricalType: 'passive'` and `functionalRole: 'general'` defaults to pin creation.
These map to `PinElectricalTypeV2` and `PinFunctionalRole` from `../../types/symbol`.

### SymbolEditor.tsx — sortOrder injection added
Modified `handleAddPin` to inject `sortOrder` based on current pin count:
- Non-multi-unit path: uses `localSymbol.pins.length` at callback scope (localSymbol added to deps)
- Multi-unit path: computes `currentUnit.pins.length` inside `setLocalSymbol(prev =>...)` updater
- Added `localSymbol` to `useCallback` deps array (safe — recreated only when symbol changes)

### CANONICAL_SYMBOL_TYPES — KEPT
`SYMBOL_LABELS` and `SYMBOL_CATEGORIES` are used by `Toolbox.tsx`. 
`CANONICAL_SYMBOL_TYPES` used internally by `preloadAllThumbnails`. All three kept in symbolThumbnails.ts.

### Build/Test verification (post-Task 10)
- `pnpm run build` → 33 errors (same pre-existing set, zero new)
- `pnpm run test` → 986 passed (40 test files)
