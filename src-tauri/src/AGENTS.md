# BACKEND KNOWLEDGE BASE

## OVERVIEW
`src-tauri/src` is the Rust backend for the Tauri desktop app. `main.rs` boots `app_lib::run()`, and `lib.rs` wires shared state plus command registration.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| App + command registration | `lib.rs`, `main.rs` | Tauri setup + `generate_handler!` |
| Tauri IPC command handlers | `commands/*` | Domain-grouped command entrypoints |
| Simulation runtime | `sim/*` | Engine, executor, timer/counter, debugger |
| Modbus protocol | `modbus/*` | TCP/RTU server + memory mapping |
| Project lifecycle/files | `project/*` | Manifest, migration, autosave, recovery |
| Scenario execution | `scenario/*` | Scenario types + executor |
| Canvas/scope backend | `canvas/*` | Scope and sync logic |
| Parser domain | `parser/*` | CSV/parsing/mapping logic |
| Error model | `error.rs` | Shared backend error enum |

## CONVENTIONS
- Commands are domain-grouped and registered through `lib.rs`.
- Async command style is standard (`#[tauri::command]` async handlers with structured error mapping).
- Keep command handlers thin and delegate domain logic to modules under `sim`, `project`, `modbus`, etc.
- Use shared state patterns already present in app-managed state rather than introducing isolated globals.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not bypass command registration conventions in `lib.rs`.
- Do not scatter domain logic into command files when a domain module exists.
- Do not introduce unchecked panics (`unwrap`/`expect`) on recoverable paths.

## COMMANDS
```bash
pnpm tauri dev
pnpm tauri build
```
