## [2026-02-24] Pre-existing Test Failure (NOT our bug)

**File**: `src/components/LadderEditor/hooks/__tests__/useLadderKeyboardShortcuts.test.tsx`
**Test**: "should clear selection on Escape"
**Error**: `clearSelection` call throws at useLadderKeyboardShortcuts.ts:384
**Status**: Pre-existing. 1 fail / 661 pass. NOT related to OneCanvas — must NOT be fixed by our tasks.

## [2026-02-24] LSP Errors in Test Files (likely stale)

- `src/stores/__tests__/windowStore.test.ts:369` — '}' expected
- `src/stores/__tests__/panelStore.floating.test.ts:349` — '}' expected
Both files appear to pass vitest. Likely stale LSP cache.