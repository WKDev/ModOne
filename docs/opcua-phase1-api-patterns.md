# OPC UA Phase 1 — API Patterns for opcua 0.12

**Date:** 2026-03-16
**Context:** The current `opcua` v0.12 crate is sufficient for all Phase 1 requirements (see `CRATE_EVALUATION.md`). This document specifies the exact API patterns needed for each Phase 1 enhancement, referencing the existing ModOne codebase.

---

## Table of Contents

1. [Multi-Security-Policy Endpoints](#1-multi-security-policy-endpoints)
2. [Custom Authenticator (Multiple Users with Hash Verification)](#2-custom-authenticator)
3. [Session Detail Retrieval](#3-session-detail-retrieval)
4. [Gap Mitigations](#4-gap-mitigations)

---

## 1. Multi-Security-Policy Endpoints

### Status: Already Implemented ✅

**Current implementation:** `server.rs:496–513`

### API Pattern

```rust
use opcua::server::prelude::*;

// 1. Create the ServerBuilder
let mut builder = ServerBuilder::new()
    .application_name("ModOne PLC Simulator")
    .host_and_port("127.0.0.1", 4840)
    // ... other builder config

// 2. Register endpoints for each user-selected security policy
for (idx, policy) in config.security_policies.iter().enumerate() {
    let endpoint = build_server_endpoint(*policy, "/", &user_token_ids);
    let name = if idx == 0 { "default".to_string() } else { format!("policy_{}", idx) };
    builder = builder.endpoint(&name, endpoint);
}

// 3. Always add a discovery endpoint (no security, no user tokens)
builder = builder.endpoint(
    "discovery",
    ServerEndpoint::new_none("/discovery", &[]),
);
```

### Endpoint Factory Methods (per policy)

```rust
fn build_server_endpoint(
    policy: OpcUaSecurityPolicy,
    path: &str,
    user_token_ids: &[String],
) -> ServerEndpoint {
    match policy {
        OpcUaSecurityPolicy::None           => ServerEndpoint::new_none(path, user_token_ids),
        OpcUaSecurityPolicy::Basic128Rsa15  => ServerEndpoint::new_basic128rsa15_sign_encrypt(path, user_token_ids),
        OpcUaSecurityPolicy::Basic256       => ServerEndpoint::new_basic256_sign_encrypt(path, user_token_ids),
        OpcUaSecurityPolicy::Basic256Sha256 => ServerEndpoint::new_basic256sha256_sign_encrypt(path, user_token_ids),
        OpcUaSecurityPolicy::Aes128Sha256RsaOaep => ServerEndpoint::new_aes128_sha256_rsaoaep_sign_encrypt(path, user_token_ids),
        OpcUaSecurityPolicy::Aes256Sha256RsPss   => ServerEndpoint::new_aes256_sha256_rsapss_sign_encrypt(path, user_token_ids),
    }
}
```

### Key API Details

| API | Purpose | Crate Path |
|-----|---------|------------|
| `ServerBuilder::endpoint(id, ServerEndpoint)` | Register a single named endpoint | `opcua::server::builder` |
| `ServerEndpoint::new_none(path, &[token_ids])` | No-security endpoint | `opcua::server::config` |
| `ServerEndpoint::new_basic256sha256_sign_encrypt(path, &[token_ids])` | Basic256Sha256 + SignAndEncrypt | `opcua::server::config` |
| `ServerEndpoint::new(path, SecurityPolicy, MessageSecurityMode, &[token_ids])` | Generic constructor (any combo) | `opcua::server::config` |

### Adding Sign-Only Endpoints (Phase 1 Enhancement)

Currently only `SignAndEncrypt` mode is registered. To also offer `Sign`-only mode:

```rust
// For each non-None policy, register both Sign and SignAndEncrypt
match policy {
    OpcUaSecurityPolicy::Basic256Sha256 => {
        // SignAndEncrypt
        builder = builder.endpoint(
            "b256s256_sign_encrypt",
            ServerEndpoint::new_basic256sha256_sign_encrypt(path, user_token_ids),
        );
        // Sign only
        builder = builder.endpoint(
            "b256s256_sign",
            ServerEndpoint::new_basic256sha256_sign(path, user_token_ids),
        );
    }
    // ... similar for other policies
}
```

### No Changes Needed

The multi-policy endpoint pattern is fully implemented and tested. The `OpcUaConfig.security_policies` field already supports an arbitrary list of policies via `Vec<OpcUaSecurityPolicy>`.

---

## 2. Custom Authenticator

### Status: Already Implemented via Pre-Verification Pattern ✅

**Current implementation:** `server.rs:359–426` (resolve_user_tokens), `auth.rs` (full auth module)

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Account CRUD (Tauri commands)                  │
│  opcua_add_account() → UserAccountStore.add() + CredentialCache  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│            resolve_verified_credentials()                        │
│  For each enabled account:                                       │
│    1. Look up plaintext in CredentialCache                        │
│    2. bcrypt::verify(plaintext, stored_hash)                     │
│    3. If verified → VerifiedCredential { username, plaintext }   │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│            OpcUaConfig.verified_credentials                      │
│  Vec<VerifiedCredential> passed to OpcUaServer at start()        │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│            resolve_user_tokens()                                 │
│  For each VerifiedCredential:                                    │
│    ServerUserToken::user_pass(username, plaintext_password)      │
│    → registered with ServerBuilder::user_token(token_id, token)  │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│            opcua crate internal auth                             │
│  Client connects → crate compares password against               │
│  ServerUserToken.pass (plaintext match)                           │
└──────────────────────────────────────────────────────────────────┘
```

### API Pattern — Registering Multiple Users

```rust
// In resolve_user_tokens():
use opcua::server::prelude::ServerUserToken;

let mut entries = Vec::new();

for (idx, cred) in config.verified_credentials.iter().enumerate() {
    let token_id = format!("MODONE_USER_{}", idx);
    let token = ServerUserToken::user_pass(
        cred.username.clone(),
        cred.plaintext_password.clone(),  // pre-verified against bcrypt hash
    );
    entries.push((token_id, token));
}

// Register all tokens with the builder:
for (token_id, server_user_token) in &entries {
    builder = builder.user_token(token_id, server_user_token.clone());
}

// Collect token IDs for endpoint registration:
let user_token_ids: Vec<String> = entries.iter().map(|(id, _)| id.clone()).collect();

// Optionally include anonymous:
if config.allow_anonymous {
    user_token_ids.push(opcua::server::prelude::ANONYMOUS_USER_TOKEN_ID.to_string());
}
```

### Key API Details

| API | Purpose | Notes |
|-----|---------|-------|
| `ServerUserToken::user_pass(user, pass)` | Create username/password token | `pass` must be plaintext |
| `ServerBuilder::user_token(id, token)` | Register token with server | `id` is referenced by endpoints |
| `ANONYMOUS_USER_TOKEN_ID` | Built-in constant for anonymous token | Include in token IDs if anonymous allowed |
| `ServerEndpoint::new_*(path, &[token_ids])` | Endpoint references token IDs | Multiple tokens = multiple users per endpoint |

### Hash Verification Flow (auth.rs)

```rust
// Hash a password (account creation):
let hash = bcrypt::hash(plaintext, 12)?;  // cost 12

// Verify a password (credential resolution):
let matches = bcrypt::verify(plaintext, &stored_hash)?;

// Full resolution pipeline:
let verified = resolve_verified_credentials(&account_store, &credential_cache);
// Returns Vec<VerifiedCredential> with username + plaintext + role
```

### Limitation & Workaround

**Limitation:** opcua 0.12 has no `Authenticator` trait. The crate performs plaintext matching internally against `ServerUserToken.pass`. There is no way to inject custom auth logic (e.g., bcrypt verification) into the OPC UA session activation flow.

**Workaround (already implemented):** Pre-verify bcrypt hashes at startup time via `resolve_verified_credentials()`. Pass verified plaintext passwords to the crate. The hash verification still happens — just before server start, not during session activation.

**Trade-off:** If a user changes their password while the server is running, the OPC UA server must be restarted for the new password to take effect. This is acceptable for Phase 1.

---

## 3. Session Detail Retrieval

### Status: Partially Implemented (enhancement needed for 2 gaps) ⚠️

**Current implementation:** `server.rs:161–212` (collect_session_details)

### API Pattern — Reading Session Details via ServerMetrics

```rust
use opcua::server::prelude::*;

fn collect_session_details(
    server: &Arc<parking_lot::RwLock<Server>>,
) -> Vec<OpcUaSessionInfo> {
    let server_guard = server.read();

    // 1. Access server state and connections
    let server_state = server_guard.server_state();
    let server_state_guard = server_state.read();
    let connections = server_guard.connections();

    // 2. Update metrics from current connection state
    let metrics_arc = server_guard.server_metrics();
    let mut metrics = metrics_arc.write();
    metrics.update_from_server_state(&server_state_guard);
    metrics.update_from_connections(connections.read().clone());

    // 3. Iterate connections → sessions
    let mut result = Vec::new();
    for connection in &metrics.connections {
        let client_ip = parse_client_ip(&connection.client_address);

        for session in &connection.sessions {
            if session.session_terminated {
                continue;
            }

            result.push(OpcUaSessionInfo {
                session_id: session.id.clone(),
                client_name: session.id.clone(),  // Best available
                client_ip: client_ip.clone(),
                security_policy: /* see Gap 1 below */,
                security_mode: if session.session_activated {
                    "Activated".to_string()
                } else {
                    "Pending".to_string()
                },
                connected_at: /* see Gap 2 below */,
                subscription_count: session.subscriptions.subscriptions.len() as u32,
            });
        }
    }

    result
}
```

### Available Metrics Fields

| Field Path | Type | What It Contains |
|------------|------|------------------|
| `metrics.connections` | `Vec<ConnectionMetrics>` | One per TCP connection |
| `connection.client_address` | `String` | Socket address (e.g., "V4(127.0.0.1:54321)") |
| `connection.transport_state` | `String` | "New" / "ProcessMessages" / "Finished" |
| `connection.sessions` | `Vec<SessionMetrics>` | Sessions on this connection |
| `session.id` | `String` | Session NodeId as string |
| `session.session_activated` | `bool` | Whether ActivateSession was called |
| `session.session_terminated` | `bool` | Whether session ended |
| `session.terminated_at` | `DateTimeUtc` | When session was terminated |
| `session.subscriptions.subscriptions` | `Vec<SubscriptionMetrics>` | Active subscriptions |

### Session Count (for OpcUaStatus)

```rust
// Already implemented in status():
let count = metrics
    .diagnostics
    .server_diagnostics_summary()
    .current_session_count;
```

### Subscription Count Per Session

```rust
// Already implemented:
let subscription_count = session.subscriptions.subscriptions.len() as u32;
```

### Client IP Parsing

```rust
// The client_address format varies: "V4(127.0.0.1:54321)" or "127.0.0.1:54321"
fn parse_client_ip(raw: &str) -> String {
    // Strip "V4(" / "V6(" wrapper and trailing ")"
    let inner = raw
        .strip_prefix("V4(").or_else(|| raw.strip_prefix("V6("))
        .and_then(|s| s.strip_suffix(')'))
        .unwrap_or(raw);
    // Strip port suffix
    if let Some(colon_pos) = inner.rfind(':') {
        inner[..colon_pos].to_string()
    } else {
        inner.to_string()
    }
}
```

---

## 4. Gap Mitigations

### Gap 1: Security Policy Per Session

**Problem:** `connection.transport_state` returns the transport state ("ProcessMessages"), NOT the security policy. The crate's `Session` struct has `security_policy_uri()` but it's `pub(crate)` — not accessible from outside the opcua crate.

**Mitigation Strategy: Endpoint Configuration Correlation**

```rust
/// Infer the security policy for a session by correlating endpoint configuration.
///
/// When a client connects, it selects one of the server's advertised endpoints.
/// Since each endpoint has a known security policy from our configuration, we can
/// map the endpoint URL back to the policy.
///
/// Approach:
/// 1. Store a map of endpoint_path → security_policy at server build time
/// 2. When building OpcUaSessionInfo, look up the endpoint from configuration
///
/// Limitation: If multiple policies share the same path (which is common — all use "/"),
/// the mapping is ambiguous. In that case, fall back to "Unknown" or use the strongest
/// configured policy as a reasonable default.
struct EndpointPolicyMap {
    /// endpoint_name → (security_policy_uri, message_security_mode)
    entries: HashMap<String, (String, String)>,
}

impl EndpointPolicyMap {
    fn from_config(config: &OpcUaConfig) -> Self {
        let mut entries = HashMap::new();
        for (idx, policy) in config.security_policies.iter().enumerate() {
            let name = if idx == 0 { "default".to_string() } else { format!("policy_{}", idx) };
            entries.insert(name, (
                policy.policy_uri().to_string(),
                policy.auto_message_security_mode().to_string(),
            ));
        }
        Self { entries }
    }
}
```

**Alternative Mitigation: External Tracking in SessionMonitor**

```rust
/// Enhanced SessionMonitor that tracks security policy per session.
///
/// When a new session is detected (by comparing session IDs across poll ticks),
/// infer the security policy from the server's endpoint configuration. Since
/// opcua 0.12 typically has one connection per secure channel, and each secure
/// channel is bound to one endpoint, the first non-terminated session on a
/// connection inherits the endpoint's security policy.
struct EnhancedSessionState {
    /// session_id → inferred security policy URI
    security_policies: HashMap<String, String>,
}
```

**Practical Recommendation:** For Phase 1, populate `OpcUaSessionInfo.security_policy` with the server's default/strongest configured policy as a best-effort value, and add a note in the UI that per-session policy is approximate. The full solution requires migrating to async-opcua (Phase 2) where `session.security_policy_uri()` is public.

### Gap 2: Connection Timestamp

**Problem:** The opcua 0.12 crate does not record when a session was created. `metrics.server.start_time` gives the server start time, not the session creation time.

**Mitigation Strategy: External Timestamp Capture**

```rust
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Track when sessions are first observed.
///
/// Added to SessionMonitor's polling loop state.
struct SessionTimestampTracker {
    /// session_id → first-observed timestamp
    first_seen: HashMap<String, DateTime<Utc>>,
}

impl SessionTimestampTracker {
    fn new() -> Self {
        Self { first_seen: HashMap::new() }
    }

    /// Call on each poll tick with the current set of active session IDs.
    /// Returns newly observed session IDs.
    fn update(&mut self, current_session_ids: &[String]) -> Vec<String> {
        let now = Utc::now();
        let mut new_sessions = Vec::new();

        for id in current_session_ids {
            if !self.first_seen.contains_key(id) {
                self.first_seen.insert(id.clone(), now);
                new_sessions.push(id.clone());
            }
        }

        // Prune sessions no longer present
        self.first_seen.retain(|id, _| current_session_ids.contains(id));

        new_sessions
    }

    /// Get the first-observed timestamp for a session.
    fn get(&self, session_id: &str) -> Option<&DateTime<Utc>> {
        self.first_seen.get(session_id)
    }
}
```

**Integration with collect_session_details():**

```rust
// Store the tracker as shared state accessible to both SessionMonitor and collect_session_details()
struct SharedSessionState {
    timestamps: HashMap<String, DateTime<Utc>>,
    security_policies: HashMap<String, String>,
}

// In OpcUaServer:
shared_session_state: Arc<Mutex<SharedSessionState>>,

// In collect_session_details():
let state = self.shared_session_state.lock();
let connected_at = state.timestamps
    .get(&session.id)
    .map(|dt| dt.to_rfc3339())
    .unwrap_or_else(|| Utc::now().to_rfc3339());
```

**Accuracy Note:** The timestamp accuracy is bounded by the SessionMonitor poll interval (currently `SESSION_MONITOR_POLL_INTERVAL`). A session created between polls will have its timestamp recorded at the next poll tick, which may be up to one interval late. For typical poll intervals (2–5 seconds), this is acceptable for UI display purposes.

---

## Summary of Phase 1 Implementation Plan

| Requirement | API Pattern | Status | Work Needed |
|-------------|-------------|--------|-------------|
| Multi-security-policy endpoints | `ServerBuilder::endpoint()` + `build_server_endpoint()` | ✅ Done | None |
| Multiple user tokens | `ServerBuilder::user_token()` + `resolve_user_tokens()` | ✅ Done | None |
| Bcrypt hash verification | `resolve_verified_credentials()` pre-verification | ✅ Done | None |
| Anonymous access toggle | `ANONYMOUS_USER_TOKEN_ID` in endpoint token list | ✅ Done | None |
| Session count | `ServerDiagnostics.current_session_count` | ✅ Done | None |
| Client IP per session | `Connection.client_address` via `ServerMetrics` | ✅ Done | None |
| Subscription count | `session.subscriptions.subscriptions.len()` | ✅ Done | None |
| Security policy per session | Infer from endpoint config | ⚠️ Gap | Add `EndpointPolicyMap` or best-effort default |
| Connection timestamp | External tracking in `SessionMonitor` | ⚠️ Gap | Add `SessionTimestampTracker` |

### Key opcua 0.12 API Types Referenced

| Type | Module | Purpose |
|------|--------|---------|
| `ServerBuilder` | `opcua::server::builder` | Fluent API for server construction |
| `ServerEndpoint` | `opcua::server::config` | Endpoint definition (path + policy + tokens) |
| `ServerUserToken` | `opcua::server::config` | Username/password credential |
| `Server` | `opcua::server::server` | Running server instance |
| `ServerMetrics` | `opcua::server::metrics` | Connection/session/diagnostic metrics |
| `ConnectionMetrics` | `opcua::server::metrics` | Per-connection state (client_address, sessions) |
| `SessionMetrics` | `opcua::server::metrics` | Per-session state (id, activated, subscriptions) |
| `SecurityPolicy` | `opcua::crypto::security_policy` | Policy enum (None, Basic256Sha256, etc.) |
| `MessageSecurityMode` | `opcua::types` | None / Sign / SignAndEncrypt |

### Dependencies (Cargo.toml)

```toml
# Current — no changes needed for Phase 1
opcua = { version = "0.12", features = ["server", "client", "vendored-openssl"] }
bcrypt = "0.15"
```
