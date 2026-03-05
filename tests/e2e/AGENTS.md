# E2E KNOWLEDGE BASE

## OVERVIEW
`tests/e2e` holds Playwright end-to-end coverage for core desktop-app workflows running through the web UI layer.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Main e2e specs | `tests/e2e/*.spec.ts` | Project/layout/modbus/floating-window flows |
| Shared fixtures | `tests/e2e/fixtures/*` | Mock data + Tauri/browser test setup |
| Shared helpers/selectors | `tests/e2e/utils/*` | Reusable app/test utilities |
| Runner config | `playwright.config.ts` | Chromium project + webServer config |

## CONVENTIONS
- E2E test naming uses `*.spec.ts`.
- Playwright suite is configured for Chromium in this repo.
- `webServer` launches `pnpm run dev` at `http://localhost:1420` for test execution.
- Keep reusable setup in fixtures/helpers instead of duplicating across specs.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not rely on brittle fixed delays when stable selectors/assertions are available.
- Do not hardcode duplicate selectors across many spec files; centralize shared selector logic.
- Do not introduce e2e-only behavior into production code without clear rationale.

## COMMANDS
```bash
pnpm run test:e2e
pnpm run test:e2e:ui
pnpm run test:e2e:headed
pnpm run test:e2e:debug
```
