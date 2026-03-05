# STORE LAYER KNOWLEDGE BASE

## OVERVIEW
`src/stores` is the central state layer (Zustand + related adapters). This directory has high coupling and contains some of the largest files in the repo.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Project lifecycle state | `projectStore.ts` | Open/save/modified/recent handling |
| Canvas state | `canvasStore.ts` | Largest store, high complexity |
| Ladder state | `ladderStore.ts`, `ladderUIStore.ts` | Ladder data + UI state |
| Document coordination | `documentRegistry.ts` | Cross-document state and history |
| Layout/panel state | `layoutStore.ts`, `panelStore.ts`, `editorAreaStore.ts` | Shell/panel persistence |
| Modbus/simulation state | `modbusStore.ts`, `scenarioStore.ts` | Protocol and scenario UI state |

## CONVENTIONS
- Keep state and actions explicit; favor selector exports for read access.
- Maintain document-oriented patterns in new store code where facades already exist.
- Keep backend communication in services/hooks, not inside low-level store internals unless already established.
- Preserve existing undo/redo and history integration points.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not import deprecated global canvas store paths from UI components/hooks.
- Do not split a single source of truth into parallel ad-hoc stores.
- Do not add cross-store circular dependencies without clear boundary review.

## COMMANDS
```bash
pnpm run test
```
