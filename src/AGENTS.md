# FRONTEND KNOWLEDGE BASE

## OVERVIEW
`src/` is a React + TypeScript app organized by domain and layer. UI components stay in `components`, business orchestration in hooks/services, and shared state in Zustand stores.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| App shell/bootstrap | `src/main.tsx`, `src/App.tsx` | App mount + top-level window logic |
| State orchestration | `src/stores` | Global app/document/layout state |
| Domain services | `src/services` | Tauri invoke wrappers |
| Reusable business hooks | `src/hooks` | Hook facade over services/stores |
| Shared types | `src/types` | Cross-layer type contracts |
| i18n setup | `src/i18n` | Translation init + locale files |

## CONVENTIONS
- Strict TS is enforced; do not introduce loose typing to bypass compiler checks.
- Use configured path aliases (`@/*`, `@components/*`, `@hooks/*`, `@stores/*`, `@types/*`, `@services/*`).
- Keep layer split clear: component -> hook/service -> store/backend.
- Prefer barrel exports (`index.ts`) for module surfaces where already established.
- Test files are mostly co-located under `__tests__` and run through Vitest.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not import deprecated global canvas store paths from UI/hooks.
- Do not add direct backend command calls from random components; use `src/services/*`.
- Do not duplicate state across multiple stores when a source-of-truth store already exists.
- Do not add feature logic to layout shell components if it belongs in hooks/services.

## HOTSPOTS
- `src/stores/canvasStore.ts`: very high complexity and broad coupling.
- `src/stores/ladderStore.ts`: ladder editing + history complexity.
- `src/components/OneCanvas`: dense interaction + geometry logic.
- `src/components/LadderEditor`: wire/grid algorithm heavy area.

## COMMANDS
```bash
pnpm run dev
pnpm run build
pnpm run test
```
