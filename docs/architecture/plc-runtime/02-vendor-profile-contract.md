# Vendor Profile Contract

## Purpose

`VendorProfile` is the only place where vendor-specific address semantics are allowed to live.

This is especially important for vendors whose user-visible families are not a clean match for canonical runtime semantics. `LS P` must be treated as a compatibility projection over canonical physical I/O, not as the shape of canonical memory itself.

## Responsibilities

A profile is responsible for:

- parsing vendor address strings
- formatting vendor address strings
- validating supported device families and address ranges
- translating vendor addresses to canonical addresses
- providing reverse aliases from canonical addresses to vendor-visible addresses
- defining readonly and retention metadata
- defining protocol mapping policy for Modbus and OPC UA alias projection

## Parse / Format / Validate Contract

Every profile must implement:

- `parse_address`
- `format_address`
- `validate_address`

Rules:

- parsing must reject malformed syntax
- validation must reject unsupported but syntactically valid addresses
- formatting must round-trip supported addresses deterministically

## Canonical Translation Contract

Every supported vendor address must translate to exactly one canonical address.

Reverse translation may yield:

- zero aliases
- one preferred alias
- multiple equivalent aliases

The profile must define a preferred alias for display.

If a vendor namespace collapses multiple canonical concepts into one family, the profile must own the disambiguation rule. That disambiguation may depend on:

- PLC model family
- configured hardware topology
- fixed CPU-local I/O window rules

## Metadata Contract

Every supported vendor address must provide:

- scalar type
- readonly / writable / internal-only access
- retained / volatile classification
- bit-addressable or word-only behavior

## Protocol Mapping Policy Contract

Profiles must supply:

- Modbus mapping policy
- OPC UA alias policy

The canonical runtime remains the source of truth. Profiles only describe how vendor-visible addresses are projected.

Project configuration must persist two separate concerns for profiles:

- `hardware_topology`
  - racks/bases/modules/address windows
  - shared across LS, MELSEC, and future IEC-oriented hardware backplanes
- `modbus.exposure`
  - whether the project uses recommended vendor defaults, legacy-wide exposure, or explicit custom mappings

Recommended Modbus exposure is allowed to differ from legacy-wide exposure. For example, LS projects may recommend `M -> coil` and `D -> holding register` while still supporting broader compatibility mappings when explicitly requested.

## Unsupported-Device Policy

Unsupported addresses must fail explicitly.

Do not silently coerce, remap, or reinterpret unsupported families.

## LS Profile Table

The LS profile must preserve the existing runtime behavior:

- bit devices: `P`, `M`, `K`, `F`, `T`, `C`
- word devices: `D`, `R`, `Z`, `N`
- derived timer/counter words: `TD`, `CD`

It owns:

- current parse/format rules
- current readonly behavior
- current retention behavior
- current Modbus mapping behavior
- model-specific `P` projection rules

For v1, the profile must distinguish at least:

- `XBC/XEC` fixed CPU-local `P` windows
- `XGT/XGI` slot-driven `P` topology

The profile is allowed to preserve legacy behavior where hardware topology is not yet available, but it must not pretend that all `P` addresses are inherently one canonical area.

## MELSEC FX/Q Common-Core Table

The initial MELSEC profile is intentionally narrow:

- supported bit families: `X`, `Y`, `M`, `L`, `T`, `C`
- supported word families: `D`
- unsupported in v1: any family outside the frozen common-core scope

This is a controlled first target, not a promise of full MELSEC coverage.

MELSEC-style explicit `X`/`Y` separation is the preferred reference shape for canonical physical I/O in v1.

## Future IEC Extension Point

The profile interface must remain capable of adding `IecProfile` later, including:

- symbolic/tag-oriented addressing
- richer type metadata
- non-letter-centric presentation

No current implementation work is required for IEC, but the interface must not block it.
