# OPC UA Crate Evaluation — Phase 1 Recommendation

**Date:** 2026-03-16
**Current crate:** `opcua` v0.12.0 (MPL-2.0, author: Adam Lock)
**Cargo.toml:** `opcua = { version = "0.12", features = ["server", "client", "vendored-openssl"] }`

---

## Recommendation

### **Stay with `opcua` 0.12 for Phase 1. No crate replacement needed.**

The current crate satisfies all Phase 1 requirements either natively or through established workaround patterns already implemented in the ModOne codebase. The two minor gaps (per-session security policy and connection timestamp) are addressable without changing crates.

---

## Rationale

### Requirements vs. Current Crate Capabilities

| Phase 1 Requirement | opcua 0.12 Support | Approach |
|---|---|---|
| Multiple security policies simultaneously | ✅ Native | `ServerBuilder::endpoint()` with multiple `ServerEndpoint` entries — already implemented via `build_server_endpoint()` |
| Custom authenticator (multiple users, bcrypt hash) | ✅ Workaround | Pre-verify bcrypt hashes at startup → pass plaintext to `ServerUserToken` — already implemented via `resolve_user_tokens()` |
| Session count | ✅ Native | `ServerDiagnostics.current_session_count` — already implemented |
| Client IP per session | ✅ Native | `Connection.client_address` via `ServerMetrics` — already implemented |
| Subscription count | ✅ Native | `Session.subscriptions().metrics()` — already implemented |
| Security policy per session | ⚠️ Gap | Not in metrics; infer from endpoint config or track externally in `SessionMonitor` |
| Connection timestamp | ⚠️ Gap | Not tracked by crate; capture in `SessionMonitor` when new session delta detected |
| Async/Tauri compatibility | ✅ Native | tokio-based, works with `tauri::async_runtime::spawn` |

### Why Not Switch to async-opcua 0.18?

async-opcua is the strongest alternative and offers genuine improvements:
- **`AuthManager` trait** — enables bcrypt verification inside the OPC UA auth flow (eliminates plaintext workaround)
- **Public session getters** — `security_policy_uri()`, `message_security_mode()`, `application_description()` all pub
- **Active development** from the FreeOpcUa community

However, migration is **not justified for Phase 1** because:

1. **Working code exists.** The pre-verification auth pattern and metrics-based session monitoring are already implemented and tested. Replacing them provides no user-facing benefit in Phase 1.

2. **Migration cost is moderate.** Switching requires refactoring:
   - `OpcUaServer` builder → new `ServerBuilder` API (method renames, different endpoint registration)
   - Auth model → implement `AuthManager` trait instead of declarative `ServerUserToken`
   - Session monitoring → replace `ServerMetrics` polling with `SessionManager` direct access
   - Address space → adapt to `NodeManagerBuilder` pattern
   - Cargo.toml → `opcua` → `async-opcua` with `server` feature

3. **Risk outweighs benefit.** async-opcua 0.18 is actively evolving. Migrating now means absorbing API churn during Phase 1 delivery.

4. **The two gaps are minor.** Security policy per session can be inferred from endpoint configuration matching. Connection timestamp can be captured externally when the session monitor first detects a new session.

### Why Not mabi-opcua?

**Not recommended for production use:**
- Designed as a simulator, not a production OPC UA server
- Uses non-standard password hashing (simple XOR, not bcrypt/argon2)
- No custom authenticator trait (concrete struct only)
- Low maturity and community adoption
- Higher migration effort than async-opcua with fewer benefits

---

## Gap Mitigation Plan (Phase 1)

### Gap 1: Security Policy Per Session

**Problem:** `ServerMetrics` exposes `transport_state` (New/ProcessMessages/Finished), not the negotiated security policy.

**Mitigation:** When building `OpcUaSessionInfo`, correlate the endpoint URL from session data with the `ServerConfig.endpoints` map to resolve the security policy. Each endpoint has a known `SecurityPolicy` from configuration.

### Gap 2: Connection Timestamp

**Problem:** The crate does not record when a session was created.

**Mitigation:** In the `SessionMonitor` polling loop, record `chrono::Utc::now()` when a session ID is first observed. Store in a `HashMap<String, DateTime<Utc>>` alongside existing session tracking state.

---

## Phase 2+ Migration Path

If any of the following conditions arise, migrate to **async-opcua**:

1. **External identity provider integration** — need to call LDAP/OAuth during OPC UA session activation (requires `AuthManager` trait)
2. **Production monitoring dashboard** — session detail gaps become unacceptable for customer-facing UI
3. **opcua 0.12 becomes unmaintained** — the crate already shows low activity
4. **Dynamic user management** — need to add/remove users without server restart (requires `AuthManager` trait)

### Migration Checklist (for future reference)

- [ ] Replace `opcua` dependency with `async-opcua = { version = "0.18", features = ["server"] }`
- [ ] Implement `AuthManager` trait with bcrypt verification in `authenticate_username_identity_token()`
- [ ] Refactor `OpcUaServer::build_server()` to use async-opcua `ServerBuilder` API
- [ ] Replace `ServerMetrics` polling with `ServerHandle::session_manager()` access
- [ ] Adapt `AddressSpace` builder to `NodeManagerBuilder` pattern
- [ ] Update shutdown mechanism: `CancellationToken` instead of `Arc<AtomicBool>`
- [ ] Verify certificate management compatibility (same OpenSSL backend)
- [ ] Run full integration test suite against all supported security policies

---

## Detailed Assessment Reference

See `docs/opcua-crate-capability-assessment.md` for the full capability comparison matrix across all three evaluated crates (opcua 0.12, async-opcua 0.18, mabi-opcua 1.3.2).
