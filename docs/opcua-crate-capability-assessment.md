# OPC UA Crate Capability Assessment

**Date:** 2026-03-16
**Crate:** `opcua` v0.12.0 (crates.io, author: Adam Lock, license: MPL-2.0)
**Purpose:** Evaluate whether the current crate supports Phase 1 OPC UA server enhancements

---

## 1. Multi-Security-Policy Endpoint Configuration

### Verdict: FULLY SUPPORTED

The `opcua` 0.12 crate natively supports configuring multiple security policies simultaneously on the same server. The API surface is comprehensive:

#### ServerBuilder API
- `endpoint(id, ServerEndpoint)` — adds a single named endpoint
- `endpoints(Vec<(id, ServerEndpoint)>)` — adds multiple endpoints in one call
- Endpoints are stored in a `BTreeMap<String, ServerEndpoint>` inside `ServerConfig`, so any number of unique endpoints can coexist

#### ServerEndpoint Factory Methods (all policies)
Each policy has convenience constructors for both Sign and SignAndEncrypt modes:

| Policy | Sign | SignAndEncrypt |
|--------|------|---------------|
| None | `new_none()` | — |
| Basic128Rsa15 | `new_basic128rsa15_sign()` | `new_basic128rsa15_sign_encrypt()` |
| Basic256 | `new_basic256_sign()` | `new_basic256_sign_encrypt()` |
| Basic256Sha256 | `new_basic256sha256_sign()` | `new_basic256sha256_sign_encrypt()` |
| Aes128-Sha256-RsaOaep | `new_aes128_sha256_rsaoaep_sign()` | `new_aes128_sha256_rsaoaep_sign_encrypt()` |
| Aes256-Sha256-RsPss | `new_aes256_sha256_rsapss_sign()` | `new_aes256_sha256_rsapss_sign_encrypt()` |

#### Generic Constructor
```rust
ServerEndpoint::new(path, SecurityPolicy, MessageSecurityMode, &[user_token_ids])
```

#### Current Usage in ModOne
The codebase already implements multi-policy support via `build_server_endpoint()` (server.rs:970) which iterates over `OpcUaConfig.security_policies` and registers each as a named endpoint. The `new_sample()` builder demonstrates 11 simultaneous endpoints as a reference.

#### Security Level Auto-Assignment
The crate assigns `security_level` values (0–15) automatically based on policy + mode combination, allowing clients to select the strongest available policy. Each endpoint also supports a separate `password_security_policy` for user token encryption.

**No changes needed for multi-policy support — already implemented and working.**

---

## 2. Custom Authenticator (Multiple Username/Password with Hash Verification)

### Verdict: SUPPORTED VIA EXISTING PATTERN (no custom trait needed)

#### How Authentication Works in opcua 0.12
The crate uses a **declarative model** rather than a callback-based authenticator:

1. **User tokens** are registered via `ServerBuilder::user_token(id, ServerUserToken)` where each `ServerUserToken` contains:
   ```rust
   pub struct ServerUserToken {
       pub user: String,
       pub pass: Option<String>,       // plaintext password for runtime comparison
       pub x509: Option<String>,       // X.509 certificate path
       pub thumbprint: Option<Thumbprint>,
   }
   ```

2. **Endpoints** reference user tokens by ID (`user_token_ids: BTreeSet<String>`)

3. **Multiple users** are supported by registering multiple `ServerUserToken` entries — the crate's `new_sample()` builder demonstrates this with `sample_password_user`, `sample_x509_user`, and `unused_user`.

#### Limitation: No Custom Authenticator Trait
The `callbacks.rs` module exposes traits for:
- `AttributeGetter` / `AttributeSetter` — node value access
- `RegisterNodes` / `UnregisterNodes` — node registration
- `Method` — method invocation

**There is NO `Authenticator` or `IdentityValidator` trait** that allows injecting custom authentication logic. The crate performs built-in password matching against the plaintext `pass` field internally.

#### Implication for Hash Verification
Since the crate requires the plaintext password in `ServerUserToken.pass`, bcrypt/hash verification **cannot be done inside the OPC UA authentication flow**. The current ModOne approach (already implemented) is correct:

1. At startup, resolve user accounts from the `UserAccountStore`
2. Verify bcrypt hashes via the `CredentialCache` layer
3. Pass verified plaintext credentials as `VerifiedCredential` into `OpcUaConfig.verified_credentials`
4. Register each as a `ServerUserToken` with the plaintext password

This pattern is already implemented in `server.rs:resolve_user_tokens()` and works for multiple users. The hash verification happens **before** the OPC UA server starts, not during session activation.

**No crate replacement needed — the pre-verification pattern is the correct approach for opcua 0.12.**

---

## 3. Session Detail Retrieval APIs

### Verdict: SUPPORTED (with pub(crate) access workarounds already in place)

#### Available Session Information

The `ServerMetrics` struct (metrics.rs) provides access to:

| Field | Source | Available |
|-------|--------|-----------|
| Client IP address | `Connection.client_address` | Yes — via `connection.client_address()` |
| Transport state | `Connection.transport_state` | Yes — New/WaitingHello/ProcessMessages/Finished |
| Session ID | `Session.session_id()` | Yes — NodeId-based string |
| Session activated | `Session.is_activated()` | Yes |
| Session terminated | `Session.is_terminated()` | Yes |
| Termination time | `Session.terminated_at()` | Yes |
| Subscription metrics | `Session.subscriptions().metrics()` | Yes — includes subscription count |
| Security policy per session | Not directly on Session | **Partial** — available at Connection level via `transport_state` |
| Connection time | Not directly exposed | **No** — must be derived from session creation |

#### How ModOne Currently Accesses This
The `collect_session_details()` method (server.rs:161) already uses the metrics API to build `OpcUaSessionInfo` structs:

```rust
// Iterates server_metrics.connections → sessions
for connection in &server_metrics.connections {
    for session in &connection.sessions {
        result.push(OpcUaSessionInfo {
            session_id: session.id.clone(),
            client_ip: connection.client_address.clone(),
            security_policy: connection.transport_state.clone(),
            subscription_count: session.subscriptions.subscriptions.len(),
            // ...
        });
    }
}
```

#### Gaps
1. **Security policy per session**: The `transport_state` field gives connection state (New/ProcessMessages/Finished), NOT the security policy. The security policy is determined at the secure channel level but is **not directly exposed** in the metrics structs. A workaround would require accessing `ServerState` → endpoint configuration matching.

2. **Connection timestamp**: Not natively tracked by the metrics. Would need to be captured externally when the connection is first observed.

3. **Message security mode**: Not available in session metrics. Same gap as security policy.

**The current polling-based session monitor pattern is the best available approach with opcua 0.12.**

---

## 4. Async Compatibility

### Verdict: COMPATIBLE WITH TAURI

The opcua 0.12 server uses **tokio** internally:
- `Server::run()` and `Server::run_server()` are async, using `TcpListener`, `TcpStream` from `tokio::net`
- Uses `tokio::sync::oneshot` for shutdown signaling
- Uses `tokio::time::interval_at` for periodic polling

The current ModOne integration spawns the server on `tauri::async_runtime::spawn` (which wraps tokio), and this pattern works correctly. No async compatibility issues.

---

## 5. Alternative Crate Evaluation

### 5.1 async-opcua v0.18.0

- **Repository**: https://github.com/freeopcua/async-opcua
- **License**: MPL-2.0 (same as current opcua crate)
- **Crate structure**: Modular — `async-opcua` (umbrella), `async-opcua-server`, `async-opcua-client`, `async-opcua-core`, `async-opcua-types`, `async-opcua-crypto`, `async-opcua-nodes`
- **Runtime**: Fully async/tokio-native with `tokio_util::sync::CancellationToken` for shutdown

#### Multi-Security-Policy Endpoints: ✅ FULLY SUPPORTED
Same pattern as opcua 0.12 — `ServerBuilder::add_endpoint()` with `ServerEndpoint` structs. The `new_sample()` builder demonstrates 11 simultaneous endpoints across all supported policies (None, Basic128Rsa15, Basic256, Basic256Sha256, Aes128Sha256RsaOaep, Aes256Sha256RsaPss × Sign/SignAndEncrypt).

#### Custom Authenticator: ✅ MAJOR IMPROVEMENT — `AuthManager` trait
This is the most significant advantage over opcua 0.12. async-opcua exposes a public `AuthManager` trait:

```rust
#[async_trait]
pub trait AuthManager: Send + Sync + 'static {
    async fn authenticate_username_identity_token(
        &self,
        endpoint: &ServerEndpoint,
        username: &str,
        password: &Password,
    ) -> Result<UserToken, Error>;

    async fn authenticate_anonymous_token(&self, endpoint: &ServerEndpoint) -> Result<(), Error>;
    async fn authenticate_x509_identity_token(&self, endpoint: &ServerEndpoint, signing_thumbprint: &Thumbprint) -> Result<UserToken, Error>;
    fn effective_user_access_level(&self, token: &UserToken, user_access_level: AccessLevel, node_id: &NodeId) -> AccessLevel;
    fn user_token_policies(&self, endpoint: &ServerEndpoint) -> Vec<UserTokenPolicy>;
    fn core_permissions(&self, token: &UserToken) -> CoreServerPermissions;
}
```

- **Async methods** for authentication — can call bcrypt/argon2 without blocking
- **Per-method override** — custom logic for each auth type (username, x509, issued token)
- **UserToken return** — custom user identity tracking across sessions
- **`DefaultAuthenticator`** provided for simple use cases (plaintext matching like opcua 0.12)
- **`ServerBuilder::with_authenticator(Arc<dyn AuthManager>)`** — plug in custom implementation

**Impact for ModOne**: Eliminates the "pre-verify plaintext pass-through" workaround. A custom `AuthManager` implementation could call `bcrypt::verify()` directly inside `authenticate_username_identity_token()`, keeping hash verification within the OPC UA authentication flow.

#### Session Detail Retrieval: ✅ MAJOR IMPROVEMENT — public `Session` fields
`ServerHandle::session_manager()` returns `&RwLock<SessionManager>` with `HashMap<NodeId, Arc<RwLock<Session>>>`. The `Session` struct has **public** getters:

| Field | Method | Visibility |
|-------|--------|-----------|
| Session ID | `session_id()` | **pub** |
| Session name | `session_name()` | **pub** |
| Security policy URI | `security_policy_uri()` | **pub** |
| Message security mode | `message_security_mode()` | **pub** |
| Endpoint URL | `endpoint_url()` | **pub** |
| Client certificate | `client_certificate()` | **pub** |
| Application description | `application_description()` | **pub** |
| User token | `user_token()` | **pub** |
| Is activated | `is_activated()` | **pub** |
| Secure channel ID | `secure_channel_id()` | **pub** |
| Session deadline | `deadline()` | **pub** |

**All four gaps in opcua 0.12 are resolved:**
1. ✅ Security policy per session — `session.security_policy_uri()` (pub)
2. ✅ Security mode per session — `session.message_security_mode()` (pub)
3. ✅ Client application name — `session.application_description()` (pub)
4. ⚠️ Connection timestamp — Not directly exposed as a timestamp, but `Session::create()` calls `Instant::now()` for `last_service_request`. Would need external tracking or a minor wrapper.

**Note**: Client IP address is NOT directly available on the `Session` object (same as opcua 0.12). The `SessionManager` does not store the TCP peer address. This would need to be captured at the transport layer.

#### Async Compatibility: ✅ NATIVE
Fully async/tokio-native. Uses `CancellationToken` instead of `Arc<AtomicBool>` for shutdown. Compatible with `tauri::async_runtime::spawn`.

#### Migration Risk: MODERATE
- Different API surface — `ServerBuilder` methods renamed (e.g., `endpoint()` → `add_endpoint()`)
- `AuthManager` trait replaces declarative user token model
- `ServerHandle` replaces `Server` metrics API
- Node manager system completely redesigned (`NodeManagerBuilder` trait)
- Modular crate structure requires feature flag changes in Cargo.toml

---

### 5.2 mabi-opcua v1.3.2

- **Repository**: https://github.com/seadonggyun4/mabinogion
- **License**: Apache-2.0
- **Purpose**: OPC UA server **simulator** — focused on simulation use cases
- **Rust version**: 1.75+

#### Multi-Security-Policy Endpoints: ✅ SUPPORTED
`SecurityPolicyProvider` manages available policies with enable/disable per-policy. `EndpointConfig` supports per-endpoint security policy and mode. All 6 standard policies supported (None, Basic128Rsa15, Basic256, Basic256Sha256, Aes128Sha256RsaOaep, Aes256Sha256RsaPss).

#### Custom Authenticator: ✅ SUPPORTED — `UserAuthenticator` struct
The `UserAuthenticator` provides runtime user management:
- `add_user(UserAccount)` / `remove_user()` — dynamic user management
- `UserAccount` stores **password hash + salt** natively (no plaintext storage!)
- `verify_password()` uses hash comparison
- Built-in account lockout, password expiry, and password policy validation
- Role-based access (`admin`, `user` roles)

**Limitation**: The hash function is a **custom, non-standard hash** (simple XOR-wrapping), NOT bcrypt/argon2. The crate explicitly notes "use proper bcrypt/argon2 in production." For production use, the hash function would need to be replaced.

**Limitation**: `UserAuthenticator` is a concrete struct, NOT a trait. Cannot inject completely custom auth logic without modifying the crate.

#### Session Detail Retrieval: ✅ COMPREHENSIVE
`SessionInfo` is a public struct with all fields public:

| Field | Available | Notes |
|-------|-----------|-------|
| `session_id` | ✅ | NodeId |
| `session_name` | ✅ | Client-provided |
| `client_description` | ✅ | String |
| `endpoint_url` | ✅ | String |
| `security_policy_uri` | ✅ | String |
| `security_mode` | ✅ | String |
| `user_identity` | ✅ | Enum (Anonymous/UserName/Certificate) |
| `created_at` | ✅ | `DateTime<Utc>` — **session creation timestamp** |
| `last_activity` | ✅ | `DateTime<Utc>` |
| `subscriptions` | ✅ | `Vec<u32>` — subscription IDs |
| `state` | ✅ | SessionState enum |
| `timeout_ms` | ✅ | Timeout setting |

**All session detail gaps are fully resolved**, including the connection timestamp which was missing from both opcua 0.12 and async-opcua.

#### Async Compatibility: ✅ NATIVE
Fully async/tokio-native. Server uses `tokio::spawn` for background tasks and TCP listener.

#### Maturity Risk: HIGH
- Primarily designed as a **simulator**, not a production OPC UA server
- Version 1.3.2 but relatively new crate with low download count
- Custom (non-standard) password hashing
- Less battle-tested than opcua/async-opcua
- No OPC UA Foundation certification

---

### 5.3 Capability Comparison Matrix

| Capability | opcua 0.12 (current) | async-opcua 0.18 | mabi-opcua 1.3.2 |
|---|---|---|---|
| **Multi-policy endpoints** | ✅ Native | ✅ Native | ✅ Native |
| **Custom auth trait** | ❌ No trait | ✅ `AuthManager` trait | ⚠️ Concrete struct only |
| **Multiple users** | ✅ Declarative | ✅ Declarative + custom | ✅ Runtime add/remove |
| **Hash verification in auth flow** | ❌ Pre-verify workaround | ✅ Custom async authenticator | ⚠️ Built-in but weak hash |
| **Session security policy** | ❌ pub(crate) | ✅ pub `security_policy_uri()` | ✅ pub `security_policy_uri` |
| **Session security mode** | ❌ Not in metrics | ✅ pub `message_security_mode()` | ✅ pub `security_mode` |
| **Session client name** | ❌ pub(crate) | ✅ pub `application_description()` | ✅ pub `client_description` |
| **Session connection time** | ❌ Not tracked | ⚠️ Internally via Instant | ✅ pub `created_at` (DateTime) |
| **Client IP per session** | ⚠️ Via metrics Connection | ⚠️ Not on Session object | ❌ Not directly available |
| **Subscription count** | ✅ Via metrics | ✅ Via SubscriptionCache | ✅ Via subscription IDs |
| **Async/tokio native** | ✅ | ✅ | ✅ |
| **Tauri compatibility** | ✅ Proven | ✅ Expected (same runtime) | ✅ Expected (same runtime) |
| **Maturity** | 🟢 Production | 🟡 Active development | 🔴 Simulator-grade |
| **License** | MPL-2.0 | MPL-2.0 | Apache-2.0 |
| **OPC UA spec version** | 1.04 | 1.04+ | 1.04 |
| **Migration effort** | N/A (current) | Moderate | High (different paradigm) |

---

## 6. Recommendation

### Primary Recommendation: Stay with opcua 0.12 for Phase 1

**No crate replacement is needed for Phase 1.** The `opcua` 0.12 crate supports all Phase 1 requirements either natively or via established workaround patterns that are already implemented:

| Requirement | Support | Approach |
|-------------|---------|----------|
| Multi-security-policy endpoints | Native | `ServerBuilder::endpoint()` — already implemented |
| Multiple username/password auth | Native | Multiple `ServerUserToken` entries — already implemented |
| Hash verification (bcrypt) | Workaround | Pre-verify at startup, pass plaintext to crate — already implemented |
| Session count | Native | `ServerDiagnostics.current_session_count` — already implemented |
| Client IP | Native | `Connection.client_address` via metrics — already implemented |
| Subscription count | Native | `Session.subscriptions().metrics()` — already implemented |
| Security policy per session | Gap | Available at endpoint config level, not per-session metrics |
| Connection timestamp | Gap | Must be tracked externally via session monitor |
| Async/Tauri compatibility | Native | tokio-based runtime, compatible with tauri::async_runtime |

### Future Consideration: async-opcua 0.18 for Phase 2+

**async-opcua is the strongest alternative** and should be evaluated for a future migration if:
1. The custom `AuthManager` trait becomes critical (e.g., need to integrate with external identity providers)
2. The session detail gaps in opcua 0.12 prove too limiting for production monitoring dashboards
3. The opcua 0.12 crate stops receiving updates (already appears low-activity)

**async-opcua advantages over opcua 0.12:**
- Public `AuthManager` trait for custom authentication (the biggest win)
- Public session getters for security policy, security mode, and client description
- Active development from the FreeOpcUa community
- Same license (MPL-2.0), same API philosophy (evolved from the same codebase)

**async-opcua migration would require:**
- Refactoring `OpcUaServer` builder to use new `ServerBuilder` API
- Implementing custom `AuthManager` trait instead of pre-verification pattern
- Replacing `ServerMetrics` polling with `SessionManager` direct access
- Updating `AddressSpace` builder to use `NodeManagerBuilder` pattern
- Updating Cargo.toml: `opcua` → `async-opcua` with `server` feature

### Not Recommended: mabi-opcua

mabi-opcua is **not recommended** for production use:
- Designed as a simulator, not a production server
- Non-standard password hashing (NOT bcrypt/argon2)
- No custom authenticator trait (concrete struct only)
- Less mature ecosystem and community support
- Would require more extensive migration than async-opcua

### Remaining Gaps in opcua 0.12 (minor, addressable without crate change)
1. **Security policy per session**: Can be inferred by correlating endpoint configuration with connection data, or tracked in the external session monitor when connections are first detected.
2. **Connection timestamp**: Can be captured in the `SessionMonitor` polling loop when a new session delta is detected (already partially done via audit events).

These gaps are cosmetic/UX issues, not blocking limitations. The external session monitor pattern already compensates for the crate's limited session lifecycle callbacks.
