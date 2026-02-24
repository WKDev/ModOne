## Wire Geometry Unification — Learnings

### Root Cause
Wire가 드래그 후 대각선으로 보이는 이유:
1. **Geometry Source Mismatch**: WireRenderer hit area는 `[from, ...handles, to]`, SVG path는 `calculatePathWithHandles()`로 exit point 포함 — 두 개가 다른 포인트 집합
2. **No Orthogonal Validation**: `commitWirePolyline()`이 polyline을 검증 없이 핸들로 저장
3. **Segment Index Drift**: `ensureMovableSegment()`가 direct wire에 stub 삽입 — renderer가 모르는 변환
4. **SpatialIndex 3번째 불일치 소스**: `[from, ...handles, to]` 직접 조합

### Key Architecture Facts
- `PORT_EXIT_DISTANCE = 20` — `wirePathCalculator.ts:86`에 `const`로 선언됨 (export 없음). `interactionMachine.ts:278`에도 `dist = 20` 중복 존재
- `buildWirePolyline(wire, geom)` — wireSimplifier.ts:113. `[fromPos, ...handlePositions, toPos]` 반환 (exit point 없음)
- `polylineToHandles` — wireSimplifier.ts:125. poly.slice(1,-1)을 핸들로 변환. Exit point가 poly에 있으면 핸들로 저장돼버림 (버그)
- `commitWirePolyline` — canvasStore.ts:1119, useCanvasDocument.ts:606. 두 곳 모두 `polylineToHandles` 직접 호출
- `getExitPoint(pos, dir, dist)` — wirePathCalculator.ts:338. exit point 계산 함수 (export됨)
- `bridgeOrthogonal(a, b)` — rubberBand.ts:74. 대각→직교 변환 패턴
- `simplifyOrthogonal` — wireSimplifier.ts:33. 콜린리어 포인트 제거

### Design Decision: Exit Points Are Ephemeral
- Exit point는 `wire.handles`에 절대 저장하지 않는다
- `buildCanonicalWirePolyline`이 반환하는 포인트 중 exit point는 렌더/히트/드래그에만 사용
- `commitWirePolyline` 호출 시에는 반드시 from/to 포트 포지션과 exit point를 제외한 interior points만 핸들로 저장

### Guardrails
- ❌ calculateOrthogonalRoute / calculateOrthogonalPath 수정 금지
- ❌ WireHandle 데이터 모델 변경 금지 ({ id, position, constraint, source })
- ❌ Handle drag 경로 수정 금지 (prepareWireHandleDragging/applyWireHandleDragging)
- ❌ XState 머신 구조 변경 금지
- ❌ 새로운 SVG 비주얼 요소 추가 금지
- ❌ Exit point를 wire.handles에 영구 저장 금지

## [2026-02-24] Task 2: enforceOrthogonalPolyline
- enforceOrthogonalPolyline added to wireSimplifier.ts as export
- Function detects diagonal segments (dx > 1 && dy > 1) and inserts bridge points
- Bridge point uses horizontal-first strategy: { x: current.x, y: prev.y }
- Result is simplified via simplifyOrthogonal to clean up redundant points
- Applied to canvasStore.ts:1127 commitWirePolyline before polylineToHandles call
- Applied to useCanvasDocument.ts:616 commitWirePolyline before polylineToHandles call
- Build: PASS (✓ built in 3.00s)
- Tests: 662 passed, 1 unrelated failure in LadderEditor keyboard shortcuts
- No TypeScript errors in modified files
- Enforcement acts as safety net — any diagonal coordinates committed are auto-orthogonalized

## [2026-02-24] Task 1: buildCanonicalWirePolyline
- buildCanonicalWirePolyline 구현 완료, wireSimplifier.ts에 export
- PORT_EXIT_DISTANCE export 완료, interactionMachine.ts 단일 참조
- 테스트 8개 PASS
- canonical builder는 exit point를 보존하면서(직접 wire 4-point 유지) 대각 세그먼트에 horizontal-first bridge를 삽입해 직교를 보장

## [2026-02-24] Task 5: segmentWasDirect 제거
- interactionMachine 세그먼트 드래그 경로를 canonical-only로 통일: prepare에서 `buildCanonicalWirePolyline` 사용
- direct wire 전용 분기(`segmentWasDirect` + `resolveWireEndpointExitPoint`) 제거, 모든 케이스가 `dragSegment` 단일 경로 사용
- commit 시 canonical의 exit point(index 1, -2)를 `stripCanonicalExitPoints`로 제거 후 저장하도록 변경
- apply/finalize 둘 다 exit point 제거 경로를 거치게 해서 `polylineToHandles(poly.slice(1,-1))`로 exit point가 handles에 저장되는 버그 차단
- 검증: interactionMachine LSP diagnostics clean, `pnpm build` 통과, `pnpm test`는 기존 LadderEditor 단일 실패(허용 범위) 유지

## Task 4: SpatialIndex + Drag Engine Canonical Migration (2026-02-24)

### Key Discovery: interactionMachine already migrated
- `prepareWireSegmentDragging` and `finalizeWireSegmentDragging` were ALREADY using `buildCanonicalWirePolyline` before this task
- `stripCanonicalExitPoints()` is a local helper in interactionMachine.ts that strips exit points before committing
- No changes needed in interactionMachine.ts

### segIndex Consistency Problem Solved
- **Before**: WireRenderer `segmentPoints = [from, ...handles, to]` but drag engine used canonical `[fromPos, fromExit, ...handles, toExit, toPos]` → INDEX MISMATCH
- **After**: WireRenderer now accepts `canonicalPoly` prop and uses it for `segmentPoints` → INDICES MATCH

### Implementation Pattern
1. `WireRenderer.tsx`: Added `canonicalPoly?: readonly Position[]` prop; segmentPoints prefers canonicalPoly
2. `CanvasContent.tsx`: Computes `geom = { components: blocks, junctions }` outside wire loop; calls `buildCanonicalWirePolyline(wire, geom)` for each wire; passes as `canonicalPoly` prop
3. `SpatialIndex.ts`: Replaced manual `[from, ...handles, to]` with `buildCanonicalWirePolyline(wire, geom)` - now uses same point set as drag engine and renderer

### ensureMovableSegment: KEEP as safety net
- For port-to-port wires, canonical poly is always ≥4 points (has exit points), so 2-point branch in ensureMovableSegment never triggers
- For junction-to-junction wires without handles, canonical poly may still return simplified 2-point polyline (fallback path when no direction info)
- ensureMovableSegment correctly handles this edge case → do NOT remove it

### GeomApi construction
```typescript
const geom = { components: blocks, junctions };  // satisfies GeomApi interface
```
Both `blocks: Map<string, Block>` and `junctions: Map<string, Junction>` match GeomApi fields.

### Build/Test Results
- `pnpm build`: ✓ exit 0, 2423 modules
- `pnpm test`: 670 passed, 1 known LadderEditor failure (unrelated: store.clearActiveTool not a function)


## [2026-02-24] Task 6: Round-trip Integration Tests

### Test File Created
`src/components/OneCanvas/utils/__tests__/wireGeometryRoundtrip.test.ts` — 8 tests, all passing

### Key Test Patterns
- `stripCanonicalExitPoints` is NOT exported from interactionMachine.ts; must be replicated inline in tests
- Same `makeBlock / makeGeom / makeHandle / assertOrthogonal` helper pattern as `buildCanonicalWirePolyline.test.ts`
- Wire type requires only `id`, `from`, `to` — all other fields optional
- `routingMode: 'manual'` used in all test wires (matches existing test convention)

### Round-trip Verification
- `buildCanonicalWirePolyline` → 5-point poly for right-to-left wire with y-offset (fromPos, fromExit, handle, toExit, toPos)
- `stripCanonicalExitPoints(poly)` → 3-point stripped poly using `poly.slice(2,-2)`
- `polylineToHandles(stripped, [], 'auto')` → 1 handle with 'vertical' constraint
- Rebuild with that handle → same 5-point poly — STABLE

### Exit Distance Clamping
- Short wire (block a at x=0 w=20, block b at x=30 w=20): ports at (20,10) and (30,10), dist=10px
- exitDistance = min(20, 10*0.33) ≈ 3.3px (well below PORT_EXIT_DISTANCE=20)

### enforceOrthogonalPolyline Behavior
- Diagonal input [(0,0),(100,100),(200,100)] → inserts bridge at (100,0) → 4 points
- Already-orthogonal 4-point poly → passes through unchanged (same length)

### Test Results
- 8 tests, 8 passed, 0 failed
- Full suite: 678 passed, 1 pre-existing LadderEditor failure (unchanged)
- Evidence saved to `.sisyphus/evidence/task-6-test-suite.txt`
