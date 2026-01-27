//! File recovery utilities for corrupted or missing project files
//!
//! This module provides utilities to:
//! - Find available backup files
//! - Validate .mop file integrity
//! - Attempt partial recovery from corrupted archives
//! - Recover from backup files

use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use zip::read::ZipArchive;

use crate::error::{ModOneError, ModOneResult};

/// Constants for backup file patterns
const BACKUP_EXTENSION: &str = ".bak";
const MAX_BACKUP_SEARCH: usize = 10;

// Directory and file path constants (matching mop_file.rs)
const MODONE_DIR: &str = "modone";
const CONFIG_FILE: &str = "modone/config.yml";

/// Information about an available backup file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    /// Full path to the backup file
    pub path: PathBuf,

    /// When the backup was created (file modification time)
    pub timestamp: DateTime<Utc>,

    /// Size of the backup file in bytes
    pub size: u64,

    /// Backup number (0 for .bak, 1 for .bak.1, etc.)
    pub backup_number: u32,
}

/// Result of validating a .mop file's integrity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MopIntegrityResult {
    /// Whether the file is fully valid
    pub is_valid: bool,

    /// Whether the ZIP archive can be opened
    pub is_readable: bool,

    /// Whether config.yml exists
    pub has_config: bool,

    /// Whether the modone/ directory exists
    pub has_modone_dir: bool,

    /// List of files that could be read successfully
    pub readable_files: Vec<String>,

    /// List of errors encountered
    pub errors: Vec<String>,
}

impl Default for MopIntegrityResult {
    fn default() -> Self {
        Self {
            is_valid: false,
            is_readable: false,
            has_config: false,
            has_modone_dir: false,
            readable_files: Vec::new(),
            errors: Vec::new(),
        }
    }
}

/// Result of attempting partial recovery from a corrupted file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryResult {
    /// Files that were successfully recovered
    pub recovered_files: Vec<String>,

    /// Files that could not be recovered
    pub failed_files: Vec<String>,

    /// Whether a default config.yml was created
    pub created_default_config: bool,

    /// Path to the recovery output directory
    pub output_path: PathBuf,
}

// ============================================================================
// Backup Discovery
// ============================================================================

/// Find all available backup files for a given .mop file
///
/// Searches for:
/// - file.mop.bak
/// - file.mop.bak.1
/// - file.mop.bak.2
/// - etc.
///
/// Returns backups sorted by modification time (most recent first)
pub fn find_backups(mop_path: &Path) -> Vec<BackupInfo> {
    let mut backups = Vec::new();

    // Get the parent directory and base filename
    let parent = match mop_path.parent() {
        Some(p) => p,
        None => return backups,
    };

    let filename = match mop_path.file_name() {
        Some(f) => f.to_string_lossy().to_string(),
        None => return backups,
    };

    // Check for .bak file
    let bak_path = parent.join(format!("{}{}", filename, BACKUP_EXTENSION));
    if let Some(info) = get_backup_info(&bak_path, 0) {
        backups.push(info);
    }

    // Check for numbered backups (.bak.1, .bak.2, etc.)
    for i in 1..=MAX_BACKUP_SEARCH {
        let numbered_path = parent.join(format!("{}{}.{}", filename, BACKUP_EXTENSION, i));
        if let Some(info) = get_backup_info(&numbered_path, i as u32) {
            backups.push(info);
        } else {
            // Stop searching if we hit a gap in numbering
            break;
        }
    }

    // Sort by timestamp (most recent first)
    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    backups
}

/// Get backup info for a specific path if it exists
fn get_backup_info(path: &Path, backup_number: u32) -> Option<BackupInfo> {
    let metadata = fs::metadata(path).ok()?;

    if !metadata.is_file() {
        return None;
    }

    let modified = metadata.modified().ok()?;
    let timestamp = DateTime::<Utc>::from(modified);

    Some(BackupInfo {
        path: path.to_path_buf(),
        timestamp,
        size: metadata.len(),
        backup_number,
    })
}

// ============================================================================
// Integrity Validation
// ============================================================================

/// Validate the integrity of a .mop file
///
/// Checks:
/// - File can be opened as a ZIP archive
/// - Required directory structure exists (modone/)
/// - Required files exist (config.yml)
/// - All entries can be read
pub fn validate_mop_integrity(path: &Path) -> MopIntegrityResult {
    let mut result = MopIntegrityResult::default();

    // Try to open as ZIP
    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            result.errors.push(format!("Cannot open file: {}", e));
            return result;
        }
    };

    let reader = BufReader::new(file);
    let mut archive = match ZipArchive::new(reader) {
        Ok(a) => a,
        Err(e) => {
            result.errors.push(format!("Invalid ZIP archive: {}", e));
            return result;
        }
    };

    result.is_readable = true;

    // Check each entry in the archive
    for i in 0..archive.len() {
        match archive.by_index(i) {
            Ok(entry) => {
                let name = entry.name().to_string();

                // Check for required structure
                if name == CONFIG_FILE || name == format!("{}/", CONFIG_FILE.trim_end_matches('/')) {
                    result.has_config = true;
                }
                if name.starts_with(MODONE_DIR) {
                    result.has_modone_dir = true;
                }

                result.readable_files.push(name);
            }
            Err(e) => {
                result.errors.push(format!("Cannot read entry {}: {}", i, e));
            }
        }
    }

    // Check for config.yml specifically
    if !result.has_config {
        // Try direct access
        if archive.by_name(CONFIG_FILE).is_ok() {
            result.has_config = true;
        }
    }

    // Determine overall validity
    result.is_valid = result.is_readable
        && result.has_modone_dir
        && result.has_config
        && result.errors.is_empty();

    result
}

// ============================================================================
// Recovery Operations
// ============================================================================

/// Attempt to recover as much data as possible from a corrupted .mop file
///
/// Extracts all readable entries to the output directory and creates
/// a default config.yml if the original is missing or corrupted.
pub fn attempt_partial_recovery(
    corrupted_path: &Path,
    output_dir: &Path,
) -> ModOneResult<RecoveryResult> {
    let mut result = RecoveryResult {
        recovered_files: Vec::new(),
        failed_files: Vec::new(),
        created_default_config: false,
        output_path: output_dir.to_path_buf(),
    };

    // Create output directory
    fs::create_dir_all(output_dir).map_err(|e| {
        ModOneError::RecoveryFailed(format!("Cannot create output directory: {}", e))
    })?;

    // Try to open the corrupted file
    let file = File::open(corrupted_path).map_err(|e| {
        ModOneError::RecoveryFailed(format!("Cannot open corrupted file: {}", e))
    })?;

    let reader = BufReader::new(file);
    let mut archive = match ZipArchive::new(reader) {
        Ok(a) => a,
        Err(e) => {
            return Err(ModOneError::RecoveryFailed(format!(
                "Cannot read as ZIP archive: {}",
                e
            )));
        }
    };

    // Track if we found config.yml
    let mut found_config = false;

    // Try to extract each entry
    for i in 0..archive.len() {
        match archive.by_index(i) {
            Ok(mut entry) => {
                let name = entry.name().to_string();
                let outpath = output_dir.join(&name);

                // Security check
                if !outpath.starts_with(output_dir) {
                    result.failed_files.push(format!("{} (path traversal)", name));
                    continue;
                }

                if entry.is_dir() {
                    if fs::create_dir_all(&outpath).is_ok() {
                        result.recovered_files.push(name);
                    } else {
                        result.failed_files.push(name);
                    }
                } else {
                    // Create parent directories
                    if let Some(parent) = outpath.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    // Try to extract file contents
                    let mut contents = Vec::new();
                    match entry.read_to_end(&mut contents) {
                        Ok(_) => {
                            if fs::write(&outpath, &contents).is_ok() {
                                if name == CONFIG_FILE {
                                    found_config = true;
                                }
                                result.recovered_files.push(name);
                            } else {
                                result.failed_files.push(name);
                            }
                        }
                        Err(_) => {
                            result.failed_files.push(name);
                        }
                    }
                }
            }
            Err(_) => {
                result.failed_files.push(format!("entry_{}", i));
            }
        }
    }

    // Create default config if missing
    if !found_config {
        let config_path = output_dir.join(CONFIG_FILE);
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let default_config = create_default_config_yaml();
        if fs::write(&config_path, default_config).is_ok() {
            result.created_default_config = true;
            result.recovered_files.push(CONFIG_FILE.to_string());
        }
    }

    Ok(result)
}

/// Create a default config.yml content
fn create_default_config_yaml() -> String {
    let now = Utc::now().to_rfc3339();
    format!(
        r#"version: "1.0"

project:
  name: "Recovered Project"
  description: "Recovered from corrupted file"
  created_at: "{now}"
  updated_at: "{now}"

plc:
  manufacturer: LS
  model: ""
  scan_time_ms: 10

modbus:
  tcp:
    enabled: true
    port: 502
    unit_id: 1
  rtu:
    enabled: false
    com_port: ""
    baud_rate: 9600
    parity: None
    stop_bits: 1

memory_map:
  coil_start: 0
  coil_count: 1000
  discrete_input_start: 0
  discrete_input_count: 1000
  holding_register_start: 0
  holding_register_count: 1000
  input_register_start: 0
  input_register_count: 1000

auto_save:
  enabled: true
  interval_secs: 300
  backup_count: 3
"#
    )
}

/// Recover a project from a backup file
///
/// Validates the backup integrity before copying to ensure we're not
/// replacing a corrupted file with another corrupted file.
pub fn recover_from_backup(backup_path: &Path, target_path: &Path) -> ModOneResult<()> {
    // Validate backup integrity first
    let integrity = validate_mop_integrity(backup_path);

    if !integrity.is_valid {
        let errors = if integrity.errors.is_empty() {
            "Unknown validation error".to_string()
        } else {
            integrity.errors.join("; ")
        };
        return Err(ModOneError::RecoveryFailed(format!(
            "Backup file is also corrupted: {}",
            errors
        )));
    }

    // Create parent directory if needed
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            ModOneError::RecoveryFailed(format!("Cannot create target directory: {}", e))
        })?;
    }

    // Copy backup to target
    fs::copy(backup_path, target_path).map_err(|e| {
        ModOneError::RecoveryFailed(format!("Cannot copy backup file: {}", e))
    })?;

    Ok(())
}

/// Get the most recent valid backup for a .mop file
///
/// Returns the first backup that passes integrity validation.
pub fn get_most_recent_valid_backup(mop_path: &Path) -> Option<BackupInfo> {
    let backups = find_backups(mop_path);

    for backup in backups {
        let integrity = validate_mop_integrity(&backup.path);
        if integrity.is_valid {
            return Some(backup);
        }
    }

    None
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;
    use zip::write::{FileOptions, ZipWriter};
    use zip::CompressionMethod;

    /// Create a valid test .mop file
    fn create_valid_mop(path: &Path) {
        let file = File::create(path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Stored);

        // Add modone directory
        zip.add_directory("modone/", options).unwrap();

        // Add config.yml
        zip.start_file("modone/config.yml", options).unwrap();
        zip.write_all(b"version: '1.0'\nproject:\n  name: Test\n").unwrap();

        zip.finish().unwrap();
    }

    /// Create a corrupted test file (not a valid ZIP)
    fn create_corrupted_file(path: &Path) {
        fs::write(path, b"This is not a valid ZIP file").unwrap();
    }

    #[test]
    fn test_find_backups_none() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("project.mop");

        // Create the main file but no backups
        create_valid_mop(&mop_path);

        let backups = find_backups(&mop_path);
        assert!(backups.is_empty());
    }

    #[test]
    fn test_find_backups_single() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("project.mop");
        let bak_path = temp_dir.path().join("project.mop.bak");

        create_valid_mop(&mop_path);
        create_valid_mop(&bak_path);

        let backups = find_backups(&mop_path);
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].backup_number, 0);
    }

    #[test]
    fn test_find_backups_multiple() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("project.mop");

        create_valid_mop(&mop_path);
        create_valid_mop(&temp_dir.path().join("project.mop.bak"));
        create_valid_mop(&temp_dir.path().join("project.mop.bak.1"));
        create_valid_mop(&temp_dir.path().join("project.mop.bak.2"));

        let backups = find_backups(&mop_path);
        assert_eq!(backups.len(), 3);
    }

    #[test]
    fn test_validate_mop_integrity_valid() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("valid.mop");

        create_valid_mop(&mop_path);

        let result = validate_mop_integrity(&mop_path);
        assert!(result.is_valid);
        assert!(result.is_readable);
        assert!(result.has_config);
        assert!(result.has_modone_dir);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_mop_integrity_corrupted() {
        let temp_dir = TempDir::new().unwrap();
        let corrupted_path = temp_dir.path().join("corrupted.mop");

        create_corrupted_file(&corrupted_path);

        let result = validate_mop_integrity(&corrupted_path);
        assert!(!result.is_valid);
        assert!(!result.is_readable);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_validate_mop_integrity_missing_config() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("no_config.mop");

        // Create ZIP without config.yml
        let file = File::create(&mop_path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Stored);

        zip.add_directory("modone/", options).unwrap();
        zip.finish().unwrap();

        let result = validate_mop_integrity(&mop_path);
        assert!(!result.is_valid);
        assert!(result.is_readable);
        assert!(!result.has_config);
        assert!(result.has_modone_dir);
    }

    #[test]
    fn test_recover_from_backup() {
        let temp_dir = TempDir::new().unwrap();
        let backup_path = temp_dir.path().join("project.mop.bak");
        let target_path = temp_dir.path().join("recovered.mop");

        create_valid_mop(&backup_path);

        let result = recover_from_backup(&backup_path, &target_path);
        assert!(result.is_ok());
        assert!(target_path.exists());
    }

    #[test]
    fn test_recover_from_corrupted_backup() {
        let temp_dir = TempDir::new().unwrap();
        let backup_path = temp_dir.path().join("corrupted.mop.bak");
        let target_path = temp_dir.path().join("recovered.mop");

        create_corrupted_file(&backup_path);

        let result = recover_from_backup(&backup_path, &target_path);
        assert!(result.is_err());
    }

    #[test]
    fn test_partial_recovery() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("partial.mop");
        let output_dir = temp_dir.path().join("recovered");

        create_valid_mop(&mop_path);

        let result = attempt_partial_recovery(&mop_path, &output_dir).unwrap();
        assert!(!result.recovered_files.is_empty());
        assert!(result.failed_files.is_empty());
        assert!(!result.created_default_config); // Config existed
    }

    #[test]
    fn test_get_most_recent_valid_backup() {
        let temp_dir = TempDir::new().unwrap();
        let mop_path = temp_dir.path().join("project.mop");
        let bak_path = temp_dir.path().join("project.mop.bak");

        create_valid_mop(&mop_path);
        create_valid_mop(&bak_path);

        let backup = get_most_recent_valid_backup(&mop_path);
        assert!(backup.is_some());
    }

    #[test]
    fn test_default_config_yaml_valid() {
        let yaml = create_default_config_yaml();
        assert!(yaml.contains("version:"));
        assert!(yaml.contains("project:"));
        assert!(yaml.contains("Recovered Project"));
    }
}
