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
