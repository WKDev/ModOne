//! SQLite 백엔드 감사 저장소 — 연결, 스키마 마이그레이션, 기록/조회/보존.

use std::path::Path;

use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

use crate::types::{AuditClientInfo, AuditLogEntry, AuditLogQuery, AuditLogResult, AuditSeverity};

/// 현재 스키마 버전.
const SCHEMA_VERSION: u32 = 3;

/// 스키마 마이그레이션을 SCHEMA_VERSION까지 적용.
///
/// - v1: id/timestamp/category/severity/message/detail/source 초기 테이블
/// - v2: client_info TEXT 컬럼 추가
/// - v3: event_type TEXT 컬럼 추가 (세분화된 이벤트 분류)
fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS audit_schema_version (version INTEGER NOT NULL);",
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
        let has_client_info = conn
            .prepare("SELECT client_info FROM audit_log LIMIT 0")
            .is_ok();
        if !has_client_info {
            conn.execute_batch("ALTER TABLE audit_log ADD COLUMN client_info TEXT;")
                .map_err(|e| format!("Failed to add client_info column: {e}"))?;
        }
        set_version(conn, 2)?;
    }

    if current_version < 3 {
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
        set_version(conn, SCHEMA_VERSION)?;
    }

    Ok(())
}

fn set_version(conn: &Connection, version: u32) -> Result<(), String> {
    conn.execute("DELETE FROM audit_schema_version", [])
        .map_err(|e| format!("Failed to clear schema version: {e}"))?;
    conn.execute(
        "INSERT INTO audit_schema_version (version) VALUES (?1)",
        params![version],
    )
    .map_err(|e| format!("Failed to update schema version: {e}"))?;
    Ok(())
}

/// SQLite 감사 저장소. append-only로 이벤트를 기록하고 조회·보존을 제공한다.
pub struct AuditStore {
    conn: Connection,
    retention_days: i64,
    max_rows: i64,
}

impl AuditStore {
    /// 주어진 DB 파일 경로로 저장소를 연다(없으면 생성). 부모 디렉터리도 만든다.
    /// 마이그레이션은 열 때 자동 적용.
    pub fn open(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create audit log directory: {e}"))?;
        }
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open audit log database: {e}"))?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;",
        )
        .map_err(|e| format!("Failed to set journal mode: {e}"))?;
        run_migrations(&conn)?;
        log::info!("Audit log database opened at {:?}", db_path);
        Ok(Self {
            conn,
            retention_days: 90,
            max_rows: 50_000,
        })
    }

    /// 인메모리 DB를 연다(테스트/임시용).
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

    pub fn retention_days(&self) -> i64 {
        self.retention_days
    }

    /// 보존 일수 설정 (최소 1일).
    pub fn set_retention_days(&mut self, days: i64) {
        self.retention_days = days.max(1);
    }

    pub fn max_rows(&self) -> i64 {
        self.max_rows
    }

    /// 최대 보존 행 수 설정 (최소 100).
    pub fn set_max_rows(&mut self, rows: i64) {
        self.max_rows = rows.max(100);
    }

    /// 모든 필드를 갖는 이벤트를 기록. 자동 생성된 row id 반환.
    pub fn log_full(
        &self,
        category: &str,
        event_type: Option<&str>,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
        client_info: Option<&AuditClientInfo>,
    ) -> Result<i64, String> {
        let ts = Utc::now().to_rfc3339();
        let client_info_json = client_info.and_then(|ci| ci.to_json());
        self.conn
            .execute(
                "INSERT INTO audit_log (timestamp, category, event_type, severity, message, detail, source, client_info)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    ts,
                    category,
                    event_type,
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

    /// 카테고리만으로 간단히 기록 (event_type/client_info 없음).
    pub fn log(
        &self,
        category: &str,
        severity: AuditSeverity,
        message: &str,
        detail: Option<&str>,
        source: Option<&str>,
    ) -> Result<i64, String> {
        self.log_full(category, None, severity, message, detail, source, None)
    }

    /// 필터로 항목 조회.
    pub fn query(&self, q: &AuditLogQuery) -> Result<AuditLogResult, String> {
        let mut where_clauses: Vec<String> = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref cat) = q.category {
            where_clauses.push(format!("category = ?{}", param_values.len() + 1));
            param_values.push(Box::new(cat.clone()));
        }
        if let Some(ref et) = q.event_type {
            where_clauses.push(format!("event_type = ?{}", param_values.len() + 1));
            param_values.push(Box::new(et.clone()));
        }
        if let Some(ref sev) = q.severity {
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

        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|b| b.as_ref()).collect();
        let count_sql = format!("SELECT COUNT(*) FROM audit_log {where_sql}");
        let total_count: u32 = self
            .conn
            .query_row(&count_sql, params_ref.as_slice(), |row| row.get(0))
            .map_err(|e| format!("Failed to count audit log entries: {e}"))?;

        let limit = q.limit.min(1000);
        let select_sql = format!(
            "SELECT id, timestamp, category, event_type, severity, message, detail, source, client_info
             FROM audit_log {where_sql} ORDER BY id DESC LIMIT {limit} OFFSET {}",
            q.offset
        );
        let mut stmt = self
            .conn
            .prepare(&select_sql)
            .map_err(|e| format!("Failed to prepare audit log query: {e}"))?;
        let entries = stmt
            .query_map(params_ref.as_slice(), row_to_entry)
            .map_err(|e| format!("Failed to query audit log: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(AuditLogResult {
            entries,
            total_count,
        })
    }

    /// id로 단일 항목 조회.
    pub fn get_by_id(&self, id: i64) -> Result<Option<AuditLogEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, timestamp, category, event_type, severity, message, detail, source, client_info
                 FROM audit_log WHERE id = ?1",
            )
            .map_err(|e| format!("Failed to prepare get_by_id query: {e}"))?;
        let mut rows = stmt
            .query_map(params![id], row_to_entry)
            .map_err(|e| format!("Failed to execute get_by_id query: {e}"))?;
        Ok(rows.next().and_then(|r| r.ok()))
    }

    /// 보존 정책 적용: `retention_days`보다 오래된 항목 삭제 + `max_rows`로 절단.
    /// 삭제된 행 수 반환.
    pub fn enforce_retention(&self) -> Result<u64, String> {
        let cutoff = (Utc::now() - Duration::days(self.retention_days)).to_rfc3339();
        let deleted_by_age: u64 = self
            .conn
            .execute("DELETE FROM audit_log WHERE timestamp < ?1", params![cutoff])
            .map_err(|e| format!("Failed to enforce age retention: {e}"))?
            as u64;
        let deleted_by_count: u64 = self
            .conn
            .execute(
                "DELETE FROM audit_log WHERE id NOT IN (
                    SELECT id FROM audit_log ORDER BY id DESC LIMIT ?1
                )",
                params![self.max_rows],
            )
            .map_err(|e| format!("Failed to enforce row-count retention: {e}"))?
            as u64;
        Ok(deleted_by_age + deleted_by_count)
    }

    /// 모든 항목 삭제. 삭제 수 반환.
    pub fn clear(&self) -> Result<u64, String> {
        let deleted = self
            .conn
            .execute("DELETE FROM audit_log", [])
            .map_err(|e| format!("Failed to clear audit log: {e}"))? as u64;
        log::info!("Audit log: cleared {} entries", deleted);
        Ok(deleted)
    }

    /// 전체 항목 수.
    pub fn count(&self) -> Result<u32, String> {
        self.conn
            .query_row("SELECT COUNT(*) FROM audit_log", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count audit log entries: {e}"))
    }
}

/// SQLite row → `AuditLogEntry` 변환.
fn row_to_entry(row: &rusqlite::Row) -> rusqlite::Result<AuditLogEntry> {
    let sev_str: String = row.get(4)?;
    let client_info_json: Option<String> = row.get(8)?;
    Ok(AuditLogEntry {
        id: row.get(0)?,
        timestamp: row.get(1)?,
        category: row.get(2)?,
        event_type: row.get(3)?,
        severity: AuditSeverity::from_str(&sev_str).unwrap_or(AuditSeverity::Info),
        message: row.get(5)?,
        detail: row.get(6)?,
        source: row.get(7)?,
        client_info: client_info_json
            .as_deref()
            .map(|json| AuditClientInfo::from_json(Some(json)))
            .filter(|ci| !ci.is_empty()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> AuditStore {
        AuditStore::open_in_memory().expect("in-memory store")
    }

    #[test]
    fn log_full_inserts_and_get_by_id() {
        let s = store();
        let client = AuditClientInfo {
            ip_address: Some("10.0.0.5".to_string()),
            username: Some("admin".to_string()),
            ..Default::default()
        };
        let id = s
            .log_full(
                "server_lifecycle",
                Some("server_start"),
                AuditSeverity::Info,
                "server started",
                Some("port=4840"),
                Some("server"),
                Some(&client),
            )
            .unwrap();
        assert!(id > 0);

        let e = s.get_by_id(id).unwrap().unwrap();
        assert_eq!(e.category, "server_lifecycle");
        assert_eq!(e.event_type.as_deref(), Some("server_start"));
        assert_eq!(e.severity, AuditSeverity::Info);
        assert_eq!(e.detail.as_deref(), Some("port=4840"));
        assert_eq!(e.client_info.unwrap().ip_address.as_deref(), Some("10.0.0.5"));
        assert!(s.get_by_id(99999).unwrap().is_none());
    }

    #[test]
    fn query_by_category_and_search() {
        let s = store();
        s.log("session", AuditSeverity::Info, "Client connected from office", None, None)
            .unwrap();
        s.log("session", AuditSeverity::Info, "Client disconnected", None, None)
            .unwrap();
        s.log("server_lifecycle", AuditSeverity::Info, "stopped", None, None)
            .unwrap();

        let by_cat = s
            .query(&AuditLogQuery {
                category: Some("session".to_string()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_cat.total_count, 2);

        let by_search = s
            .query(&AuditLogQuery {
                search: Some("office".to_string()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(by_search.total_count, 1);
    }

    #[test]
    fn query_severity_at_or_above() {
        let s = store();
        s.log("session", AuditSeverity::Info, "i", None, None).unwrap();
        s.log("security", AuditSeverity::Warning, "w", None, None).unwrap();
        s.log("authentication", AuditSeverity::Error, "e", None, None).unwrap();
        let r = s
            .query(&AuditLogQuery {
                severity: Some(AuditSeverity::Warning),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(r.total_count, 2);
    }

    #[test]
    fn query_searches_client_info_json() {
        let s = store();
        let client = AuditClientInfo {
            ip_address: Some("10.0.0.42".to_string()),
            username: Some("admin_user".to_string()),
            ..Default::default()
        };
        s.log_full("session", None, AuditSeverity::Info, "Connected", None, None, Some(&client))
            .unwrap();
        s.log("session", AuditSeverity::Info, "Other", None, None).unwrap();
        let r = s
            .query(&AuditLogQuery {
                search: Some("admin_user".to_string()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(r.total_count, 1);
    }

    #[test]
    fn query_pagination() {
        let s = store();
        for i in 0..10 {
            s.log("session", AuditSeverity::Info, &format!("event {i}"), None, None)
                .unwrap();
        }
        let p1 = s
            .query(&AuditLogQuery { limit: 3, offset: 0, ..Default::default() })
            .unwrap();
        assert_eq!(p1.entries.len(), 3);
        assert_eq!(p1.total_count, 10);
        let p2 = s
            .query(&AuditLogQuery { limit: 3, offset: 8, ..Default::default() })
            .unwrap();
        assert_eq!(p2.entries.len(), 2);
    }

    #[test]
    fn retention_by_age() {
        let mut s = store();
        s.set_retention_days(30);
        let old_ts = (Utc::now() - Duration::days(45)).to_rfc3339();
        s.conn
            .execute(
                "INSERT INTO audit_log (timestamp, category, severity, message) VALUES (?1, ?2, ?3, ?4)",
                params![old_ts, "session", "info", "old"],
            )
            .unwrap();
        s.log("session", AuditSeverity::Info, "recent", None, None).unwrap();
        assert_eq!(s.enforce_retention().unwrap(), 1);
        assert_eq!(s.count().unwrap(), 1);
    }

    #[test]
    fn retention_by_row_count() {
        let mut s = store();
        // 최소 보존 행은 100으로 clamp되므로(set_max_rows) 그보다 많이 넣어야 절단된다.
        s.set_max_rows(100);
        for i in 0..105 {
            s.log("session", AuditSeverity::Info, &format!("e{i}"), None, None).unwrap();
        }
        assert_eq!(s.enforce_retention().unwrap(), 5);
        assert_eq!(s.count().unwrap(), 100);
    }

    #[test]
    fn retention_setting_minimums() {
        let mut s = store();
        s.set_retention_days(0);
        assert_eq!(s.retention_days(), 1);
        s.set_max_rows(50);
        assert_eq!(s.max_rows(), 100);
    }

    #[test]
    fn clear_and_count() {
        let s = store();
        s.log("session", AuditSeverity::Info, "a", None, None).unwrap();
        s.log("session", AuditSeverity::Info, "b", None, None).unwrap();
        assert_eq!(s.count().unwrap(), 2);
        assert_eq!(s.clear().unwrap(), 2);
        assert_eq!(s.count().unwrap(), 0);
    }

    #[test]
    fn migration_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sub").join("audit.db");
        let _a = AuditStore::open(&path).unwrap();
        drop(_a);
        let b = AuditStore::open(&path).unwrap();
        assert_eq!(b.count().unwrap(), 0);
    }
}
