# OneCanvas Stabilization — Week 1: CanvasFacade 도입 및 경계 차단

> PRD: `.taskmaster/docs/PRD_OneCanvas_Stabilization.md` Phase 1
> Goal: `src/components/**`에서 `canvasStore` 직접 import 0개 + 도메인 로직 단일화

## Context

### 현재 상태 (as-is)
- `canvasStore` 직접 import: **7개 파일** (components 레이어)
  - `SearchPanel.tsx` (1)
  - `useCanvasState.ts` (2: import + type import)
  - `OneCanvasPanel.tsx` (1)
  - `CanvasInteractionHandlers.ts` (1: type-only)
  - `canvasCommands.tsx` (1)
  - `useDragDrop.ts` (1)
  - `useWireDrawing.ts` (1)
- `useCanvasStore.getState()` 직접 호출: **28곳** (canvasCommands 26 + OneCanvasPanel 2)
- align/distribute/flip 중복: `useCanvasState.ts:133-267` vs `canvasStore.ts:603-746`
- `useCanvasKeyboardShortcuts.ts`, `useBlockDrag.ts`, `useSelectionHandler.ts` — 글로벌 fallback 내장

### 목표 상태 (to-be)
- UI 컴포넌트 → `useCanvasFacade` Hook 하나만 통해 접근
- 도메인 로직(align/distribute/flip/copyPaste) → `canvas-commands.ts` 순수 함수 1벌
- `canvasStore`는 stores 레이어 내부 adapter에서만 접근

### Migration Rules
1. 한 번에 하나의 소비자만 전환
2. 전환 후 즉시 `pnpm run build` 통과 확인
3. 기존 동작 보존 우선 (새 기능 금지)
4. `as any`, `@ts-ignore` 금지
5. 각 Task = 독립 커밋 (개별 revert 가능)

---

## Tasks

### Task 1: CanvasFacadeReturn 인터페이스 정의
- [ ] **Create** `src/types/canvasFacade.ts`
- **What**: `useCanvasState.ts`의 반환 타입을 기반으로 `CanvasFacadeReturn` 인터페이스 정의
- **Interface shape**:
  ```typescript
  interface CanvasFacadeReturn {
    // Selectors
    components: Map<string, Block>;
    junctions: Map<string, Junction>;
    wires: Wire[];
    zoom: number;
    pan: Position;
    // Commands
    addComponent: (type: BlockType, position: Position, props?: Partial<Block>) => string;
    moveComponent: (id: string, position: Position, skipHistory?: boolean) => void;
    removeComponent: (id: string) => void;
    updateComponent: (id: string, updates: Partial<Block>) => void;
    addWire: (...) => string | null;
    removeWire: (id: string) => void;
    createJunctionOnWire: (wireId: string, position: Position) => string | null;
    moveJunction: (id: string, position: Position, skipHistory?: boolean) => void;
    updateWireHandle: (...) => void;
    removeWireHandle: (...) => void;
    moveWireSegment: (...) => void;
    insertEndpointHandle: (...) => void;
    cleanupOverlappingHandles: (wireId: string) => void;
    alignSelected: (direction: ...) => void;
    distributeSelected: (direction: ...) => void;
    flipSelected: (axis: ...) => void;
    // CircuitIO
    getCircuitData: () => SerializableCircuitState;
    loadCircuit: (data: SerializableCircuitState) => void;
    // Interaction
    wireDrawing: WireDrawingState | null;
    startWireDrawing: (...) => void;
    updateWireDrawing: (position: Position) => void;
    cancelWireDrawing: () => void;
    selectedIds: Set<string>;
    setSelection: (ids: string[]) => void;
    addToSelection: (id: string) => void;
    toggleSelection: (id: string) => void;
    clearSelection: () => void;
    setPan: (pan: Position) => void;
    // History
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    // Metadata
    isDocumentMode: boolean;
    documentId: string | null;
  }
  ```
- **Source files to reference**: `useCanvasState.ts` return type (L269-338), `useCanvasDocument.ts` return type (L59-112)
- **Gate**: Interface compiles cleanly, no unused types
- **Commit**: `refactor: define CanvasFacadeReturn interface`

### Task 2: canvas-commands.ts 순수 함수 모듈 추출
- [ ] **Create** `src/components/OneCanvas/utils/canvas-commands.ts`
- **What**: align/distribute/flip 로직을 순수 함수로 추출
- **Extract from**:
  - `useCanvasState.ts:133-267` (alignDocumentSelected, distributeDocumentSelected, flipDocumentSelected)
  - `canvasStore.ts:603-746` (alignSelected, distributeSelected, flipSelected)
- **Target function signatures**:
  ```typescript
  export function alignComponents(
    components: Map<string, Block>,
    selectedIds: Set<string>,
    direction: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV'
  ): Map<string, Block>;  // returns new map with updated positions

  export function distributeComponents(
    components: Map<string, Block>,
    selectedIds: Set<string>,
    direction: 'horizontal' | 'vertical'
  ): Map<string, Block>;

  export function flipComponents(
    components: Map<string, Block>,
    selectedIds: Set<string>,
    axis: 'horizontal' | 'vertical'
  ): Map<string, Block>;
  ```
- **Key**: Pure functions. No store imports. Input → Output. No side effects.
- **Gate**: `pnpm run build` passes
- **Commit**: `refactor: extract canvas-commands pure function module`

### Task 3: canvas-commands 단위 테스트 작성
- [ ] **Create** `src/components/OneCanvas/utils/__tests__/canvas-commands.test.ts`
- **Test cases** (minimum 8):
  1. `alignComponents('left')` — all x = min(x)
  2. `alignComponents('right')` — all x+width = max(x+width)
  3. `alignComponents('top')` — all y = min(y)
  4. `alignComponents('bottom')` — all y+height = max(y+height)
  5. `alignComponents('centerH')` — average center X
  6. `alignComponents('centerV')` — average center Y
  7. `distributeComponents('horizontal')` — even spacing (3+ items)
  8. `distributeComponents('horizontal')` with < 3 items — returns unchanged
  9. `flipComponents('horizontal')` — mirror around center X axis
  10. `flipComponents('vertical')` — mirror around center Y axis
- **Test helper**: Create `makeBlock(id, x, y, w, h)` factory
- **Gate**: `pnpm run test -- canvas-commands` all pass
- **Commit**: `test: add canvas-commands unit tests`

### Task 4: canvasStore의 align/distribute/flip을 canvas-commands 호출로 교체
- [ ] **Modify** `src/stores/canvasStore.ts`
- **What**: `alignSelected` (L603-660), `distributeSelected` (L664-707), `flipSelected` (L711-746) 내부 로직을 `canvas-commands.ts` 함수 호출로 교체
- **Pattern**:
  ```typescript
  // Before: inline logic with draft mutation
  alignSelected: (direction) => {
    set((state) => {
      // 60+ lines of alignment logic...
    });
  }
  
  // After: delegate to pure function, apply result
  alignSelected: (direction) => {
    set((state) => {
      const result = alignComponents(state.components, state.selectedIds, direction);
      state.components = result;
    }, false, `alignSelected/${direction}`);
  }
  ```
- **IMPORTANT**: canvasStore uses immer middleware, so `state.components = result` works via draft
- **Gate**: `pnpm run build` + existing tests pass
- **Commit**: `refactor: canvasStore delegates align/distribute/flip to canvas-commands`

### Task 5: useCanvasState의 align/distribute/flip을 canvas-commands 호출로 교체
- [ ] **Modify** `src/components/panels/content/canvas/useCanvasState.ts`
- **What**: Remove `alignDocumentSelected` (L133-190), `distributeDocumentSelected` (L192-234), `flipDocumentSelected` (L236-267) inline implementations; replace with `canvas-commands.ts` calls
- **Pattern**:
  ```typescript
  const alignDocumentSelected = useCallback(
    (direction: ...) => {
      if (!documentId || !documentState) return;
      pushHistory(documentId);
      updateCanvasData(documentId, (docData) => {
        const updated = alignComponents(docData.components, documentSelectedIds, direction);
        docData.components = updated;
      });
    },
    [documentId, documentState, documentSelectedIds, pushHistory, updateCanvasData]
  );
  ```
- **Lines removed**: ~135 lines of duplicate logic
- **Gate**: `pnpm run build` passes, schematic page functionality unaffected
- **Commit**: `refactor: useCanvasState delegates to canvas-commands`

### Task 6: useCanvasFacade Hook 구현
- [ ] **Create** `src/hooks/useCanvasFacade.ts`
- **What**: Single entry point hook that wraps `useCanvasDocument` (document mode) or `canvasStore` (global fallback)
- **Structure**:
  ```typescript
  export function useCanvasFacade(documentId: string | null): CanvasFacadeReturn {
    const documentState = useCanvasDocument(documentId);
    // ... local state for wireDrawing, selection (document mode)
    // ... global store selectors (fallback mode)
    
    // circuitIO — key new addition
    const getCircuitData = useCallback(() => { ... }, []);
    const loadCircuit = useCallback((data) => { ... }, []);
    
    if (documentState) {
      return { /* document-mode values */ isDocumentMode: true, documentId };
    }
    return { /* global-mode values */ isDocumentMode: false, documentId: null };
  }
  ```
- **Key additions vs useCanvasState**:
  - `getCircuitData()` / `loadCircuit()` — was only available via `canvasStore.getState()`
  - `documentId` / `isDocumentMode` metadata
  - Dev-only assertion: `if (process.env.NODE_ENV === 'development' && documentId && ...)`
- **Source**: Heavily based on `useCanvasState.ts` but with circuitIO and metadata
- **Gate**: `pnpm run build` passes, returns same shape as `useCanvasState`
- **Commit**: `refactor: implement useCanvasFacade hook`

### Task 7: OneCanvasPanel — useCanvasState → useCanvasFacade 전환
- [ ] **Modify** `src/components/panels/content/OneCanvasPanel.tsx`
- **Changes**:
  - L22: Remove `import { useCanvasStore }` 
  - L52: Replace `import { useCanvasState }` with `import { useCanvasFacade }`
  - L67-98: Change `useCanvasState(documentId)` → `useCanvasFacade(documentId)`
  - Add destructuring for `getCircuitData`, `loadCircuit` from facade
- **Gate**: `OneCanvasPanel.tsx` has 0 imports from `canvasStore`, `pnpm run build` passes
- **Commit**: `refactor: OneCanvasPanel uses useCanvasFacade`

### Task 8: OneCanvasPanel — schematic page switch를 facade 기반으로 전환
- [ ] **Modify** `src/components/panels/content/OneCanvasPanel.tsx`
- **Changes**:
  - L108: `useCanvasStore.getState().getCircuitData()` → facade `getCircuitData()`
  - L110: `useDocumentRegistry.getState().pushHistory(documentId)` → keep (registry access is OK)
  - L115: `useCanvasStore.getState().loadCircuit(targetPage.circuit)` → facade `loadCircuit(targetPage.circuit)`
- **Critical**: This is the #1 split-brain violation (E2). Must verify schematic page switching still works.
- **Gate**: Zero `useCanvasStore` references in file. Manual test: switch schematic pages → circuit data preserved.
- **Commit**: `fix: schematic page switch uses facade instead of global store`

### Task 9: useCanvasKeyboardShortcuts — facade 파라미터 주입으로 전환
- [ ] **Modify** `src/components/OneCanvas/hooks/useCanvasKeyboardShortcuts.ts`
- **Changes**:
  - Change hook signature to accept facade values as parameter:
    ```typescript
    interface UseCanvasKeyboardShortcutsOptions {
      enabled?: boolean;
      onDelete?: () => void;
      // Injected from facade:
      components: Map<string, Block>;
      wires: Wire[];
      selectedIds: Set<string>;
      selectAll: () => void;
      clearSelection: () => void;
      removeComponent: (id: string) => void;
      removeWire: (id: string) => void;
      addComponent: (...) => string;
      addWire: (...) => string | null;
      toggleGrid: () => void;
      toggleSnap: () => void;
      undo: () => void;
      redo: () => void;
      rotateSelectedComponents?: (degrees: number) => void;
    }
    ```
  - Remove all `useCanvasStore(...)` calls (L88-101)
  - Use params instead of store in all handlers
  - Fix `as` castings in clipboard logic (E14) — use proper typed interfaces
- **Caller update**: `OneCanvasPanel.tsx` L218: pass facade values to hook
- **Gate**: 0 `canvasStore` imports in file. `pnpm run build` passes.
- **Commit**: `refactor: useCanvasKeyboardShortcuts receives facade params`

### Task 10: canvasCommands.tsx — facade 기반 전환
- [ ] **Modify** `src/components/CommandPalette/commands/canvasCommands.tsx`
- **Changes**:
  - Add `getActiveDocumentFacade()` helper:
    ```typescript
    function getActiveDocumentFacade() {
      const { tabs, activeTabId } = useEditorAreaStore.getState();
      const activeTab = tabs.find(t => t.id === activeTabId);
      const documentId = activeTab?.data?.documentId as string | undefined;
      if (documentId) {
        return useDocumentRegistry.getState();
      }
      return useCanvasStore.getState(); // fallback
    }
    ```
  - Replace all 26 `useCanvasStore.getState()` calls with document-aware access
  - For commands that need components/wires: resolve from documentRegistry when documentId exists
  - **Note**: Command palette operates outside React render → cannot use hooks → use `.getState()` from stores
- **Gate**: 0 `canvasStore` imports. All commands work in document mode. `pnpm run build`.
- **Commit**: `refactor: canvasCommands uses document-aware state access`

### Task 11: SearchPanel.tsx — document-aware 전환
- [ ] **Modify** `src/components/sidebar/SearchPanel.tsx`
- **Changes**:
  - Remove `import { useCanvasStore }` (L3)
  - Replace `useCanvasStore((state) => state.components)` with active document components
  - Import `useEditorAreaStore` and `useDocumentRegistry` to resolve active document
  - Selection/pan/zoom → access via documentRegistry or facade
- **Gate**: 0 `canvasStore` imports. `pnpm run build`.
- **Commit**: `refactor: SearchPanel uses document-aware state`

### Task 12: useDragDrop.ts — facade 파라미터 주입
- [ ] **Modify** `src/components/OneCanvas/hooks/useDragDrop.ts`
- **Changes**:
  - Change hook to receive canvas state as parameters (zoom, pan, gridSize, snapToGrid, addComponent, moveComponent, selectedIds)
  - Remove `import { useCanvasStore }` (L9)
  - Remove all `useCanvasStore(...)` calls (L68-74)
  - L186: `useCanvasStore.getState().components.get(id)` → use passed `components` param
- **Caller update**: `OneCanvasPanel.tsx` passes facade values
- **Gate**: 0 `canvasStore` imports. `pnpm run build`.
- **Commit**: `refactor: useDragDrop receives facade params`

### Task 13: useWireDrawing.ts — facade 파라미터 주입
- [ ] **Modify** `src/components/OneCanvas/hooks/useWireDrawing.ts`
- **Changes**:
  - Change hook to receive wire-related state as parameters (components, wires, wireDrawing, startWireDrawing, updateWireDrawing, completeWireDrawing, cancelWireDrawing)
  - Remove `import { useCanvasStore }` (L10)
  - Remove all `useCanvasStore(...)` calls (L57-63)
- **Caller update**: `OneCanvasPanel.tsx` passes facade values
- **Gate**: 0 `canvasStore` imports. `pnpm run build`.
- **Commit**: `refactor: useWireDrawing receives facade params`

### Task 14: CanvasInteractionHandlers.ts — type-only import 정리
- [ ] **Modify** `src/components/panels/content/canvas/CanvasInteractionHandlers.ts`
- **Changes**:
  - L6: `import type { WireDrawingState as StoreWireDrawingState } from '../../../../stores/canvasStore'`
  - → Move `WireDrawingState` type to `src/types/canvasFacade.ts` or `src/components/OneCanvas/types.ts`
  - Update import path in CanvasInteractionHandlers.ts
- **Gate**: 0 imports from `canvasStore`. `pnpm run build`.
- **Commit**: `refactor: move WireDrawingState type out of canvasStore`

### Task 15: Final verification — 빌드 + 테스트 + import audit
- [ ] **Verify** full build and test suite
- **Steps**:
  1. `pnpm run build` → exit code 0
  2. `pnpm run test` → all 22 test files pass
  3. Grep `import.*canvasStore|from.*canvasStore` in `src/components/**` → **0 matches**
  4. Grep `useCanvasStore\.getState\(\)` in `src/components/**` → **0 matches**
  5. Grep `alignSelected|distributeSelected|flipSelected` → verify only 1 implementation in `canvas-commands.ts` (+ 1 delegation call each in `canvasStore.ts` and `useCanvasFacade.ts`)
- **Gate**: All 5 checks pass
- **Commit**: none (verification only)

---

## Completion Gates

- [ ] `src/components/**`에서 `canvasStore` 직접 import = 0개 파일
- [ ] `useCanvasStore.getState()` in components = 0곳
- [ ] `canvas-commands.ts` 테스트 8개 이상 통과
- [ ] align/distribute/flip 도메인 로직 = `canvas-commands.ts`에 정확히 1벌
- [ ] `pnpm run build` exit code 0
- [ ] `pnpm run test` — 기존 22개 테스트 파일 전체 통과
- [ ] Schematic page switch 수동 검증 통과

---

## Rollback Strategy

각 Task는 독립 커밋. 문제 발생 시:
```bash
git revert <commit-hash>  # 개별 Task revert
```

Task 간 의존성:
- Task 1 (interface) → Task 6 (facade impl) → Task 7-8 (OneCanvasPanel)
- Task 2 (commands) → Task 3 (tests) → Task 4-5 (store/state delegation)
- Task 6 (facade) → Task 9-13 (consumer migration)
- Task 14 (type-only) — 독립적, 언제든 가능
- Task 15 (verification) — 마지막

두 트랙 병렬 가능: [Task 1→6→7→8→9→10→11→12→13] 과 [Task 2→3→4→5] 는 병렬 진행 후 Task 14→15에서 합류.
