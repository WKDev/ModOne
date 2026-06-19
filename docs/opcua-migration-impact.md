# OPC UA Crate Migration Impact Analysis

**Date:** 2026-03-16
**Context:** Phase 1 recommendation is to stay with `opcua` 0.12. This document records the migration impact to `async-opcua` 0.18 for future reference (Phase 2+).

---

## Executive Summary

Migration from `opcua` 0.12 to `async-opcua` 0.18 would affect **6 source files** and **1 build file** in the `src-tauri/src/opcua/` module. The core business logic (canonical memory, tag registry, address space spec generation) is **not affected**. The primary impact is in server lifecycle management, authentication flow, and session monitoring. Estimated effort: **3–5 developer-days** including testing.

---

## 1. Dependency Change

### Cargo.toml (`src-tauri/Cargo.toml`)

| Current | After Migration |
|---------|----------------|
| `opcua = { version = "0.12", features = ["server", "client", "vendored-openssl"], optional = true }` | `async-opcua = { version = "0.18", features = ["server", "client"], optional = true }` |
| Feature: `opcua-server = ["dep:opcua"]` | Feature: `opcua-server = ["dep:async-opcua"]` |

**Breaking changes:**
- The `vendored-openssl` feature may not exist in async-opcua 0.18 — verify OpenSSL linking strategy
- Crate import path changes: `opcua::server::prelude::*` → `async_opcua::server::prelude::*` (all `use` statements)
- The umbrella `async-opcua` crate may require different feature flags than `opcua`

**Risk:** Low. Straightforward dependency swap.

---

## 2. Server Builder & Lifecycle (`server.rs`)

This is the **highest-impact file** — approximately 60% of migration effort.

### 2.1 Server Type Storage

**Current** (line 51):
```rust
inner_server: Mutex<Option<Arc<parking_lot::RwLock<opcua::server::prelude::Server>>>>,
```

**After migration:**
async-opcua uses `ServerHandle` as the runtime reference instead of `Server`. The `Server` is consumed by `Server::run()` which returns a `ServerHandle`.

```rust
inner_handle: Mutex<Option<async_opcua::server::ServerHandle>>,
```

**Breaking change:** The `Server` object is no longer retained after `run()`. All runtime interactions go through `ServerHandle`.

### 2.2 Server Builder API

**Current** (`start_opcua_server()`, line 429):
```rust
let builder = ServerBuilder::new()
    .application_name(name)
    .application_uri(uri)
    .discovery_urls(urls)
    .pki_dir(pki_dir)
    .certificate_path(cert_path)
    .private_key_path(key_path)
    .user_token(id, ServerUserToken { user, pass, .. })
    .endpoint(id, ServerEndpoint::new(...))
    .discovery_server_url(None);
```

**After migration:**
```rust
let builder = ServerBuilder::new()
    .application_name(name)
    .application_uri(uri)
    .discovery_urls(urls)
    .pki_dir(pki_dir)
    .certificate_path(cert_path)
    .private_key_path(key_path)
    .with_authenticator(Arc::new(ModOneAuthManager::new(...)))
    .add_endpoint(id, ServerEndpoint::new(...))
    .discovery_server_url(None);
```

**Breaking changes:**
- `endpoint()` → `add_endpoint()` (method rename)
- `user_token()` → removed; replaced by `AuthManager` trait implementation
- `ServerUserToken` struct → no longer used; authentication is callback-based
- Builder method signatures may differ for certificate/PKI configuration

### 2.3 Shutdown Mechanism

**Current:**
```rust
running: Arc<AtomicBool>
// Server checks AtomicBool in its event loop
```

**After migration:**
```rust
cancel_token: CancellationToken
// ServerHandle::abort() or CancellationToken::cancel()
```

**Breaking change:** The `Arc<AtomicBool>` shutdown signal pattern used throughout `OpcUaServer` must be replaced with `tokio_util::sync::CancellationToken`. This affects:
- `OpcUaServer.running` field
- `start()` method
- `stop()` method
- `stop_opcua_server()` method
- `is_running()` method

### 2.4 Server Run Pattern

**Current** (`start_opcua_server()`, line ~580):
```rust
let server_clone = Arc::clone(&server);
let running = Arc::clone(&self.running);
let handle = tauri::async_runtime::spawn(async move {
    let _ = Server::run(server_clone).await;
    running.store(false, Ordering::SeqCst);
});
```

**After migration:**
```rust
let (server, handle) = builder.build().unwrap();
let server_handle = server.run().await; // consumes server, returns ServerHandle
// server_handle can be used for session queries, shutdown, etc.
```

**Breaking change:** `Server::run()` now consumes the server and returns a `ServerHandle`. The spawned task pattern changes significantly.

---

## 3. Authentication Model (`server.rs` + `auth.rs`)

### 3.1 Elimination of CredentialCache Workaround

**Current flow:**
1. `UserAccountStore` stores bcrypt hashes on disk
2. `CredentialCache` holds plaintext passwords in memory
3. `resolve_verified_credentials()` verifies bcrypt → produces `VerifiedCredential` with plaintext
4. `resolve_user_tokens()` (server.rs:359) converts to `ServerUserToken` with plaintext `pass`
5. opcua crate does internal plaintext comparison at runtime

**After migration:**
1. `UserAccountStore` stores bcrypt hashes on disk (unchanged)
2. `CredentialCache` is **no longer needed** for OPC UA auth
3. Custom `AuthManager` implementation calls `bcrypt::verify()` directly
4. No plaintext passwords stored in memory at runtime

**Breaking changes:**
- `VerifiedCredential.plaintext_password` field becomes unnecessary for OPC UA (may still be needed for other purposes)
- `resolve_user_tokens()` in server.rs (line 359) is replaced entirely
- `CredentialCache` usage in OPC UA context is eliminated
- `OpcUaConfig.verified_credentials` field usage changes

**Benefit:** This is the single largest security improvement — eliminates in-memory plaintext password storage.

### 3.2 New `AuthManager` Implementation Required

A new struct (e.g., `ModOneAuthManager`) must be created implementing `async_opcua::server::AuthManager`:

```rust
struct ModOneAuthManager {
    account_store: Arc<RwLock<UserAccountStore>>,
    audit_logger: Option<Arc<AuditLoggerState>>,
}

#[async_trait]
impl AuthManager for ModOneAuthManager {
    async fn authenticate_username_identity_token(
        &self, endpoint: &ServerEndpoint, username: &str, password: &Password,
    ) -> Result<UserToken, Error> {
        let store = self.account_store.read();
        let account = store.get(username)
            .ok_or(Error::new(StatusCode::BadIdentityTokenRejected))?;
        let verified = account.verify_password(password.as_str())?;
        if !verified {
            return Err(Error::new(StatusCode::BadIdentityTokenRejected));
        }
        Ok(UserToken::new(username, account.role))
    }
    // ... other trait methods
}
```

**New file suggested:** `src-tauri/src/opcua/auth_manager.rs`

**Impact on `auth.rs`:**
- `CredentialCache` struct remains (may be used outside OPC UA)
- `resolve_verified_credentials()` / `resolve_verified_credentials_audited()` no longer called from OPC UA server startup
- `VerifiedCredential` struct may be simplified or deprecated
- `UserAccountStore`, `UserAccount`, `UserRole` — **unchanged**

---

## 4. Session Monitoring (`server.rs` — `SessionMonitor`)

### 4.1 Current Polling Approach

**Current** (line 748+):
```rust
struct SessionMonitor {
    task: Option<tokio::task::JoinHandle<()>>,
    cancel: Arc<AtomicBool>,
}
// Polls ServerMetrics via inner_server.read().metrics() every N seconds
// Extracts: connection.client_address, session.id, session.subscriptions
```

### 4.2 After Migration

**New approach:** `ServerHandle::session_manager()` returns `&RwLock<SessionManager>` with direct `Session` access.

```rust
let session_mgr = server_handle.session_manager().read();
for (id, session) in session_mgr.sessions() {
    let session = session.read();
    let info = OpcUaSessionInfo {
        session_id: session.session_id().to_string(),
        security_policy: session.security_policy_uri().to_string(),
        security_mode: format!("{:?}", session.message_security_mode()),
        // client_ip: still needs transport-layer capture
        // connected_at: still needs external tracking
    };
}
```

**Breaking changes:**
- `ServerMetrics` struct no longer exists — replaced by `SessionManager`
- `connection.client_address` access path changes
- Session iteration pattern changes (HashMap of Arc<RwLock<Session>> instead of flat struct list)
- `collect_session_details()` (line 161) needs complete rewrite

**Gaps that persist after migration:**
- Client IP address: still not on `Session` object; must be captured at transport layer
- Connection timestamp: still not natively tracked; external capture still needed

**Gaps resolved by migration:**
- Security policy per session: `session.security_policy_uri()` (pub)
- Security mode per session: `session.message_security_mode()` (pub)
- Client application name: `session.application_description()` (pub)

---

## 5. Address Space Builder (`address_space.rs` + `server.rs`)

### 5.1 Current Node Registration

**Current** (server.rs, `start_opcua_server()` section):
```rust
let address_space = server.write().address_space();
let mut address_space = address_space.write();
// Create folder nodes, variable nodes using opcua::server::address_space API
address_space.add_folder(node_id, browse_name, parent);
address_space.add_variable(Variable::new(node_id, browse_name, ...));
```

### 5.2 After Migration

async-opcua uses a `NodeManager` / `NodeManagerBuilder` pattern:

```rust
let node_manager = NodeManagerBuilder::new()
    .add_folder(node_id, browse_name, parent)
    .add_variable(node_id, browse_name, data_type, value)
    .build();
server_builder.with_node_manager(node_manager);
```

**Breaking changes:**
- `address_space.add_folder()` / `address_space.add_variable()` API may differ
- Folder hierarchy construction pattern may change
- Variable node creation with `AttributeGetter` callbacks may use different trait
- The `AddressSpaceSpec` and `OpcUaNodeSpec` structs are **not affected** (they are ModOne-internal abstractions)
- Only the code that *applies* the spec to the OPC UA server changes

### 5.3 Live Value Getters

**Current:**
```rust
// AttibuteGetter trait for live value reads
impl AttributeGetter for OpcUaValueGetter { ... }
```

**After migration:**
The getter/setter callback mechanism may use a different trait name or signature. The `OpcUaMemory`-based getter pattern needs adaptation.

**Impact on `memory.rs`:** Likely unchanged — `OpcUaMemory` is a ModOne abstraction layer. Only the bridge code in `server.rs` that connects `OpcUaMemory` to opcua node callbacks changes.

---

## 6. Adapter Layer (`adapter.rs`)

**Impact: NONE**

The `OpcUaAdapter` struct and `ProtocolAdapter` implementation interact only with:
- `OpcUaMemory` (ModOne abstraction — unchanged)
- `OpcUaServer::update_node_values()` / `sync_all_node_values()` (ModOne methods — interface unchanged)
- `CanonicalMemory` (ModOne abstraction — unchanged)

The adapter is fully insulated from the underlying OPC UA crate. No changes needed.

---

## 7. Types (`types.rs`)

**Impact: MINIMAL**

| Type | Change Needed |
|------|---------------|
| `OpcUaConfig` | Remove `verified_credentials` field (or mark deprecated) |
| `OpcUaSecurityPolicy` | No change — ModOne enum, not crate-dependent |
| `OpcUaStatus` | No change |
| `OpcUaSessionInfo` | No change (struct is correct, only the *population* code changes) |
| `OpcUaError` | No change |

---

## 8. Audit Integration (`audit.rs`)

**Impact: MINIMAL**

The audit logger emits events based on ModOne-level lifecycle events (server start/stop, session connect/disconnect). These are triggered from `server.rs` and `SessionMonitor`, not from the OPC UA crate directly. The audit module itself does not depend on opcua types.

Changes needed:
- Audit events for authentication outcomes move from `resolve_verified_credentials_audited()` to the new `AuthManager` implementation
- Session lifecycle audit events remain in `SessionMonitor` (which itself changes, see §4)

---

## 9. Module Exports (`mod.rs`)

**Impact: NONE**

All public exports are ModOne-defined types. No opcua crate types are re-exported from the module boundary.

---

## 10. File-by-File Impact Summary

| File | Impact | Effort | Description |
|------|--------|--------|-------------|
| `Cargo.toml` | 🟡 Low | 0.5h | Swap dependency, update feature flags |
| `server.rs` | 🔴 High | 2–3d | Builder, lifecycle, shutdown, session monitoring, node registration |
| `auth.rs` | 🟡 Medium | 0.5d | Remove/deprecate CredentialCache OPC UA usage, adapt resolve functions |
| `auth_manager.rs` (new) | 🟡 Medium | 0.5d | Implement `AuthManager` trait with bcrypt verification |
| `address_space.rs` | 🟢 None | 0h | No opcua crate dependency — pure ModOne logic |
| `adapter.rs` | 🟢 None | 0h | Fully insulated from crate internals |
| `types.rs` | 🟢 Minimal | 0.5h | Minor field cleanup on OpcUaConfig |
| `memory.rs` | 🟢 None | 0h | Pure ModOne abstraction |
| `audit.rs` | 🟢 Minimal | 1h | Move auth audit calls to AuthManager |
| `mod.rs` | 🟢 None | 0h | No crate types exported |

**Total estimated effort:** 3–5 developer-days (including integration testing)

---

## 11. Breaking Changes Checklist

### API Breaking Changes (compile errors)
- [ ] `opcua::server::prelude::*` → `async_opcua::server::prelude::*`
- [ ] `ServerBuilder::endpoint()` → `ServerBuilder::add_endpoint()`
- [ ] `ServerBuilder::user_token()` → removed (use `with_authenticator()`)
- [ ] `ServerUserToken` struct → removed
- [ ] `Server` retained reference → `ServerHandle` (server consumed by `run()`)
- [ ] `ServerMetrics` → `SessionManager` for session queries
- [ ] `Arc<AtomicBool>` shutdown → `CancellationToken`
- [ ] `AttributeGetter` trait → verify new callback trait name/signature

### Semantic Breaking Changes (runtime behavior)
- [ ] Authentication now happens inside OPC UA flow (bcrypt during session activation, not at startup)
- [ ] Session monitoring uses direct `Session` access instead of polling `ServerMetrics`
- [ ] Plaintext passwords no longer held in memory for OPC UA purposes
- [ ] Shutdown signaling semantics may differ (graceful vs immediate)

### Non-Breaking (preserved)
- `OpcUaConfig` serialization format (frontend API contract)
- `OpcUaStatus` serialization format (frontend API contract)
- `OpcUaSessionInfo` serialization format (frontend API contract)
- `ProtocolAdapter` trait implementation
- `OpcUaMemory` read/write patterns
- `AddressSpaceSpec` / `OpcUaNodeSpec` structs
- `UserAccountStore` persistence format
- `AuditLogger` event format
- All Tauri command signatures

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| async-opcua API instability (0.18 is pre-1.0) | Medium | High | Pin exact version, vendor if needed |
| OpenSSL linking changes | Low | Medium | Test vendored-openssl compatibility early |
| Session monitoring regression | Medium | Medium | Comprehensive integration tests before/after |
| Authentication regression | Low | High | Test all auth paths: valid, invalid, disabled, anonymous |
| Address space node registration regression | Medium | Medium | Validate full node tree matches after migration |
| Performance regression in bcrypt-during-auth | Low | Low | bcrypt runs async; no event loop blocking |

---

## 13. Recommended Migration Strategy

1. **Create feature branch** — isolate all migration work
2. **Swap dependency first** — get `Cargo.toml` compiling with async-opcua
3. **Implement `AuthManager` trait** — new file, can be developed independently
4. **Refactor `server.rs` builder** — largest change, do incrementally
5. **Update session monitoring** — adapt `SessionMonitor` to `SessionManager`
6. **Update node registration** — adapt address space application code
7. **Run full integration test suite** — validate all security policies, auth flows, session reporting
8. **Remove deprecated code** — clean up `CredentialCache` OPC UA usage, old `resolve_user_tokens()`

---

## Cross-References

- **Crate evaluation:** `src-tauri/src/opcua/CRATE_EVALUATION.md`
- **Capability assessment:** `docs/opcua-crate-capability-assessment.md`
