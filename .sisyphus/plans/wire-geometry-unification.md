# Wire Geometry Unification — Diagonal Artifact Root Fix

## TL;DR

> **Quick Summary**: Wire가 드래그 후 대각선으로 표시되는 근본 원인은 렌더링/히트테스트/드래그/커밋 경로가 서로 다른 포인트 집합(exit point 포함 여부)을 참조하기 때문. 단일 정규 폴리라인 빌더(`buildCanonicalWirePolyline`)를 만들어 모든 소비자가 동일 geometry를 사용하도록 통합한다.
>
> **Deliverables**:
> - `buildCanonicalWirePolyline()` 정규 빌더 함수 + 단위 테스트
> - WireRenderer, SpatialIndex, drag engine, commit 경로 전부 정규 빌더 사용으로 전환
> - `commitWirePolyline`에 orthogonal enforcement 안전장치 추가
> - 라운드트립 안정성 테스트 (build → commit → rebuild = 동일 geometry)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7 → Task 8

---

## Context

### Original Request
Wire 코너 핸들 제거 후 세그먼트 드래그 방식으로 전환했으나, 드래그 후 wire가 반복적으로 대각선으로 표시되는 문제 발생. 새로 생성된 세그먼트도 재드래그가 안 되는 케이스 존재.

### Interview Summary
**Key Discussions**:
- 코너 핸들 제거 → 세그먼트 드래그로 전환 완료
- 드래그 후 대각선 발생 반복 보고
- 포트 인접 wire 이동 시 자연스러운 꺾임 필요

**Research Findings (2 explore + 1 oracle)**:
- **Geometry Source Mismatch**: WireRenderer hit area는 `[from, ...handles, to]`이고, SVG path는 `calculatePathWithHandles()`로 exit point 포함 — 두 개가 다른 포인트 집합
- **No Orthogonal Validation**: `commitWirePolyline()`이 polyline을 검증 없이 핸들로 저장 → 대각 좌표가 영구 보존
- **Segment Index Drift**: `ensureMovableSegment()`가 direct wire에 stub 삽입(2→4점) — renderer가 모르는 변환
- **SpatialIndex도 3번째 불일치 소스**: `[from, ...handles, to]` 기반이라 exit point 미포함
- **Exit point constant 중복**: `PORT_EXIT_DISTANCE=20`이 `wirePathCalculator.ts:86`과 `interactionMachine.ts:278`에 각각 존재

### Metis Review
**Identified Gaps** (addressed):
- SpatialIndex가 3번째 geometry 소스로 불일치 → Task 4에서 통합
- Junction endpoint에서 `resolveWireEndpointExitPoint`가 null 반환 → Task 1에서 junction exit 처리 포함
- Exit point를 handle로 저장하면 안 됨 (ephemeral이어야 함) → 설계 원칙으로 명시
- `draftPoly` 코드 경로도 정규 빌더 경유 필요 → Task 3에서 처리
- 짧은 wire(40px 미만)에서 exit point overshoot → Task 1 엣지케이스 테스트
- PORT_EXIT_DISTANCE 상수 중복 → Task 1에서 정리

---

## Work Objectives

### Core Objective
Wire geometry의 단일 정규 소스(Single Source of Truth)를 만들어, 렌더링·히트테스트·드래그·커밋 모든 경로가 동일한 폴리라인을 참조하도록 통합한다.

### Concrete Deliverables
- `src/components/OneCanvas/utils/wireSimplifier.ts` — `buildCanonicalWirePolyline()` 함수
- `src/components/OneCanvas/content/WireRenderer.tsx` — `segmentPoints`와 path rendering 통합
- `src/components/OneCanvas/machines/interactionMachine.ts` — drag prep에서 정규 빌더 사용
- `src/components/OneCanvas/utils/SpatialIndex.ts` — 정규 빌더 사용
- `src/stores/canvasStore.ts` + `src/stores/hooks/useCanvasDocument.ts` — commit 시 orthogonal enforcement
- Unit test suite for wire geometry

### Definition of Done
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 신규 테스트 포함 전부 PASS (기존 실패 1건 제외: LadderEditor clearActiveTool)
- [ ] 모든 연속 포인트 쌍이 `abs(dx) < 1 OR abs(dy) < 1` (대각선 없음)
- [ ] 드래그 → 릴리즈 → 재선택 → 재드래그 사이클이 대각선 없이 동작

### Must Have
- 단일 정규 폴리라인 빌더 (exit point 포함)
- 모든 소비자가 정규 빌더 사용
- Commit 시 orthogonal enforcement
- Round-trip 안정성 (build → commit → rebuild = 동일)
- Unit test coverage for canonical builder + commit validation

### Must NOT Have (Guardrails)
- ❌ Auto-routing 알고리즘 변경 (`calculateOrthogonalRoute`, `calculateOrthogonalPath`)
- ❌ `WireHandle` 데이터 모델 변경 (`{ id, position, constraint, source }` 구조 유지)
- ❌ Handle 드래그 경로 수정 (`prepareWireHandleDragging`/`applyWireHandleDragging`) — 확인된 대각선 원인 아님
- ❌ XState 머신 구조 변경 (states, transitions, guards)
- ❌ 새로운 SVG 비주얼 요소 추가
- ❌ Exit point를 `wire.handles`에 영구 저장 — exit point는 항상 ephemeral

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **Automated tests**: YES (Tests-after)
- **Framework**: vitest (`pnpm test`)
- **Strategy**: 정규 빌더 + commit validation + round-trip에 대한 unit test 작성

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (`pnpm test` / node REPL) — Import, call functions, compare output
- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation):
├── Task 1: buildCanonicalWirePolyline 정규 빌더 + 단위 테스트 [deep]
├── Task 2: commitWirePolyline orthogonal enforcement [quick]

Wave 2 (After Wave 1 — consumer migration, MAX PARALLEL):
├── Task 3: WireRenderer segmentPoints + pathD 통합 (depends: 1) [unspecified-high]
├── Task 4: SpatialIndex + drag engine 정규 빌더 전환 (depends: 1) [unspecified-high]
├── Task 5: interactionMachine direct-wire drag 리팩터 (depends: 1) [deep]

Wave 3 (After Wave 2 — integration + verification):
├── Task 6: Round-trip 통합 테스트 (depends: 2, 3, 4, 5) [unspecified-high]
├── Task 7: E2E Playwright 검증 (depends: 6) [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
├── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3/5 → Task 6 → Task 7 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3, 4, 5 | 1 |
| 2 | — | 6 | 1 |
| 3 | 1 | 6 | 2 |
| 4 | 1 | 6 | 2 |
| 5 | 1 | 6 | 2 |
| 6 | 2, 3, 4, 5 | 7 | 3 |
| 7 | 6 | F1-F4 | 3 |

### Agent Dispatch Summary

- **Wave 1**: 2 — T1 → `deep`, T2 → `quick`
- **Wave 2**: 3 — T3 → `unspecified-high`, T4 → `unspecified-high`, T5 → `deep`
- **Wave 3**: 2 — T6 → `unspecified-high`, T7 → `unspecified-high` (+`playwright`)
- **FINAL**: 4 — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` (+`playwright`), F4 → `deep`

---

## TODOs


- [ ] 1. `buildCanonicalWirePolyline` 정규 빌더 생성 + 단위 테스트

  **What to do**:
  - `wireSimplifier.ts`에 `buildCanonicalWirePolyline(wire: Wire, geom: GeomApi): Position[]` 함수 생성
  - 기존 `buildWirePolyline`을 확장: `[portPos, exitPoint, ...handles, exitPoint, portPos]` 형태의 전체 visual polyline 반환
  - `PORT_EXIT_DISTANCE` 상수를 `wirePathCalculator.ts`에서 export하고, `interactionMachine.ts`의 중복(`dist = 20`) 제거 → 단일 상수 참조
  - Junction endpoint exit point 계산 포함 (현재 `resolveWireEndpointExitPoint`는 port만 처리, junction은 null 반환 — junction도 방향 기반 exit point 생성)
  - Exit point와 handle 사이 대각 구간이 생기면 자동 orthogonal bridge 삽입 (중간 꺾임점)
  - 결과 polyline의 모든 연속 쌍이 `abs(dx) < 1 OR abs(dy) < 1` 보장
  - 엣지케이스 처리: 40px 미만 짧은 wire에서 exit point overshoot 방지 (exit distance를 endpoint 간 거리의 1/3로 clamp)
  - `src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts` 단위 테스트 작성:
    - Port-to-port (same axis, different axis, opposite directions, same-side directions)
    - Port-to-junction
    - Junction-to-junction
    - Wire with existing handles
    - Wire with no handles (direct)
    - Very short wire (< 40px)
    - All output segments are orthogonal assertion

  **Must NOT do**:
  - `calculateOrthogonalRoute` / `calculateOrthogonalPath` 수정 금지
  - `WireHandle` 데이터 모델 변경 금지
  - 기존 `buildWirePolyline` 시그니처 삭제 금지 (하위호환 유지, 내부에서 canonical 호출)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 핵심 geometry 함수 설계 + 엣지케이스 처리 + 테스트 커버리지 필요
  - **Skills**: []
    - 순수 TypeScript 유틸리티 — 외부 라이브러리/브라우저 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/components/OneCanvas/utils/wireSimplifier.ts:113-123` — 기존 `buildWirePolyline` 구현. 이 함수를 확장하는 형태로 canonical 빌더 생성
  - `src/components/OneCanvas/utils/wireSimplifier.ts:33-62` — `simplifyOrthogonal` 함수. 콜린리어 포인트 제거 로직 — canonical 빌더 출력에도 적용
  - `src/components/OneCanvas/utils/rubberBand.ts:74-87` — `bridgeOrthogonal` 함수. 대각 구간을 직교 꺾임으로 변환하는 패턴 참고

  **API/Type References**:
  - `src/components/OneCanvas/types.ts:714-716` — Wire의 `fromExitDirection`/`toExitDirection` 필드
  - `src/components/OneCanvas/utils/wirePathCalculator.ts:86` — `PORT_EXIT_DISTANCE = 20` 상수 (이것을 단일 소스로)
  - `src/components/OneCanvas/utils/wirePathCalculator.ts:338-347` — `getExitPoint` 함수. exit point 계산 로직
  - `src/components/OneCanvas/utils/canvasHelpers.ts:310-334` — `resolveEndpoint` 함수. port/junction 양쪽 endpoint 해석 패턴

  **Test References**:
  - `src/components/OneCanvas/utils/__tests__/canvas-commands.test.ts` — 기존 OneCanvas 유틸 테스트 패턴
  - `src/components/OneCanvas/utils/__tests__/coordinate-system-integration.test.ts` — 좌표계 테스트 구조

  **WHY Each Reference Matters**:
  - `buildWirePolyline` — 확장 대상이므로 현재 구현을 정확히 이해해야 함
  - `bridgeOrthogonal` — 대각선→직교 변환의 기존 패턴을 재사용
  - `resolveEndpoint` — junction exit direction 추론 로직을 canonical 빌더에서 재활용
  - `PORT_EXIT_DISTANCE` — 상수 중복 제거의 단일 소스 확정

  **Acceptance Criteria**:
  - [ ] `buildCanonicalWirePolyline` 함수가 `wireSimplifier.ts`에 export됨
  - [ ] `PORT_EXIT_DISTANCE`가 `wirePathCalculator.ts`에서만 정의되고 `interactionMachine.ts`의 `dist = 20`이 import로 대체됨
  - [ ] `pnpm test src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts` → PASS (최소 8개 테스트)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Port-to-port canonical polyline has no diagonals
    Tool: Bash (pnpm test)
    Preconditions: Test file exists at src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts
    Steps:
      1. Run: pnpm test src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts
      2. Assert all tests pass
      3. Verify at least one test checks: for every consecutive pair, abs(dx) < 1 OR abs(dy) < 1
    Expected Result: All tests pass, 0 failures
    Failure Indicators: Any test failure or 'diagonal' assertion error
    Evidence: .sisyphus/evidence/task-1-canonical-builder-tests.txt

  Scenario: Short wire (< 40px) does not overshoot exit points
    Tool: Bash (pnpm test)
    Preconditions: Test includes short wire case
    Steps:
      1. Run the short wire test case
      2. Verify exit point distance is clamped to max 1/3 of endpoint distance
      3. Assert no point exceeds the bounding box of from→to
    Expected Result: Exit points stay within from↔to bounds
    Failure Indicators: Point coordinates exceeding endpoint bounds
    Evidence: .sisyphus/evidence/task-1-short-wire-test.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-canonical-builder-tests.txt — full test output
  - [ ] task-1-short-wire-test.txt — short wire edge case output

  **Commit**: YES (groups with Task 2)
  - Message: `refactor(canvas): add canonical wire polyline builder with orthogonal enforcement`
  - Files: `src/components/OneCanvas/utils/wireSimplifier.ts`, `src/components/OneCanvas/utils/wirePathCalculator.ts`, `src/components/OneCanvas/machines/interactionMachine.ts`, `src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts`
  - Pre-commit: `pnpm test src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts`

- [ ] 2. `commitWirePolyline` orthogonal enforcement 안전장치

  **What to do**:
  - `canvasStore.ts`의 `commitWirePolyline` 구현에서 `polylineToHandles` 호출 전 orthogonal enforcement 추가
  - `useCanvasDocument.ts`의 `commitWirePolyline` 구현에도 동일 적용
  - Enforcement 로직: 연속 포인트 쌍 중 `abs(dx) > 1 AND abs(dy) > 1`인 경우, 중간에 orthogonal bridge point 삽입 (horizontal-first: `{x: next.x, y: prev.y}`)
  - Enforcement 후 `simplifyOrthogonal()` 호출로 불필요한 콜린리어 포인트 제거
  - `enforceOrthogonalPolyline(poly: Position[]): Position[]` 헬퍼를 `wireSimplifier.ts`에 export
  - 단위 테스트: 대각 입력 → 직교 출력 검증, 이미 직교인 입력 → 변화 없음 검증

  **Must NOT do**:
  - `polylineToHandles` 함수 자체 수정 금지
  - `WireHandle` 모델 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 헬퍼 함수 추가 + 2곳 호출 삽입 — 범위 명확
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 6
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/components/OneCanvas/utils/wireSimplifier.ts:33-62` — `simplifyOrthogonal` 패턴. enforcement 후 이것으로 정리
  - `src/components/OneCanvas/utils/rubberBand.ts:74-87` — `bridgeOrthogonal` 함수. 대각→직교 변환 패턴 재활용

  **API/Type References**:
  - `src/stores/canvasStore.ts:1119-1134` — `commitWirePolyline` 구현 위치 (canvasStore)
  - `src/stores/hooks/useCanvasDocument.ts:600-620` — `commitWirePolyline` 구현 위치 (document adapter)
  - `src/components/OneCanvas/utils/wireSimplifier.ts:125-156` — `polylineToHandles` — enforcement 결과를 이 함수에 전달

  **WHY Each Reference Matters**:
  - `commitWirePolyline` 2곳 — 두 곳 모두 동일한 enforcement를 넣어야 누락 없음
  - `simplifyOrthogonal` — enforcement 후 정리에 사용
  - `bridgeOrthogonal` — bridge 삽입 패턴 일관성 유지

  **Acceptance Criteria**:
  - [ ] `enforceOrthogonalPolyline` 함수가 `wireSimplifier.ts`에 export됨
  - [ ] `canvasStore.ts`와 `useCanvasDocument.ts` 양쪽의 `commitWirePolyline`에서 enforcement 적용됨
  - [ ] 대각 입력 polyline이 직교로 변환되는 단위 테스트 PASS

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Diagonal polyline is enforced to orthogonal on commit
    Tool: Bash (pnpm test)
    Preconditions: Unit test for enforceOrthogonalPolyline exists
    Steps:
      1. Input: [{x:0,y:0}, {x:100,y:80}, {x:200,y:80}]
      2. Call enforceOrthogonalPolyline
      3. Assert output has NO diagonal pairs (abs(dx)<1 OR abs(dy)<1 for all consecutive)
      4. Assert output length >= input length (bridge points added)
    Expected Result: All consecutive pairs are axis-aligned
    Failure Indicators: Any pair with both dx>1 AND dy>1
    Evidence: .sisyphus/evidence/task-2-orthogonal-enforcement.txt

  Scenario: Already-orthogonal polyline passes through unchanged
    Tool: Bash (pnpm test)
    Preconditions: Unit test exists
    Steps:
      1. Input: [{x:0,y:0}, {x:100,y:0}, {x:100,y:80}]
      2. Call enforceOrthogonalPolyline
      3. Assert output equals input (no bridge added)
    Expected Result: Output === Input
    Failure Indicators: Extra points inserted or points moved
    Evidence: .sisyphus/evidence/task-2-orthogonal-passthrough.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-orthogonal-enforcement.txt
  - [ ] task-2-orthogonal-passthrough.txt

  **Commit**: YES (groups with Task 1)
  - Message: `refactor(canvas): add canonical wire polyline builder with orthogonal enforcement`
  - Files: `src/components/OneCanvas/utils/wireSimplifier.ts`, `src/stores/canvasStore.ts`, `src/stores/hooks/useCanvasDocument.ts`
  - Pre-commit: `pnpm test`


- [ ] 3. WireRenderer `segmentPoints` + `pathD` 통합 — 단일 geometry 소스

  **What to do**:
  - `WireRenderer.tsx`에서 `segmentPoints` 계산을 `buildCanonicalWirePolyline` 호출로 교체
  - `pathD` 계산도 동일한 `segmentPoints`로부터 `segmentsToPath(segmentPoints, cornerRadius)` 호출로 통합
  - 기존 3갈래 분기 제거: `calculatePathWithHandles` / `calculatePathWithExitDirections` / `calculateWirePath` → 단일 `segmentsToPath(canonicalPoly)` 로 통일
  - `draftPoly`가 있을 때도 정규 빌더 결과 대신 `draftPoly`를 사용하되, 동일한 `segmentsToPath` 경로로 렌더링
  - 세그먼트 drag hit area의 `<line>` 요소들이 시각적 SVG path와 정확히 일치하는지 확인
  - `segmentPoints` index가 drag engine이 받는 `data-seg-index`와 1:1 대응됨을 보장
  - **주의**: `Wire.tsx` (standalone Wire component)도 동일한 변경 적용 필요 — `WireRenderer.tsx`와 동일 패턴

  **Must NOT do**:
  - `calculateOrthogonalRoute` / `calculateOrthogonalPath` 수정 금지
  - 새로운 SVG 요소 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 렌더러 내부 3갈래 분기 제거 + 정규 빌더 연동 — 중간 복잡도
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References** (CRITICAL):

  **Pattern References**:
  - `src/components/OneCanvas/content/WireRenderer.tsx:114-145` — 현재 3갈래 `pathD` 분기 로직. 이것을 단일 `segmentsToPath(canonicalPoly)` 호출로 대체
  - `src/components/OneCanvas/content/WireRenderer.tsx:152-157` — 현재 `segmentPoints` 빌드 로직. canonical 빌더 호출로 교체
  - `src/components/OneCanvas/content/WireRenderer.tsx:282-304` — segment drag hit area `<line>` 요소들. segmentPoints와 index 일치 확인
  - `src/components/OneCanvas/Wire.tsx:112-138` — standalone Wire component의 `pathD` 로직. 동일 패턴 적용 필요

  **API/Type References**:
  - `src/components/OneCanvas/utils/wirePathCalculator.ts:220-270` — `segmentsToPath` 함수. canonical poly → SVG path 변환
  - `src/components/OneCanvas/utils/wireSimplifier.ts` — `buildCanonicalWirePolyline` (Task 1에서 생성)

  **Acceptance Criteria**:
  - [ ] `WireRenderer.tsx`에서 `calculatePathWithHandles`, `calculatePathWithExitDirections`, `calculateWirePath` 직접 호출이 제거됨
  - [ ] `pathD`와 `segmentPoints`가 동일한 소스(`buildCanonicalWirePolyline`)에서 파생됨
  - [ ] `pnpm build` 성공

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Visual path and hit-area segments are aligned
    Tool: Playwright
    Preconditions: OneCanvas with at least 2 blocks connected by a wire
    Steps:
      1. Navigate to OneCanvas panel
      2. Click a wire to select it
      3. Inspect SVG: count <path> segments vs <line data-wire-segment> elements
      4. For each <line>, verify x1,y1,x2,y2 correspond to consecutive points on the visual path
    Expected Result: Every <line> hit-area overlaps a visual path segment. No orphan lines, no missing segments.
    Failure Indicators: <line> coordinates don't match visual path, or segment count mismatch
    Evidence: .sisyphus/evidence/task-3-hit-area-alignment.png

  Scenario: No diagonal visual artifacts on auto-routed wire
    Tool: Playwright
    Preconditions: Two blocks with right/left port arrangement
    Steps:
      1. Create wire between right port → left port
      2. Screenshot the wire
      3. Verify all visible segments are strictly horizontal or vertical
    Expected Result: Clean orthogonal wire path
    Failure Indicators: Any visible diagonal line segment
    Evidence: .sisyphus/evidence/task-3-no-diagonal-auto.png
  ```

  **Commit**: YES (groups with Tasks 4, 5)
  - Message: `refactor(canvas): migrate all wire geometry consumers to canonical builder`
  - Files: `src/components/OneCanvas/content/WireRenderer.tsx`, `src/components/OneCanvas/Wire.tsx`

- [ ] 4. SpatialIndex + drag engine 정규 빌더 전환

  **What to do**:
  - `SpatialIndex.ts`의 wire geometry 빌드를 `buildCanonicalWirePolyline` 호출로 교체
  - `interactionMachine.ts`의 `prepareWireSegmentDragging`에서 `buildWirePolyline` 대신 `buildCanonicalWirePolyline` 호출
  - `findWireSnapTarget`도 canonical poly 기반으로 전환
  - `ensureMovableSegment` stub 삽입 로직 검토 — canonical poly는 exit point 포함으로 최소 4점, stub 불필요 가능성
  - `segIndex` 매핑이 renderer의 `segmentPoints` index와 1:1 대응 확인 (둘 다 canonical을 쓰므로 자동 일치)

  **Must NOT do**:
  - XState 머신 구조 변경 금지
  - Handle 드래그 경로 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: SpatialIndex + drag engine 2개 영역 동시 수정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References** (CRITICAL):

  **Pattern References**:
  - `src/components/OneCanvas/utils/SpatialIndex.ts:107-130` — 현재 wire geometry 빌드
  - `src/components/OneCanvas/machines/interactionMachine.ts:944-970` — `prepareWireSegmentDragging`
  - `src/components/OneCanvas/machines/interactionMachine.ts:340-360` — `findWireSnapTarget`
  - `src/components/OneCanvas/utils/wireSimplifier.ts:225-264` — `ensureMovableSegment`

  **Acceptance Criteria**:
  - [ ] `SpatialIndex.ts`에서 `buildCanonicalWirePolyline` import 사용
  - [ ] `prepareWireSegmentDragging`에서 `buildCanonicalWirePolyline` 사용
  - [ ] `findWireSnapTarget`에서 canonical poly 사용
  - [ ] `pnpm build` 성공

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Drag segment index matches visual segment
    Tool: Playwright
    Preconditions: Wire with 3+ visible segments (handles exist)
    Steps:
      1. Select wire, drag the MIDDLE segment perpendicular to its orientation
      2. Verify the correct visual segment moves (not an adjacent one)
      3. Release, verify no diagonal artifacts
    Expected Result: Middle segment moves cleanly, wire remains orthogonal
    Failure Indicators: Wrong segment moves, or diagonal after release
    Evidence: .sisyphus/evidence/task-4-segment-index-match.png
  ```

  **Commit**: YES (groups with Tasks 3, 5)
  - Message: `refactor(canvas): migrate all wire geometry consumers to canonical builder`
  - Files: `src/components/OneCanvas/utils/SpatialIndex.ts`, `src/components/OneCanvas/machines/interactionMachine.ts`

- [ ] 5. interactionMachine direct-wire drag 리팩터

  **What to do**:
  - `applyWireSegmentDragging`의 `segmentWasDirect` 특수 분기(lines 1025-1064) 제거
  - canonical poly가 이미 exit point를 포함하므로, direct wire도 일반 wire와 동일한 `dragSegment` 경로로 처리
  - `resolveWireEndpointExitPoint` 함수 제거 (더 이상 필요 없음 — canonical 빌더가 exit point 처리)
  - `segmentWasDirect` context 필드 제거
  - `finalizeWireSegmentDragging`에서 `buildWirePolyline` 대신 `buildCanonicalWirePolyline` 사용
  - Commit polyline에서 exit point를 제외하고 handle만 저장해야 함 — commit 시 `poly.slice(exitPointCount, -exitPointCount)` 또는 canonical builder에서 `handleOnly` 옵션

  **Must NOT do**:
  - XState 머신 구조 변경 금지
  - Handle 드래그 경로 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: drag state machine 내부 분기 제거 + exit point 저장 방지 로직 — 신중한 접근 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References** (CRITICAL):

  **Pattern References**:
  - `src/components/OneCanvas/machines/interactionMachine.ts:1025-1064` — `segmentWasDirect` 특수 분기 (제거 대상)
  - `src/components/OneCanvas/machines/interactionMachine.ts:252-292` — `resolveWireEndpointExitPoint` (제거 대상)
  - `src/components/OneCanvas/machines/interactionMachine.ts:1090-1105` — `finalizeWireSegmentDragging`
  - `src/components/OneCanvas/utils/wireSimplifier.ts:266-287` — `dragSegment` — 모든 wire가 이 경로로 통일

  **API/Type References**:
  - `src/components/OneCanvas/machines/interactionMachine.ts:84-121` — `InteractionContext` type. `segmentWasDirect` 필드 제거 필요

  **Acceptance Criteria**:
  - [ ] `segmentWasDirect` 필드와 특수 분기가 제거됨
  - [ ] `resolveWireEndpointExitPoint` 함수가 제거됨
  - [ ] Direct wire drag가 `dragSegment` 단일 경로로 처리됨
  - [ ] Commit 시 exit point가 handle로 저장되지 않음
  - [ ] `pnpm build` 성공

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Direct wire drag creates orthogonal result
    Tool: Playwright
    Preconditions: Two blocks connected by auto-routed wire (no handles)
    Steps:
      1. Select the wire
      2. Drag the wire segment perpendicular to its orientation by 40px
      3. Release mouse
      4. Re-select the wire
      5. Verify all segments are orthogonal
      6. Drag one of the NEW segments created by the first drag
      7. Verify it moves correctly (no stuck, no diagonal)
    Expected Result: First drag creates orthogonal elbows, second drag works on new segments
    Failure Indicators: Diagonal on first drag, or second drag non-functional
    Evidence: .sisyphus/evidence/task-5-direct-wire-roundtrip.png

  Scenario: Exit points are not stored as handles
    Tool: Bash (node REPL or pnpm test)
    Preconditions: Wire has been dragged and committed
    Steps:
      1. After drag-commit, read wire.handles from store
      2. Count handles vs canonical polyline points
      3. Verify handles.length < canonicalPoly.length - 2 (exit points excluded)
    Expected Result: Handles contain only interior control points, not exit points
    Failure Indicators: handle count equals canonical poly length - 2 (exit points included)
    Evidence: .sisyphus/evidence/task-5-no-exit-in-handles.txt
  ```

  **Commit**: YES (groups with Tasks 3, 4)
  - Message: `refactor(canvas): migrate all wire geometry consumers to canonical builder`
  - Files: `src/components/OneCanvas/machines/interactionMachine.ts`

- [ ] 6. Round-trip 통합 테스트

  **What to do**:
  - `src/components/OneCanvas/utils/__tests__/wireGeometryRoundtrip.test.ts` 생성
  - 테스트 케이스:
    - `buildCanonicalWirePolyline` → `polylineToHandles` → 저장 → `buildCanonicalWirePolyline` = 동일 geometry
    - Drag → commit → rebuild = 동일 geometry (분기 없음)
    - 연속 3회 드래그 → 매번 orthogonal 유지
    - Junction-connected wire round-trip
    - `enforceOrthogonalPolyline`이 commit에서 실제로 대각선을 잡아내는지 검증
  - `pnpm test` 전체 실행하여 회귀 검증

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential after Wave 2)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 2, 3, 4, 5

  **References**:
  - `src/components/OneCanvas/utils/__tests__/buildCanonicalWirePolyline.test.ts` (Task 1 결과물) — 테스트 패턴 참고
  - `src/components/OneCanvas/utils/wireSimplifier.ts` — 모든 대상 함수

  **Acceptance Criteria**:
  - [ ] Round-trip 테스트 파일 존재 및 최소 5개 테스트 PASS
  - [ ] `pnpm test` 전체 PASS (기존 LadderEditor 1건 제외)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full test suite passes
    Tool: Bash (pnpm test)
    Steps:
      1. Run: pnpm test
      2. Verify all new tests pass
      3. Verify no regression in existing tests
    Expected Result: All tests pass except known LadderEditor failure
    Failure Indicators: New test failures
    Evidence: .sisyphus/evidence/task-6-test-suite.txt
  ```

  **Commit**: YES
  - Message: `test(canvas): add round-trip and E2E wire geometry verification`
  - Files: `src/components/OneCanvas/utils/__tests__/wireGeometryRoundtrip.test.ts`

- [ ] 7. E2E Playwright 검증

  **What to do**:
  - Playwright로 실제 브라우저에서 wire 드래그 시나리오 검증:
    - Wire 선택 → segment 드래그 → 릴리즈 → 대각선 없음 확인
    - 드래그로 생성된 새 segment 재드래그 확인
    - 짧은 wire(부품 바로 옆) 드래그 확인
    - Junction 연결 wire 드래그 확인
    - 연속 3회 드래그 시나리오

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 6)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 6

  **Acceptance Criteria**:
  - [ ] 모든 E2E 시나리오 스크린샷 증거 존재
  - [ ] 대각선 아티팩트 없음
  - [ ] 재드래그 동작 확인

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full drag round-trip with no diagonals
    Tool: Playwright
    Preconditions: Fresh OneCanvas with 2 blocks and 1 wire
    Steps:
      1. Click wire to select
      2. Drag a segment 50px perpendicular
      3. Screenshot (verify orthogonal)
      4. Click wire again to re-select
      5. Drag one of the NEW segments 30px perpendicular
      6. Screenshot (verify still orthogonal)
      7. Repeat drag on another segment
      8. Final screenshot (no diagonals anywhere)
    Expected Result: All 3 screenshots show clean orthogonal wires
    Failure Indicators: Any diagonal in any screenshot
    Evidence: .sisyphus/evidence/task-7-e2e-drag-round-trip-{1,2,3}.png

  Scenario: Short wire drag does not create artifacts
    Tool: Playwright
    Preconditions: Two blocks placed very close (< 60px apart)
    Steps:
      1. Connect wire between adjacent ports
      2. Select wire, drag segment
      3. Screenshot
    Expected Result: Wire maintains orthogonal shape even when very short
    Failure Indicators: Overlapping segments or diagonal artifacts
    Evidence: .sisyphus/evidence/task-7-short-wire-drag.png
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `test(canvas): add round-trip and E2E wire geometry verification`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm build` + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: empty state, very short wire, junction-connected wire, rapid sequential drags.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1 완료**: `refactor(canvas): add canonical wire polyline builder with orthogonal enforcement`
- **Wave 2 완료**: `refactor(canvas): migrate all wire geometry consumers to canonical builder`
- **Wave 3 완료**: `test(canvas): add round-trip and E2E wire geometry verification`

---

## Success Criteria

### Verification Commands
```bash
pnpm build          # Expected: success
pnpm test           # Expected: all new tests pass
```

### Final Checklist
- [ ] 단일 정규 빌더가 모든 geometry 소비자에 사용됨
- [ ] Commit 시 대각선 포인트가 걸러짐
- [ ] 드래그 → 릴리즈 → 재드래그 사이클에 대각선 없음
- [ ] Exit point가 handle로 저장되지 않음
- [ ] PORT_EXIT_DISTANCE 상수 중복 제거됨
- [ ] Auto-routing 알고리즘 미변경
- [ ] WireHandle 데이터 모델 미변경
