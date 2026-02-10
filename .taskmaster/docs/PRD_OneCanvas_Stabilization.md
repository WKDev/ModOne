# PRD: OneCanvas Architecture Stabilization

## 1. Problem Statement

OneCanvas는 현재 **이중 상태 소유권(split-brain)** 구조에서 기능 추가와 버그 수정을 반복하는 악순환에 빠져 있다. 글로벌 `canvasStore`와 문서 기반 `documentRegistry`가 동시에 진실(truth)을 주장하며, UI 컴포넌트들이 양쪽을 임의로 접근하기 때문에 한쪽 경로를 고치면 다른 쪽에서 회귀가 발생한다.

### 핵심 증거

| # | 문제 | 파일 | 심각도 |
|---|------|------|--------|
| E1 | 글로벌/문서 이중 상태 | `canvasStore.ts` vs `documentRegistry.ts` + `useCanvasDocument.ts` | Critical |
| E2 | 문서모드에서 글로벌 직접 접근 (schematic page switch) | `OneCanvasPanel.tsx:108,115` — `useCanvasStore.getState().getCircuitData()` / `loadCircuit()` | Critical |
| E3 | align/distribute/flip 로직 중복 | `useCanvasState.ts:133-267` (문서용) vs `canvasStore.ts:603-746` (글로벌용) | High |
| E4 | 키보드 단축키 훅이 글로벌만 사용 | `useCanvasKeyboardShortcuts.ts` — 문서모드 무시 | High |
| E5 | 커맨드 팔레트가 글로벌만 사용 (26곳) | `canvasCommands.tsx` — `useCanvasStore.getState()` 26회 | High |
| E6 | SearchPanel이 글로벌만 사용 | `SearchPanel.tsx:45-49` | Medium |
| E7 | useDragDrop/useWireDrawing이 글로벌 직접 접근 | `useDragDrop.ts`, `useWireDrawing.ts` | High |
| E8 | 브릿지가 양쪽 전체를 구독 (387줄 중 ~30 selector) | `useCanvasState.ts:34-64` | Medium |
| E9 | 멀티윈도우 sync가 merge 없이 overwrite | `stateSync.ts:114` | High |
| E10 | save-on-close가 TODO stub | `useTabClose.ts:172`, `useWindowClose.ts:61` | High |
| E11 | 파일 열기 시 문서 로드 미구현 | `useFileOpen.ts:115-117` | High |
| E12 | 멀티윈도우 E2E 전부 skip | `floating-window.spec.ts:193` | Medium |
| E13 | OneCanvas/document 관련 테스트 0건 | `src/stores/__tests__/` — canvas/document 테스트 없음 | High |
| E14 | useCanvasKeyboardShortcuts에 `as` 캐스팅 | `useCanvasKeyboardShortcuts.ts:186-202` — `comp as {...}`, `w as {...}` | Low |
| E15 | 레거시/신규 레이아웃 공존 | `layoutPersistenceStore.ts`, `useTabClose.ts` — legacy + VSCode-style 혼재 | Medium |

---

## 2. Goal

**OneCanvas의 상태 모델을 단일 소유권(Single Source of Truth)으로 수렴시켜**, 기능 추가 시 회귀가 발생하지 않는 구조를 만든다.

### 성공 기준

1. UI 컴포넌트에서 `canvasStore`를 직접 import하는 곳이 0개 (facade를 통해서만 접근)
2. align/distribute/flip/selection 로직이 정확히 1벌만 존재
3. 키보드 단축키, 커맨드 팔레트, 검색이 문서모드에서 정상 동작
4. save/close 플로우가 TODO 없이 완전히 구현됨
5. 핵심 경로(select, drag, wire, undo/redo, page switch) 각각에 대해 contract test 존재
6. 멀티윈도우 E2E 최소 1개가 CI에서 통과

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────┐
│                    UI Components                     │
│  OneCanvasPanel, Canvas, hooks, Toolbox, Toolbar...  │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │           CanvasFacade (Hook)                │    │
│  │  - selectors (components, wires, zoom, ...)  │    │
│  │  - commands (add, move, align, delete, ...)  │    │
│  │  - circuitIO (load, save, getCircuitData)   │    │
│  │  - interaction (wireDrawing, selection)      │    │
│  │  - history (undo, redo)                      │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │ (single entry point)               │
├─────────────────┼────────────────────────────────────┤
│  Adapter Layer  │                                    │
│  ┌──────────────┴──────────────────────────────┐    │
│  │  DocumentCanvasAdapter (Primary)             │    │
│  │  → wraps documentRegistry + useCanvasDocument│    │
│  │  → calls shared canvas-commands module       │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │  GlobalCanvasAdapter (Temporary/Fallback)    │    │
│  │  → wraps canvasStore (same interface)        │    │
│  │  → to be removed at 90 days                  │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  Shared Domain Logic (Pure Functions)                │
│  ┌──────────────────────────────────────────────┐    │
│  │  canvas-commands.ts                          │    │
│  │  - alignComponents(components, selectedIds)  │    │
│  │  - distributeComponents(...)                 │    │
│  │  - flipComponents(...)                       │    │
│  │  - selectAll(components)                     │    │
│  │  - deleteSelected(components, wires, ids)    │    │
│  │  - copyPaste(components, wires, ids)         │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │  canvasHelpers.ts (기존, 유지)               │    │
│  │  - generateId, snapToGrid, wireExists, ...   │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  State Stores                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  documentRegistry.ts (Primary Truth)         │    │
│  │  → CanvasDocumentState per document          │    │
│  │  → history snapshots per document            │    │
│  └──────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────┐    │
│  │  canvasStore.ts (Legacy, 90일 후 제거)       │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 핵심 원칙

1. **UI → Facade만 접근**: `useCanvasStore`를 컴포넌트에서 직접 import 금지
2. **Facade → Adapter 선택**: documentId가 있으면 DocumentAdapter, 없으면 GlobalAdapter
3. **도메인 로직 단일화**: align/distribute/flip/copyPaste/delete 등은 `canvas-commands.ts` 순수 함수 모듈에 1벌
4. **Dev-time invariant**: 문서모드에서 글로벌 스토어 접근 시 `console.error` + assertion

---

## 4. Stabilization Phases

### Phase 1: Stop the Bleeding (Week 1-2)

> 목표: 가장 치명적인 경계 침범을 차단하고, 향후 마이그레이션의 기반을 구축

#### Task 1.1: CanvasFacade Hook 정의 및 구현
- **파일**: `src/hooks/useCanvasFacade.ts` (신규)
- **내용**:
  - `useCanvasState.ts`의 멀티플렉싱 로직을 흡수
  - 반환 인터페이스: `CanvasFacadeReturn` (selectors + commands + circuitIO + interaction + history)
  - documentId가 있으면 `useCanvasDocument` 기반, 없으면 글로벌 스토어 기반
  - dev-only assertion: 문서모드에서 `canvasStore.getState()` 호출 시 경고
- **게이트**: `useCanvasFacade`가 `useCanvasState`와 동일한 인터페이스를 반환하며, 기존 테스트 통과

#### Task 1.2: canvas-commands.ts 순수 함수 모듈 추출
- **파일**: `src/components/OneCanvas/utils/canvas-commands.ts` (신규)
- **내용**:
  - `useCanvasState.ts:133-267`의 align/distribute/flip 로직 추출
  - `canvasStore.ts:603-746`의 동일 로직과 통합 (하나만 남김)
  - 순수 함수: `(components: Map, selectedIds: Set) => Map` 형태
  - 테스트 추가: 각 함수에 대해 최소 2개 케이스
- **게이트**: `useCanvasState.ts`와 `canvasStore.ts`에서 중복 로직 제거, 둘 다 `canvas-commands.ts` 호출
- **증거**: E3 해소

#### Task 1.3: OneCanvasPanel의 글로벌 직접 접근 제거
- **파일**: `src/components/panels/content/OneCanvasPanel.tsx`
- **변경**:
  - L108: `useCanvasStore.getState().getCircuitData()` → facade의 `circuitIO.getCircuitData(documentId)`
  - L115: `useCanvasStore.getState().loadCircuit(...)` → facade의 `circuitIO.loadCircuit(documentId, ...)`
  - L22: `import { useCanvasStore }` 제거
  - L218: `useCanvasKeyboardShortcuts()` → facade 기반 단축키로 교체 (Task 1.4에서)
- **게이트**: `OneCanvasPanel.tsx`에서 `canvasStore` import 0개
- **증거**: E2 해소

#### Task 1.4: useCanvasKeyboardShortcuts를 facade 기반으로 전환
- **파일**: `src/components/OneCanvas/hooks/useCanvasKeyboardShortcuts.ts`
- **변경**:
  - `useCanvasStore` 의존 → facade 파라미터로 주입받도록 변경
  - `components`, `wires`, `selectedIds`, `addComponent`, `removeComponent`, `undo`, `redo` 등을 facade에서 받기
  - 클립보드 로직의 `as` 캐스팅 제거 → 타입 안전 인터페이스 사용
- **게이트**: `useCanvasKeyboardShortcuts.ts`에서 `canvasStore` import 0개
- **증거**: E4, E14 해소

#### Task 1.5: canvasCommands.tsx를 facade 기반으로 전환
- **파일**: `src/components/CommandPalette/commands/canvasCommands.tsx`
- **변경**:
  - `useCanvasStore.getState()` 26곳 → facade 또는 registry를 통한 접근으로 교체
  - 커맨드 등록 시 현재 활성 documentId를 resolve하는 헬퍼 함수 도입
  - `getActiveCanvasDocumentId(): string | null` — editorAreaStore에서 현재 활성 탭의 documentId 추출
- **게이트**: `canvasCommands.tsx`에서 `canvasStore` import 0개
- **증거**: E5 해소

#### Task 1.6: SearchPanel을 facade 기반으로 전환
- **파일**: `src/components/sidebar/SearchPanel.tsx`
- **변경**:
  - `useCanvasStore` 의존 → 활성 문서의 components를 facade/registry로 접근
  - selection/pan/zoom도 facade 경유
- **게이트**: `SearchPanel.tsx`에서 `canvasStore` import 0개
- **증거**: E6 해소

#### Task 1.7: useDragDrop과 useWireDrawing의 글로벌 접근 제거
- **파일**:
  - `src/components/OneCanvas/hooks/useDragDrop.ts`
  - `src/components/OneCanvas/hooks/useWireDrawing.ts`
- **변경**:
  - 두 훅 모두 facade 파라미터를 받도록 인터페이스 변경
  - `useCanvasStore` import 제거
  - 호출부(`OneCanvasPanel.tsx`)에서 facade 값 전달
- **게이트**: 두 파일에서 `canvasStore` import 0개
- **증거**: E7 해소

#### Task 1.8: useCanvasState.ts 브릿지를 thin adapter로 축소
- **파일**: `src/components/panels/content/canvas/useCanvasState.ts`
- **변경**:
  - 387줄 → ~50줄로 축소
  - align/distribute/flip 로직 제거 (canvas-commands.ts로 이동됨)
  - wireDrawing/selection state 로직은 facade로 이관
  - 이 파일은 `useCanvasFacade`로 대체 후 최종 삭제 대상
- **게이트**: 파일 내 도메인 로직 0줄, 순수 라우팅만 존재
- **증거**: E3, E8 해소

### Phase 2: Contract Tests & Lifecycle 완성 (Week 3-4)

> 목표: 테스트 게이트를 세워 회귀를 자동 감지하고, 미완성 lifecycle을 구현

#### Task 2.1: CanvasFacade Contract Test Suite
- **파일**: `src/stores/__tests__/canvasFacade.contract.test.ts` (신규)
- **테스트 항목** (각 adapter에 대해 동일 테스트 실행):
  1. addComponent → components에 추가됨
  2. moveComponent → position 변경됨
  3. addWire → wires에 추가됨
  4. removeWire → wires에서 제거됨
  5. setSelection → selectedIds 반영됨
  6. align/distribute/flip → 정확한 좌표 계산
  7. loadCircuit → 모든 데이터 로드됨
  8. getCircuitData → serializable 형태 반환
  9. pushHistory + undo → 이전 상태 복원
  10. pushHistory + undo + redo → 다시 복원
- **게이트**: 10개 테스트 × 2 adapter = 20개 통과
- **증거**: E13 해소

#### Task 2.2: canvas-commands 단위 테스트
- **파일**: `src/components/OneCanvas/utils/__tests__/canvas-commands.test.ts` (신규)
- **테스트 항목**:
  1. alignLeft — 모든 컴포넌트의 x가 최소값
  2. alignRight — 모든 컴포넌트의 x+width가 최대값
  3. alignTop, alignBottom, centerH, centerV
  4. distributeHorizontal — 균등 간격
  5. distributeVertical — 균등 간격
  6. distributeHorizontal 3개 미만 시 무동작
  7. flipHorizontal — 중심축 기준 반전
  8. flipVertical — 중심축 기준 반전
- **게이트**: 8+ 테스트 통과

#### Task 2.3: save-on-close 플로우 구현
- **파일**:
  - `src/hooks/useTabClose.ts` — L172의 TODO 구현
  - `src/hooks/useWindowClose.ts` — L61의 TODO 구현
  - `src/services/canvasService.ts` — 기존 saveCircuit 활용
- **변경**:
  - Tab close 시: documentId로 문서 데이터 추출 → canvasService.saveCircuit 호출
  - Window close 시: 모든 dirty 문서에 대해 save 실행
  - 에러 핸들링: 저장 실패 시 사용자에게 재시도/강제닫기 선택
- **게이트**: TODO 주석 0개, save 실패 시나리오 테스트 존재
- **증거**: E10 해소

#### Task 2.4: 파일 열기 시 문서 로드 구현
- **파일**: `src/hooks/useFileOpen.ts` — L115-117의 TODO 구현
- **변경**:
  - canvas 타입: `canvasService.loadCircuit(path)` → `documentRegistry.loadCanvasCircuit(docId, circuit)`
  - schematic 타입: 파일 로드 → `documentRegistry.updateSchematicData(docId, data)`
  - scenario 타입: 파일 로드 → `documentRegistry.updateScenarioData(docId, data)`
  - 에러 핸들링: 로드 실패 시 `setDocumentStatus(docId, 'error', message)`
- **게이트**: TODO 주석 0개, 로드 에러 테스트 존재
- **증거**: E11 해소

#### Task 2.5: 멀티윈도우 State Sync에 merge 로직 추가
- **파일**: `src/utils/stateSync.ts`
- **변경**:
  - 문서 단위 sync: 전체 state overwrite → 문서 ID + revision 기반 merge
  - `StateSyncPayload`에 `documentId`, `revision` 필드 추가
  - `mergeState` 옵션의 실제 merge 로직 구현 (현재 dead code)
  - conflict resolution: revision이 높은 쪽 우선
- **게이트**: merge 테스트 존재 (두 윈도우가 동시에 업데이트해도 데이터 유실 없음)
- **증거**: E9 해소

#### Task 2.6: 멀티윈도우 E2E 1개 게이트화
- **파일**: `tests/e2e/floating-window.spec.ts`
- **변경**:
  - "can undock panel via undock button" 테스트 1개를 unskip하고 구현
  - Tauri webdriver 설정이 불가능한 경우: 단일 윈도우 내 state sync 시뮬레이션 테스트로 대체
- **게이트**: CI에서 1주간 non-flaky 통과
- **증거**: E12 부분 해소

### Phase 3: 레거시 정리 & 최종 수렴 (Week 5-8)

> 목표: 글로벌 canvasStore를 완전히 제거하고, 문서 기반 단일 소유권 확립

#### Task 3.1: 글로벌 canvasStore를 GlobalCanvasAdapter로 격리
- **파일**: `src/stores/adapters/globalCanvasAdapter.ts` (신규)
- **변경**:
  - `canvasStore.ts`의 로직을 CanvasFacade 인터페이스를 구현하는 adapter로 래핑
  - 직접 import 경로 차단 (eslint rule 또는 barrel export 제거)
- **게이트**: `canvasStore`를 직접 import하는 컴포넌트 0개

#### Task 3.2: useBlockDrag, useSelectionHandler를 facade 파라미터 주입으로 완전 전환
- **파일**:
  - `src/components/OneCanvas/hooks/useBlockDrag.ts`
  - `src/components/OneCanvas/hooks/useSelectionHandler.ts`
- **변경**:
  - 이미 `options` 파라미터로 override를 받는 구조 → 글로벌 fallback 제거
  - `useCanvasStore` import 완전 제거
- **게이트**: 두 파일에서 `canvasStore` import 0개

#### Task 3.3: 레거시 레이아웃 경로 정리
- **파일**:
  - `src/stores/layoutPersistenceStore.ts`
  - `src/hooks/useTabClose.ts`
  - `src/config/layoutPresets.ts`
- **변경**:
  - "legacy" 주석이 달린 grid layout 코드 제거
  - `useTabClose`에서 legacy panel store 분기 제거
  - VSCode-style layout만 남김
- **게이트**: "legacy" 주석/분기 0개
- **증거**: E15 해소

#### Task 3.4: 문서 기반을 기본값으로 전환
- **변경**:
  - 파일 열 때 항상 documentId 할당 (현재는 일부만)
  - CanvasFacade에서 fallback(글로벌) 경로를 deprecation 경고로 변경
  - `canvasStore.ts`에 "DEPRECATED" 주석 추가
- **게이트**: 정상 사용 시나리오에서 글로벌 adapter가 호출되지 않음

#### Task 3.5: canvasStore.ts 제거
- **변경**:
  - `canvasStore.ts` 삭제
  - `GlobalCanvasAdapter` 삭제
  - CanvasFacade에서 fallback 분기 제거
  - 모든 관련 import 정리
- **게이트**: 빌드 성공, 전체 테스트 통과, `canvasStore` 문자열 검색 0건

---

## 5. Week 1 Execution Checklist (파일 단위)

### Day 1-2: 기반 구축

| # | 작업 | 대상 파일 | 예상 시간 |
|---|------|----------|-----------|
| 1 | `CanvasFacadeReturn` 인터페이스 정의 | `src/types/canvasFacade.ts` (신규) | 1h |
| 2 | `canvas-commands.ts` 순수 함수 추출 | `src/components/OneCanvas/utils/canvas-commands.ts` (신규) | 2h |
| 3 | `canvas-commands.test.ts` 작성 | `src/components/OneCanvas/utils/__tests__/canvas-commands.test.ts` (신규) | 1.5h |
| 4 | `canvasStore.ts`에서 align/distribute/flip을 `canvas-commands.ts` 호출로 교체 | `src/stores/canvasStore.ts` | 1h |
| 5 | `useCanvasState.ts`에서 align/distribute/flip을 `canvas-commands.ts` 호출로 교체 | `src/components/panels/content/canvas/useCanvasState.ts` | 1h |

### Day 3-4: Facade 도입 + 핵심 경계 차단

| # | 작업 | 대상 파일 | 예상 시간 |
|---|------|----------|-----------|
| 6 | `useCanvasFacade.ts` 구현 (useCanvasState.ts 기반 리팩터링) | `src/hooks/useCanvasFacade.ts` (신규) | 3h |
| 7 | `OneCanvasPanel.tsx`에서 `useCanvasState` → `useCanvasFacade` 교체 | `src/components/panels/content/OneCanvasPanel.tsx` | 1.5h |
| 8 | `OneCanvasPanel.tsx`의 schematic page switch를 facade 기반으로 전환 | `src/components/panels/content/OneCanvasPanel.tsx` | 1h |
| 9 | `useCanvasKeyboardShortcuts.ts`를 facade 파라미터 주입으로 전환 | `src/components/OneCanvas/hooks/useCanvasKeyboardShortcuts.ts` | 2h |

### Day 5: 나머지 소비자 전환 + 검증

| # | 작업 | 대상 파일 | 예상 시간 |
|---|------|----------|-----------|
| 10 | `canvasCommands.tsx` facade 전환 | `src/components/CommandPalette/commands/canvasCommands.tsx` | 2h |
| 11 | `SearchPanel.tsx` facade 전환 | `src/components/sidebar/SearchPanel.tsx` | 0.5h |
| 12 | `useDragDrop.ts` facade 전환 | `src/components/OneCanvas/hooks/useDragDrop.ts` | 1h |
| 13 | `useWireDrawing.ts` facade 전환 | `src/components/OneCanvas/hooks/useWireDrawing.ts` | 1h |
| 14 | 전체 빌드 + 기존 테스트 통과 확인 | — | 0.5h |
| 15 | `canvasStore` import 검색 → 컴포넌트 레이어에서 0건 확인 | — | 0.5h |

### Week 1 완료 게이트

- [ ] `src/components/**`에서 `canvasStore`를 직접 import하는 파일 0개
- [ ] `canvas-commands.ts` 테스트 8개 이상 통과
- [ ] align/distribute/flip 로직이 코드베이스 전체에서 정확히 1벌
- [ ] 빌드 성공 (exit code 0)
- [ ] 기존 22개 테스트 파일 전체 통과

---

## 6. Migration Rules (모든 단계에 적용)

1. **한 번에 하나의 소비자만 전환**: 여러 파일을 동시에 바꾸면 회귀 원인 특정 불가
2. **전환 후 즉시 빌드 확인**: 각 파일 전환 후 `pnpm run build` 통과 필수
3. **기존 동작 보존 우선**: 새 기능 추가 금지, 리팩터링만 수행
4. **타입 안전성 절대 유지**: `as any`, `@ts-ignore`, `@ts-expect-error` 사용 금지
5. **Rollback 단위**: 각 Task는 독립 커밋, 문제 시 개별 revert 가능

---

## 7. Out of Scope

이 PRD에서 다루지 않는 항목:

- Reactive Signals 도입 (tldraw 스타일) — 현재 React + Zustand 구조 유지
- Delta-based History 전환 — 현재 snapshot 방식 유지 (성능 문제 발생 시 별도 PRD)
- Plugin System 도입 — 현재 규모에서는 불필요
- 새로운 블록 타입 추가 — 안정화 완료 후 별도 진행
- ProseMirror-style Schema Validation — 현재 TypeScript 타입으로 충분

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Facade 인터페이스가 기존 API와 미스매치 | Medium | High | `useCanvasState.ts`의 반환 타입을 그대로 사용하여 1:1 매핑 보장 |
| 커맨드 팔레트가 비-React 컨텍스트에서 호출 | High | Medium | `getActiveCanvasDocumentId()` 헬퍼로 현재 활성 문서 ID를 항상 resolve |
| 기존 글로벌 모드 사용자가 영향받음 | Low | High | Phase 1에서는 fallback으로 글로벌 유지, Phase 3에서만 제거 |
| 멀티윈도우 sync 변경이 기존 플로우 깨뜨림 | Medium | High | Phase 2에서 merge 도입 전에 E2E 테스트 먼저 작성 |
