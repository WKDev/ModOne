# wire-fixes — Learnings

## [2026-03-09] Session: ses_3318be196ffeXRezMM4658AC65 — Pre-task code audit

### Confirmed Line Numbers (from direct read)

**InteractionController.ts state fields** (verified):
- Line 132-137: Wire segment drag fields (`_segmentWireId`, `_segmentHandleA/B`, `_segmentOrientation`, `_segmentAppliedDelta`)
- Line 139-143: Wire handle drag fields (`_handleWireId`, `_handleIndex`, `_handleConstraint`, `_handleStartPosition`)
- Line 126-130: Wire drawing fields (`_wireFrom`, `_wireFromExitDirection`, `_wireSnapTarget`, `_wireDrawingReturnState`)
- Line 996-1022: `_resetTransient()` — resets ALL state fields

**Wire drawing methods** (verified):
- Line 677-691: `_startWireDrawing(worldPos, target)` — `worldPos` IS the snapped port position (stored as `_lastMoveWorld` at line 688)
- Line 693-734: `_handleWireDrawingMove(worldPos)` — line 726 is the ONE buggy line: `this._visuals.renderWirePreview([worldPos])`
- Line 736-766: `_handleWireDrawingUp(_worldPos, button)` — clears preview, resets wire fields

**Wire segment drag methods** (verified):
- Line 811-823: `_startWireSegmentDragging(_worldPos, target)` — stores wireId, handleA (=subIndex), handleB (=subIndex+1), orientation. Does NOT store handle positions.
- Line 825-847: `_handleSegmentDraggingMove(worldPos)` — BUGGY: computes total delta, calls `moveWireSegment(constrained, isFirstMove=true)` every frame
- Line 849-870: `_handleSegmentDraggingUp()` — BUGGY: re-applies same `_segmentAppliedDelta` with `isFirstMove=false`

**Wire handle drag methods** (verified — working pattern to copy)**:
- Line 876-888: `_startWireHandleDragging(target)` — stores `this._handleStartPosition = target.position` (position from HitTestResult)
- Line 890-911: `_handleHandleDraggingMove(worldPos)` — CORRECT: `newPos = add(_handleStartPosition, constrained)`, calls `updateWireHandle(newPos, isFirstMove=true)` always
- Line 913-947: `_handleHandleDraggingUp()` — re-computes final position from `_lastMoveWorld`, calls `updateWireHandle(newPos, isFirstMove=false)` — FINE because absolute (idempotent)

**Geometry helpers at bottom of file** (lines 1035-1094):
- `subtract(a, b)` at line 1035
- `add(a, b)` at line 1039
- These are LOCAL file functions (not imported from geometry.ts!)
- `snapDelta`, `constrainSegmentDelta`, `constrainDelta` are also used in this file — check imports at top

### Key Insight: Facade has NO getWire method

`canvasFacade.ts` does NOT expose a `getWire(id)` method to read handle positions. The facade only allows mutations. Therefore Task 1 must use one of these approaches:
- **Option A (Incremental delta)**: Track `_prevAppliedDelta`, compute `incrementalDelta = currentConstrained - prevConstrained`, pass to additive `moveWireSegment`. Track `_segmentIsFirstMove` for history.
- **Option B (Absolute via HitTestResult)**: `_startWireSegmentDragging` receives `target: HitTestResult`. The segment HitTestResult might have position of hit point, but NOT the two endpoint handle positions. This approach may NOT work without facade read access.

**Recommendation**: Use Option A (incremental delta). It's simpler, doesn't require facade read access, keeps `moveWireSegment` semantics intact, and correctly handles history with `isFirstMove` tracking.

### Incremental Delta Fix (Task 1) — Full Code Change

```typescript
// Add fields at line ~137 (after _segmentAppliedDelta):
private _segmentPrevDelta: Position = { x: 0, y: 0 };
private _segmentIsFirstMove = true;

// In _startWireSegmentDragging (after line 822):
this._segmentPrevDelta = { x: 0, y: 0 };
this._segmentIsFirstMove = true;

// Replace _handleSegmentDraggingMove entirely:
private _handleSegmentDraggingMove(worldPos: Position): void {
  if (!this._pointerStartWorld || !this._segmentWireId) return;
  const facade = this._facade;
  if (!facade) return;

  const snapped = snapDelta(subtract(worldPos, this._pointerStartWorld));
  const constrained = constrainSegmentDelta(snapped, this._segmentOrientation);
  
  // Compute INCREMENTAL delta (difference from previous frame)
  const incrementalDelta = {
    x: constrained.x - this._segmentPrevDelta.x,
    y: constrained.y - this._segmentPrevDelta.y,
  };
  this._segmentAppliedDelta = constrained;
  this._segmentPrevDelta = constrained;
  
  if (incrementalDelta.x !== 0 || incrementalDelta.y !== 0) {
    const isFirstMove = this._segmentIsFirstMove;
    this._segmentIsFirstMove = false;
    facade.moveWireSegment(
      this._segmentWireId,
      this._segmentHandleA,
      this._segmentHandleB,
      incrementalDelta,
      isFirstMove
    );
  }
}

// Replace _handleSegmentDraggingUp — REMOVE duplicate moveWireSegment call:
private _handleSegmentDraggingUp(): void {
  // Handles are already at the correct final position from move handler
  // No duplicate delta application needed
  this._segmentWireId = null;
  this._segmentHandleA = -1;
  this._segmentHandleB = -1;
  this._segmentOrientation = null;
  this._segmentAppliedDelta = { x: 0, y: 0 };
  this._segmentPrevDelta = { x: 0, y: 0 };
  this._segmentIsFirstMove = true;
  this._state = 'idle';
  this._clearPointerTracking();
}

// In _resetTransient() — add cleanup:
this._segmentPrevDelta = { x: 0, y: 0 };
this._segmentIsFirstMove = true;
```

### Wire Preview Fix (Task 2) — Full Code Change

```typescript
// Add field at line ~130 (after _wireDrawingReturnState):
private _wireDrawingFromPos: Position = { x: 0, y: 0 };

// In _startWireDrawing (after line 689):
this._wireDrawingFromPos = worldPos;

// Replace line 725-727 in _handleWireDrawingMove:
if (this._wireFrom && isPortEndpoint(this._wireFrom)) {
  // Compute orthogonal L-route based on exit direction
  const fromPos = this._wireDrawingFromPos;
  const exitDir = this._wireFromExitDirection;
  const mid = (exitDir === 'left' || exitDir === 'right')
    ? { x: worldPos.x, y: fromPos.y }   // horizontal first
    : { x: fromPos.x, y: worldPos.y };  // vertical first
  this._visuals.renderWirePreview([fromPos, mid, worldPos]);
}

// In _handleWireDrawingUp (after line 764 where _wireSnapTarget is cleared):
this._wireDrawingFromPos = { x: 0, y: 0 };

// In _resetTransient() — add cleanup:
this._wireDrawingFromPos = { x: 0, y: 0 };
```

### Conventions Observed
- Geometry helpers (`add`, `subtract`, `snapDelta`) are defined locally in the file OR imported — check top of file imports before adding import
- State fields initialized with default values in class body (not constructor)
- `_resetTransient()` resets ALL transient fields — always add new fields here
- `_handleSegmentDraggingUp` vs `_handleHandleDraggingUp`: handle dragging does re-call facade on mouseup with `isFirstMove=false` — segment dragging fix does NOT need this since incremental approach keeps handles correct

## [2026-03-09T03:43:01.871Z] Task 1 complete
- Approach used: incremental delta
- Files modified: `src/components/OneCanvas/interaction/InteractionController.ts`, `.sisyphus/evidence/task-1-all-tests-pass.txt`, `.sisyphus/evidence/task-1-lsp-clean.txt`
- Test result: 40 files passed, 986 tests passed
- Any unexpected findings: `_segmentAppliedDelta` became write-only after removing mouseup reapply, so mouseup now performs a no-op read before cleanup to keep LSP diagnostics clean

## [2026-03-09 03:43:35] Task 2 complete
- Field added: _wireDrawingFromPos
- Line changed: 726 (renderWirePreview call)
- L-route approach: horizontal-first when exit is left/right, vertical-first otherwise
- Test result: 986 passed, 0 failed
- Any unexpected findings: None

## [2026-03-09T04:00:00.000Z] Task 3 complete
- New test files:
  - `src/components/OneCanvas/interaction/__tests__/wireSegmentDrag.test.ts` (9 tests)
  - `src/components/OneCanvas/utils/__tests__/wirePreviewPath.test.ts` (12 tests)
- New test count: 21
- Total tests: 1007 (was 986)
- Approach used: pure function extraction for preview path (no class instantiation), direct canvasStore.getState().moveWireSegment() calls for segment drag (bypasses React rendering overhead)
- Key finding: canvasStore.setState() + getState().moveWireSegment() works cleanly without renderHook — avoids all hook/act overhead for store-level unit tests
- Segment drag tests verify: single move exactness, sequential increment accumulation, axis constraint, large delta, zero delta no-op, negative delta, history snapshot only on isFirstMove=true, and the anti-amplification regression case
- Preview path tests verify: 3-point output, right/left/up/down/null exit directions, collinear cases, orthogonality for all directions, axis-correct mid computation, and bug documentation test
