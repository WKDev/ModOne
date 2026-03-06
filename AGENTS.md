# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-26 02:00 KST
**Commit:** 05a4ed5
**Branch:** main

## OVERVIEW
ModOne is a **commercial-grade EDA (Electronic Design Automation) desktop application** targeting the level of KiCad, EPLAN, and OrCAD. It is built with Tauri (Rust backend) and React + TypeScript (frontend). The repo is local-first, uses pnpm, and has no configured CI workflow.

### Product Vision
- **Ambition**: Production-quality schematic editor for electrical/PLC engineering, competitive with KiCad's schematic editor and EPLAN's circuit design capabilities.
- **Core differentiator**: Integrated PLC simulation engine with real-time Modbus communication — design, simulate, and commission in one tool.
- **Scale targets**: Must handle large industrial projects (1,000+ rungs, 10,000+ I/O points, 50+ schematic pages) at 60fps interaction.
- **Rendering strategy**: The current React DOM+SVG canvas (OneCanvas) is a stepping stone. The rendering layer MUST evolve to a GPU-accelerated solution (WebGL/WebGPU via Pixi.js or custom renderer) to meet commercial EDA performance requirements. Architecture decisions should keep the rendering layer decoupled and swappable.
- **Non-negotiable**: All architectural decisions must be evaluated against "would this scale to KiCad/EPLAN level?" — if the answer is no, find an alternative.

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
