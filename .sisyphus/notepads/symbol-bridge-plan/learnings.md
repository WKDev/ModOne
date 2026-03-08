
## Task 7: Unified symbolBridge.ts (2026-03-08)
- symbolBridge.ts delegates to customSymbolBridge cache — builtins and custom symbols share the same Map
- `'symbolId' in block && block.symbolId` is the correct type-safe pattern for accessing optional symbolId on Block union type
- `CustomSymbolBlock` covers types: `custom_symbol | scope | text | net_label`
- BUILTIN_SYMBOLS has 42 entries; BLOCK_TYPE_TO_SYMBOL_ID handles aliases (e.g. relay_coil → builtin:relay)
- registerBuiltinSymbols() is idempotent via _builtinsRegistered flag; safe to call multiple times
- Build was already failing before this task (pre-existing TS errors in 7+ unrelated files)
- 2 pre-existing test failures: stale "22" hardcoded assertions in port-positions.test.ts and builtin-symbol-migration.test.ts
