# Tag Registry and OPC UA Model

## Purpose

The tag registry is the semantic layer between canonical runtime memory and external systems like OPC UA.

## Tag Classes

The registry supports two tag classes:

- `RawBacked`
  - direct binding to a canonical address
- `Semantic`
  - a stable business-facing tag bound to one or more canonical sources

## Tag ID Policy

Every tag must have a stable id.

Rules:

- raw tags derive deterministically from canonical address identity
- semantic tags use stable registry ids
- vendor address strings are not allowed to be the long-term identity of semantic tags

## Canonical Binding Policy

Every tag resolves to canonical runtime memory.

The registry must never bind directly to vendor-specific storage or protocol-specific offset tables.

## Vendor Alias Policy

Profiles may contribute vendor-visible aliases for display or browse decoration, but canonical binding remains authoritative.

## Access-Level Propagation

Tag access must derive from canonical access rules plus any tag-specific restriction. Tags may become more restrictive, but never less restrictive, than their canonical source.

## OPC UA Namespace Structure

The initial OPC UA namespace layout is fixed:

- `Root/ModOne/RawMemory`
- `Root/ModOne/Tags`

## NodeId Rules

- raw nodes use canonical area and canonical index based identifiers
- tag nodes use stable tag ids
- LS or MELSEC address strings may appear as browse metadata, but not as the canonical NodeId source for semantic tags

## Subscription Model

Data change subscriptions must be driven by canonical memory bus events.

Polling may exist only as a fallback or bootstrap aid, not as the primary update path.
