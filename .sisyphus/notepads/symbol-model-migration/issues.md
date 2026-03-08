# Symbol Model Migration — Issues

## [2026-03-08] Build Errors from Task 6

### Issue: Record<BlockType, X> type mismatch in 3 files
**Files affected:**
- src/components/OneCanvas/blockDefinitions.ts:26
- src/components/OneCanvas/utils/bomGenerator.ts:52
- src/components/panels/content/canvas/BlockDragPreview.tsx:10

**Root cause:** Task 6 added 20+ new canonical types to BlockType union (power_source, relay_coil, etc.)
but these 3 files use `Record<BlockType, X>` which requires ALL BlockType values to be present.

**Fix options:**
1. Change to `Partial<Record<BlockType, X>>` and handle undefined gracefully
2. Add entries for all new types (pointing to symbolBridge for data)
3. Change type to `Record<string, X>` (loses type safety — BAD)

**Recommended fix:** Option 1 — Partial<Record<BlockType, X>> is cleanest and aligns with Task 8's
goal of making symbolBridge the primary data source. The legacy blockDefinitions.ts entries remain
for backward compat but new types use symbolBridge.

### Pre-existing errors (DO NOT FIX in Task 8)
- wire-routing-verification.test.ts — stale golden values (pre-existing)
- gridConverter.test.ts — LadderItem rename (pre-existing)
- useAppIntegration.ts — missing plugin (pre-existing)
- SymbolEditorHost.tsx — multiple issues (pre-existing)
