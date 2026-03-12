# Ladder Editor Dual-Grid Architecture

## Why This Exists

The current ladder editor mixes three concerns into one integer cell model:

- component placement
- wire rendering
- electrical connectivity

That works for coarse editing, but it makes vertical branch placement ambiguous because a `wire_v`
element currently occupies the same logical cell space as instructions, while its rendered shape is
meant to live on the boundary between adjacent rows.

For a production-grade ladder editor, vertical links need their own coordinate layer.

## Core Model

The editor should operate on a hybrid coordinate system with IEC-style relative units:

- Component Grid
  - Integer coordinates `(x, y)`
  - One logical component cell is `1 x 1`
  - Components occupy the cell body
  - Component terminals live on integer anchor points at cell boundaries
- Link Grid
  - Vertical links live at `(x, y + 0.5)`
  - `x` is always an integer boundary
  - A link centered at `y + 0.5` connects anchor points `(x, y)` and `(x, y + 1)`

This keeps component occupancy and link occupancy separate even when they touch the same anchor.

## Topology Contract

The new `dualGrid.ts` utility builds a renderer-agnostic topology:

- nodes
  - integer anchor points where terminals, horizontal segments, and vertical links meet
- edges
  - horizontal edges along integer rows
  - vertical edges across half-step link positions
- row states
  - each row stores `topLinkIds` and `bottomLinkIds`
- continuity chains
  - contiguous vertical links on the same `x` become one electrical path
- adjacency
  - node-to-node graph for future power-flow animation
- issues
  - invalid geometry and isolated vertical chains are surfaced explicitly

## Interaction Rules

### Snapping

- component tools snap to integer coordinates
- vertical-link tools snap to integer `x` and half-step `y`

This removes the current ambiguity where branch placement depends on which cell the pointer happened
to enter first.

### Boundary Constraint

Vertical links are only valid when:

- `x` is an integer
- `y` is a half-step value such as `0.5`, `1.5`, `2.5`

That prevents illegal vertical wires through the middle of a component body.

### T-Junction Generation

When a vertical link touches a node that already contains:

- a horizontal segment, or
- a component terminal

the topology marks that anchor as an auto-created junction.

The horizontal rung remains continuous; the branch is additive rather than destructive.

### Selection Priority

Selection should be resolved against geometry plus coordinate-system affinity:

- clicks closer to integer rows prefer horizontal/component targets
- clicks closer to half-step rows prefer vertical-link targets

This is implemented in `resolveDualGridSelection`.

### Isolation Detection

A vertical continuity chain is invalid when it has no attachment to:

- a horizontal segment, or
- a component terminal

This supports the requested "invalid path" state for orphaned vertical links.

## Rendering Contract

The renderer should stop inferring branch geometry from cell-local wire sprites and instead project
topology geometry directly:

- horizontal segment: `(xStart, y)` to `(xEnd, y)`
- vertical link: `(x, y - 0.5)` to `(x, y + 0.5)`

The helper functions already exist:

- `projectHorizontalSegmentToPixels`
- `projectVerticalLinkToPixels`

This is the contract needed to replace the current `midY = h * 0.65` approximation in
`LadderWireRenderer.ts`.

## How This Fits The Current Codebase

### Immediate integration targets

- `src/components/LadderEditor/pixi/interactions/LadderDragHandler.ts`
  - convert pointer positions into dual-grid snap targets before commit
- `src/stores/hooks/useLadderDocument.ts`
  - store vertical links as link-grid entities instead of cell-overlapping `wire_v`
- `src/components/LadderEditor/utils/connectivityGraph.ts`
  - consume dual-grid adjacency instead of inferring vertical connectivity from neighboring cells
- `src/components/LadderEditor/pixi/renderers/LadderWireRenderer.ts`
  - render projected segments from topology geometry

### Recommended migration order

1. keep existing element map for instructions
2. introduce a dedicated vertical-link collection beside the element map
3. build dual-grid topology from instructions + horizontal wires + vertical links
4. switch selection and snapping to the topology helpers
5. switch rendering to projected geometry
6. move continuity-chain selection and delete semantics onto `linkToChainId`

## Why This Scales Better

This design is better aligned with KiCad/EPLAN-class editor requirements because it:

- separates visual occupancy from electrical occupancy
- makes snapping deterministic
- avoids ambiguous wire-cell overload
- creates a reusable adjacency graph for simulation overlays and power-flow animation
- keeps topology logic in pure utilities instead of binding it to one renderer
