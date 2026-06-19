# OPC UA Crate Session Detail Retrieval — API Research

**Date:** 2026-03-16
**Crate:** `opcua` v0.12.0 (`opcua = { version = "0.12", features = ["server", "client", "vendored-openssl"] }`)
**Scope:** Sub-AC 4 — Document the opcua crate's API capabilities for session detail retrieval

---

## 1. Current Implementation

The existing `OpcUaServer::collect_session_details()` in `src-tauri/src/opcua/server.rs` already retrieves session information via the `ServerMetrics` pipeline:

```rust
let metrics_arc = server_guard.server_metrics();
let mut metrics = metrics_arc.write();
metrics.update_from_server_state(&server_state_guard);
metrics.update_from_connections(connections.read().clone());
```

This populates `metrics.connections: Vec<Connection>`, each containing `sessions: Vec<Session>`.

---

## 2. Available Data Structures in opcua 0.12

### 2.1 ServerMetrics (top-level)

| Field | Type | Description |
|-------|------|-------------|
| `server` | `Server` (metrics struct) | Server info including `start_time` |
| `diagnostics` | `ServerDiagnostics` | Aggregate session/subscription counters |
| `config` | `Option<ServerConfig>` | Server configuration snapshot |
| `connections` | `Vec<Connection>` | Per-connection detail |
| `runtime_components` | `Vec<String>` | Runtime component names |

### 2.2 Connection (per TCP connection)

| Field | Type | Description |
|-------|------|-------------|
| `client_address` | `String` | Client socket address (Debug-formatted `SocketAddr`, e.g. `"V4(127.0.0.1:54321)"`) |
| `transport_state` | `String` | Transport state: `"New"`, `"WaitingHello"`, `"ProcessMessages"`, `"Finished(<StatusCode>)"` |
| `sessions` | `Vec<Session>` | Sessions on this connection |

### 2.3 Session (metrics view, per session)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | Session identifier (e.g. `"Session-1"`) |
| `session_activated` | `bool` | Whether session has been activated |
| `session_terminated` | `bool` | Whether session has been terminated |
| `session_terminated_at` | `String` | RFC 3339 termination timestamp (empty if active) |
| `subscriptions` | `subscriptions::Metrics` | Subscription metrics |

### 2.4 Subscription Metrics

| Field | Type | Description |
|-------|------|-------------|
| `subscriptions` | `Vec<Subscription>` | Individual subscription details |
| `publish_request_queue_len` | `usize` | Pending publish requests |
| `publish_response_queue_len` | `usize` | Pending publish responses |
| `transmission_queue_len` | `usize` | Outgoing transmission queue |
| `retransmission_queue_len` | `usize` | Retransmission queue |

### 2.5 ServerDiagnosticsSummaryDataType (aggregate)

| Field | Type | Description |
|-------|------|-------------|
| `current_session_count` | `u32` | Currently active sessions |
| `cumulated_session_count` | `u32` | Total sessions since start |
| `current_subscription_count` | `u32` | Currently active subscriptions |
| `security_rejected_session_count` | `u32` | Sessions rejected for security reasons |
| `rejected_session_count` | `u32` | Total rejected sessions |
| `session_timeout_count` | `u32` | Timed-out sessions |
| `session_abort_count` | `u32` | Aborted sessions |

---

## 3. What's Currently Exposed vs. What's Needed

| Required Field (`OpcUaSessionInfo`) | Available via Metrics? | Source | Quality |
|--------------------------------------|----------------------|--------|---------|
| `session_id` | ✅ Yes | `Session.id` | Good — unique per session |
| `client_name` | ⚠️ Partial | Falls back to `session.id` | The metrics `Session` struct does not expose client application name; the underlying server `Session` object has `session_name()` but it's behind `pub(crate)` |
| `client_ip` | ✅ Yes | `Connection.client_address` | Requires parsing from Debug-formatted `SocketAddr` (already implemented via `parse_client_ip()`) |
| `security_policy` | ⚠️ No | `Connection.transport_state` only has transport state, not security policy | **Gap** — `transport_state` is `"ProcessMessages"` etc., NOT the security policy URI. The underlying `Session.security_policy_uri` is not propagated to metrics. |
| `security_mode` | ⚠️ No | Not in metrics | **Gap** — not available through metrics pipeline |
| `connected_at` | ⚠️ Workaround | Currently uses `metrics.server.start_time` (server start, not session start) | **Gap** — no per-session connection timestamp in metrics. The underlying `SessionDiagnostics` has `ClientConnectionTime` but it's not in the metrics view. |
| `subscription_count` | ✅ Yes | `session.subscriptions.subscriptions.len()` | Good — accurate count |

---

## 4. Deeper Session Object (Server-Side, Not Metrics)

The actual `opcua::server::session::Session` struct contains rich information, but most getters are `pub(crate)`:

| Method/Field | Visibility | Data |
|-------------|-----------|------|
| `session_id()` | pub(crate) | `NodeId` — unique session ID |
| `session_name()` | pub(crate) | Client-provided session name |
| `security_policy_uri` | pub(crate) | Security policy URI string |
| `client_certificate()` | pub(crate) | Optional X509 certificate |
| `endpoint_url()` | pub(crate) | Endpoint URL |
| `is_activated()` | pub(crate) | Activation state |
| `subscriptions()` | pub(crate) | Subscription collection |
| `session_diagnostics()` | pub(crate) | Detailed diagnostics (request counts, timing) |
| `last_service_request_timestamp()` | pub(crate) | Last activity timestamp |

**Key Limitation:** These methods are `pub(crate)`, meaning they are only accessible from within the opcua crate itself. External consumers (like our code) cannot call them directly.

The `ServerMetrics::update_from_connections()` method does access some of these internal fields to populate the metrics structs, but it does **not** propagate security policy, security mode, session name, or connection timestamps.

---

## 5. Gap Analysis Summary

### What Works Well
- **Client IP retrieval** — Available via `Connection.client_address` (needs parsing, already implemented)
- **Session count** — Both per-session list and aggregate `current_session_count`
- **Subscription count** — Accurate per-session count via metrics
- **Session lifecycle** (active/terminated) — Boolean flags available

### What Has Gaps
1. **Security policy per session** — NOT available in metrics. `transport_state` is the TCP transport state, not the security policy. The actual `security_policy_uri` is on the internal `Session` object (`pub(crate)`).
2. **Security mode per session** — NOT available in metrics at all.
3. **Client application name** — NOT available in metrics. The `session_name()` is `pub(crate)` on the internal Session.
4. **Per-session connection time** — NOT available in metrics. `SessionDiagnostics` has `ClientConnectionTime` but it's not propagated to the metrics view. Current workaround uses server start time.

### Current Workarounds in Place
- `client_name` → falls back to session ID
- `security_policy` → incorrectly uses `transport_state` (shows "ProcessMessages" instead of policy URI)
- `security_mode` → shows "Activated"/"Pending" based on activation state (not actual MessageSecurityMode)
- `connected_at` → uses server start time instead of per-session timestamp

---

## 6. Options to Close the Gaps

### Option A: Fork/Patch opcua 0.12
- Change `pub(crate)` to `pub` on key Session methods
- Add security_policy and security_mode fields to the metrics `Session` struct
- **Pros:** Minimal disruption, exact control
- **Cons:** Maintenance burden of maintaining a fork; must reapply on crate updates

### Option B: Use ServerDiagnostics Address Space Nodes
- The opcua crate does populate OPC UA standard diagnostic nodes in the address space (`SessionDiagnosticsArray`)
- These include `SecurityMode`, `SecurityPolicyUri`, `ClientConnectionTime`, `ClientDescription`
- We could read these from the address space programmatically
- **Pros:** No fork needed; uses standard OPC UA diagnostic information model
- **Cons:** Indirect; requires address space read roundtrip; diagnostic nodes may not be fully populated in 0.12

### Option C: Extend SessionMonitor with Connection-Level Tracking
- The `SessionMonitor` already polls metrics; extend it to track additional metadata by caching session details at connect time
- Security policy could be inferred from the endpoint configuration when only one policy is active
- **Pros:** Works within current constraints
- **Cons:** Security policy still cannot be determined per-session when multiple policies are active

### Option D: Migrate to async-opcua or opcua-rs alternatives
- Evaluate newer crate versions or forks that may expose session details publicly
- **Pros:** Might get better API surface
- **Cons:** Major migration effort; async-opcua may have its own gaps

---

## 7. Recommendation

**Option B (Address Space Diagnostic Nodes)** should be investigated first as it requires no fork and leverages the OPC UA standard diagnostic information model. If the `SessionDiagnosticsArray` nodes are populated by opcua 0.12, this provides all needed fields (security policy, mode, connection time, client description) through the standard address space API that is already publicly accessible.

If Option B proves insufficient (diagnostic nodes not populated), **Option A (targeted fork)** with a minimal patch to expose `security_policy_uri`, `session_name()`, and connection timestamps on the metrics `Session` struct is the most pragmatic path. The fork scope would be small (< 20 lines changed in `metrics.rs`).

**No crate replacement is needed.** The opcua 0.12 crate has all the required data internally — the gap is only in what subset is exposed through the public metrics API. This is addressable without a full crate migration.

---

## 8. References

- Crate source: `~/.cargo/registry/src/index.crates.io-.../opcua-0.12.0/`
- Key files: `src/server/metrics.rs`, `src/server/session.rs`, `src/server/session_diagnostics.rs`
- Current implementation: `src-tauri/src/opcua/server.rs` (`collect_session_details()`)
- Types: `src-tauri/src/opcua/types.rs` (`OpcUaSessionInfo`)
