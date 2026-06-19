//! OPC UA user account management with bcrypt password hashing.
//!
//! Provides the [`UserAccount`] data model, password hashing/verification
//! utilities, and persistent [`UserAccountStore`] for OPC UA server
//! authentication with multiple user accounts.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Default bcrypt cost factor. 12 is a good balance between security and performance.
const DEFAULT_BCRYPT_COST: u32 = 12;

/// Role assigned to an OPC UA user account.
///
/// Phase 1 supports a simple Admin/Operator/Viewer hierarchy.
/// Full RBAC with custom permissions is deferred to Phase 2.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserRole {
    /// Full access: read, write, configure
    Admin,
    /// Operational access: read and write tag values
    Operator,
    /// Read-only access to tag values
    Viewer,
}

impl UserRole {
    /// Whether this role permits write operations to tag values.
    pub fn can_write(&self) -> bool {
        matches!(self, UserRole::Admin | UserRole::Operator)
    }

    /// Whether this role permits server configuration changes.
    pub fn can_configure(&self) -> bool {
        matches!(self, UserRole::Admin)
    }
}

impl Default for UserRole {
    fn default() -> Self {
        UserRole::Operator
    }
}

impl std::fmt::Display for UserRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UserRole::Admin => write!(f, "Admin"),
            UserRole::Operator => write!(f, "Operator"),
            UserRole::Viewer => write!(f, "Viewer"),
        }
    }
}

/// An OPC UA user account with hashed password and role.
///
/// Passwords are never stored in plaintext. The `password_hash` field
/// contains a bcrypt hash string.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAccount {
    /// Unique username used for OPC UA authentication.
    pub username: String,
    /// Bcrypt-hashed password. Never store plaintext passwords.
    pub password_hash: String,
    /// Role determining access level for this user.
    pub role: UserRole,
    /// Whether this account is active and can authenticate.
    pub enabled: bool,
}

impl UserAccount {
    /// Create a new enabled user account with the given plaintext password.
    ///
    /// The password is immediately hashed with bcrypt and the plaintext is not retained.
    pub fn new(
        username: impl Into<String>,
        plaintext_password: &str,
        role: UserRole,
    ) -> Result<Self, AuthError> {
        let password_hash = hash_password(plaintext_password)?;
        Ok(Self {
            username: username.into(),
            password_hash,
            role,
            enabled: true,
        })
    }

    /// Verify a plaintext password against this account's stored hash.
    ///
    /// Returns `false` if the account is disabled, even if the password matches.
    pub fn verify_password(&self, plaintext_password: &str) -> Result<bool, AuthError> {
        if !self.enabled {
            return Ok(false);
        }
        verify_password(plaintext_password, &self.password_hash)
    }

    /// Update the password for this account, hashing the new plaintext password.
    pub fn set_password(&mut self, new_plaintext_password: &str) -> Result<(), AuthError> {
        self.password_hash = hash_password(new_plaintext_password)?;
        Ok(())
    }
}

/// Errors from authentication operations.
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Password hashing failed: {0}")]
    HashingFailed(String),
    #[error("Password verification failed: {0}")]
    VerificationFailed(String),
}

/// Hash a plaintext password using bcrypt with the default cost factor.
pub fn hash_password(plaintext: &str) -> Result<String, AuthError> {
    hash_password_with_cost(plaintext, DEFAULT_BCRYPT_COST)
}

/// Hash a plaintext password using bcrypt with a specified cost factor.
///
/// Lower cost values are faster but less secure. Use `hash_password` for production defaults.
pub fn hash_password_with_cost(plaintext: &str, cost: u32) -> Result<String, AuthError> {
    bcrypt::hash(plaintext, cost).map_err(|e| AuthError::HashingFailed(e.to_string()))
}

/// Verify a plaintext password against a bcrypt hash string.
pub fn verify_password(plaintext: &str, hash: &str) -> Result<bool, AuthError> {
    bcrypt::verify(plaintext, hash).map_err(|e| AuthError::VerificationFailed(e.to_string()))
}

// ============================================================================
// Runtime Credential Cache
// ============================================================================

/// In-memory cache of plaintext passwords for OPC UA server registration.
///
/// The opcua v0.12 crate requires plaintext passwords for its built-in
/// `ServerUserToken` comparison. This cache bridges the gap between the
/// persistent bcrypt-hashed [`UserAccountStore`] and the crate's requirement.
///
/// Plaintext passwords are deposited here during account CRUD operations and
/// are **never persisted to disk**. After an app restart, users must re-enter
/// credentials (or the server must be reconfigured) before those accounts can
/// authenticate OPC UA clients.
#[derive(Debug, Default)]
pub struct CredentialCache {
    /// username (lowercased) → plaintext password
    passwords: HashMap<String, String>,
}

impl CredentialCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Deposit a plaintext password for a username.
    pub fn set(&mut self, username: &str, plaintext: String) {
        self.passwords.insert(username.to_lowercase(), plaintext);
    }

    /// Retrieve the cached plaintext password for a username.
    pub fn get(&self, username: &str) -> Option<&str> {
        self.passwords
            .get(&username.to_lowercase())
            .map(|s| s.as_str())
    }

    /// Remove a cached credential.
    pub fn remove(&mut self, username: &str) {
        self.passwords.remove(&username.to_lowercase());
    }

    /// Clear all cached credentials.
    pub fn clear(&mut self) {
        self.passwords.clear();
    }

    /// Return the number of cached credentials.
    pub fn len(&self) -> usize {
        self.passwords.len()
    }

    /// Whether the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.passwords.is_empty()
    }
}

/// A resolved credential that has been verified against the account store's
/// bcrypt hash and is ready for registration with the OPC UA crate.
#[derive(Debug, Clone)]
pub struct VerifiedCredential {
    /// The username as stored in the account.
    pub username: String,
    /// The plaintext password (verified against bcrypt hash).
    pub plaintext_password: String,
    /// The role of this account.
    pub role: UserRole,
}

/// Resolve all enabled accounts that have cached credentials into verified
/// credentials ready for OPC UA server registration.
///
/// For each enabled account in the store:
/// 1. Look up the plaintext password in the credential cache
/// 2. Verify the plaintext against the stored bcrypt hash
/// 3. If verified, include it in the result
///
/// Accounts that fail verification or lack cached credentials are skipped
/// (logged as warnings by the caller).
///
/// If an `audit` logger is provided, authentication-related audit events are
/// emitted for each account processed (success, failure, disabled, cache miss).
pub fn resolve_verified_credentials(
    store: &UserAccountStore,
    cache: &CredentialCache,
) -> Vec<VerifiedCredential> {
    resolve_verified_credentials_audited(store, cache, None)
}

/// Same as [`resolve_verified_credentials`] but emits audit events to the
/// provided [`AuditLoggerState`] for each authentication-relevant outcome.
pub fn resolve_verified_credentials_audited(
    store: &UserAccountStore,
    cache: &CredentialCache,
    audit: Option<&super::audit::AuditLoggerState>,
) -> Vec<VerifiedCredential> {
    let all_accounts = store.all_accounts();
    let total_enabled = all_accounts.iter().filter(|a| a.enabled).count();
    let mut result = Vec::new();

    for account in all_accounts {
        if !account.enabled {
            log::debug!(
                "Skipping disabled account '{}' during credential resolution",
                account.username
            );
            if let Some(audit) = audit {
                audit.log_auth_disabled_account(&account.username);
            }
            continue;
        }

        let plaintext = match cache.get(&account.username) {
            Some(p) => p.to_owned(),
            None => {
                log::warn!(
                    "No cached credential for enabled account '{}'; \
                     it will not be registered with the OPC UA server. \
                     Re-enter the password via account management to enable it.",
                    account.username
                );
                if let Some(audit) = audit {
                    audit.log_credential_cache_miss(&account.username);
                }
                continue;
            }
        };

        match account.verify_password(&plaintext) {
            Ok(true) => {
                if let Some(audit) = audit {
                    audit.log_auth_success(&account.username);
                }
                result.push(VerifiedCredential {
                    username: account.username.clone(),
                    plaintext_password: plaintext,
                    role: account.role,
                });
            }
            Ok(false) => {
                log::warn!(
                    "Cached credential for '{}' failed bcrypt verification; \
                     it will not be registered with the OPC UA server.",
                    account.username
                );
                if let Some(audit) = audit {
                    audit.log_credential_verify_failed(&account.username);
                }
            }
            Err(e) => {
                log::error!(
                    "Bcrypt verification error for '{}': {}; \
                     it will not be registered with the OPC UA server.",
                    account.username,
                    e
                );
                if let Some(audit) = audit {
                    audit.log_auth_failure(&account.username, &e.to_string());
                }
            }
        }
    }

    // Emit summary event
    if let Some(audit) = audit {
        audit.log_credential_resolution(result.len(), total_enabled);
    }

    result
}

// ============================================================================
// Persistent User Account Store
// ============================================================================

const ACCOUNTS_FILE: &str = "opcua_accounts.json";

/// Persistent storage wrapper for user account data on disk.
///
/// Accounts are serialized as a JSON array in
/// `<app_data_dir>/opcua_accounts.json`. The file is created automatically
/// on first write. All mutations are flushed immediately.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct AccountsFile {
    /// Schema version for future migration support.
    version: u32,
    /// All registered user accounts keyed by username (lowercased).
    accounts: Vec<UserAccount>,
}

impl Default for AccountsFile {
    fn default() -> Self {
        Self {
            version: 1,
            accounts: Vec::new(),
        }
    }
}

/// A frontend-safe view of a user account (no password hash exposed).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAccountInfo {
    pub username: String,
    pub role: UserRole,
    pub enabled: bool,
}

impl From<&UserAccount> for UserAccountInfo {
    fn from(account: &UserAccount) -> Self {
        Self {
            username: account.username.clone(),
            role: account.role,
            enabled: account.enabled,
        }
    }
}

/// Thread-safe persistent store for OPC UA user accounts.
///
/// Backed by a JSON file in the app data directory. All mutations are
/// immediately flushed to disk.
pub struct UserAccountStore {
    file_path: PathBuf,
    accounts: HashMap<String, UserAccount>,
}

impl UserAccountStore {
    /// Create or load a store from the given app data directory.
    ///
    /// If the accounts file exists it is loaded; otherwise an empty store is
    /// created. The file itself is not written until the first mutation.
    pub fn load(app_data_dir: &Path) -> Result<Self, AuthError> {
        let file_path = app_data_dir.join(ACCOUNTS_FILE);
        let accounts = if file_path.exists() {
            let file = File::open(&file_path)
                .map_err(|e| AuthError::HashingFailed(format!("Failed to open accounts file: {e}")))?;
            let reader = BufReader::new(file);
            let data: AccountsFile = serde_json::from_reader(reader)
                .map_err(|e| AuthError::HashingFailed(format!("Failed to parse accounts file: {e}")))?;
            data.accounts
                .into_iter()
                .map(|a| (a.username.to_lowercase(), a))
                .collect()
        } else {
            HashMap::new()
        };

        Ok(Self {
            file_path,
            accounts,
        })
    }

    /// Persist current accounts to disk.
    fn flush(&self) -> Result<(), AuthError> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| AuthError::HashingFailed(format!("Failed to create accounts dir: {e}")))?;
        }

        let data = AccountsFile {
            version: 1,
            accounts: self.accounts.values().cloned().collect(),
        };
        let file = File::create(&self.file_path)
            .map_err(|e| AuthError::HashingFailed(format!("Failed to create accounts file: {e}")))?;
        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, &data)
            .map_err(|e| AuthError::HashingFailed(format!("Failed to write accounts file: {e}")))?;

        Ok(())
    }

    /// List all accounts (without password hashes).
    pub fn list(&self) -> Vec<UserAccountInfo> {
        let mut infos: Vec<UserAccountInfo> = self.accounts.values().map(UserAccountInfo::from).collect();
        infos.sort_by(|a, b| a.username.cmp(&b.username));
        infos
    }

    /// Get a full account by username (case-insensitive).
    pub fn get(&self, username: &str) -> Option<&UserAccount> {
        self.accounts.get(&username.to_lowercase())
    }

    /// Add a new user account. Returns error if username already exists or is empty.
    pub fn add(
        &mut self,
        username: &str,
        plaintext_password: &str,
        role: UserRole,
    ) -> Result<UserAccountInfo, AuthError> {
        let trimmed = username.trim();
        if trimmed.is_empty() {
            return Err(AuthError::HashingFailed("Username cannot be empty".into()));
        }
        if plaintext_password.is_empty() {
            return Err(AuthError::HashingFailed("Password cannot be empty".into()));
        }
        let key = trimmed.to_lowercase();
        if self.accounts.contains_key(&key) {
            return Err(AuthError::HashingFailed(format!(
                "Account '{}' already exists",
                trimmed
            )));
        }

        let account = UserAccount::new(trimmed, plaintext_password, role)?;
        let info = UserAccountInfo::from(&account);
        self.accounts.insert(key, account);
        self.flush()?;
        Ok(info)
    }

    /// Remove an account by username. Returns error if not found.
    pub fn remove(&mut self, username: &str) -> Result<(), AuthError> {
        let key = username.trim().to_lowercase();
        if self.accounts.remove(&key).is_none() {
            return Err(AuthError::HashingFailed(format!(
                "Account '{}' not found",
                username.trim()
            )));
        }
        self.flush()
    }

    /// Update an existing account's role, enabled status, and optionally password.
    ///
    /// If `new_password` is `Some`, the password is re-hashed.
    /// If `new_password` is `None`, the existing password hash is preserved.
    pub fn update(
        &mut self,
        username: &str,
        role: Option<UserRole>,
        enabled: Option<bool>,
        new_password: Option<&str>,
    ) -> Result<UserAccountInfo, AuthError> {
        let key = username.trim().to_lowercase();
        let account = self.accounts.get_mut(&key).ok_or_else(|| {
            AuthError::HashingFailed(format!("Account '{}' not found", username.trim()))
        })?;

        if let Some(r) = role {
            account.role = r;
        }
        if let Some(e) = enabled {
            account.enabled = e;
        }
        if let Some(pwd) = new_password {
            if pwd.is_empty() {
                return Err(AuthError::HashingFailed("Password cannot be empty".into()));
            }
            account.set_password(pwd)?;
        }

        let info = UserAccountInfo::from(account as &UserAccount);
        self.flush()?;
        Ok(info)
    }

    /// Return all full `UserAccount` entries (for server authenticator use).
    pub fn all_accounts(&self) -> Vec<UserAccount> {
        self.accounts.values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Use cost 4 (minimum) in tests for speed.
    const TEST_COST: u32 = 4;

    fn test_hash(password: &str) -> String {
        hash_password_with_cost(password, TEST_COST).unwrap()
    }

    #[test]
    fn hash_and_verify_correct_password() {
        let hash = test_hash("my_secure_pass");
        assert!(verify_password("my_secure_pass", &hash).unwrap());
    }

    #[test]
    fn verify_rejects_wrong_password() {
        let hash = test_hash("correct_password");
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn hash_is_not_plaintext() {
        let hash = test_hash("plaintext_password");
        assert_ne!(hash, "plaintext_password");
        assert!(hash.starts_with("$2b$") || hash.starts_with("$2a$"));
    }

    #[test]
    fn different_hashes_for_same_password() {
        let hash1 = test_hash("same_pass");
        let hash2 = test_hash("same_pass");
        // bcrypt uses random salt, so hashes should differ
        assert_ne!(hash1, hash2);
        // But both should verify
        assert!(verify_password("same_pass", &hash1).unwrap());
        assert!(verify_password("same_pass", &hash2).unwrap());
    }

    #[test]
    fn user_account_creation_and_verification() {
        // Use low cost for test speed
        let hash = hash_password_with_cost("test_pass", TEST_COST).unwrap();
        let account = UserAccount {
            username: "operator1".to_string(),
            password_hash: hash,
            role: UserRole::Operator,
            enabled: true,
        };

        assert!(account.verify_password("test_pass").unwrap());
        assert!(!account.verify_password("bad_pass").unwrap());
    }

    #[test]
    fn disabled_account_rejects_correct_password() {
        let hash = hash_password_with_cost("valid_pass", TEST_COST).unwrap();
        let account = UserAccount {
            username: "disabled_user".to_string(),
            password_hash: hash,
            role: UserRole::Viewer,
            enabled: false,
        };

        assert!(!account.verify_password("valid_pass").unwrap());
    }

    #[test]
    fn set_password_changes_hash() {
        let hash = hash_password_with_cost("old_pass", TEST_COST).unwrap();
        let mut account = UserAccount {
            username: "changeme".to_string(),
            password_hash: hash,
            role: UserRole::Admin,
            enabled: true,
        };

        let old_hash = account.password_hash.clone();
        account.set_password("new_pass").unwrap();
        assert_ne!(account.password_hash, old_hash);
        assert!(account.verify_password("new_pass").unwrap());
        assert!(!account.verify_password("old_pass").unwrap());
    }

    #[test]
    fn user_role_permissions() {
        assert!(UserRole::Admin.can_write());
        assert!(UserRole::Admin.can_configure());

        assert!(UserRole::Operator.can_write());
        assert!(!UserRole::Operator.can_configure());

        assert!(!UserRole::Viewer.can_write());
        assert!(!UserRole::Viewer.can_configure());
    }

    #[test]
    fn user_role_default_is_operator() {
        assert_eq!(UserRole::default(), UserRole::Operator);
    }

    #[test]
    fn user_account_serialization_roundtrip() {
        let hash = hash_password_with_cost("serialize_test", TEST_COST).unwrap();
        let account = UserAccount {
            username: "serde_user".to_string(),
            password_hash: hash.clone(),
            role: UserRole::Admin,
            enabled: true,
        };

        let json = serde_json::to_string(&account).unwrap();
        let deserialized: UserAccount = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.username, "serde_user");
        assert_eq!(deserialized.password_hash, hash);
        assert_eq!(deserialized.role, UserRole::Admin);
        assert!(deserialized.enabled);
    }

    #[test]
    fn verify_rejects_invalid_hash_format() {
        let result = verify_password("anything", "not_a_valid_hash");
        assert!(result.is_err());
    }

    #[test]
    fn empty_password_can_be_hashed_and_verified() {
        let hash = test_hash("");
        assert!(verify_password("", &hash).unwrap());
        assert!(!verify_password("notempty", &hash).unwrap());
    }

    #[test]
    fn user_role_display() {
        assert_eq!(UserRole::Admin.to_string(), "Admin");
        assert_eq!(UserRole::Operator.to_string(), "Operator");
        assert_eq!(UserRole::Viewer.to_string(), "Viewer");
    }

    // ========================================================================
    // UserAccountStore persistence tests
    // ========================================================================

    fn temp_store() -> (tempfile::TempDir, UserAccountStore) {
        let dir = tempfile::tempdir().unwrap();
        let store = UserAccountStore::load(dir.path()).unwrap();
        (dir, store)
    }

    #[test]
    fn store_add_and_list() {
        let (_dir, mut store) = temp_store();
        assert!(store.list().is_empty());

        let info = store.add("alice", "pass1234", UserRole::Admin).unwrap();
        assert_eq!(info.username, "alice");
        assert_eq!(info.role, UserRole::Admin);
        assert!(info.enabled);

        let list = store.list();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].username, "alice");
    }

    #[test]
    fn store_duplicate_username_rejected() {
        let (_dir, mut store) = temp_store();
        store.add("bob", "pass1234", UserRole::Operator).unwrap();
        let result = store.add("bob", "other_pass", UserRole::Viewer);
        assert!(result.is_err());
    }

    #[test]
    fn store_case_insensitive_username() {
        let (_dir, mut store) = temp_store();
        store.add("Alice", "pass1234", UserRole::Admin).unwrap();
        // Same username, different case — should fail
        let result = store.add("alice", "pass1234", UserRole::Viewer);
        assert!(result.is_err());
    }

    #[test]
    fn store_remove() {
        let (_dir, mut store) = temp_store();
        store.add("charlie", "pass1234", UserRole::Viewer).unwrap();
        assert_eq!(store.list().len(), 1);

        store.remove("charlie").unwrap();
        assert!(store.list().is_empty());
    }

    #[test]
    fn store_remove_nonexistent_fails() {
        let (_dir, mut store) = temp_store();
        let result = store.remove("nobody");
        assert!(result.is_err());
    }

    #[test]
    fn store_update_role() {
        let (_dir, mut store) = temp_store();
        store.add("dave", "pass1234", UserRole::Viewer).unwrap();

        let info = store
            .update("dave", Some(UserRole::Admin), None, None)
            .unwrap();
        assert_eq!(info.role, UserRole::Admin);
    }

    #[test]
    fn store_update_enabled() {
        let (_dir, mut store) = temp_store();
        store.add("eve", "pass1234", UserRole::Operator).unwrap();

        let info = store.update("eve", None, Some(false), None).unwrap();
        assert!(!info.enabled);
    }

    #[test]
    fn store_update_password() {
        let (_dir, mut store) = temp_store();
        store.add("frank", "old_pass1", UserRole::Operator).unwrap();

        store
            .update("frank", None, None, Some("new_pass1"))
            .unwrap();

        let account = store.get("frank").unwrap();
        assert!(account.verify_password("new_pass1").unwrap());
        assert!(!account.verify_password("old_pass1").unwrap());
    }

    #[test]
    fn store_update_nonexistent_fails() {
        let (_dir, mut store) = temp_store();
        let result = store.update("nobody", Some(UserRole::Admin), None, None);
        assert!(result.is_err());
    }

    #[test]
    fn store_persistence_roundtrip() {
        let dir = tempfile::tempdir().unwrap();

        // Create store, add accounts, drop it
        {
            let mut store = UserAccountStore::load(dir.path()).unwrap();
            store.add("user1", "pass1234", UserRole::Admin).unwrap();
            store
                .add("user2", "pass5678", UserRole::Viewer)
                .unwrap();
        }

        // Re-load from same directory
        {
            let store = UserAccountStore::load(dir.path()).unwrap();
            let list = store.list();
            assert_eq!(list.len(), 2);

            let usernames: Vec<&str> = list.iter().map(|i| i.username.as_str()).collect();
            assert!(usernames.contains(&"user1"));
            assert!(usernames.contains(&"user2"));

            // Verify password still works after reload
            let account = store.get("user1").unwrap();
            assert!(account.verify_password("pass1234").unwrap());
        }
    }

    #[test]
    fn store_empty_username_rejected() {
        let (_dir, mut store) = temp_store();
        let result = store.add("", "pass1234", UserRole::Operator);
        assert!(result.is_err());
    }

    #[test]
    fn store_empty_password_rejected() {
        let (_dir, mut store) = temp_store();
        let result = store.add("user", "", UserRole::Operator);
        assert!(result.is_err());
    }

    #[test]
    fn store_all_accounts_returns_full_data() {
        let (_dir, mut store) = temp_store();
        store.add("admin1", "pass1234", UserRole::Admin).unwrap();
        store
            .add("viewer1", "pass5678", UserRole::Viewer)
            .unwrap();

        let accounts = store.all_accounts();
        assert_eq!(accounts.len(), 2);
        // Full accounts include password_hash
        for account in &accounts {
            assert!(!account.password_hash.is_empty());
        }
    }

    // ========================================================================
    // CredentialCache tests
    // ========================================================================

    #[test]
    fn credential_cache_set_and_get() {
        let mut cache = CredentialCache::new();
        assert!(cache.is_empty());

        cache.set("Alice", "secret123".to_string());
        assert_eq!(cache.len(), 1);
        assert_eq!(cache.get("alice"), Some("secret123"));
        assert_eq!(cache.get("Alice"), Some("secret123"));
        assert_eq!(cache.get("ALICE"), Some("secret123"));
    }

    #[test]
    fn credential_cache_overwrite() {
        let mut cache = CredentialCache::new();
        cache.set("bob", "old_pass".to_string());
        cache.set("bob", "new_pass".to_string());
        assert_eq!(cache.get("bob"), Some("new_pass"));
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn credential_cache_remove() {
        let mut cache = CredentialCache::new();
        cache.set("charlie", "pass".to_string());
        assert_eq!(cache.len(), 1);

        cache.remove("Charlie");
        assert!(cache.is_empty());
        assert_eq!(cache.get("charlie"), None);
    }

    #[test]
    fn credential_cache_clear() {
        let mut cache = CredentialCache::new();
        cache.set("a", "1".to_string());
        cache.set("b", "2".to_string());
        assert_eq!(cache.len(), 2);

        cache.clear();
        assert!(cache.is_empty());
    }

    #[test]
    fn credential_cache_missing_returns_none() {
        let cache = CredentialCache::new();
        assert_eq!(cache.get("nonexistent"), None);
    }

    // ========================================================================
    // resolve_verified_credentials tests
    // ========================================================================

    #[test]
    fn resolve_verified_credentials_happy_path() {
        let (_dir, mut store) = temp_store();
        store.add("operator1", "pass1234", UserRole::Operator).unwrap();
        store.add("admin1", "admin_pw", UserRole::Admin).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("operator1", "pass1234".to_string());
        cache.set("admin1", "admin_pw".to_string());

        let creds = resolve_verified_credentials(&store, &cache);
        assert_eq!(creds.len(), 2);

        let usernames: Vec<&str> = creds.iter().map(|c| c.username.as_str()).collect();
        assert!(usernames.contains(&"operator1"));
        assert!(usernames.contains(&"admin1"));
    }

    #[test]
    fn resolve_verified_credentials_skips_disabled_accounts() {
        let (_dir, mut store) = temp_store();
        store.add("user1", "pass1234", UserRole::Operator).unwrap();
        store.update("user1", None, Some(false), None).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("user1", "pass1234".to_string());

        let creds = resolve_verified_credentials(&store, &cache);
        assert!(creds.is_empty());
    }

    #[test]
    fn resolve_verified_credentials_skips_missing_cache() {
        let (_dir, mut store) = temp_store();
        store.add("user1", "pass1234", UserRole::Operator).unwrap();

        let cache = CredentialCache::new(); // empty cache

        let creds = resolve_verified_credentials(&store, &cache);
        assert!(creds.is_empty());
    }

    #[test]
    fn resolve_verified_credentials_skips_wrong_password() {
        let (_dir, mut store) = temp_store();
        store.add("user1", "correct_pw", UserRole::Operator).unwrap();

        let mut cache = CredentialCache::new();
        cache.set("user1", "wrong_password".to_string());

        let creds = resolve_verified_credentials(&store, &cache);
        assert!(creds.is_empty());
    }

    #[test]
    fn resolve_verified_credentials_partial_cache() {
        let (_dir, mut store) = temp_store();
        store.add("user1", "pass1111", UserRole::Operator).unwrap();
        store.add("user2", "pass2222", UserRole::Viewer).unwrap();

        let mut cache = CredentialCache::new();
        // Only cache user1, not user2
        cache.set("user1", "pass1111".to_string());

        let creds = resolve_verified_credentials(&store, &cache);
        assert_eq!(creds.len(), 1);
        assert_eq!(creds[0].username, "user1");
        assert_eq!(creds[0].role, UserRole::Operator);
    }
}
