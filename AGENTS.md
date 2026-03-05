# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-26 02:00 KST
**Commit:** 05a4ed5
**Branch:** main

## OVERVIEW
ModOne is a desktop engineering app built with Tauri (Rust backend) and React + TypeScript (frontend). The repo is local-first, uses pnpm, and has no configured CI workflow.

## STRUCTURE
```text
ModOne/
|- src/                 # React + TypeScript app code
|- src-tauri/src/       # Rust domain logic + Tauri commands
|- tests/e2e/           # Playwright browser E2E tests
|- .taskmaster/         # TaskMaster workflow/config docs
|- .claude/.cursor/.gemini/.opencode/  # mirrored AI command catalogs
|- docs/                # ad-hoc project docs
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| App startup | `src/main.tsx` | React entry point |
| Desktop runtime boot | `src-tauri/src/main.rs`, `src-tauri/src/lib.rs` | Tauri app setup + command registration |
| Frontend business flows | `src/hooks`, `src/services`, `src/stores` | Hook-service-store layering |
| Canvas/circuit features | `src/components/OneCanvas` | Largest frontend subsystem |
| Ladder logic features | `src/components/LadderEditor` | Grid + wire generation complexity |
| Simulation engine | `src-tauri/src/sim` | Core PLC runtime |
| Modbus protocol | `src-tauri/src/modbus` | TCP/RTU + memory mapping |
| E2E tests | `tests/e2e` | Playwright + fixtures |

## CODE MAP
| Symbol/Area | Type | Location | Role |
|---|---|---|---|
| `App` | React component | `src/App.tsx` | Main UI shell |
| `useProject` | React hook | `src/hooks/useProject.ts` | Project lifecycle orchestration |
| `useProjectStore` | Zustand store | `src/stores/projectStore.ts` | Shared project state |
| `interactionMachine` | state machine | `src/components/OneCanvas/machines/interactionMachine.ts` | Canvas interaction state |
| `generate_handler!` registry | Tauri registration | `src-tauri/src/lib.rs` | Exposes backend commands |
| `ModOneError` | Rust error enum | `src-tauri/src/error.rs` | Backend error normalization |

## CONVENTIONS
- Package manager: `pnpm` only; scripts are defined in `package.json`.
- TypeScript is strict (`strict`, `noImplicitAny`, `strictNullChecks`, unused checks on).
- Path aliases are first-class (`@/*`, `@components/*`, `@hooks/*`, `@stores/*`, `@types/*`, `@services/*`).
- Frontend tests use Vitest via `vite.config.ts`; test files are mostly co-located under `__tests__`.
- E2E tests use Playwright in `tests/e2e` with Chromium profile and local web server startup.
- Tauri commands are grouped by domain under `src-tauri/src/commands/*` and delegated to domain modules.

## ANTI-PATTERNS (THIS PROJECT)
- `src-tauri/src/main.rs`: `DO NOT REMOVE` the Windows console-window guard comment behavior.
- `src/stores/canvasStore.ts`: deprecated direct import from UI/hooks is forbidden; use document/facade paths.
- `.taskmaster/CLAUDE.md`: never manually edit `.taskmaster/tasks/tasks.json`.
- `.taskmaster/CLAUDE.md`: never manually edit `.taskmaster/config.json`.
- Do not assume CI catches regressions; there is no `.github/workflows/*` pipeline configured here.

## UNIQUE STYLES
- Multi-agent command mirrors exist under `.claude`, `.cursor`, `.gemini`, `.opencode`; content is largely duplicated by tool format.
- TaskMaster docs are authoritative for planning workflow (`.taskmaster/CLAUDE.md`).
- Obsidian logging conventions are defined in root `CLAUDE.md` and used as operational documentation policy.

## COMMANDS
```bash
pnpm run dev
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm tauri dev
pnpm tauri build
```

## NOTES
- Root `CLAUDE.md` and `.taskmaster/CLAUDE.md` are active instruction sources.
- High-complexity zones: `src/stores`, `src/components/OneCanvas`, `src/components/LadderEditor`, `src-tauri/src/sim`.
- Prefer adding local AGENTS in complex subdomains over bloating root guidance.
