//! Tauri command handlers for logging operations

use tauri::State;

use crate::logging::{LogEntry, SharedErrorLogger};

/// Get the path to the logs directory
#[tauri::command]
pub async fn get_log_path(logger: State<'_, SharedErrorLogger>) -> Result<String, String> {
    let logger = logger
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    Ok(logger.logs_dir().to_string_lossy().to_string())
}

/// Get recent error log entries
#[tauri::command]
pub async fn get_recent_errors(
    logger: State<'_, SharedErrorLogger>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let logger = logger
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let limit = limit.unwrap_or(50);
    logger
        .get_recent_errors(limit)
        .map_err(|e| format!("Failed to read log entries: {}", e))
}

/// Clear all log files
#[tauri::command]
pub async fn clear_error_logs(logger: State<'_, SharedErrorLogger>) -> Result<(), String> {
    let logger = logger
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    logger
        .clear_logs()
        .map_err(|e| format!("Failed to clear logs: {}", e))
}

/// Open the logs directory in the system file explorer
#[tauri::command]
pub async fn open_logs_directory(logger: State<'_, SharedErrorLogger>) -> Result<(), String> {
    let logger = logger
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    let logs_dir = logger.logs_dir();

    // Use platform-specific command to open directory
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(logs_dir)
            .spawn()
            .map_err(|e| format!("Failed to open logs directory: {}", e))?;
    }

    Ok(())
}
