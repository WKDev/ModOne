//! Unified error types for the ModOne application
//!
//! This module provides a centralized error handling system that can be
//! serialized to the frontend and provides user-friendly error messages.

use serde::Serialize;
use thiserror::Error;

/// Main error type for ModOne operations
///
/// All errors are serializable to JSON for frontend consumption using
/// a tagged enum format: { "type": "ErrorType", "message": "..." }
#[derive(Error, Debug, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum ModOneError {
    // ========================================================================
    // Project Errors
    // ========================================================================
    /// Project file not found at the specified path
    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    /// Invalid or corrupted .mop project file
    #[error("Invalid project file: {0}")]
    InvalidMopFile(String),

    /// Configuration parsing error (YAML)
    #[error("Configuration error: {0}")]
    ConfigError(String),

    /// Configuration validation error with field information
    #[error("Invalid configuration: {field} - {message}")]
    ConfigValidationError { field: String, message: String },

    /// A project is already open and must be closed first
    #[error("A project is already open. Please close it first.")]
    ProjectAlreadyOpen,

    /// No project is currently open
    #[error("No project is open")]
    NoProjectOpen,

    /// Project has unsaved changes
    #[error("Project has unsaved changes")]
    UnsavedChanges,

    // ========================================================================
    // File/IO Errors
    // ========================================================================
    /// General IO error
    #[error("IO error: {0}")]
    IoError(String),

    /// File already exists (for create operations)
    #[error("File already exists: {0}")]
    FileExists(String),

    /// Permission denied
    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    // ========================================================================
    // Recovery Errors
    // ========================================================================
    /// Backup file not found
    #[error("No backup file found")]
    BackupNotFound,

    /// Recovery operation failed
    #[error("Recovery failed: {0}")]
    RecoveryFailed(String),

    // ========================================================================
    // Modbus Errors
    // ========================================================================
    /// Modbus server error
    #[error("Modbus error: {0}")]
    ModbusError(String),

    /// Modbus memory access error
    #[error("Memory access error: {0}")]
    MemoryError(String),

    // ========================================================================
    // General Errors
    // ========================================================================
    /// Internal error (unexpected conditions)
    #[error("Internal error: {0}")]
    Internal(String),

    /// Operation cancelled by user
    #[error("Operation cancelled")]
    Cancelled,

    /// Operation timed out
    #[error("Operation timed out: {0}")]
    Timeout(String),
}

/// Result type alias for ModOne operations
pub type ModOneResult<T> = Result<T, ModOneError>;

// ============================================================================
// From implementations for common error types
// ============================================================================

impl From<std::io::Error> for ModOneError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => ModOneError::ProjectNotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => ModOneError::PermissionDenied(err.to_string()),
            std::io::ErrorKind::AlreadyExists => ModOneError::FileExists(err.to_string()),
            _ => ModOneError::IoError(err.to_string()),
        }
    }
}

impl From<zip::result::ZipError> for ModOneError {
    fn from(err: zip::result::ZipError) -> Self {
        ModOneError::InvalidMopFile(format!("ZIP error: {}", err))
    }
}

impl From<serde_yaml::Error> for ModOneError {
    fn from(err: serde_yaml::Error) -> Self {
        ModOneError::ConfigError(format!("YAML parsing error: {}", err))
    }
}

impl From<serde_json::Error> for ModOneError {
    fn from(err: serde_json::Error) -> Self {
        ModOneError::ConfigError(format!("JSON parsing error: {}", err))
    }
}

// ============================================================================
// Helper methods
// ============================================================================

impl ModOneError {
    /// Check if this error type is recoverable (user can retry or take action)
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            ModOneError::IoError(_)
                | ModOneError::PermissionDenied(_)
                | ModOneError::ConfigValidationError { .. }
                | ModOneError::UnsavedChanges
                | ModOneError::Timeout(_)
        )
    }

    /// Check if this error might have a backup available for recovery
    pub fn has_backup_option(&self) -> bool {
        matches!(self, ModOneError::InvalidMopFile(_))
    }

    /// Get a user-friendly title for this error
    pub fn title(&self) -> &'static str {
        match self {
            ModOneError::ProjectNotFound(_) => "Project Not Found",
            ModOneError::InvalidMopFile(_) => "Invalid Project File",
            ModOneError::ConfigError(_) => "Configuration Error",
            ModOneError::ConfigValidationError { .. } => "Invalid Configuration",
            ModOneError::ProjectAlreadyOpen => "Project Already Open",
            ModOneError::NoProjectOpen => "No Project Open",
            ModOneError::UnsavedChanges => "Unsaved Changes",
            ModOneError::IoError(_) => "File Error",
            ModOneError::FileExists(_) => "File Already Exists",
            ModOneError::PermissionDenied(_) => "Permission Denied",
            ModOneError::BackupNotFound => "Backup Not Found",
            ModOneError::RecoveryFailed(_) => "Recovery Failed",
            ModOneError::ModbusError(_) => "Modbus Error",
            ModOneError::MemoryError(_) => "Memory Error",
            ModOneError::Internal(_) => "Internal Error",
            ModOneError::Cancelled => "Cancelled",
            ModOneError::Timeout(_) => "Timeout",
        }
    }

    /// Get the error type as a string (matches serde tag)
    pub fn error_type(&self) -> &'static str {
        match self {
            ModOneError::ProjectNotFound(_) => "ProjectNotFound",
            ModOneError::InvalidMopFile(_) => "InvalidMopFile",
            ModOneError::ConfigError(_) => "ConfigError",
            ModOneError::ConfigValidationError { .. } => "ConfigValidationError",
            ModOneError::ProjectAlreadyOpen => "ProjectAlreadyOpen",
            ModOneError::NoProjectOpen => "NoProjectOpen",
            ModOneError::UnsavedChanges => "UnsavedChanges",
            ModOneError::IoError(_) => "IoError",
            ModOneError::FileExists(_) => "FileExists",
            ModOneError::PermissionDenied(_) => "PermissionDenied",
            ModOneError::BackupNotFound => "BackupNotFound",
            ModOneError::RecoveryFailed(_) => "RecoveryFailed",
            ModOneError::ModbusError(_) => "ModbusError",
            ModOneError::MemoryError(_) => "MemoryError",
            ModOneError::Internal(_) => "Internal",
            ModOneError::Cancelled => "Cancelled",
            ModOneError::Timeout(_) => "Timeout",
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_serialization() {
        let error = ModOneError::ProjectNotFound("/path/to/project.mop".to_string());
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"type\":\"ProjectNotFound\""));
        assert!(json.contains("/path/to/project.mop"));
    }

    #[test]
    fn test_config_validation_error_serialization() {
        let error = ModOneError::ConfigValidationError {
            field: "tcp_port".to_string(),
            message: "Port must be between 0 and 65535".to_string(),
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"type\":\"ConfigValidationError\""));
        assert!(json.contains("tcp_port"));
    }

    #[test]
    fn test_from_io_error() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let error: ModOneError = io_error.into();
        assert!(matches!(error, ModOneError::ProjectNotFound(_)));
    }

    #[test]
    fn test_is_recoverable() {
        assert!(ModOneError::IoError("test".to_string()).is_recoverable());
        assert!(ModOneError::UnsavedChanges.is_recoverable());
        assert!(!ModOneError::ProjectAlreadyOpen.is_recoverable());
        assert!(!ModOneError::Internal("test".to_string()).is_recoverable());
    }

    #[test]
    fn test_has_backup_option() {
        assert!(ModOneError::InvalidMopFile("corrupted".to_string()).has_backup_option());
        assert!(!ModOneError::ProjectNotFound("path".to_string()).has_backup_option());
    }
}
