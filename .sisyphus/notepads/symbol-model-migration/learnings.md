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
