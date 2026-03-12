# LS Profile Mapping

## Device Families

The LS profile preserves the current backend device set:

- bit: `P`, `M`, `K`, `F`, `T`, `C`
- word: `D`, `R`, `Z`, `N`
- derived runtime words: `TD`, `CD`

`LS` is treated as a compatibility projection over canonical memory. The important outlier is `P`: unlike `MELSEC X/Y`, it does not by itself encode whether the point is an input or an output.

## Sizes and Ranges

The initial LS profile copies the current runtime sizes:

- `P` = 2048
- `M` = 8192
- `K` = 2048
- `F` = 2048
- `T` done/contact = 2048
- `C` done/contact = 2048
- `D` = 10000
- `R` = 10000
- `Z` = 16
- `N` = 8192
- `TD` = 2048
- `CD` = 2048

## Readonly and Retention Behavior

- retained:
  - `K`
  - `R`
- readonly or internal-only in current semantics:
  - `F`
  - `T`
  - `C`
  - `TD`
  - `CD`

The exact canonical access class is decided in code, but current observable LS behavior must be preserved.

## Supported LS Address Forms

The LS profile must continue to support current forms such as:

- `M0000`
- `D0100`
- `D0100.5`
- `D0100[Z0]`
- `TD0001`
- `CD0001`

`P` parsing is model-sensitive in the compatibility layer:

- `XBC/XEC`:
  - current v1 compatibility assumption uses decimal CPU-local windows
  - `P0000`-`P0019` -> `InputBit`
  - `P0020`-`P0039` -> `OutputBit`
  - above that range, legacy input-style fallback is preserved until richer topology exists
- `XGT/XGI`:
  - `P` assignment depends on extension-module slot and port layout
  - because project config does not yet persist that topology, v1 preserves legacy `P -> InputBit` behavior for parse-to-canonical translation
  - reverse aliasing from canonical `OutputBit` back to `P` remains allowed as a compatibility view

## Canonical Mapping Table

Preferred mappings:

- `P` -> model-dependent compatibility projection
- `M` -> `InternalBit`
- `K` -> `RetentiveBit`
- `F` -> `SpecialBit`
- `T` -> `TimerDoneBit`
- `C` -> `CounterDoneBit`
- `D` -> `DataWord`
- `R` -> `RetentiveWord`
- `Z` -> `IndexWord`
- `N` -> `SystemWord`
- `TD` -> `TimerValueWord`
- `CD` -> `CounterValueWord`

Model-specific `P` notes:

- `XBC/XEC` fixed CPU models use `P` as a split compatibility family over canonical `InputBit` and `OutputBit`
- `XGT/XGI` use slot-driven addressing and therefore require hardware-topology metadata for a fully correct `P` projection

## Current Modbus Mapping Table

The LS profile must preserve the current mapping policy:

- `M` -> coil area, offset `0`
- `K` -> coil area, offset `8192`
- `T` -> coil area, offset `10240`
- `C` -> coil area, offset `12288`
- `P` -> discrete input area, offset `0`
- `F` -> discrete input area, offset `2048`
- `D` -> holding register area, offset `0`
- `R` -> holding register area, offset `10000`
- `Z` -> holding register area, offset `20000`
- `N` -> holding register area, offset `20016`
- `TD` -> holding register area, offset `28208`
- `CD` -> holding register area, offset `30256`

Important limitation:

- the current rule table is still family-based and cannot yet express slot-specific LS `P` segmentation
- when LS Modbus is rebuilt on the canonical adapter, the mapping policy must grow enough metadata to express segmented `P` windows and future slot-based projections

## Compatibility Invariants

The LS profile is considered correct only if:

- current LS address parsing still works
- current LS simulator behavior does not regress
- current LS Modbus behavior remains unchanged unless a bug is being intentionally fixed
