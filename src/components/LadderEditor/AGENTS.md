# LADDER EDITOR KNOWLEDGE BASE

## OVERVIEW
`LadderEditor` owns ladder-logic editing UX, element rendering, grid conversion, and wire generation. This area is algorithm-heavy and tightly coupled to ladder document/store behavior.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Editor shell | `LadderEditor.tsx`, `LadderGrid.tsx` | Main composition |
| Element rendering | `elements/*` | Contact/coil/timer/counter/wire primitives |
| Keyboard ops | `hooks/useLadderKeyboardShortcuts.ts` | Editing shortcuts and selection ops |
| Grid/wire algorithms | `utils/gridConverter.ts`, `utils/wireGenerator.ts` | Core conversion + routing complexity |
| Property editing | `properties/*` | Element property panels |
| Tests | `__tests__`, `utils/__tests__`, `hooks/__tests__` | Component and algorithm coverage |

## CONVENTIONS
- Keep ladder-domain algorithms in `utils/*`; avoid placing them in UI event handlers.
- Follow current element registry/rendering patterns in `elements/index.ts`.
- Preserve keyboard behavior contracts when changing shortcut logic.
- Keep property-panel data shaping consistent with ladder element models.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not intermix UI-only state with persistent ladder document state.
- Do not fork wire/grid rule logic across multiple files when a canonical util exists.
- Do not add editor actions that bypass document registry/history paths.

## COMMANDS
```bash
pnpm run test
```
