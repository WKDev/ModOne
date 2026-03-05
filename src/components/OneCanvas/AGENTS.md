# ONECANVAS KNOWLEDGE BASE

## OVERVIEW
`OneCanvas` is the highest-complexity frontend subsystem. It combines interaction state machines, coordinate transforms, geometry/wire logic, block rendering, and simulation-oriented helpers.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Interaction flow | `machines/interactionMachine.ts` | Main interaction state machine |
| Canvas shell | `Canvas.tsx`, `content/CanvasContent.tsx` | Composition + rendering flow |
| Block registry | `blockDefinitions.ts`, `components/blocks` | Block metadata + implementations |
| Geometry/wire math | `geometry/*`, `utils/wire*`, `utils/pathFinder.ts` | Hit tests and wire pathing |
| Coordinate model | `coordinate-system/*`, `utils/canvasCoordinates.ts` | Screen/canvas conversion contracts |
| Tests | `utils/__tests__` | Utility-heavy regression tests |

## CONVENTIONS
- Add new block types through the existing block definition/renderer pipeline.
- Keep geometry and route calculations in utility modules, not inside render components.
- Preserve separation between transformed content layers and overlay/UI layers.
- Reuse existing interaction machine states/events before adding new ad-hoc handlers.
- Maintain document/facade integration patterns used by existing hooks/adapters.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not duplicate coordinate transforms in multiple places.
- Do not embed heavy algorithmic logic inside JSX components.
- Do not bypass selection/interaction state machine with direct mutations.
- Do not spread wire/path logic across unrelated components; centralize in utils/geometry.

## COMMANDS
```bash
pnpm run test
```
