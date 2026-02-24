# Issues — macos-titlebar-restore

## [2026-02-24] Known Issues / Watch Points

### W1: tauri-plugin-window-state conflict
- **Risk**: `tauri-plugin-window-state` may restore stale position when titlebar style changes — first launch after change may show wrong window position
- **Mitigation**: Test with fresh state (delete saved window state); no code change needed
- **Status**: Watch only, no action needed in this plan

### W2: traffic_light_position API stability
- **Risk**: `set_traffic_light_position` may need `tauri::LogicalPosition` import
- **Mitigation**: Check existing imports in lib.rs before adding; Tauri v2 API should include it

### W3: useMacosNativeMenu special cases
- **Risk**: Some menu items have custom handlers (file.newProject → projectDialogService) vs simple commandRegistry.execute()
- **Mitigation**: Read MenuBar.tsx:82-293 carefully; map EACH item's JS handler to Rust equivalent

### W4: MacWindowBar project name source
- **Risk**: Project name may be in a Zustand store not easily accessible from a standalone component
- **Mitigation**: Check projectDialogService and existing project stores before creating new state
