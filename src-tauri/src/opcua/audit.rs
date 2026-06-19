//! OPC UA Audit Log — SQLite-backed event logging
//!
//! Records server lifecycle, authentication, configuration changes,
//! and security-related events to a local SQLite database with
//! automatic retention policy enforcement.

use std::path::Path;
use std::sync::Arc;

use chrono::{Duration, Utc};
use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

// ============================================================================
// Types
// ============================================================================

/// Categories of auditable OPC UA events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventCategory {
    /// Server started / stopped
    ServerLifecycle,
    /// Client session created / closed / rejected
    Session,
    /// Authentication success / failure
    Authentication,
    /// Configuration changes (policies, accounts, settings)
    Configuration,
    /// Security-related events (certificate, policy violations)
    Security,
}

/// Specific event types for structured audit logging.
///
/// These provide fine-grained classification of audit events beyond the
/// broader `AuditEventCategory`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    /// OPC UA server started
    ServerStart,
    /// OPC UA server stopped
    ServerStop,
    /// Client connected to the server
    ClientConnect,
    /// Client disconnected from the server
    ClientDisconnect,
    /// Authentication succeeded
    AuthSuccess,
    /// Authentication failed
    AuthFailure,
    /// Configuration change event
    ConfigChange,
    /// Security-related event (certificate, policy, etc.)
    SecurityEvent,
    /// Generic / uncategorized event
    Other,
}

impl AuditEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ServerStart => "server_start",
            Self::ServerStop => "server_stop",
            Self::ClientConnect => "client_connect",
            Self::ClientDisconnect => "client_disconnect",
            Self::AuthSuccess => "auth_success",
            Self::AuthFailure => "auth_failure",
            Self::ConfigChange => "config_change",
            Self::SecurityEvent => "security_event",
            Self::Other => "other",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "server_start" => Some(Self::ServerStart),
            "server_stop" => Some(Self::ServerStop),
            "client_connect" => Some(Self::ClientConnect),
            "client_disconnect" => Some(Self::ClientDisconnect),
            "auth_success" => Some(Self::AuthSuccess),
            "auth_failure" => Some(Self::AuthFailure),
            "config_change" => Some(Self::ConfigChange),
            "security_event" => Some(Self::SecurityEvent),
            "other" => Some(Self::Other),
            _ => None,
        }
    }

    /// Infer the parent category from this event type.
    pub fn category(&self) -> AuditEventCategory {
        match self {
            Self::ServerStart | Self::ServerStop => AuditEventCategory::ServerLifecycle,
            Self::ClientConnect | Self::ClientDisconnect => AuditEventCategory::Session,
            Self::AuthSuccess | Self::AuthFailure => AuditEventCategory::Authentication,
            Self::ConfigChange => AuditEventCategory::Configuration,
            Self::SecurityEvent => AuditEventCategory::Security,
            Self::Other => AuditEventCategory::ServerLifecycle,
        }
    }
}

impl AuditEventCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ServerLifecycle => "server_lifecycle",
            Self::Session => "session",
            Self::Authentication => "authentication",
            Self::Configuration => "configuration",
            Self::Security => "security",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "server_lifecycle" => Some(Self::ServerLifecycle),
            "session" => Some(Self::Session),
            "authentication" => Some(Self::Authentication),
            "configuration" => Some(Self::Configuration),
            "security" => Some(Self::Security),
            _ => None,
        }
    }
}

/// Severity level for audit events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuditSeverity {
    Info,
    Warning,
    Error,
}

impl AuditSeverity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "info" => Some(Self::Info),
            "warning" => Some(Self::Warning),
            "error" => Some(Self::Error),
            _ => None,
        }
    }
}

/// Client identity information attached to an audit event.
///
/// Captures the OPC UA client's network and identity context at the time
/// of the event. Stored as a JSON blob in the `client_info` column.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditClientInfo {
    /// Client IP address (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    /// OPC UA session ID (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Authenticated username (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    /// OPC UA application URI of the client
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application_uri: Option<String>,
}

impl AuditClientInfo {
    /// Returns true if all fields are None (no client info available).
    pub fn is_empty(&self) -> bool {
        self.ip_address.is_none()
            && self.session_id.is_none()
            && self.username.is_none()
            && self.application_uri.is_none()
    }

    /// Serialize to JSON string for database storage. Returns `None` if empty.
    pub fn to_json(&self) -> Option<String> {
        if self.is_empty() {
            None
        } else {
            serde_json::to_string(self).ok()
        }
    }

    /// Deserialize from JSON string. Returns default if `None` or parsing fails.
    pub fn from_json(json: Option<&str>) -> Self {
        json.and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default()
    }
}

/// A single audit log entry stored in and retrieved from SQLite.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    /// Auto-increment row id.
    pub id: i64,
    /// ISO-8601 timestamp.
    pub timestamp: String,
    /// Event category.
    pub category: AuditEventCategory,
    /// Specific event type (e.g. ServerStart, AuthFailure).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_type: Option<AuditEventType>,
    /// Severity level.
    pub severity: AuditSeverity,
    /// Short human-readable event description.
    pub message: String,
    /// Optional additional detail / details JSON (username, endpoint, etc.).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// Source that generated the event (e.g. "server", "auth", "config").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Optional client identity information (IP, session, username).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_info: Option<AuditClientInfo>,
}

/// Query parameters for filtering audit log entries.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogQuery {
    /// Filter by category.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<AuditEventCategory>,
    /// Filter by specific event type.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_type: Option<AuditEventType>,
    /// Filter by minimum severity.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<AuditSeverity>,
    /// Filter entries after this ISO-8601 timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<String>,
    /// Filter entries before this ISO-8601 timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    /// Free-text search in message, detail, and client_info fields.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    /// Maximum number of entries to return (default 200).
    #[serde(default = "default_limit")]
    pub limit: u32,
    /// Offset for pagination (default 0).
    #[serde(default)]
    pub offset: u32,
}

fn default_limit() -> u32 {
    200
}

/// Summary statistics returned alongside query results.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogResult {
    /// Matching entries (paginated).
    pub entries: Vec<AuditLogEntry>,
    /// Total number of matching entries (before pagination).
    pub total_count: u32,
}

// ============================================================================
// Schema Migration
// ============================================================================

/// Current schema version.
const SCHEMA_VERSION: u32 = 3;

/// Apply database migrations up to SCHEMA_VERSION.
///
/// Migration history:
/// - v1: Initial table with id, timestamp, category, severity, message, detail, source
/// - v2: Added client_info TEXT column for client identity JSON
/// - v3: Added event_type TEXT column for fine-grained event classification
///       (ServerStart, ServerStop, ClientConnect, ClientDisconnect, AuthSuccess, AuthFailure, etc.)
fn run_migrations(conn: &Connection) -> Result<(), String> {
    // Ensure version tracking table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS audit_schema_version (
            version INTEGER NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to create schema version table: {e}"))?;

    let current_version: u32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM audit_schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < 1 {
        log::info!("Audit log: applying migration v1 (initial schema)");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS audit_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT NOT NULL,
                category    TEXT NOT NULL,
                severity    TEXT NOT NULL,
                message     TEXT NOT NULL,
                detail      TEXT,
                source      TEXT,
                client_info TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_category  ON audit_log(category);
            CREATE INDEX IF NOT EXISTS idx_audit_severity  ON audit_log(severity);",
        )
        .map_err(|e| format!("Failed to create audit log table: {e}"))?;

        conn.execute(
            "INSERT INTO audit_schema_version (version) VALUES (?1)",
            params![1],
        )
        .map_err(|e| format!("Failed to record schema version: {e}"))?;
    }

    if current_version < 2 {
        log::info!("Audit log: applying migration v2 (add client_info column)");
        // Add client_info column if it doesn't exist (safe for v1 tables that
        // already have it from fresh creation, and for pre-migration tables).
        let has_client_info = conn
            .prepare("SELECT client_info FROM audit_log LIMIT 0")
            .is_ok();
        if !has_client_info {
            conn.execute_batch("ALTER TABLE audit_log ADD COLUMN client_info TEXT;")
                .map_err(|e| format!("Failed to add client_info column: {e}"))?;
        }

        // Upsert schema version
        conn.execute("DELETE FROM audit_schema_version", [])
            .map_err(|e| format!("Failed to clear schema version: {e}"))?;
        conn.execute(
            "INSERT INTO audit_schema_version (version) VALUES (?1)",
            params![2u32],
        )
        .map_err(|e| format!("Failed to update schema version: {e}"))?;
    }

    if current_version < 3 {
        log::info!("Audit log: applying migration v3 (add event_type column)");
        // Add event_type column for fine-grained event classification
        let has_event_type = conn
            .prepare("SELECT event_type FROM audit_log LIMIT 0")
            .is_ok();
        if !has_event_type {
            conn.execute_batch("ALTER TABLE audit_log ADD COLUMN event_type TEXT;")
                .map_err(|e| format!("Failed to add event_type column: {e}"))?;
        }
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);",
        )
        .map_err(|e| format!("Failed to create event_type index: {e}"))?;

        // Upsert schema version
        conn.execute("DELETE FROM audit_schema_version", [])
            .map_err(|e| format!("Failed to clear schema version: {e}"))?;
        conn.execute(
            "INSERT INTO audit_schema_version (version) VALUES (?1)",
            params![SCHEMA_VERSION],
        )
        .map_err(|e| format!("Failed to update schema version: {e}"))?;
    }

    if current_version < SCHEMA_VERSION {
        log::info!(
            "Audit log: schema migrated from v{} to v{}",
            current_version,
            SCHEMA_VERSION
        );
    }

    Ok(())
}

// ============================================================================
// AuditLogger
// ============================================================================

/// Manages a SQLite database for audit log persistence.
///
/// The database file is stored at `<app_data_dir>/opcua/audit_log.db`.
/// Retention is enforced by age (default 30 days) and max rows (default 50 000).
pub struct AuditLogger {
    conn: Connection,
    /// Maximum age of entries to keep.
    retention_days: i64,
    /// Maximum number of rows to keep.
    max_rows: i64,
}

impl AuditLogger {
    /// Open (or create) the audit log database at the given directory.
    ///
    /// Schema migrations are applied automatically on open.
    pub fn open(data_dir: &Path) -> Result<Self, String> {
        let db_dir = data_dir.join("opcua");
        std::fs::create_dir_all(&db_dir)
            .map_err(|e| format!("Failed to create audit log directory: {e}"))?;
        let db_path = db_dir.join("audit_log.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open audit log database: {e}"))?;

        // Enable WAL mode for better concurrent read performance.
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;")
            .map_err(|e| format!("Failed to set journal mode: {e}"))?;

        run_migrations(&conn)?;

        log::info!("Audit log database opened at {:?}", db_path);

        Ok(Self {
            conn,
            retention_days: 90,
            max_rows: 50_000,
        })
    }

    /// Open an in-memory database (for testing).
    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory()
            .map_err(|e| format!("Failed to open in-memory database: {e}"))?;
        run_migrations(&conn)?;
        Ok(Self {
            conn,
            retention_days: 90,
            max_rows: 50_000,
        })
    }

    /// Get current retention days setting.
    pub fn retention_days(&self) -> i64 {
        self.retention_days
    }

    /// Set retention days. Minimum 1 day.
    pub fn set_retention_days(&mut self, days: i64) {
        self.retention_days = days.max(1);
    }

    /// Get current max rows setting.
    pub fn max_rows(&self) -> i64 {
        self.max_rows
    }

    /// Set max rows. Minimum 100.
    pub fn set_max_rows(&mut self, rows: i64) {
        self.max_rows = rows.max(100);
    }

    /// Record an audit event into SQLite. This is the primary public API for
    /// inserting events. Returns the auto-generated row ID.
    ///
    /// # Arguments
    /// * `event_type` - The specific event type (e.g. ServerStart, AuthFailure)
    /// * `severity` - Severity level (Info, Warning, Error)
    /// * `message` - Short human-readable event description
    /// * `detail` - Optional additional detail string
    /// * `source` - Optional source identifier (e.g. "server", "auth")
    /// * `client_info` - Optional client identity information
    pub fn record(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        self.log_full(
            event_type.category(),
            Some(event_type),
            severity,
            message,
            detail,
            source,
            client_info,
        )
    }

    /// Record a new audit event. Returns the auto-generated row ID.
    pub fn log(
        &self,
        category: AuditEventCategory,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
    ) -> Result<i64, String> {
        self.log_full(category, None, severity, message, detail, source, None)
    }

    /// Record an audit event with a specific event type. Returns the auto-generated row ID.
    pub fn log_event(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        self.log_full(
            event_type.category(),
            Some(event_type),
            severity,
            message,
            detail,
            source,
            client_info,
        )
    }

    /// Record a new audit event with optional client identity information.
    /// Returns the auto-generated row ID.
    pub fn log_with_client_info(
        &self,
        category: AuditEventCategory,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        self.log_full(category, None, severity, message, detail, source, client_info)
    }

    /// Record a new audit event with all fields. Returns the auto-generated row ID.
    pub fn log_full(
        &self,
        category: AuditEventCategory,
        event_type: Option<AuditEventType>,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        let ts = Utc::now().to_rfc3339();
        let client_info_json = client_info.and_then(|ci| ci.to_json());
        let event_type_str = event_type.map(|et| et.as_str().to_string());

        self.conn
            .execute(
                "INSERT INTO audit_log (timestamp, category, event_type, severity, message, detail, source, client_info)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    ts,
                    category.as_str(),
                    event_type_str,
                    severity.as_str(),
                    message,
                    detail,
                    source,
                    client_info_json,
                ],
            )
            .map_err(|e| format!("Failed to insert audit log entry: {e}"))?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Query audit log entries with optional filters.
    pub fn query(&self, q: &AuditLogQuery) -> Result<AuditLogResult, String> {
        let mut where_clauses: Vec<String> = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref cat) = q.category {
            where_clauses.push(format!("category = ?{}", param_values.len() + 1));
            param_values.push(Box::new(cat.as_str().to_string()));
        }
        if let Some(ref et) = q.event_type {
            where_clauses.push(format!("event_type = ?{}", param_values.len() + 1));
            param_values.push(Box::new(et.as_str().to_string()));
        }
        if let Some(ref sev) = q.severity {
            // Severity filter: return entries at or above the given level
            let severities = match sev {
                AuditSeverity::Info => vec!["info", "warning", "error"],
                AuditSeverity::Warning => vec!["warning", "error"],
                AuditSeverity::Error => vec!["error"],
            };
            let placeholders: Vec<String> = severities
                .iter()
                .enumerate()
                .map(|(i, _)| format!("?{}", param_values.len() + i + 1))
                .collect();
            where_clauses.push(format!("severity IN ({})", placeholders.join(",")));
            for s in severities {
                param_values.push(Box::new(s.to_string()));
            }
        }
        if let Some(ref from) = q.from {
            where_clauses.push(format!("timestamp >= ?{}", param_values.len() + 1));
            param_values.push(Box::new(from.clone()));
        }
        if let Some(ref to) = q.to {
            where_clauses.push(format!("timestamp <= ?{}", param_values.len() + 1));
            param_values.push(Box::new(to.clone()));
        }
        if let Some(ref search) = q.search {
            let pattern = format!("%{}%", search);
            where_clauses.push(format!(
                "(message LIKE ?{n} OR detail LIKE ?{n} OR client_info LIKE ?{n})",
                n = param_values.len() + 1
            ));
            param_values.push(Box::new(pattern));
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        // Count total matches
        let count_sql = format!("SELECT COUNT(*) FROM audit_log {where_sql}");
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|b| b.as_ref()).collect();
        let total_count: u32 = self
            .conn
            .query_row(&count_sql, params_ref.as_slice(), |row| row.get(0))
            .map_err(|e| format!("Failed to count audit log entries: {e}"))?;

        // Fetch page
        let limit = q.limit.min(1000);
        let select_sql = format!(
            "SELECT id, timestamp, category, event_type, severity, message, detail, source, client_info
             FROM audit_log {where_sql}
             ORDER BY id DESC
             LIMIT {limit} OFFSET {}",
            q.offset
        );
        let mut stmt = self
            .conn
            .prepare(&select_sql)
            .map_err(|e| format!("Failed to prepare audit log query: {e}"))?;

        let entries = stmt
            .query_map(params_ref.as_slice(), |row| {
                let cat_str: String = row.get(2)?;
                let event_type_str: Option<String> = row.get(3)?;
                let sev_str: String = row.get(4)?;
                let client_info_json: Option<String> = row.get(8)?;
                Ok(AuditLogEntry {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    category: AuditEventCategory::from_str(&cat_str)
                        .unwrap_or(AuditEventCategory::ServerLifecycle),
                    event_type: event_type_str
                        .as_deref()
                        .and_then(AuditEventType::from_str),
                    severity: AuditSeverity::from_str(&sev_str).unwrap_or(AuditSeverity::Info),
                    message: row.get(5)?,
                    detail: row.get(6)?,
                    source: row.get(7)?,
                    client_info: client_info_json
                        .as_deref()
                        .map(|json| AuditClientInfo::from_json(Some(json)))
                        .filter(|ci| !ci.is_empty()),
                })
            })
            .map_err(|e| format!("Failed to query audit log: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(AuditLogResult {
            entries,
            total_count,
        })
    }

    /// Get a single audit log entry by ID.
    pub fn get_by_id(&self, id: i64) -> Result<Option<AuditLogEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, timestamp, category, event_type, severity, message, detail, source, client_info
                 FROM audit_log WHERE id = ?1",
            )
            .map_err(|e| format!("Failed to prepare get_by_id query: {e}"))?;

        let mut rows = stmt
            .query_map(params![id], |row| {
                let cat_str: String = row.get(2)?;
                let event_type_str: Option<String> = row.get(3)?;
                let sev_str: String = row.get(4)?;
                let client_info_json: Option<String> = row.get(8)?;
                Ok(AuditLogEntry {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    category: AuditEventCategory::from_str(&cat_str)
                        .unwrap_or(AuditEventCategory::ServerLifecycle),
                    event_type: event_type_str
                        .as_deref()
                        .and_then(AuditEventType::from_str),
                    severity: AuditSeverity::from_str(&sev_str).unwrap_or(AuditSeverity::Info),
                    message: row.get(5)?,
                    detail: row.get(6)?,
                    source: row.get(7)?,
                    client_info: client_info_json
                        .as_deref()
                        .map(|json| AuditClientInfo::from_json(Some(json)))
                        .filter(|ci| !ci.is_empty()),
                })
            })
            .map_err(|e| format!("Failed to execute get_by_id query: {e}"))?;

        Ok(rows.next().and_then(|r| r.ok()))
    }

    /// Enforce retention policy: delete entries older than `retention_days`
    /// and trim to `max_rows`.
    pub fn enforce_retention(&self) -> Result<u64, String> {
        let cutoff = (Utc::now() - Duration::days(self.retention_days)).to_rfc3339();
        let deleted_by_age: u64 = self
            .conn
            .execute(
                "DELETE FROM audit_log WHERE timestamp < ?1",
                params![cutoff],
            )
            .map_err(|e| format!("Failed to enforce age retention: {e}"))? as u64;

        // Trim excess rows (keep newest max_rows)
        let deleted_by_count: u64 = self
            .conn
            .execute(
                "DELETE FROM audit_log WHERE id NOT IN (
                    SELECT id FROM audit_log ORDER BY id DESC LIMIT ?1
                )",
                params![self.max_rows],
            )
            .map_err(|e| format!("Failed to enforce row-count retention: {e}"))? as u64;

        Ok(deleted_by_age + deleted_by_count)
    }

    /// Clear all audit log entries. Returns the number of entries deleted.
    pub fn clear(&self) -> Result<u64, String> {
        let deleted = self
            .conn
            .execute("DELETE FROM audit_log", [])
            .map_err(|e| format!("Failed to clear audit log: {e}"))? as u64;
        log::info!("Audit log: cleared {} entries", deleted);
        Ok(deleted)
    }

    /// Get total entry count.
    pub fn count(&self) -> Result<u32, String> {
        self.conn
            .query_row("SELECT COUNT(*) FROM audit_log", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count audit log entries: {e}"))
    }
}

// ============================================================================
// Thread-safe wrapper
// ============================================================================

/// Default retention check interval: 1 hour.
const DEFAULT_RETENTION_INTERVAL_SECS: u64 = 3600;

/// Thread-safe shared audit logger state managed by Tauri.
///
/// Includes an optional background retention scheduler that periodically
/// purges expired audit log entries. The inner logger is wrapped in
/// `Arc<Mutex<…>>` so the scheduler task can share access without
/// requiring the entire `AuditLoggerState` to be `Arc`-wrapped.
pub struct AuditLoggerState {
    /// The inner audit logger (protected by a mutex, shared with scheduler).
    pub inner: Arc<Mutex<Option<AuditLogger>>>,
    /// Cancellation sender for the retention scheduler task.
    retention_cancel_tx: Mutex<Option<mpsc::Sender<()>>>,
    /// Retention scheduler interval in seconds (configurable).
    retention_interval_secs: Mutex<u64>,
}

impl AuditLoggerState {
    pub fn new(logger: AuditLogger) -> Self {
        Self {
            inner: Arc::new(Mutex::new(Some(logger))),
            retention_cancel_tx: Mutex::new(None),
            retention_interval_secs: Mutex::new(DEFAULT_RETENTION_INTERVAL_SECS),
        }
    }

    /// Get the current retention check interval in seconds.
    pub fn retention_interval_secs(&self) -> u64 {
        *self.retention_interval_secs.lock()
    }

    /// Set the retention check interval in seconds. Minimum 60 seconds.
    ///
    /// Note: Takes effect on the next scheduler restart. Call
    /// [`stop_retention_scheduler`] then [`start_retention_scheduler`] to apply immediately.
    pub fn set_retention_interval_secs(&self, secs: u64) {
        *self.retention_interval_secs.lock() = secs.max(60);
    }

    /// Start a background task that periodically enforces the retention policy.
    ///
    /// The task runs at the configured interval (default 1 hour) and deletes
    /// entries older than the retention period and trims excess rows.
    /// If a scheduler is already running it is stopped first.
    pub fn start_retention_scheduler(&self) {
        // Stop any existing scheduler first
        self.stop_retention_scheduler();

        let interval_secs = *self.retention_interval_secs.lock();
        let (tx, mut rx) = mpsc::channel::<()>(1);
        *self.retention_cancel_tx.lock() = Some(tx);

        let inner = Arc::clone(&self.inner);
        let interval_duration = std::time::Duration::from_secs(interval_secs);

        tauri::async_runtime::spawn(async move {
            let mut ticker = tokio::time::interval(interval_duration);
            // The first tick fires immediately — skip it since retention was
            // already enforced on startup.
            ticker.tick().await;

            log::info!(
                "Audit log retention scheduler started (interval: {}s)",
                interval_secs
            );

            loop {
                tokio::select! {
                    _ = ticker.tick() => {
                        let result = {
                            let guard = inner.lock();
                            guard.as_ref().map(|l| l.enforce_retention())
                        };
                        match result {
                            Some(Ok(deleted)) => {
                                if deleted > 0 {
                                    log::info!(
                                        "Audit log retention: purged {} expired entries",
                                        deleted
                                    );
                                }
                            }
                            Some(Err(e)) => {
                                log::warn!("Audit log retention enforcement failed: {e}");
                            }
                            None => {
                                // Logger not initialized, skip
                            }
                        }
                    }
                    _ = rx.recv() => {
                        log::info!("Audit log retention scheduler stopped");
                        break;
                    }
                }
            }
        });
    }

    /// Stop the background retention scheduler if running.
    pub fn stop_retention_scheduler(&self) {
        if let Some(tx) = self.retention_cancel_tx.lock().take() {
            let _ = tx.try_send(());
        }
    }

    /// Returns true if the retention scheduler is currently running.
    pub fn is_retention_scheduler_running(&self) -> bool {
        self.retention_cancel_tx.lock().is_some()
    }

    /// Record an audit event into SQLite (no-op if logger is not initialized).
    /// This is the primary public API for inserting events via the thread-safe wrapper.
    pub fn record(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) {
        if let Some(ref logger) = *self.inner.lock() {
            if let Err(e) =
                logger.record(event_type, severity, message, detail, source, client_info)
            {
                log::error!("Audit log write failed: {e}");
            }
        }
    }

    /// Log an event (no-op if logger is not initialized).
    pub fn log(
        &self,
        category: AuditEventCategory,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
    ) {
        if let Some(ref logger) = *self.inner.lock() {
            if let Err(e) = logger.log(category, severity, message, detail, source) {
                log::error!("Audit log write failed: {e}");
            }
        }
    }

    /// Log an event with a specific event type (no-op if logger is not initialized).
    pub fn log_event(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) {
        if let Some(ref logger) = *self.inner.lock() {
            if let Err(e) =
                logger.log_event(event_type, severity, message, detail, source, client_info)
            {
                log::error!("Audit log write failed: {e}");
            }
        }
    }

    /// Log an event with client identity information (no-op if logger is not initialized).
    pub fn log_with_client_info(
        &self,
        category: AuditEventCategory,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) {
        if let Some(ref logger) = *self.inner.lock() {
            if let Err(e) =
                logger.log_with_client_info(category, severity, message, detail, source, client_info)
            {
                log::error!("Audit log write failed: {e}");
            }
        }
    }

    /// Get the current retention days setting.
    pub fn get_retention_days(&self) -> i64 {
        match *self.inner.lock() {
            Some(ref logger) => logger.retention_days(),
            None => 90,
        }
    }

    /// Set the retention days on the underlying logger. Minimum 1 day.
    pub fn set_retention_days(&self, days: i64) {
        if let Some(ref mut logger) = *self.inner.lock() {
            logger.set_retention_days(days);
        }
    }

    /// Query audit log entries.
    pub fn query(&self, q: &AuditLogQuery) -> Result<AuditLogResult, String> {
        match *self.inner.lock() {
            Some(ref logger) => logger.query(q),
            None => Ok(AuditLogResult {
                entries: Vec::new(),
                total_count: 0,
            }),
        }
    }

    /// Get a single entry by ID.
    pub fn get_by_id(&self, id: i64) -> Result<Option<AuditLogEntry>, String> {
        match *self.inner.lock() {
            Some(ref logger) => logger.get_by_id(id),
            None => Ok(None),
        }
    }

    /// Enforce retention policy.
    pub fn enforce_retention(&self) -> Result<u64, String> {
        match *self.inner.lock() {
            Some(ref logger) => logger.enforce_retention(),
            None => Ok(0),
        }
    }

    /// Clear all entries.
    pub fn clear_all(&self) -> Result<u64, String> {
        match *self.inner.lock() {
            Some(ref logger) => logger.clear(),
            None => Ok(0),
        }
    }

    /// Get total entry count.
    pub fn count(&self) -> Result<u32, String> {
        match *self.inner.lock() {
            Some(ref logger) => logger.count(),
            None => Ok(0),
        }
    }
}

impl Default for AuditLoggerState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
            retention_cancel_tx: Mutex::new(None),
            retention_interval_secs: Mutex::new(DEFAULT_RETENTION_INTERVAL_SECS),
        }
    }
}

// ============================================================================
// Authentication audit event helpers
// ============================================================================

impl AuditLoggerState {
    /// Record a successful authentication event.
    ///
    /// Use [`log_auth_success_with_ip`] when the client IP is available
    /// (e.g., runtime session activation). This variant is used during
    /// server-startup credential resolution where no client IP exists.
    pub fn log_auth_success(&self, username: &str) {
        self.log_auth_success_with_ip(username, None);
    }

    /// Record a successful authentication event with client IP.
    ///
    /// Records both the authenticated username and the client's IP address
    /// in the audit log entry's `client_info` field.
    pub fn log_auth_success_with_ip(&self, username: &str, client_ip: Option<&str>) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ip_address: client_ip.map(|s| s.to_string()),
            ..Default::default()
        };
        let ip_detail = client_ip
            .map(|ip| format!("username={}, client_ip={}", username, ip))
            .unwrap_or_else(|| username.to_string());
        self.log_event(
            AuditEventType::AuthSuccess,
            AuditSeverity::Info,
            &format!("User '{}' authenticated successfully", username),
            Some(&ip_detail),
            Some("auth"),
            Some(&client_info),
        );
    }

    /// Record a failed authentication event (wrong password).
    ///
    /// Use [`log_auth_failure_with_ip`] when the client IP is available.
    pub fn log_auth_failure(&self, username: &str, reason: &str) {
        self.log_auth_failure_with_ip(username, reason, None);
    }

    /// Record a failed authentication event with client IP.
    ///
    /// Records the username, failure reason, and optionally the client's IP
    /// address in the audit log entry.
    pub fn log_auth_failure_with_ip(
        &self,
        username: &str,
        reason: &str,
        client_ip: Option<&str>,
    ) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ip_address: client_ip.map(|s| s.to_string()),
            ..Default::default()
        };
        let detail = match client_ip {
            Some(ip) => format!("username={}, reason={}, client_ip={}", username, reason, ip),
            None => format!("username={}, reason={}", username, reason),
        };
        self.log_event(
            AuditEventType::AuthFailure,
            AuditSeverity::Error,
            &format!("Authentication failed for user '{}': {}", username, reason),
            Some(&detail),
            Some("auth"),
            Some(&client_info),
        );
    }

    /// Record an authentication attempt on a disabled account.
    pub fn log_auth_disabled_account(&self, username: &str) {
        self.log_auth_disabled_account_with_ip(username, None);
    }

    /// Record an authentication attempt on a disabled account with client IP.
    pub fn log_auth_disabled_account_with_ip(&self, username: &str, client_ip: Option<&str>) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ip_address: client_ip.map(|s| s.to_string()),
            ..Default::default()
        };
        self.log_event(
            AuditEventType::AuthFailure,
            AuditSeverity::Warning,
            &format!(
                "Authentication attempt on disabled account '{}'",
                username
            ),
            Some(username),
            Some("auth"),
            Some(&client_info),
        );
    }

    /// Record an authentication attempt with an unknown username.
    pub fn log_auth_unknown_user(&self, username: &str) {
        self.log_auth_unknown_user_with_ip(username, None);
    }

    /// Record an authentication attempt with an unknown username and client IP.
    pub fn log_auth_unknown_user_with_ip(&self, username: &str, client_ip: Option<&str>) {
        let client_info = AuditClientInfo {
            username: Some(username.to_string()),
            ip_address: client_ip.map(|s| s.to_string()),
            ..Default::default()
        };
        self.log_event(
            AuditEventType::AuthFailure,
            AuditSeverity::Error,
            &format!(
                "Authentication attempt with unknown username '{}'",
                username
            ),
            Some(username),
            Some("auth"),
            Some(&client_info),
        );
    }

    /// Record credential resolution results during server startup.
    pub fn log_credential_resolution(&self, resolved_count: usize, total_enabled: usize) {
        self.log(
            AuditEventCategory::Authentication,
            AuditSeverity::Info,
            &format!(
                "Credential resolution completed: {}/{} enabled accounts verified",
                resolved_count, total_enabled
            ),
            Some(&format!(
                "resolved={}, total_enabled={}",
                resolved_count, total_enabled
            )),
            Some("auth"),
        );
    }

    /// Record a credential that failed bcrypt verification during server startup.
    pub fn log_credential_verify_failed(&self, username: &str) {
        self.log(
            AuditEventCategory::Authentication,
            AuditSeverity::Warning,
            &format!(
                "Cached credential for '{}' failed bcrypt verification during server startup",
                username
            ),
            Some(username),
            Some("auth"),
        );
    }

    /// Record a missing cached credential during server startup.
    pub fn log_credential_cache_miss(&self, username: &str) {
        self.log(
            AuditEventCategory::Authentication,
            AuditSeverity::Warning,
            &format!(
                "No cached credential for enabled account '{}' during server startup",
                username
            ),
            Some(username),
            Some("auth"),
        );
    }

    /// Record a user account creation event.
    pub fn log_account_created(&self, username: &str, role: &str) {
        self.log(
            AuditEventCategory::Configuration,
            AuditSeverity::Info,
            &format!("User account '{}' created with role '{}'", username, role),
            Some(&format!("username={}, role={}", username, role)),
            Some("auth"),
        );
    }

    /// Record a user account deletion event.
    pub fn log_account_deleted(&self, username: &str) {
        self.log(
            AuditEventCategory::Configuration,
            AuditSeverity::Info,
            &format!("User account '{}' deleted", username),
            Some(username),
            Some("auth"),
        );
    }

    /// Record a user account update event.
    pub fn log_account_updated(&self, username: &str, changes: &str) {
        self.log(
            AuditEventCategory::Configuration,
            AuditSeverity::Info,
            &format!("User account '{}' updated: {}", username, changes),
            Some(&format!("username={}, changes={}", username, changes)),
            Some("auth"),
        );
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn test_logger() -> AuditLogger {
        AuditLogger::open_in_memory().expect("Failed to create in-memory audit logger")
    }

    #[test]
    fn record_inserts_event_into_sqlite() {
        let logger = test_logger();

        // Use the record() API to insert an event
        let client = AuditClientInfo {
            ip_address: Some("10.0.0.5".to_string()),
            username: Some("admin".to_string()),
            ..Default::default()
        };

        let id = logger
            .record(
                AuditEventType::ServerStart,
                AuditSeverity::Info,
                "OPC UA server started on port 4840",
                Some("endpoint=opc.tcp://localhost:4840"),
                Some("server"),
                Some(&client),
            )
            .unwrap();
        assert!(id > 0);

        // Verify the entry was persisted correctly
        let entry = logger.get_by_id(id).unwrap().unwrap();
        assert_eq!(entry.id, id);
        assert_eq!(entry.event_type, Some(AuditEventType::ServerStart));
        assert_eq!(entry.category, AuditEventCategory::ServerLifecycle);
        assert_eq!(entry.severity, AuditSeverity::Info);
        assert_eq!(entry.message, "OPC UA server started on port 4840");
        assert_eq!(entry.detail.as_deref(), Some("endpoint=opc.tcp://localhost:4840"));
        assert_eq!(entry.source.as_deref(), Some("server"));
        assert!(!entry.timestamp.is_empty());

        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.ip_address.as_deref(), Some("10.0.0.5"));
        assert_eq!(ci.username.as_deref(), Some("admin"));
    }

    #[test]
    fn record_all_event_types() {
        let logger = test_logger();

        let event_types = [
            (AuditEventType::ServerStart, AuditEventCategory::ServerLifecycle),
            (AuditEventType::ServerStop, AuditEventCategory::ServerLifecycle),
            (AuditEventType::ClientConnect, AuditEventCategory::Session),
            (AuditEventType::ClientDisconnect, AuditEventCategory::Session),
            (AuditEventType::AuthSuccess, AuditEventCategory::Authentication),
            (AuditEventType::AuthFailure, AuditEventCategory::Authentication),
        ];

        for (et, expected_cat) in &event_types {
            let id = logger
                .record(*et, AuditSeverity::Info, &format!("{:?} event", et), None, None, None)
                .unwrap();
            let entry = logger.get_by_id(id).unwrap().unwrap();
            assert_eq!(entry.event_type, Some(*et));
            assert_eq!(entry.category, *expected_cat, "Category mismatch for {:?}", et);
        }

        assert_eq!(logger.count().unwrap(), event_types.len() as u32);
    }

    #[test]
    fn record_without_optional_fields() {
        let logger = test_logger();

        let id = logger
            .record(
                AuditEventType::ServerStop,
                AuditSeverity::Warning,
                "Server stopped unexpectedly",
                None,
                None,
                None,
            )
            .unwrap();

        let entry = logger.get_by_id(id).unwrap().unwrap();
        assert_eq!(entry.event_type, Some(AuditEventType::ServerStop));
        assert!(entry.detail.is_none());
        assert!(entry.source.is_none());
        assert!(entry.client_info.is_none());
    }

    #[test]
    fn state_record() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.record(
            AuditEventType::AuthFailure,
            AuditSeverity::Error,
            "Authentication failed for user 'test'",
            Some("bad password"),
            Some("auth"),
            None,
        );

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.entries[0].event_type, Some(AuditEventType::AuthFailure));
        assert_eq!(result.entries[0].severity, AuditSeverity::Error);
    }

    #[test]
    fn create_and_query_event() {
        let logger = test_logger();
        let id = logger
            .log(
                AuditEventCategory::ServerLifecycle,
                AuditSeverity::Info,
                "Server started on port 4840",
                None,
                Some("server"),
            )
            .unwrap();
        assert!(id > 0);

        let result = logger.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].category, AuditEventCategory::ServerLifecycle);
        assert_eq!(result.entries[0].message, "Server started on port 4840");
        assert_eq!(result.entries[0].source.as_deref(), Some("server"));
        assert!(result.entries[0].client_info.is_none());
    }

    #[test]
    fn log_with_client_info() {
        let logger = test_logger();

        let client = AuditClientInfo {
            ip_address: Some("192.168.1.100".to_string()),
            session_id: Some("sess-001".to_string()),
            username: Some("operator1".to_string()),
            application_uri: Some("urn:example:client".to_string()),
        };

        let id = logger
            .log_with_client_info(
                AuditEventCategory::Session,
                AuditSeverity::Info,
                "Client connected",
                None,
                Some("session"),
                Some(&client),
            )
            .unwrap();
        assert!(id > 0);

        let result = logger.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.entries.len(), 1);

        let ci = result.entries[0].client_info.as_ref().unwrap();
        assert_eq!(ci.ip_address.as_deref(), Some("192.168.1.100"));
        assert_eq!(ci.session_id.as_deref(), Some("sess-001"));
        assert_eq!(ci.username.as_deref(), Some("operator1"));
        assert_eq!(ci.application_uri.as_deref(), Some("urn:example:client"));
    }

    #[test]
    fn log_without_client_info_stores_null() {
        let logger = test_logger();
        logger
            .log(
                AuditEventCategory::Configuration,
                AuditSeverity::Warning,
                "Policy changed",
                Some("Basic256Sha256 enabled"),
                Some("config"),
            )
            .unwrap();

        let result = logger.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.entries.len(), 1);
        assert!(result.entries[0].client_info.is_none());
    }

    #[test]
    fn get_by_id() {
        let logger = test_logger();

        let id = logger
            .log(
                AuditEventCategory::Authentication,
                AuditSeverity::Error,
                "Auth failed",
                Some("bad password"),
                Some("auth"),
            )
            .unwrap();

        let entry = logger.get_by_id(id).unwrap();
        assert!(entry.is_some());
        let entry = entry.unwrap();
        assert_eq!(entry.id, id);
        assert_eq!(entry.message, "Auth failed");

        let missing = logger.get_by_id(99999).unwrap();
        assert!(missing.is_none());
    }

    #[test]
    fn query_by_category() {
        let logger = test_logger();

        logger.log(AuditEventCategory::ServerLifecycle, AuditSeverity::Info, "started", None, None).unwrap();
        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "session", None, None).unwrap();
        logger.log(AuditEventCategory::ServerLifecycle, AuditSeverity::Info, "stopped", None, None).unwrap();

        let result = logger
            .query(&AuditLogQuery {
                category: Some(AuditEventCategory::ServerLifecycle),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.total_count, 2);
        assert_eq!(result.entries.len(), 2);
    }

    #[test]
    fn query_by_severity_filters_at_or_above() {
        let logger = test_logger();

        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "info", None, None).unwrap();
        logger.log(AuditEventCategory::Security, AuditSeverity::Warning, "warning", None, None).unwrap();
        logger.log(AuditEventCategory::Authentication, AuditSeverity::Error, "error", None, None).unwrap();

        // Warning filter should return warning + error
        let result = logger
            .query(&AuditLogQuery {
                severity: Some(AuditSeverity::Warning),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.total_count, 2);
    }

    #[test]
    fn query_with_search() {
        let logger = test_logger();

        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "Client connected from office", None, None).unwrap();
        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "Client disconnected", None, None).unwrap();

        let result = logger
            .query(&AuditLogQuery {
                search: Some("office".to_string()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.total_count, 1);
        assert!(result.entries[0].message.contains("office"));
    }

    #[test]
    fn query_searches_client_info_json() {
        let logger = test_logger();

        let client = AuditClientInfo {
            ip_address: Some("10.0.0.42".to_string()),
            username: Some("admin_user".to_string()),
            ..Default::default()
        };
        logger
            .log_with_client_info(
                AuditEventCategory::Session,
                AuditSeverity::Info,
                "Connected",
                None,
                None,
                Some(&client),
            )
            .unwrap();
        logger
            .log(AuditEventCategory::Session, AuditSeverity::Info, "Other event", None, None)
            .unwrap();

        // Search by IP in client_info
        let result = logger
            .query(&AuditLogQuery {
                search: Some("10.0.0.42".to_string()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.total_count, 1);

        // Search by username in client_info
        let result = logger
            .query(&AuditLogQuery {
                search: Some("admin_user".to_string()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.total_count, 1);
    }

    #[test]
    fn query_with_pagination() {
        let logger = test_logger();

        for i in 0..10 {
            logger.log(AuditEventCategory::Session, AuditSeverity::Info, &format!("event {i}"), None, None).unwrap();
        }

        let result = logger
            .query(&AuditLogQuery {
                limit: 3,
                offset: 0,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.entries.len(), 3);
        assert_eq!(result.total_count, 10);

        let result2 = logger
            .query(&AuditLogQuery {
                limit: 3,
                offset: 8,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result2.entries.len(), 2); // Only 2 remaining at offset 8 of 10
    }

    #[test]
    fn count() {
        let logger = test_logger();
        assert_eq!(logger.count().unwrap(), 0);

        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "a", None, None).unwrap();
        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "b", None, None).unwrap();
        assert_eq!(logger.count().unwrap(), 2);
    }

    #[test]
    fn clear_all() {
        let logger = test_logger();

        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "a", None, None).unwrap();
        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "b", None, None).unwrap();
        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "c", None, None).unwrap();

        let deleted = logger.clear().unwrap();
        assert_eq!(deleted, 3);
        assert_eq!(logger.count().unwrap(), 0);
    }

    #[test]
    fn retention_by_age() {
        let mut logger = test_logger();
        logger.set_retention_days(30);

        // Insert an event with an old timestamp manually
        let old_ts = (Utc::now() - Duration::days(45)).to_rfc3339();
        logger
            .conn
            .execute(
                "INSERT INTO audit_log (timestamp, category, severity, message) VALUES (?1, ?2, ?3, ?4)",
                params![old_ts, "session", "info", "old event"],
            )
            .unwrap();

        // Insert a recent event
        logger.log(AuditEventCategory::Session, AuditSeverity::Info, "recent", None, None).unwrap();

        // Retention set to 30 days, so the 45-day-old event should be purged
        let deleted = logger.enforce_retention().unwrap();
        assert_eq!(deleted, 1);
        assert_eq!(logger.count().unwrap(), 1);
    }

    #[test]
    fn retention_by_row_count() {
        let mut logger = test_logger();
        logger.set_max_rows(5);

        for i in 0..10 {
            logger.log(AuditEventCategory::Session, AuditSeverity::Info, &format!("event {i}"), None, None).unwrap();
        }
        assert_eq!(logger.count().unwrap(), 10);

        let deleted = logger.enforce_retention().unwrap();
        assert_eq!(deleted, 5);
        assert_eq!(logger.count().unwrap(), 5);
    }

    #[test]
    fn set_retention_settings() {
        let mut logger = test_logger();

        logger.set_retention_days(7);
        assert_eq!(logger.retention_days(), 7);

        // Minimum 1
        logger.set_retention_days(0);
        assert_eq!(logger.retention_days(), 1);

        logger.set_max_rows(1000);
        assert_eq!(logger.max_rows(), 1000);

        // Minimum 100
        logger.set_max_rows(50);
        assert_eq!(logger.max_rows(), 100);
    }

    #[test]
    fn client_info_empty_serialization() {
        let empty = AuditClientInfo::default();
        assert!(empty.is_empty());
        assert!(empty.to_json().is_none());
    }

    #[test]
    fn client_info_roundtrip() {
        let info = AuditClientInfo {
            ip_address: Some("10.0.0.1".to_string()),
            session_id: None,
            username: Some("admin".to_string()),
            application_uri: None,
        };

        let json = info.to_json().unwrap();
        let parsed = AuditClientInfo::from_json(Some(&json));
        assert_eq!(parsed.ip_address, info.ip_address);
        assert_eq!(parsed.username, info.username);
        assert!(parsed.session_id.is_none());
    }

    #[test]
    fn client_info_from_invalid_json() {
        let parsed = AuditClientInfo::from_json(Some("not valid json"));
        assert!(parsed.is_empty());
    }

    #[test]
    fn audit_entry_serde_roundtrip() {
        let entry = AuditLogEntry {
            id: 1,
            timestamp: Utc::now().to_rfc3339(),
            category: AuditEventCategory::Authentication,
            event_type: Some(AuditEventType::AuthFailure),
            severity: AuditSeverity::Warning,
            message: "Login failed".to_string(),
            detail: Some("bad password".to_string()),
            source: Some("auth".to_string()),
            client_info: Some(AuditClientInfo {
                ip_address: Some("192.168.1.50".to_string()),
                session_id: None,
                username: Some("baduser".to_string()),
                application_uri: None,
            }),
        };

        let json = serde_json::to_string(&entry).unwrap();
        let parsed: AuditLogEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.category, AuditEventCategory::Authentication);
        assert_eq!(parsed.event_type, Some(AuditEventType::AuthFailure));
        assert_eq!(parsed.severity, AuditSeverity::Warning);
        assert_eq!(parsed.message, "Login failed");
        assert!(parsed.client_info.is_some());
    }

    #[test]
    fn schema_migration_idempotent() {
        // Opening twice on the same DB should not fail
        let dir = tempfile::tempdir().unwrap();
        let _logger1 = AuditLogger::open(dir.path()).unwrap();
        drop(_logger1);
        let _logger2 = AuditLogger::open(dir.path()).unwrap();
    }

    #[test]
    fn state_default_is_uninitialized() {
        let state = AuditLoggerState::default();
        // Querying on uninitialized state returns empty result
        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 0);
        assert!(result.entries.is_empty());
        assert_eq!(state.count().unwrap(), 0);
    }

    #[test]
    fn state_log_and_query() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log(
            AuditEventCategory::ServerLifecycle,
            AuditSeverity::Info,
            "Server started",
            None,
            Some("server"),
        );

        let client = AuditClientInfo {
            ip_address: Some("10.0.0.1".to_string()),
            ..Default::default()
        };
        state.log_with_client_info(
            AuditEventCategory::Session,
            AuditSeverity::Info,
            "Client connected",
            None,
            Some("session"),
            Some(&client),
        );

        assert_eq!(state.count().unwrap(), 2);

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 2);
    }

    #[test]
    fn state_get_by_id() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log(
            AuditEventCategory::Security,
            AuditSeverity::Error,
            "Certificate rejected",
            None,
            Some("security"),
        );

        // The last inserted ID is 1
        let entry = state.get_by_id(1).unwrap();
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().message, "Certificate rejected");
    }

    #[test]
    fn event_category_roundtrip() {
        let categories = [
            AuditEventCategory::ServerLifecycle,
            AuditEventCategory::Session,
            AuditEventCategory::Authentication,
            AuditEventCategory::Configuration,
            AuditEventCategory::Security,
        ];

        for cat in &categories {
            let s = cat.as_str();
            let parsed = AuditEventCategory::from_str(s);
            assert_eq!(Some(*cat), parsed, "Round-trip failed for {:?}", cat);
        }
    }

    #[test]
    fn severity_roundtrip() {
        for sev in &[AuditSeverity::Info, AuditSeverity::Warning, AuditSeverity::Error] {
            let s = sev.as_str();
            let parsed = AuditSeverity::from_str(s);
            assert_eq!(Some(*sev), parsed);
        }
    }

    #[test]
    fn unknown_category_returns_none() {
        assert_eq!(AuditEventCategory::from_str("unknown_type"), None);
    }

    #[test]
    fn unknown_severity_returns_none() {
        assert_eq!(AuditSeverity::from_str("critical"), None);
    }

    #[test]
    fn event_type_roundtrip() {
        let types = [
            AuditEventType::ServerStart,
            AuditEventType::ServerStop,
            AuditEventType::ClientConnect,
            AuditEventType::ClientDisconnect,
            AuditEventType::AuthSuccess,
            AuditEventType::AuthFailure,
            AuditEventType::ConfigChange,
            AuditEventType::SecurityEvent,
            AuditEventType::Other,
        ];

        for et in &types {
            let s = et.as_str();
            let parsed = AuditEventType::from_str(s);
            assert_eq!(Some(*et), parsed, "Round-trip failed for {:?}", et);
        }
    }

    #[test]
    fn event_type_category_mapping() {
        assert_eq!(AuditEventType::ServerStart.category(), AuditEventCategory::ServerLifecycle);
        assert_eq!(AuditEventType::ServerStop.category(), AuditEventCategory::ServerLifecycle);
        assert_eq!(AuditEventType::ClientConnect.category(), AuditEventCategory::Session);
        assert_eq!(AuditEventType::ClientDisconnect.category(), AuditEventCategory::Session);
        assert_eq!(AuditEventType::AuthSuccess.category(), AuditEventCategory::Authentication);
        assert_eq!(AuditEventType::AuthFailure.category(), AuditEventCategory::Authentication);
        assert_eq!(AuditEventType::ConfigChange.category(), AuditEventCategory::Configuration);
        assert_eq!(AuditEventType::SecurityEvent.category(), AuditEventCategory::Security);
    }

    #[test]
    fn log_event_with_event_type() {
        let logger = test_logger();

        let client = AuditClientInfo {
            ip_address: Some("192.168.1.10".to_string()),
            username: Some("operator".to_string()),
            ..Default::default()
        };

        let id = logger
            .log_event(
                AuditEventType::ClientConnect,
                AuditSeverity::Info,
                "Client connected",
                None,
                Some("session"),
                Some(&client),
            )
            .unwrap();
        assert!(id > 0);

        let entry = logger.get_by_id(id).unwrap().unwrap();
        assert_eq!(entry.event_type, Some(AuditEventType::ClientConnect));
        assert_eq!(entry.category, AuditEventCategory::Session);
        assert_eq!(entry.client_info.as_ref().unwrap().ip_address.as_deref(), Some("192.168.1.10"));
        assert_eq!(entry.client_info.as_ref().unwrap().username.as_deref(), Some("operator"));
    }

    #[test]
    fn query_by_event_type() {
        let logger = test_logger();

        logger.log_event(AuditEventType::ServerStart, AuditSeverity::Info, "started", None, Some("server"), None).unwrap();
        logger.log_event(AuditEventType::ClientConnect, AuditSeverity::Info, "connected", None, Some("session"), None).unwrap();
        logger.log_event(AuditEventType::ServerStop, AuditSeverity::Info, "stopped", None, Some("server"), None).unwrap();

        let result = logger
            .query(&AuditLogQuery {
                event_type: Some(AuditEventType::ServerStart),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.entries[0].event_type, Some(AuditEventType::ServerStart));
    }

    #[test]
    fn log_without_event_type_stores_null() {
        let logger = test_logger();
        let id = logger
            .log(AuditEventCategory::Session, AuditSeverity::Info, "generic event", None, None)
            .unwrap();

        let entry = logger.get_by_id(id).unwrap().unwrap();
        assert_eq!(entry.event_type, None);
    }

    #[test]
    fn default_retention_is_90_days() {
        let logger = test_logger();
        assert_eq!(logger.retention_days(), 90);
    }

    #[test]
    fn state_log_event() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_event(
            AuditEventType::ServerStart,
            AuditSeverity::Info,
            "Server started on port 4840",
            None,
            Some("server"),
            None,
        );

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.entries[0].event_type, Some(AuditEventType::ServerStart));
    }

    #[test]
    fn state_get_set_retention_days() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        // Default is 90 days
        assert_eq!(state.get_retention_days(), 90);

        // Set to custom value
        state.set_retention_days(30);
        assert_eq!(state.get_retention_days(), 30);

        // Minimum clamped to 1
        state.set_retention_days(0);
        assert_eq!(state.get_retention_days(), 1);

        // Large values are accepted
        state.set_retention_days(365);
        assert_eq!(state.get_retention_days(), 365);
    }

    #[test]
    fn state_default_returns_90_for_retention() {
        let state = AuditLoggerState::default();
        // When no logger is initialized, returns 90 (default)
        assert_eq!(state.get_retention_days(), 90);
    }

    #[test]
    fn retention_enforced_with_configured_days() {
        let mut logger = test_logger();
        logger.set_retention_days(7);

        // Insert an entry with a timestamp 10 days ago
        let old_ts = (Utc::now() - Duration::days(10)).to_rfc3339();
        logger.conn.execute(
            "INSERT INTO audit_log (timestamp, category, severity, message) VALUES (?1, ?2, ?3, ?4)",
            params![old_ts, "server_lifecycle", "info", "old event"],
        ).unwrap();

        // Insert a recent entry
        logger.log(
            AuditEventCategory::ServerLifecycle,
            AuditSeverity::Info,
            "recent event",
            None,
            None,
        ).unwrap();

        assert_eq!(logger.count().unwrap(), 2);

        // Enforce retention - should delete the 10-day-old entry (> 7 days)
        let deleted = logger.enforce_retention().unwrap();
        assert!(deleted >= 1);
        assert_eq!(logger.count().unwrap(), 1);

        // Verify only the recent entry remains
        let result = logger.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.entries[0].message, "recent event");
    }

    // ========================================================================
    // Auth success/failure event helpers with username and client IP
    // ========================================================================

    #[test]
    fn auth_success_records_username() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_success("operator1");

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        let entry = &result.entries[0];
        assert_eq!(entry.event_type, Some(AuditEventType::AuthSuccess));
        assert_eq!(entry.severity, AuditSeverity::Info);
        assert!(entry.message.contains("operator1"));
        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("operator1"));
    }

    #[test]
    fn auth_success_with_ip_records_both() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_success_with_ip("admin", Some("192.168.1.100"));

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        let entry = &result.entries[0];
        assert_eq!(entry.event_type, Some(AuditEventType::AuthSuccess));
        assert!(entry.message.contains("admin"));
        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("admin"));
        assert_eq!(ci.ip_address.as_deref(), Some("192.168.1.100"));
        // Detail should include both username and client_ip
        assert!(entry.detail.as_ref().unwrap().contains("client_ip=192.168.1.100"));
    }

    #[test]
    fn auth_success_without_ip_has_no_ip_in_client_info() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_success_with_ip("viewer1", None);

        let result = state.query(&AuditLogQuery::default()).unwrap();
        let ci = result.entries[0].client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("viewer1"));
        assert_eq!(ci.ip_address, None);
    }

    #[test]
    fn auth_failure_records_username_and_reason() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_failure("baduser", "invalid password");

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        let entry = &result.entries[0];
        assert_eq!(entry.event_type, Some(AuditEventType::AuthFailure));
        assert_eq!(entry.severity, AuditSeverity::Error);
        assert!(entry.message.contains("baduser"));
        assert!(entry.message.contains("invalid password"));
        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("baduser"));
    }

    #[test]
    fn auth_failure_with_ip_records_all_fields() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_failure_with_ip("attacker", "wrong password", Some("10.0.0.5"));

        let result = state.query(&AuditLogQuery::default()).unwrap();
        assert_eq!(result.total_count, 1);
        let entry = &result.entries[0];
        assert_eq!(entry.event_type, Some(AuditEventType::AuthFailure));
        assert_eq!(entry.severity, AuditSeverity::Error);
        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("attacker"));
        assert_eq!(ci.ip_address.as_deref(), Some("10.0.0.5"));
        let detail = entry.detail.as_ref().unwrap();
        assert!(detail.contains("attacker"));
        assert!(detail.contains("wrong password"));
        assert!(detail.contains("10.0.0.5"));
    }

    #[test]
    fn auth_disabled_account_records_username() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_disabled_account("disabled_user");

        let result = state.query(&AuditLogQuery::default()).unwrap();
        let entry = &result.entries[0];
        assert_eq!(entry.event_type, Some(AuditEventType::AuthFailure));
        assert_eq!(entry.severity, AuditSeverity::Warning);
        assert!(entry.message.contains("disabled_user"));
        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("disabled_user"));
    }

    #[test]
    fn auth_disabled_account_with_ip() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_disabled_account_with_ip("disabled_user", Some("172.16.0.1"));

        let result = state.query(&AuditLogQuery::default()).unwrap();
        let ci = result.entries[0].client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("disabled_user"));
        assert_eq!(ci.ip_address.as_deref(), Some("172.16.0.1"));
    }

    #[test]
    fn auth_unknown_user_records_username() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_unknown_user("nonexistent");

        let result = state.query(&AuditLogQuery::default()).unwrap();
        let entry = &result.entries[0];
        assert_eq!(entry.event_type, Some(AuditEventType::AuthFailure));
        assert_eq!(entry.severity, AuditSeverity::Error);
        assert!(entry.message.contains("nonexistent"));
        let ci = entry.client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("nonexistent"));
    }

    #[test]
    fn auth_unknown_user_with_ip() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_unknown_user_with_ip("hacker", Some("203.0.113.42"));

        let result = state.query(&AuditLogQuery::default()).unwrap();
        let ci = result.entries[0].client_info.as_ref().unwrap();
        assert_eq!(ci.username.as_deref(), Some("hacker"));
        assert_eq!(ci.ip_address.as_deref(), Some("203.0.113.42"));
    }

    #[test]
    fn auth_events_queryable_by_event_type() {
        let logger = test_logger();
        let state = AuditLoggerState::new(logger);

        state.log_auth_success_with_ip("user1", Some("10.0.0.1"));
        state.log_auth_failure_with_ip("user2", "bad pw", Some("10.0.0.2"));
        state.log_auth_success_with_ip("user3", Some("10.0.0.3"));

        // Query only AuthSuccess events
        let result = state.query(&AuditLogQuery {
            event_type: Some(AuditEventType::AuthSuccess),
            ..Default::default()
        }).unwrap();
        assert_eq!(result.total_count, 2);
        for entry in &result.entries {
            assert_eq!(entry.event_type, Some(AuditEventType::AuthSuccess));
            assert!(entry.client_info.as_ref().unwrap().ip_address.is_some());
        }

        // Query only AuthFailure events
        let result = state.query(&AuditLogQuery {
            event_type: Some(AuditEventType::AuthFailure),
            ..Default::default()
        }).unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(
            result.entries[0].client_info.as_ref().unwrap().username.as_deref(),
            Some("user2")
        );
    }
}
