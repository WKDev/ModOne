//! Parser Commands
//!
//! Tauri commands for CSV parsing and ladder logic operations.

use crate::error::ModOneError;
use crate::parser::csv_reader::{self, CsvRow};

/// Parse a CSV file from disk
#[tauri::command]
pub async fn parser_parse_csv_file(path: String) -> Result<Vec<CsvRow>, ModOneError> {
    // Run in blocking thread to avoid blocking async runtime
    tokio::task::spawn_blocking(move || {
        csv_reader::parse_csv_file(&path).map_err(|e| ModOneError::Parse(e.to_string()))
    })
    .await
    .map_err(|e| ModOneError::Internal(e.to_string()))?
}

/// Parse CSV content from string
#[tauri::command]
pub fn parser_parse_csv_content(content: String) -> Result<Vec<CsvRow>, ModOneError> {
    csv_reader::parse_csv_content(&content).map_err(|e| ModOneError::Parse(e.to_string()))
}

/// Parse CSV content and group by step/network
#[tauri::command]
pub fn parser_parse_csv_grouped(
    content: String,
) -> Result<std::collections::HashMap<u32, Vec<CsvRow>>, ModOneError> {
    csv_reader::parse_csv_grouped(&content).map_err(|e| ModOneError::Parse(e.to_string()))
}
