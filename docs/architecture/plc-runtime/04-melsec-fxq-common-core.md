# MELSEC FX/Q Common-Core

## Scope

This document freezes the first MELSEC support target so the implementation does not expand by accident.

Supported in v1:

- bit families: `X`, `Y`, `M`, `L`, `T`, `C`
- word families: `D`

Unsupported in v1:

- any MELSEC family outside the list above
- advanced device families that are not shared cleanly across the FX/Q common core

## Parse Rules

The profile must accept the supported family set using MELSEC-appropriate vendor formatting rules.

Parsing and formatting must be deterministic and must reject unsupported families explicitly.

## Bit / Word Access Rules

- bit families map to canonical bit areas
- `D` maps to canonical word areas
- bit access on word addresses is only allowed if the chosen MELSEC common-core rules permit it

## Retention Rules

Retention must be encoded in profile metadata rather than hardcoded into protocol adapters.

Where retention differs across deeper MELSEC families, the v1 profile uses the frozen common-core rule set only.

## Readonly Rules

Timer and counter exposed state may be readable but not writable through public mutation paths.

Unsupported or ambiguous writable semantics must fail explicitly rather than guessing.

## Canonical Mapping Table

The initial canonical mapping policy is:

- `X` -> `InputBit`
- `Y` -> `OutputBit`
- `M` -> `InternalBit`
- `L` -> `RetentiveBit`
- `T` done/contact -> `TimerDoneBit`
- `C` done/contact -> `CounterDoneBit`
- `D` -> `DataWord`

Timer current values and counter current values may be exposed through canonical timer/counter value areas, but only if the selected MELSEC common-core surface supports them cleanly.

## Modbus Mapping Policy Assumptions

The MELSEC profile must provide its own Modbus mapping policy.

No LS offset table may be reused by assumption. If a mapping rule is needed for v1 behavior, it must be defined explicitly in the profile.

Recommended v1 exposure is intentionally conservative:

- `Y` -> coil area
- `X` -> discrete input area
- `D` -> holding register area

Broader mappings such as internal `M/L` exposure remain valid as compatibility or custom choices, but they must not be smuggled in as if every MELSEC project wants the same surface.

MELSEC hardware is also topology-oriented in practice. The runtime therefore stores rack/base/module topology generically for both LS and MELSEC, even though v1 canonical semantics already distinguish `X` and `Y` without needing LS-style compatibility projection.

## Compatibility Note

This profile is deliberately limited to `FX/Q common core`.

It is not a full MELSEC implementation and must not be documented, tested, or marketed as one until additional device families and semantics are added explicitly.
