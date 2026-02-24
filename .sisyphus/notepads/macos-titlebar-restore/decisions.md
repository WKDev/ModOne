# Decisions — macos-titlebar-restore

## [2026-02-24] Architectural Decisions

### D1: macOS-only programmatic override (NOT tauri.conf.json)
- **Decision**: Use `#[cfg(target_os = "macos")]` block in Rust `setup()` to call `set_decorations(true)` + `TitleBarStyle::Overlay` only on macOS
- **Reason**: `tauri.conf.json` decorations setting applies globally; changing to true would give Windows/Linux a DOUBLE titlebar (native OS titlebar + our custom MenuBar)
- **Source**: Metis review flagged this as CRITICAL gap

### D2: Phase 1 rAF coalescing kept despite user saying "no improvement"
- **Decision**: Still implement useWindowBoundary rAF coalescing
- **Reason**: Best practice per Hephaestus research; user's "no improvement" was subjective/immediate — actual jank was from decorations issue
- **Source**: Hephaestus session analysis + Metis agreement

### D3: MacWindowBar shows IS_MAC conditional in MainLayout (not replacement)
- **Decision**: `{IS_MAC ? <MacWindowBar /> : <MenuBar />}` in MainLayout
- **Reason**: User explicitly said "don't remove the bar entirely" — MacWindowBar is the mac-specific replacement, MenuBar is for Windows/Linux
- **Source**: Hephaestus Phase 4 correction

### D4: Single atomic commit for all tasks
- **Decision**: One commit: `feat(macos): restore native titlebar and menu for smooth window behavior`
- **Reason**: All changes are logically one feature; simpler history
- **Source**: Plan specification
