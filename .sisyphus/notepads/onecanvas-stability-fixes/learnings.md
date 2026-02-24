## [2026-02-24] Project Setup

- **Package manager**: pnpm (ALWAYS use pnpm, not npm)
- **Test runner**: `pnpm run test -- --run` (vitest)
- **Baseline**: 661 pass, 1 pre-existing fail (useLadderKeyboardShortcuts)
- **console.log counts confirmed**: BlockWrapper.tsx = 9, SelectionBoundingBox.tsx = 7
- Target files:
  - BlockWrapper: `src/components/OneCanvas/components/blocks/BlockWrapper.tsx`
  - SelectionBoundingBox: `src/components/OneCanvas/components/SelectionBoundingBox.tsx`
  - canvasService: `src/services/canvasService.ts`
  - canvasStore: `src/stores/canvasStore.ts` (redo fn ~L1397-1415)
  - useCanvasSync: `src/hooks/useCanvasSync.ts` (L363-375)
  - canvasHelpers: `src/components/OneCanvas/utils/canvasHelpers.ts` (L123)
  - types: `src/components/OneCanvas/types.ts`
## [2026-02-24] Console.log Removal - BlockWrapper & SelectionBoundingBox

### Completed
- **BlockWrapper.tsx**: Removed 9 console.log statements
  - Line 56: MouseDown logging
  - Line 61: Port click detection logging
  - Line 67: onDragStart call logging
  - Line 77: MouseUp logging
  - Line 82: Port click detection logging (duplicate)
  - Line 92: Click handler logging with callback info
  - Line 97: Port click detection logging (duplicate)
  - Line 103: onBlockClick call logging
  - Line 108: onSelect call logging

- **SelectionBoundingBox.tsx**: Removed 7 console.log statements
  - Line 47: Render logging with selectedIds
  - Line 52: No selection logging
  - Line 130: No elements found logging
  - Line 142: Calculated box logging
  - Line 147: No bounding box logging
  - Line 155: Single block selection logging
  - Line 160: Rendering box logging

### Verification
- ✅ grep confirms zero console.* statements in both files
- ✅ Tests: 661 pass, 1 pre-existing fail (unchanged)
- ✅ No regressions introduced
- ✅ Commit: `fix(canvas): remove debug console.logs from BlockWrapper and SelectionBoundingBox`

### Key Learnings
- Console statements were in event handlers (mouseDown, mouseUp, click) and render logic
- Removal was straightforward - no complex logic dependencies
- All surrounding code preserved exactly (only console lines removed)
- Test baseline maintained perfectly (661 pass, 1 fail)

## Error Handling Improvements (Completed)

### T3: CanvasServiceError cause chain fix
- **Issue**: Constructor was calling `super(message)` without passing the `{ cause }` option
- **Fix**: Changed to `super(message, { cause })` to properly establish JavaScript Error cause chain
- **Impact**: Now `err.cause` correctly returns the original error, enabling proper error chain inspection
- **Pattern**: ES2022 Error options pattern - standard practice for error wrapping

### T2: circuitExists error visibility
- **Issue**: Catch block silently converted ALL errors to `false`, hiding unexpected failures
- **Fix**: Added `console.warn('circuitExists: unexpected error', error)` before returning false
- **Impact**: Unexpected errors now logged to console, making silent failures visible during debugging
- **Pattern**: Distinguish between "not found" (return false) vs "unexpected error" (log + return false)

### Test Results
- 661 tests passing (baseline maintained)
- 1 pre-existing failure (useLadderKeyboardShortcuts - unrelated)
- No regressions introduced by changes

### Commit
- `fix(canvas): improve canvasService error handling and Error cause chain`
