//! Error logging and event emission module
//!
//! Provides file-based error logging with rotation and Tauri event emission
//! for real-time error notifications to the frontend.

use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::error::ModOneError;

/// Maximum size of a single log file (10 MB)
const MAX_LOG_FILE_SIZE: u64 = 10 * 1024 * 1024;

/// Maximum number of log files to keep
const MAX_LOG_FILES: usize = 5;

/// Error log filename
const ERROR_LOG_FILE: &str = "errors.jsonl";

/// Event name for error events sent to frontend
pub const ERROR_EVENT: &str = "modone-error";

/// A single log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// Timestamp when the error occurred
    pub timestamp: DateTime<Utc>,

    /// Log level (error, warn, info)
    pub level: String,

    /// Error type (matches ModOneError variant name)
    pub error_type: String,

    /// Error message
    pub message: String,

    /// Context describing what operation was being performed
    pub context: String,

    /// Optional command name that triggered the error
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

impl LogEntry {
    /// Create a new error log entry
    pub fn error(error: &ModOneError, context: &str) -> Self {
        Self {
            timestamp: Utc::now(),
            level: "error".to_string(),
            error_type: error.error_type().to_string(),
            message: error.to_string(),
            context: context.to_string(),
            command: None,
        }
    }

    /// Create a new error log entry with command info
    pub fn error_with_command(error: &ModOneError, context: &str, command: &str) -> Self {
        Self {
            timestamp: Utc::now(),
            level: "error".to_string(),
            error_type: error.error_type().to_string(),
            message: error.to_string(),
            context: context.to_string(),
            command: Some(command.to_string()),
        }
    }
}

/// Payload for error events sent to the frontend
#[derive(Debug, Clone, Serialize)]
pub struct ErrorEventPayload {
    /// The error that occurred
    pub error: serde_json::Value,

    /// Command that triggered the error (if any)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,

    /// Timestamp when the error occurred
    pub timestamp: String,
}

/// Logger state that can be shared across threads
#[derive(Debug)]
pub struct ErrorLogger {
    /// Path to the logs directory
    logs_dir: PathBuf,

    /// Current log file path
    current_log_path: PathBuf,
}

/// Thread-safe shared logger
pub type SharedErrorLogger = Arc<Mutex<ErrorLogger>>;

impl ErrorLogger {
    /// Create a new error logger
    ///
    /// Creates the logs directory if it doesn't exist.
    pub fn new() -> Result<Self, std::io::Error> {
        let logs_dir = get_logs_directory()?;

        // Create logs directory if needed
        fs::create_dir_all(&logs_dir)?;

        let current_log_path = logs_dir.join(ERROR_LOG_FILE);

        Ok(Self {
            logs_dir,
            current_log_path,
        })
    }

    /// Create a new shared error logger
    pub fn new_shared() -> Result<SharedErrorLogger, std::io::Error> {
        Ok(Arc::new(Mutex::new(Self::new()?)))
    }

    /// Get the path to the logs directory
    pub fn logs_dir(&self) -> &Path {
        &self.logs_dir
    }

    /// Get the path to the current log file
    pub fn current_log_path(&self) -> &Path {
        &self.current_log_path
    }

    /// Log an error
    pub fn log_error(&mut self, error: &ModOneError, context: &str) -> Result<(), std::io::Error> {
        let entry = LogEntry::error(error, context);
        self.write_entry(&entry)
    }

    /// Log an error with command context
    pub fn log_error_with_command(
        &mut self,
        error: &ModOneError,
        context: &str,
        command: &str,
    ) -> Result<(), std::io::Error> {
        let entry = LogEntry::error_with_command(error, context, command);
        self.write_entry(&entry)
    }

    /// Write a log entry to the current log file
    fn write_entry(&mut self, entry: &LogEntry) -> Result<(), std::io::Error> {
        // Check if rotation is needed
        self.rotate_if_needed()?;

        // Serialize entry to JSON
        let json = serde_json::to_string(entry)?;

        // Append to log file
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.current_log_path)?;

        writeln!(file, "{}", json)?;

        Ok(())
    }

    /// Rotate log files if the current one is too large
    fn rotate_if_needed(&mut self) -> Result<(), std::io::Error> {
        if !self.current_log_path.exists() {
            return Ok(());
        }

        let metadata = fs::metadata(&self.current_log_path)?;
        if metadata.len() < MAX_LOG_FILE_SIZE {
            return Ok(());
        }

        // Rotate existing files
        self.rotate_files()?;

        Ok(())
    }

    /// Rotate log files (errors.jsonl -> errors.1.jsonl, etc.)
    fn rotate_files(&self) -> Result<(), std::io::Error> {
        // Delete oldest file if at max
        let oldest = self.logs_dir.join(format!("errors.{}.jsonl", MAX_LOG_FILES));
        if oldest.exists() {
            fs::remove_file(&oldest)?;
        }

        // Shift existing files
        for i in (1..MAX_LOG_FILES).rev() {
            let from = self.logs_dir.join(format!("errors.{}.jsonl", i));
            let to = self.logs_dir.join(format!("errors.{}.jsonl", i + 1));
            if from.exists() {
                fs::rename(&from, &to)?;
            }
        }

        // Rename current to .1
        let first_backup = self.logs_dir.join("errors.1.jsonl");
        if self.current_log_path.exists() {
            fs::rename(&self.current_log_path, &first_backup)?;
        }

        Ok(())
    }

    /// Get recent errors from the log file
    pub fn get_recent_errors(&self, limit: usize) -> Result<Vec<LogEntry>, std::io::Error> {
        if !self.current_log_path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(&self.current_log_path)?;
        let reader = BufReader::new(file);

        let mut entries: Vec<LogEntry> = reader
            .lines()
            .filter_map(|line| line.ok())
            .filter_map(|line| serde_json::from_str(&line).ok())
            .collect();

        // Return most recent entries
        if entries.len() > limit {
            entries = entries.into_iter().rev().take(limit).rev().collect();
        }

        Ok(entries)
    }

    /// Clear all log files
    pub fn clear_logs(&self) -> Result<(), std::io::Error> {
        // Remove main log file
        if self.current_log_path.exists() {
            fs::remove_file(&self.current_log_path)?;
        }

        // Remove rotated files
        for i in 1..=MAX_LOG_FILES {
            let path = self.logs_dir.join(format!("errors.{}.jsonl", i));
            if path.exists() {
                fs::remove_file(&path)?;
            }
        }

        Ok(())
    }
}

impl Default for ErrorLogger {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            logs_dir: PathBuf::from("."),
            current_log_path: PathBuf::from("errors.jsonl"),
        })
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get the logs directory path
fn get_logs_directory() -> Result<PathBuf, std::io::Error> {
    ProjectDirs::from("com", "modone", "ModOne")
        .map(|dirs| dirs.data_dir().join("logs"))
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not determine app data directory",
            )
        })
}

/// Emit an error event to the frontend
pub fn emit_error_event(app_handle: &AppHandle, error: &ModOneError, command: Option<&str>) {
    let error_json = match serde_json::to_value(error) {
        Ok(v) => v,
        Err(e) => {
            log::error!("Failed to serialize error for event: {}", e);
            return;
        }
    };

    let payload = ErrorEventPayload {
        error: error_json,
        command: command.map(String::from),
        timestamp: Utc::now().to_rfc3339(),
    };

    if let Err(e) = app_handle.emit(ERROR_EVENT, &payload) {
        log::error!("Failed to emit error event: {}", e);
    }
}

/// Log an error and emit it to the frontend
pub fn log_and_emit_error(
    logger: &SharedErrorLogger,
    app_handle: &AppHandle,
    error: &ModOneError,
    context: &str,
    command: Option<&str>,
) {
    // Log to file
    if let Ok(mut logger) = logger.lock() {
        if let Some(cmd) = command {
            let _ = logger.log_error_with_command(error, context, cmd);
        } else {
            let _ = logger.log_error(error, context);
        }
    }

    // Emit to frontend
    emit_error_event(app_handle, error, command);
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_logger() -> (ErrorLogger, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let logs_dir = temp_dir.path().to_path_buf();
        let current_log_path = logs_dir.join(ERROR_LOG_FILE);

        let logger = ErrorLogger {
            logs_dir,
            current_log_path,
        };

        (logger, temp_dir)
    }

    #[test]
    fn test_log_entry_creation() {
        let error = ModOneError::ProjectNotFound("/path/to/project.mop".to_string());
        let entry = LogEntry::error(&error, "Opening project");

        assert_eq!(entry.level, "error");
        assert_eq!(entry.error_type, "ProjectNotFound");
        assert_eq!(entry.context, "Opening project");
        assert!(entry.command.is_none());
    }

    #[test]
    fn test_log_entry_with_command() {
        let error = ModOneError::NoProjectOpen;
        let entry = LogEntry::error_with_command(&error, "Saving", "save_project");

        assert_eq!(entry.command, Some("save_project".to_string()));
    }

    #[test]
    fn test_write_and_read_log() {
        let (mut logger, _temp_dir) = create_test_logger();

        let error = ModOneError::IoError("Test error".to_string());
        logger.log_error(&error, "Test context").unwrap();

        let entries = logger.get_recent_errors(10).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].error_type, "IoError");
        assert_eq!(entries[0].context, "Test context");
    }

    #[test]
    fn test_clear_logs() {
        let (mut logger, _temp_dir) = create_test_logger();

        // Write some entries
        let error = ModOneError::Internal("Test".to_string());
        logger.log_error(&error, "Test").unwrap();
        logger.log_error(&error, "Test").unwrap();

        // Verify entries exist
        let entries = logger.get_recent_errors(10).unwrap();
        assert_eq!(entries.len(), 2);

        // Clear logs
        logger.clear_logs().unwrap();

        // Verify empty
        let entries = logger.get_recent_errors(10).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_get_recent_errors_limit() {
        let (mut logger, _temp_dir) = create_test_logger();

        // Write 5 entries
        for i in 0..5 {
            let error = ModOneError::Internal(format!("Error {}", i));
            logger.log_error(&error, "Test").unwrap();
        }

        // Get only 2
        let entries = logger.get_recent_errors(2).unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn test_error_event_payload_serialization() {
        let error = ModOneError::ConfigError("Invalid config".to_string());
        let error_json = serde_json::to_value(&error).unwrap();

        let payload = ErrorEventPayload {
            error: error_json,
            command: Some("open_project".to_string()),
            timestamp: Utc::now().to_rfc3339(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("ConfigError"));
        assert!(json.contains("open_project"));
    }
}
