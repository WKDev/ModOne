//! Migration utilities for converting legacy ZIP projects to folder-based format
//!
//! This module provides functions to detect legacy v1.x ZIP projects and migrate
//! them to the new v2.0 folder-based format.

use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};

use thiserror::Error;
use zip::read::ZipArchive;

use super::config::ProjectConfig;
use super::folder_project::{FolderProject, FolderProjectError};

/// Errors that can occur during migration
#[derive(Error, Debug)]
pub enum MigrationError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("ZIP error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Folder project error: {0}")]
    FolderProject(#[from] FolderProjectError),

    #[error("Not a legacy project: {0}")]
    NotLegacyProject(PathBuf),

    #[error("Missing config.yml in legacy project")]
    MissingConfig,

    #[error("Target directory already exists: {0}")]
    TargetExists(PathBuf),
}

/// Result of a migration operation
#[derive(Debug)]
pub struct MigrationResult {
    /// Path to the new project manifest
    pub manifest_path: PathBuf,
    /// Number of files migrated
    pub files_migrated: usize,
    /// List of directories created
    pub directories_created: Vec<String>,
    /// Any warnings encountered
    pub warnings: Vec<String>,
}

/// Check if a file is a legacy ZIP-based project
pub fn is_legacy_zip_project(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }

    if let Ok(mut file) = File::open(path) {
        let mut magic = [0u8; 4];
        if file.read_exact(&mut magic).is_ok() {
            // ZIP magic bytes: PK\x03\x04
            return magic == [0x50, 0x4B, 0x03, 0x04];
        }
    }

    false
}

/// Migrate a legacy ZIP project to the new folder-based format
///
/// # Arguments
/// * `legacy_path` - Path to the legacy .mop ZIP file
/// * `target_dir` - Target directory for the new project (will be created)
///
/// # Returns
/// `MigrationResult` with details about the migration
///
/// # Directory Mapping
/// - `modone/config.yml` -> Merged into new `.mop` manifest
/// - `plc_csv/*` -> `ladder/*`
/// - `one_canvas/*` -> `canvas/*`
/// - `scenario.csv` -> `scenario/scenario.csv`
/// - `mod_server_memory.csv` -> (not migrated, can be regenerated)
pub fn migrate_project(
    legacy_path: &Path,
    target_dir: &Path,
) -> Result<MigrationResult, MigrationError> {
    // Verify it's a legacy project
    if !is_legacy_zip_project(legacy_path) {
        return Err(MigrationError::NotLegacyProject(legacy_path.to_path_buf()));
    }

    // Check target doesn't exist
    if target_dir.exists() {
        return Err(MigrationError::TargetExists(target_dir.to_path_buf()));
    }

    // Open the ZIP archive
    let file = File::open(legacy_path)?;
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)?;

    // Read and parse the legacy config
    let config = read_legacy_config(&mut archive)?;

    // Create new folder project
    let project_name = config.project.name.clone();
    let folder_project = FolderProject::create_new(target_dir, &project_name, config.plc.clone())?;

    let mut files_migrated = 0;
    let mut warnings = Vec::new();
    let directories_created = vec![
        "canvas".to_string(),
        "ladder".to_string(),
        "scenario".to_string(),
    ];

    // Migrate files from the archive
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let entry_name = entry.mangled_name();
        let entry_str = entry_name.to_string_lossy();

        // Skip directories
        if entry.is_dir() {
            continue;
        }

        // Map old paths to new paths
        let new_path = map_legacy_path(&entry_str, target_dir, &folder_project);

        if let Some(target_path) = new_path {
            // Ensure parent directory exists
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }

            // Copy file contents
            let mut contents = Vec::new();
            entry.read_to_end(&mut contents)?;
            fs::write(&target_path, contents)?;
            files_migrated += 1;
        } else {
            // File not mapped, add warning
            if !entry_str.starts_with("modone/") && entry_str != "mod_server_memory.csv" {
                warnings.push(format!("Skipped file: {}", entry_str));
            }
        }
    }

    // Update manifest with legacy config settings
    let manifest_path = folder_project.manifest_path().to_path_buf();

    // Re-open to update with full legacy settings
    let mut folder_project = FolderProject::open(&manifest_path)?;
    {
        let manifest = folder_project.manifest_mut();
        manifest.project = config.project;
        manifest.modbus = config.modbus;
        manifest.memory_map = config.memory_map;
        manifest.auto_save = config.auto_save;
    }
    folder_project.save()?;

    Ok(MigrationResult {
        manifest_path,
        files_migrated,
        directories_created,
        warnings,
    })
}

/// Read the config.yml from a legacy ZIP archive
fn read_legacy_config(archive: &mut ZipArchive<BufReader<File>>) -> Result<ProjectConfig, MigrationError> {
    // Try to find config.yml
    let config_entry = archive.by_name("modone/config.yml");

    match config_entry {
        Ok(mut entry) => {
            let mut contents = String::new();
            entry.read_to_string(&mut contents)?;
            let config: ProjectConfig = serde_yaml::from_str(&contents)?;
            Ok(config)
        }
        Err(_) => Err(MigrationError::MissingConfig),
    }
}

/// Map a legacy path to the new folder structure
fn map_legacy_path(legacy_path: &str, target_dir: &Path, project: &FolderProject) -> Option<PathBuf> {
    // Skip config.yml (merged into manifest)
    if legacy_path == "modone/config.yml" {
        return None;
    }

    // Skip mod_server_memory.csv (can be regenerated)
    if legacy_path == "mod_server_memory.csv" {
        return None;
    }

    // Map plc_csv/* -> ladder/*
    if legacy_path.starts_with("plc_csv/") {
        let filename = legacy_path.strip_prefix("plc_csv/").unwrap();
        return Some(project.ladder_dir().join(filename));
    }

    // Map one_canvas/* -> canvas/*
    if legacy_path.starts_with("one_canvas/") {
        let filename = legacy_path.strip_prefix("one_canvas/").unwrap();
        return Some(project.canvas_dir().join(filename));
    }

    // Map scenario.csv -> scenario/scenario.csv
    if legacy_path == "scenario.csv" {
        return Some(project.scenario_dir().join("scenario.csv"));
    }

    // Other files in modone/ directory (not config.yml) - preserve structure
    if legacy_path.starts_with("modone/") && legacy_path != "modone/config.yml" {
        let filename = legacy_path.strip_prefix("modone/").unwrap();
        return Some(target_dir.join(filename));
    }

    None
}

/// Get migration info without actually migrating
///
/// Returns a preview of what would be migrated.
pub fn get_migration_preview(legacy_path: &Path) -> Result<MigrationPreview, MigrationError> {
    if !is_legacy_zip_project(legacy_path) {
        return Err(MigrationError::NotLegacyProject(legacy_path.to_path_buf()));
    }

    let file = File::open(legacy_path)?;
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)?;

    let config = read_legacy_config(&mut archive)?;

    let mut files_to_migrate = Vec::new();
    let mut files_to_skip = Vec::new();

    for i in 0..archive.len() {
        let entry = archive.by_index(i)?;
        if entry.is_dir() {
            continue;
        }

        let name = entry.mangled_name().to_string_lossy().to_string();

        if name == "modone/config.yml" || name == "mod_server_memory.csv" {
            files_to_skip.push(name);
        } else if name.starts_with("plc_csv/")
            || name.starts_with("one_canvas/")
            || name == "scenario.csv"
        {
            files_to_migrate.push(name);
        } else {
            files_to_skip.push(name);
        }
    }

    Ok(MigrationPreview {
        project_name: config.project.name,
        files_to_migrate,
        files_to_skip,
    })
}

/// Preview information about a potential migration
#[derive(Debug, Clone)]
pub struct MigrationPreview {
    /// Name of the project from config
    pub project_name: String,
    /// Files that will be migrated
    pub files_to_migrate: Vec<String>,
    /// Files that will be skipped
    pub files_to_skip: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_is_legacy_zip_project() {
        // Create a test ZIP file
        let temp_dir = TempDir::new().unwrap();
        let zip_path = temp_dir.path().join("test.mop");

        // Create a minimal ZIP
        let file = File::create(&zip_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        zip.start_file("test.txt", zip::write::FileOptions::default()).unwrap();
        use std::io::Write;
        zip.write_all(b"test").unwrap();
        zip.finish().unwrap();

        assert!(is_legacy_zip_project(&zip_path));
    }

    #[test]
    fn test_is_not_legacy_project() {
        let temp_dir = TempDir::new().unwrap();
        let yaml_path = temp_dir.path().join("test.mop");

        // Create a YAML file
        fs::write(&yaml_path, "manifest_version: '2.0'\n").unwrap();

        assert!(!is_legacy_zip_project(&yaml_path));
    }

    #[test]
    fn test_map_legacy_path() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().join("TestProject");

        let project = FolderProject::create_new(
            &project_dir,
            "TestProject",
            super::super::config::PlcSettings::default(),
        ).unwrap();

        // Test plc_csv mapping
        let result = map_legacy_path("plc_csv/test.csv", &project_dir, &project);
        assert!(result.is_some());
        let result_path = result.unwrap();
        assert!(result_path.ends_with("ladder/test.csv") || result_path.ends_with("ladder\\test.csv"));

        // Test one_canvas mapping
        let result = map_legacy_path("one_canvas/diagram.json", &project_dir, &project);
        assert!(result.is_some());

        // Test scenario.csv mapping
        let result = map_legacy_path("scenario.csv", &project_dir, &project);
        assert!(result.is_some());

        // Test skipped files
        let result = map_legacy_path("modone/config.yml", &project_dir, &project);
        assert!(result.is_none());

        let result = map_legacy_path("mod_server_memory.csv", &project_dir, &project);
        assert!(result.is_none());
    }
}
