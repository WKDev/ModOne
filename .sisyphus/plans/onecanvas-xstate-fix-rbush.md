# Plan: OneCanvas XState Fix + RBush Adoption

## Problem Statement

The OneCanvas interaction system is completely non-functional at runtime. The XState v5 interaction machine (`interactionMachine.ts`, 1133 lines) hardcodes `useCanvasStore.getState()` for ALL 19 side-effect calls, but the UI reads from `useCanvasFacade(documentId)` which routes to document-based state. When a document is open (normal usage), every machine action writes to the wrong store — mutations are invisible, "nothing works."

Additionally, the custom Quadtree (344 lines) is unused and should be replaced with RBush for spatial indexing, and drag operations should use transient DOM updates for 60fps performance.

## Decision Record

- **React-Konva migration**: REJECTED — current HTML/SVG renderer is adequate for circuit editor scale (50-300 components per page)
- **RBush over Quadtree**: ACCEPTED — proven library (tldraw, OpenStreetMap), better for non-uniform layouts
- **XState kept**: ACCEPTED — machine logic is sound, only the store binding is broken
- **Transient drag**: ACCEPTED — bypass React state during drag, commit on mouseup

## Architecture: Adapter Pattern

### Core Concept

Replace `getStore()` with an injected adapter that routes reads/writes to the correct backing store.

```
                    ┌─────────────────────┐
                    │  useCanvasFacade()   │
                    │  (global or doc)     │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  useCanvasAdapter()  │
                    │  + SpatialIndex      │
                    │  + transient refs    │
                    └─────────┬───────────┘
                              │ ref (stable)
                    ┌─────────▼───────────┐
                    │  InteractionProvider │
                    │  (passes adapter     │
                    │   to machine input)  │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  interactionMachine  │
                    │  context.adapter.*   │
                    │  (no more getStore)  │
                    └─────────────────────┘
```

### Adapter Interface

```typescript
interface CanvasInteractionAdapter {
  // === Reads ===
  getComponents(): Map<string, Block>;
  getWires(): Wire[];
  getJunctions(): Map<string, Junction>;
  getSelectedIds(): Set<string>;
  getZoom(): number;
  getPan(): Position;
  getGridSize(): number;
  getSnapToGrid(): boolean;

  // === Writes: Selection ===
  setSelection(ids: string[]): void;
  addToSelection(id: string): void;
  toggleSelection(id: string): void;
  clearSelection(): void;

  // === Writes: Viewport ===
  setPan(pan: Position): void;
  setZoom(zoom: number): void;

  // === Writes: Components ===
  moveComponent(id: string, position: Position, skipHistory?: boolean): void;
  moveJunction(id: string, position: Position): void;

  // === Writes: Wires ===
  addWire(from: WireEndpoint, to: WireEndpoint, options?: object): string | null;
  createJunctionOnWire(wireId: string, position: Position): string | null;
  updateWireHandle(wireId: string, handleIndex: number, position: Position): void;
  moveWireSegment(wireId: string, handleA: number, handleB: number, delta: number): void;
  cleanupOverlappingHandles(wireId: string): void;
  insertEndpointHandle(wireId: string, end: 'from' | 'to'): void;

  // === Writes: Wire Drawing ===
  startWireDrawing(from: WireEndpoint, options?: object): void;
  updateWireDrawing(position: Position): void;
  cancelWireDrawing(): void;

  // === Spatial Index ===
  queryPoint(pos: Position, margin: number): SpatialItem[];
  queryBox(bounds: BoundingBox): SpatialItem[];

  // === Transient Drag (DOM-direct) ===
  setTransientPosition(id: string, x: number, y: number): void;
  clearTransientPositions(): void;
}
```

### How adapter stays current across re-renders

The adapter is built from `useCanvasFacade` return values. Since facade returns new function refs on every render, the adapter uses a **ref pattern**:

```typescript
function useCanvasAdapter(facade: CanvasFacadeReturn): React.RefObject<CanvasInteractionAdapter> {
  const adapterRef = useRef<CanvasInteractionAdapter>(null!);
  
  // Update on every render — ref is stable, contents are current
  adapterRef.current = {
    getComponents: () => facade.components,
    moveComponent: facade.moveComponent,
    // ... etc
  };
  
  return adapterRef;
}
```

The machine reads `context.adapterRef.current.*` — always gets the latest facade methods.

### How adapter is injected into XState

Via machine `input` (XState v5 pattern):

```typescript
// InteractionContext.tsx
const adapterRef = useCanvasAdapter(facade);
const [snapshot, send] = useMachine(interactionMachine, {
  input: { adapterRef },
});
```

```typescript
// interactionMachine.ts
const interactionMachine = setup({
  types: {
    input: {} as { adapterRef: React.RefObject<CanvasInteractionAdapter> },
    context: {} as InteractionContext & { adapterRef: React.RefObject<CanvasInteractionAdapter> },
  },
  // ...
}).createMachine({
  context: ({ input }) => ({
    ...initialContext,
    adapterRef: input.adapterRef,
  }),
});
```

## Critical Design Decision: Block Drag Ownership

### Current State (CONFLICT)
Two systems compete for block drag:
1. **@dnd-kit** (`DraggableBlock.tsx` + `useDragDrop.ts`): Handles BOTH toolbox-to-canvas AND canvas block repositioning. Works via `useDraggable` hook with pointer events.
2. **XState machine** (`dragging_items` state): Also designed to handle canvas block drag via `POINTER_DOWN` → `dragging_items.pending` → `dragging_items.active`.

### Resolution: @dnd-kit for placement, XState for canvas interactions
- **Toolbox → Canvas** (new block placement): Keep @dnd-kit (`Toolbox.tsx` → `DraggableBlockItem` → `useDragDrop.handleDragEnd` → `addComponent`)
- **Canvas block drag** (repositioning): XState machine handles this. Remove `useDraggable` from `DraggableBlock.tsx`. Block mouse events flow through the machine's `POINTER_DOWN` → `dragging_items` path.
- **Why**: The XState machine needs to own canvas interactions for multi-select drag, transient updates, and undo/redo coordination. Having @dnd-kit compete causes event conflicts.

### Migration Safety
- `DraggableBlock.tsx` becomes a simple positioned `<div>` with `data-block-id` and `onMouseDown` forwarding
- Toolbox drag continues using @dnd-kit's `DraggableBlockItem` (in `Toolbox.tsx`) — completely separate component, unaffected
- `useDragDrop.ts` `handleDragEnd` for `canvas-component` type can be removed (machine handles it)
- `useDragDrop.ts` `handleDragEnd` for `toolbox-item` type stays (separate path)

## Dual Wire Drawing State (Bug 6 Resolution)

### Decision: XState is sole source of truth for wire drawing

The machine already tracks `wireFrom`, `wireTempPosition`, `wireSnapTarget` in its context. The `InteractionContext.tsx` already derives `wirePreview` from XState state. There's no need to also call `store.startWireDrawing()` / `store.updateWireDrawing()`.

**Fix**: In task 3.2, remove all `adapter.startWireDrawing()` / `adapter.updateWireDrawing()` / `adapter.cancelWireDrawing()` calls from machine actions. Wire drawing preview is rendered from XState context only. The adapter interface does NOT include wire drawing methods.

**Impact**: `useCanvasFacade.wireDrawing` becomes unused for rendering (only XState's `wirePreview` selector is used). This is fine — facade's wireDrawing was the old hook-based path.

## getScreenPosition Bug Resolution

### Problem
`getScreenPosition()` in `InteractionContext.tsx` calls `canvasRef.current?.getContainer()` which may return null if the Canvas component hasn't mounted or the ref timing is off.

### Fix (in Task 4.1)
The adapter provides coordinate conversion directly:
```typescript
// In useCanvasAdapter
getContainerRect: () => {
  return interactionRootRef.current?.getBoundingClientRect() ?? null;
}
```
`getScreenPosition` uses `adapter.getContainerRect()` with `interactionRootRef` (the div wrapping Canvas in OneCanvasPanel), not `canvasRef.getContainer()`. This ref is always available because it's on the outermost interaction div.

## Document Switch Handling

### Problem
When `documentId` changes, the facade returns different data. The machine might be mid-interaction.

### Solution
Key the `InteractionProvider` on `documentId`:
```tsx
<InteractionProvider key={documentId ?? '__global__'}>
```
This remounts the provider and recreates the machine on document switch. Any in-progress interaction is cleanly killed. This is acceptable because:
- Document switches are user-initiated (clicking tabs)
- No one drags while switching documents
- Clean restart prevents stale state bugs

---

## Implementation Phases

### Phase 1: Foundation (parallel, ~2 hours)

#### Task 1.1: Install RBush
- **Do**: `pnpm add rbush` and `pnpm add -D @types/rbush`
- **Verify**: `pnpm ls rbush` shows installed version
- **Files**: `package.json`

#### Task 1.2: Extend CanvasFacadeReturn interface
- **Do**: Add missing fields to `src/types/canvasFacade.ts`:
  - `setZoom: (zoom: number) => void`
  - `gridSize: number`
  - `snapToGrid: boolean`
- **Do NOT** add wire drawing methods (XState owns that)
- **Verify**: `tsc` passes
- **Files**: `src/types/canvasFacade.ts`

#### Task 1.3: Implement missing facade methods
- **Do**: In `src/hooks/useCanvasFacade.ts`:
  - Global mode: `setZoom` → `useCanvasStore.getState().setZoom`, `gridSize` → `state.gridSize`, `snapToGrid` → `state.snapToGrid`
  - Document mode: `setZoom` → `documentState.setZoom` (add to documentRegistry if missing), `gridSize`/`snapToGrid` → use global settings (grid is viewport-level, not per-document)
- **Verify**: `tsc` passes, facade returns all required fields
- **Files**: `src/hooks/useCanvasFacade.ts`, `src/types/canvasFacade.ts`, possibly `src/stores/documentRegistry.ts`

#### Task 1.4: Simplify DraggableBlock
- **Do**: In `src/components/OneCanvas/components/DraggableBlock.tsx`:
  - Remove `useDraggable` import and usage
  - Keep as positioned `<div>` with `data-block-id={block.id}`
  - Forward `onMouseDown` prop (for machine's POINTER_DOWN)
  - Expose ref via `forwardRef` (for transient drag DOM manipulation)
  - Keep rotation transform
- **Do NOT** touch `Toolbox.tsx` or its `DraggableBlockItem` (separate @dnd-kit path)
- **Verify**: Blocks render at correct positions, no @dnd-kit errors
- **Risk**: `useDragDrop.handleDragEnd` for `canvas-component` type will stop working. This is intentional — machine takes over.
- **Files**: `src/components/OneCanvas/components/DraggableBlock.tsx`

### Phase 2: SpatialIndex + Canvas Fix (parallel, ~3 hours)

#### Task 2.1: Create SpatialIndex
- **Do**: Create `src/components/OneCanvas/utils/SpatialIndex.ts`:
  - RBush wrapper class
  - `SpatialItem` type: `{ minX, minY, maxX, maxY, id, kind: 'block' | 'wire-segment' | 'junction' | 'port' }`
  - Methods: `rebuild(blocks, wires, junctions)`, `upsert(item)`, `remove(id)`, `queryPoint(pos, margin)`, `queryBox(bounds)`
  - For blocks: bounding box from position + size
  - For ports: small box around port position (for snap detection)
  - For wire segments: bounding box of each segment
  - For junctions: small box around junction position
- **Do NOT** delete `Quadtree.ts` yet (do after everything works)
- **Verify**: Unit test or inline test showing insert + query works
- **Files**: `src/components/OneCanvas/utils/SpatialIndex.ts`

#### Task 2.2: Fix Canvas.tsx props
- **Do**: In `src/components/OneCanvas/Canvas.tsx`:
  - Remove `useCanvasStore` import for `zoom`, `pan`, `gridSize`, `showGrid`
  - Add these as required props in `CanvasProps`
  - OneCanvasPanel passes them from facade
- **Verify**: `tsc` passes, Canvas renders with props from facade
- **Files**: `src/components/OneCanvas/Canvas.tsx`, `src/components/panels/content/OneCanvasPanel.tsx`

### Phase 3: Adapter Creation (~3 hours)

#### Task 3.1: Create useCanvasAdapter hook
- **Do**: Create `src/components/OneCanvas/interaction/useCanvasAdapter.ts`:
  - Takes `facade: CanvasFacadeReturn` and `containerRef: RefObject<HTMLDivElement>`
  - Returns `RefObject<CanvasInteractionAdapter>`
  - Internally creates `SpatialIndex`, rebuilds on `facade.components`/`facade.wires`/`facade.junctions` changes (via useEffect)
  - All read methods return current facade values
  - All write methods delegate to facade methods
  - `getContainerRect()` reads from `containerRef`
  - `setTransientPosition(id, x, y)` finds `[data-block-id="${id}"]` and sets `style.transform`
  - `clearTransientPositions()` removes all transient transforms
- **Verify**: Hook compiles, returns valid adapter ref
- **Files**: `src/components/OneCanvas/interaction/useCanvasAdapter.ts`, `src/components/OneCanvas/interaction/index.ts`

#### Task 3.2: Define CanvasInteractionAdapter type
- **Do**: Create `src/components/OneCanvas/interaction/types.ts` with the adapter interface
- **Verify**: `tsc` passes
- **Files**: `src/components/OneCanvas/interaction/types.ts`

### Phase 4: Machine Refactor (~4 hours, the heavy lift)

#### Task 4.1: Update machine context and types
- **Do**: In `interactionMachine.ts`:
  - Remove `CanvasStoreInterop` interface
  - Remove `getStore()` function
  - Remove `useCanvasStore` import
  - Add `adapterRef: React.RefObject<CanvasInteractionAdapter>` to context
  - Add `input` type with `adapterRef`
  - Update `context` factory to use `input.adapterRef`
  - Add helper: `const adapter = (ctx) => ctx.adapterRef.current`
- **Verify**: `tsc` passes (actions will have type errors — fixed in 4.2)
- **Files**: `src/components/OneCanvas/machines/interactionMachine.ts`

#### Task 4.2: Replace all getStore() calls in machine actions
- **Do**: Systematically replace every `getStore().*` call with `adapter(context).*`:
  - `getStore().moveComponent(...)` → `adapter(context).moveComponent(...)`
  - `getStore()._selectedIdsCache` → `adapter(context).getSelectedIds()`
  - `getStore().setSelection(...)` → `adapter(context).setSelection(...)`
  - `getStore().zoom` → `adapter(context).getZoom()`
  - `getStore().pan` → `adapter(context).getPan()`
  - `getStore().gridSize` → `adapter(context).getGridSize()`
  - `getStore().snapToGrid` → `adapter(context).getSnapToGrid()`
  - etc. for all 19 call sites
  - Remove wire drawing store calls (startWireDrawing, updateWireDrawing, cancelWireDrawing) — XState context is sole source of truth
  - Replace brute-force `findWireSnapTarget` with `adapter(context).queryPoint(pos, margin)`
  - Replace `rebuildInteractionSpatialIndex` action body with no-op (spatial index auto-rebuilds via useEffect in adapter)
- **Verify**: `tsc` passes, no `useCanvasStore` or `getStore` references remain in file
- **Files**: `src/components/OneCanvas/machines/interactionMachine.ts`

#### Task 4.3: Update InteractionContext
- **Do**: In `InteractionContext.tsx`:
  - Accept `facade: CanvasFacadeReturn` and `containerRef` as props
  - Call `useCanvasAdapter(facade, containerRef)` to get adapterRef
  - Pass `adapterRef` to `useMachine(interactionMachine, { input: { adapterRef } })`
  - Remove ALL `useCanvasStore` subscriptions
  - Update `getScreenPosition` to use `adapterRef.current.getContainerRect()`
  - Update `resolvePointerTarget` to use adapter's spatial queries where applicable
  - Fix `selectionBox` selector to use adapter's `getPan()`/`getZoom()` for coordinate conversion
  - Fix `wirePreview` selector to use adapter's data
- **Verify**: `tsc` passes, no `useCanvasStore` imports remain
- **Files**: `src/components/OneCanvas/contexts/InteractionContext.tsx`

#### Task 4.4: Update OneCanvasPanel
- **Do**: In `OneCanvasPanel.tsx`:
  - Pass `facade` and `containerRef` to `InteractionProvider`
  - Key the provider: `<InteractionProvider key={documentId ?? '__global__'} ...>`
  - Pass `zoom`, `pan`, `gridSize`, `showGrid` from facade to `Canvas` component
  - Remove `canvas-component` handling from `useDragDrop.handleDragEnd` (machine owns it now)
  - Keep `toolbox-item` handling in `useDragDrop`
  - Update block `onMouseDown` wiring to call `sendPointerDown` (may already exist)
- **Verify**: `tsc && vite build` passes
- **Files**: `src/components/panels/content/OneCanvasPanel.tsx`

### Phase 5: Transient Drag + Cleanup (~2 hours)

#### Task 5.1: Implement transient drag in adapter
- **Do**: In `useCanvasAdapter.ts`:
  - `setTransientPosition(id, x, y)`: Find element `[data-block-id="${id}"]`, apply CSS transform override
  - `clearTransientPositions()`: Remove all overrides, let React re-render to final positions
  - Ensure BlockRenderer's positioned div has `data-block-id` attribute (already present in `BlockRenderer.tsx` line 193)
- **Do**: In `interactionMachine.ts` `dragging_items.active` state:
  - On POINTER_MOVE: call `adapter.setTransientPosition()` for each dragged item
  - On entry to active (after threshold): push history once
  - On POINTER_UP (exit): call `adapter.moveComponent()` for final position + `adapter.clearTransientPositions()`
- **Verify**: Block drag is visually smooth, position commits on mouseup
- **Files**: `src/components/OneCanvas/interaction/useCanvasAdapter.ts`, `src/components/OneCanvas/machines/interactionMachine.ts`

#### Task 5.2: Delete Quadtree + cleanup
- **Do**: Delete `src/components/OneCanvas/utils/Quadtree.ts`
- **Do**: Remove any imports/references to Quadtree
- **Do**: Remove `CanvasStoreInterop` type if still referenced anywhere
- **Verify**: `tsc && vite build` passes, no dead code warnings
- **Files**: Delete `Quadtree.ts`, update barrel exports

#### Task 5.3: Runtime verification
- **Do**: Start Tauri dev (`pnpm tauri dev`) and test each interaction:
  1. Pan canvas (middle-click drag or space+left-drag)
  2. Zoom (scroll wheel)
  3. Click-select a block
  4. Shift-click to multi-select
  5. Drag a single block to move it
  6. Drag multiple selected blocks
  7. Box-select (drag on empty canvas area)
  8. Draw a wire (click port → drag → release on another port)
  9. Drag a wire segment to reroute
  10. Drag a wire handle
  11. Toolbox drag-to-canvas (add new block)
  12. Undo/redo after each operation
  13. Switch documents (tabs) and verify interactions work in new document
- **Verify**: All 13 interactions work. Fix any that don't before marking complete.
- **Files**: N/A (runtime test)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Adapter ref stale during action | Ref is updated synchronously on every render; machine reads `.current` at call time, not cached |
| Document switch kills interaction | `key={documentId}` cleanly remounts; acceptable UX since switches are user-initiated |
| @dnd-kit toolbox drag breaks | Toolbox uses separate `DraggableBlockItem` component, not `DraggableBlock`. Completely independent path. |
| SpatialIndex rebuild too frequent | Debounce via `useEffect` deps — only rebuilds when components/wires/junctions Map/Array reference changes |
| Machine actions throw on null adapter | Guard with `if (!context.adapterRef.current) return;` at top of every action |
| CSS transform conflict (transient + rotation) | `setTransientPosition` preserves rotation: `translate(${x}px, ${y}px) rotate(${rot}deg)` |

## Files Summary

### Create:
- `src/components/OneCanvas/interaction/types.ts` — CanvasInteractionAdapter interface
- `src/components/OneCanvas/interaction/useCanvasAdapter.ts` — Adapter hook
- `src/components/OneCanvas/interaction/index.ts` — Barrel export
- `src/components/OneCanvas/utils/SpatialIndex.ts` — RBush wrapper

### Modify:
- `src/types/canvasFacade.ts` — Add missing fields
- `src/hooks/useCanvasFacade.ts` — Implement missing methods
- `src/components/OneCanvas/machines/interactionMachine.ts` — Replace getStore() with adapter
- `src/components/OneCanvas/contexts/InteractionContext.tsx` — Remove global store deps, inject adapter
- `src/components/OneCanvas/Canvas.tsx` — Use props instead of global store
- `src/components/panels/content/OneCanvasPanel.tsx` — Wire up adapter, pass props
- `src/components/OneCanvas/components/DraggableBlock.tsx` — Remove useDraggable, simplify
- `src/components/OneCanvas/hooks/useDragDrop.ts` — Remove canvas-component drag handling

### Delete:
- `src/components/OneCanvas/utils/Quadtree.ts` — Replaced by SpatialIndex

## Estimated Total Effort
~14 hours across 5 phases. Phase 4 (machine refactor) is the heaviest at ~4 hours.
