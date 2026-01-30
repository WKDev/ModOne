//! Project management module
//!
//! This module handles the core project/mod management logic including:
//! - Project creation and loading
//! - Configuration management
//! - .mop file handling
//! - Mod installation and management
//! - Profile management
//! - File operations
//!
//! # Thread-Safe State Management
//!
//! The `ProjectManager` is designed to be used with Tauri's state management system.
//! Wrap it in `Arc<Mutex<>>` for thread-safe access from async command handlers:
//!
//! ```rust,ignore
//! use std::sync::{Arc, Mutex};
//! use crate::project::{ProjectManager, SharedProjectManager};
//!
//! // In main.rs:
//! fn main() {
//!     let project_manager = ProjectManager::new_shared();
//!
//!     tauri::Builder::default()
//!         .manage(project_manager)
//!         .invoke_handler(tauri::generate_handler![...])
//!         .run(tauri::generate_context!())
//!         .expect("error while running tauri application");
//! }
//!
//! // In command handlers:
//! #[tauri::command]
//! async fn create_project(
//!     manager: tauri::State<'_, SharedProjectManager>,
//!     name: String,
//!     path: std::path::PathBuf,
//! ) -> Result<ProjectInfo, String> {
//!     let mut manager = manager.lock().map_err(|e| e.to_string())?;
//!     manager.create_project(name, path, PlcSettings::default())
//!         .map_err(|e| e.to_string())
//! }
//! ```

pub mod auto_save;
pub mod config;
pub mod folder_project;
pub mod layout;
pub mod manifest;
pub mod migration;
pub mod mop_file;
pub mod recovery;
pub mod validation;

pub use auto_save::{AutoSaveManager, SharedAutoSaveManager};
pub use config::{
    AutoSaveSettings, ConfigValidationError, MemoryMapSettings as ProjectMemoryMapSettings,
    ModbusRtuSettings, ModbusSettings, ModbusTcpSettings, Parity, PlcManufacturer, PlcSettings,
    ProjectConfig, ProjectSettings,
};
pub use folder_project::{FolderProject, FolderProjectError, is_folder_project, is_legacy_project};
pub use manifest::{DirectoryConfig, ProjectManifest, MANIFEST_VERSION};
pub use migration::{migrate_project, is_legacy_zip_project, MigrationError, MigrationResult, MigrationPreview, get_migration_preview};
pub use mop_file::{MopFile, MopFileError};
pub use recovery::{
    find_backups, validate_mop_integrity, attempt_partial_recovery,
    recover_from_backup, get_most_recent_valid_backup,
    BackupInfo, MopIntegrityResult, RecoveryResult,
};
pub use validation::{validate_project_config, ValidationResult};

use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Type alias for thread-safe ProjectManager wrapped in Arc<Mutex>
pub type SharedProjectManager = Arc<Mutex<ProjectManager>>;

/// Maximum number of recent projects to keep
const MAX_RECENT_PROJECTS: usize = 10;

/// Recent projects filename
const RECENT_PROJECTS_FILE: &str = "recent_projects.json";

// ============================================================================
// Placeholder Types (to be fully implemented in later units)
// ============================================================================

/// Placeholder for One Canvas diagram data
/// Will be fully implemented in Unit 5: One Canvas Integration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CanvasData {
    /// Raw canvas data stored as JSON until the real structure is implemented
    pub data: Option<serde_json::Value>,
}

/// Placeholder for test scenario data
/// Will be fully implemented in Unit 6: Scenario Editor
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScenarioData {
    /// Raw scenario data stored as JSON until the real structure is implemented
    pub data: Option<serde_json::Value>,
}

/// Placeholder for Modbus memory snapshot data
/// Will be fully implemented in Unit 3: Modbus Server
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MemorySnapshot {
    /// Raw memory snapshot data stored as JSON until the real structure is implemented
    pub data: Option<serde_json::Value>,
}

// ============================================================================
// Project Data Structures
// ============================================================================

/// Storage backend for the project
#[derive(Debug)]
pub enum ProjectStorage {
    /// New folder-based format (v2.0)
    Folder(FolderProject),
    /// Legacy ZIP-based format (v1.x) - will be read-only in future
    LegacyZip(MopFile),
}

impl ProjectStorage {
    /// Get the source path of the project
    pub fn source_path(&self) -> Option<&std::path::Path> {
        match self {
            ProjectStorage::Folder(fp) => Some(fp.manifest_path()),
            ProjectStorage::LegacyZip(mf) => mf.source_path(),
        }
    }

    /// Check if this is a folder-based project
    pub fn is_folder_project(&self) -> bool {
        matches!(self, ProjectStorage::Folder(_))
    }

    /// Check if this is a legacy ZIP project
    pub fn is_legacy_project(&self) -> bool {
        matches!(self, ProjectStorage::LegacyZip(_))
    }
}

/// A currently loaded project with all its associated data
#[derive(Debug)]
pub struct LoadedProject {
    /// Storage backend (folder or legacy ZIP)
    pub storage: ProjectStorage,

    /// Parsed project configuration (unified view)
    pub config: ProjectConfig,

    /// Whether the project has unsaved changes
    pub is_modified: bool,

    /// One Canvas diagram data (loaded on demand)
    pub canvas_data: Option<CanvasData>,

    /// Test scenario data (loaded on demand)
    pub scenario_data: Option<ScenarioData>,

    /// Modbus memory snapshot (loaded on demand)
    pub memory_snapshot: Option<MemorySnapshot>,
}

impl LoadedProject {
    /// Get the source path of the project (manifest file path)
    pub fn source_path(&self) -> Option<&std::path::Path> {
        self.storage.source_path()
    }
}

/// Information about a recently opened project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    /// Project display name
    pub name: String,

    /// Full path to the .mop file
    pub path: PathBuf,

    /// When the project was last opened
    pub last_opened: DateTime<Utc>,
}

/// Summary information returned after creating a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    /// Project name
    pub name: String,

    /// Full path to the .mop file
    pub path: PathBuf,

    /// When the project was created
    pub created_at: DateTime<Utc>,
}

/// Full project data returned when opening a project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    /// Project configuration
    pub config: ProjectConfig,

    /// Canvas data if available
    pub canvas_data: Option<CanvasData>,

    /// Scenario data if available
    pub scenario_data: Option<ScenarioData>,

    /// Memory snapshot if available
    pub memory_snapshot: Option<MemorySnapshot>,
}

// ============================================================================
// Error Types
// ============================================================================

/// Errors that can occur during project management operations
#[derive(Error, Debug)]
pub enum ProjectError {
    #[error("No project is currently open")]
    NoProjectOpen,

    #[error("Project has unsaved changes")]
    UnsavedChanges,

    #[error("Project file error: {0}")]
    MopFile(#[from] MopFileError),

    #[error("Configuration error: {0}")]
    Config(#[from] serde_yaml::Error),

    #[error("Configuration validation error: {0}")]
    ConfigValidation(#[from] crate::error::ModOneError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Project must be saved before performing this operation")]
    ProjectNotSaved,
}

// ============================================================================
// Project Manager
// ============================================================================

/// Manages the current project state and lifecycle
#[derive(Debug)]
pub struct ProjectManager {
    /// Currently loaded project (if any)
    current: Option<LoadedProject>,

    /// List of recently opened projects
    recent_projects: Vec<RecentProject>,

    /// Whether auto-save is enabled
    auto_save_enabled: bool,

    /// Auto-save interval in seconds
    auto_save_interval_secs: u64,
}

impl Default for ProjectManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ProjectManager {
    /// Create a new ProjectManager and load recent projects from disk
    pub fn new() -> Self {
        let recent_projects = load_recent_projects();

        Self {
            current: None,
            recent_projects,
            auto_save_enabled: true,
            auto_save_interval_secs: 300, // 5 minutes
        }
    }

    /// Create a new ProjectManager wrapped in Arc<Mutex> for thread-safe access
    pub fn new_shared() -> SharedProjectManager {
        Arc::new(Mutex::new(Self::new()))
    }

    // ========================================================================
    // Accessors
    // ========================================================================

    /// Get a reference to the currently loaded project
    pub fn get_current_project(&self) -> Option<&LoadedProject> {
        self.current.as_ref()
    }

    /// Get a mutable reference to the currently loaded project
    pub fn get_current_project_mut(&mut self) -> Option<&mut LoadedProject> {
        self.current.as_mut()
    }

    /// Check if a project is currently open
    pub fn is_project_open(&self) -> bool {
        self.current.is_some()
    }

    /// Check if the current project has unsaved changes
    pub fn is_modified(&self) -> bool {
        self.current.as_ref().map_or(false, |p| p.is_modified)
    }

    /// Get the list of recent projects
    pub fn get_recent_projects(&self) -> &[RecentProject] {
        &self.recent_projects
    }

    /// Mark the current project as modified
    pub fn mark_modified(&mut self) {
        if let Some(project) = &mut self.current {
            project.is_modified = true;
        }
    }

    // ========================================================================
    // Project Lifecycle Methods
    // ========================================================================

    /// Create a new project with the given name and settings
    ///
    /// # Arguments
    /// * `name` - The project name
    /// * `project_dir` - Path to the project directory (e.g., Documents/ModOne/MyProject)
    /// * `plc` - PLC configuration settings
    ///
    /// # Returns
    /// `ProjectInfo` with the created project's details
    ///
    /// # Project Structure Created
    /// ```text
    /// project_dir/
    /// ├── {name}.mop     # YAML manifest
    /// ├── canvas/        # Canvas diagrams
    /// ├── ladder/        # Ladder logic files
    /// └── scenario/      # Scenario files
    /// ```
    pub fn create_project(
        &mut self,
        name: String,
        project_dir: PathBuf,
        plc: PlcSettings,
    ) -> Result<ProjectInfo, ProjectError> {
        // Close any existing project first
        if self.current.is_some() {
            self.close_project_internal()?;
        }

        // Create folder-based project (v2.0)
        let folder_project = FolderProject::create_new(&project_dir, &name, plc.clone())
            .map_err(|e| ProjectError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Get manifest path for recent projects
        let manifest_path = folder_project.manifest_path().to_path_buf();

        // Convert manifest to legacy config format for compatibility
        let config = folder_project.manifest().to_legacy_config();
        let created_at = config.project.created_at;

        // Validate config
        validate_project_config(&config)?;

        // Create LoadedProject with folder storage
        let loaded_project = LoadedProject {
            storage: ProjectStorage::Folder(folder_project),
            config,
            is_modified: false,
            canvas_data: None,
            scenario_data: None,
            memory_snapshot: None,
        };

        self.current = Some(loaded_project);

        // Add to recent projects (use manifest path)
        self.add_to_recent(name.clone(), manifest_path.clone());

        Ok(ProjectInfo {
            name,
            path: manifest_path,
            created_at,
        })
    }

    /// Open an existing .mop project file
    ///
    /// Automatically detects whether the file is:
    /// - v2.0 folder-based project (YAML manifest)
    /// - v1.x legacy ZIP archive
    ///
    /// # Arguments
    /// * `path` - Path to the .mop file (manifest or ZIP)
    ///
    /// # Returns
    /// `ProjectData` with the loaded project's data
    pub fn open_project(&mut self, path: PathBuf) -> Result<ProjectData, ProjectError> {
        // Close any existing project first (ignoring unsaved changes warning)
        if self.current.is_some() {
            self.close_project_internal()?;
        }

        // Detect project format
        let (storage, config) = if is_folder_project(&path) {
            // v2.0 folder-based project
            let folder_project = FolderProject::open(&path)
                .map_err(|e| ProjectError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

            let config = folder_project.manifest().to_legacy_config();
            (ProjectStorage::Folder(folder_project), config)
        } else if is_legacy_project(&path) {
            // v1.x legacy ZIP project
            let mop_file = MopFile::open(&path)?;

            // Read and parse config.yml
            let config_path = mop_file.config_path();
            let config_file = File::open(&config_path)?;
            let reader = BufReader::new(config_file);
            let config: ProjectConfig = serde_yaml::from_reader(reader)?;

            (ProjectStorage::LegacyZip(mop_file), config)
        } else {
            return Err(ProjectError::MopFile(MopFileError::InvalidStructure(
                "Unknown project format".to_string()
            )));
        };

        // Validate config before proceeding
        validate_project_config(&config)?;

        let project_name = config.project.name.clone();

        // Create ProjectData to return
        let project_data = ProjectData {
            config: config.clone(),
            canvas_data: None,
            scenario_data: None,
            memory_snapshot: None,
        };

        // Create LoadedProject
        let loaded_project = LoadedProject {
            storage,
            config,
            is_modified: false,
            canvas_data: None,
            scenario_data: None,
            memory_snapshot: None,
        };

        self.current = Some(loaded_project);

        // Add to recent projects
        self.add_to_recent(project_name, path);

        Ok(project_data)
    }

    /// Close the current project
    ///
    /// This will return an error if there are unsaved changes.
    /// Use `close_project_force` to close without saving.
    pub fn close_project(&mut self) -> Result<(), ProjectError> {
        if let Some(project) = &self.current {
            if project.is_modified {
                return Err(ProjectError::UnsavedChanges);
            }
        }

        self.close_project_internal()
    }

    /// Close the current project without checking for unsaved changes
    pub fn close_project_force(&mut self) -> Result<(), ProjectError> {
        self.close_project_internal()
    }

    /// Internal close implementation that doesn't check for unsaved changes
    fn close_project_internal(&mut self) -> Result<(), ProjectError> {
        // Simply drop the current project - TempDir will auto-cleanup
        self.current = None;
        Ok(())
    }

    /// Save the current project
    ///
    /// # Arguments
    /// * `path` - Optional new path for "Save As" operation. If None, saves to original location.
    ///            For folder projects, this should be the new project directory path.
    pub fn save_project(&mut self, path: Option<PathBuf>) -> Result<(), ProjectError> {
        // Check if "Save As" was requested before borrowing self.current mutably
        let is_save_as = path.is_some();

        let project = self.current.as_mut().ok_or(ProjectError::NoProjectOpen)?;

        // Update timestamp
        project.config.project.updated_at = Utc::now();

        match &mut project.storage {
            ProjectStorage::Folder(folder_project) => {
                // Update manifest from config
                let manifest = folder_project.manifest_mut();
                manifest.project = project.config.project.clone();
                manifest.plc = project.config.plc.clone();
                manifest.modbus = project.config.modbus.clone();
                manifest.memory_map = project.config.memory_map.clone();
                manifest.auto_save = project.config.auto_save.clone();

                if let Some(new_dir) = path {
                    // Save As - to new directory
                    folder_project.save_as(&new_dir, None)
                        .map_err(|e| ProjectError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
                } else {
                    // Regular save
                    folder_project.save()
                        .map_err(|e| ProjectError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;
                }
            }
            ProjectStorage::LegacyZip(mop_file) => {
                // Legacy ZIP format
                let save_path = match path {
                    Some(p) => p,
                    None => mop_file
                        .source_path()
                        .ok_or(ProjectError::ProjectNotSaved)?
                        .to_path_buf(),
                };

                // Write config.yml
                let config_path = mop_file.config_path();
                let config_file = File::create(&config_path)?;
                let writer = BufWriter::new(config_file);
                serde_yaml::to_writer(writer, &project.config)?;

                // Save the .mop file
                mop_file.save(&save_path)?;
            }
        }

        // Clear modified flag
        project.is_modified = false;

        // If this was a "Save As", update recent projects
        if is_save_as {
            let project_name = project.config.project.name.clone();
            let new_path = project.storage.source_path()
                .map(|p| p.to_path_buf())
                .unwrap_or_default();

            // Release the mutable borrow before calling add_to_recent
            let _ = project;

            self.add_to_recent(project_name, new_path);
        }

        Ok(())
    }

    // ========================================================================
    // Recent Projects Management
    // ========================================================================

    /// Add a project to the recent projects list
    fn add_to_recent(&mut self, name: String, path: PathBuf) {
        let recent = RecentProject {
            name,
            path: path.clone(),
            last_opened: Utc::now(),
        };

        // Remove any existing entry with the same path
        self.recent_projects.retain(|p| p.path != path);

        // Add to front of list
        self.recent_projects.insert(0, recent);

        // Truncate to max size
        self.recent_projects.truncate(MAX_RECENT_PROJECTS);

        // Persist to disk (ignore errors)
        let _ = save_recent_projects(&self.recent_projects);
    }

    /// Remove a project from the recent projects list
    pub fn remove_from_recent(&mut self, path: &PathBuf) {
        self.recent_projects.retain(|p| &p.path != path);
        let _ = save_recent_projects(&self.recent_projects);
    }

    /// Clear all recent projects
    pub fn clear_recent_projects(&mut self) {
        self.recent_projects.clear();
        let _ = save_recent_projects(&self.recent_projects);
    }
}

// ============================================================================
// Recent Projects Persistence
// ============================================================================

/// Get the path to the recent projects JSON file
fn get_recent_projects_path() -> Option<PathBuf> {
    ProjectDirs::from("com", "modone", "ModOne").map(|dirs| {
        dirs.config_dir().join(RECENT_PROJECTS_FILE)
    })
}

/// Load recent projects from disk
fn load_recent_projects() -> Vec<RecentProject> {
    let path = match get_recent_projects_path() {
        Some(p) => p,
        None => return Vec::new(),
    };

    if !path.exists() {
        return Vec::new();
    }

    let file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };

    let reader = BufReader::new(file);
    serde_json::from_reader(reader).unwrap_or_default()
}

/// Save recent projects to disk
fn save_recent_projects(projects: &[RecentProject]) -> Result<(), std::io::Error> {
    let path = get_recent_projects_path()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Could not determine config directory"))?;

    // Create parent directories if needed
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(&path)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, projects)?;

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_manager_new() {
        let manager = ProjectManager::new();
        assert!(!manager.is_project_open());
        assert!(!manager.is_modified());
    }

    #[test]
    fn test_project_manager_new_shared() {
        let shared = ProjectManager::new_shared();
        let manager = shared.lock().unwrap();
        assert!(!manager.is_project_open());
    }

    #[test]
    fn test_mark_modified_no_project() {
        let mut manager = ProjectManager::new();
        manager.mark_modified(); // Should not panic
        assert!(!manager.is_modified());
    }

    #[test]
    fn test_loaded_project_instantiation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("TestProject");

        let folder_project = FolderProject::create_new(
            &project_dir,
            "Test",
            PlcSettings::default(),
        ).unwrap();

        let config = folder_project.manifest().to_legacy_config();

        let project = LoadedProject {
            storage: ProjectStorage::Folder(folder_project),
            config,
            is_modified: false,
            canvas_data: None,
            scenario_data: None,
            memory_snapshot: None,
        };

        assert!(!project.is_modified);
        assert!(project.storage.is_folder_project());
    }

    #[test]
    fn test_recent_project_serialization() {
        let recent = RecentProject {
            name: "Test Project".to_string(),
            path: PathBuf::from("/path/to/project.mop"),
            last_opened: Utc::now(),
        };

        let json = serde_json::to_string(&recent).unwrap();
        let parsed: RecentProject = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.name, recent.name);
        assert_eq!(parsed.path, recent.path);
    }

    #[test]
    fn test_placeholder_types() {
        let canvas = CanvasData::default();
        assert!(canvas.data.is_none());

        let scenario = ScenarioData::default();
        assert!(scenario.data.is_none());

        let memory = MemorySnapshot::default();
        assert!(memory.data.is_none());
    }

    #[test]
    fn test_create_and_open_project() {
        let mut manager = ProjectManager::new();

        // Create a temp directory for the project
        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("TestProject");

        // Create project (now takes directory, not file path)
        let info = manager
            .create_project(
                "Test Project".to_string(),
                project_dir.clone(),
                PlcSettings::default(),
            )
            .unwrap();

        assert_eq!(info.name, "Test Project");
        assert!(manager.is_project_open());
        assert!(!manager.is_modified());

        // Get the manifest path from the returned info
        let manifest_path = info.path.clone();
        assert!(manifest_path.exists());

        // Verify folder structure
        assert!(project_dir.join("canvas").exists());
        assert!(project_dir.join("ladder").exists());
        assert!(project_dir.join("scenario").exists());

        // Close and reopen
        manager.close_project().unwrap();
        assert!(!manager.is_project_open());

        let data = manager.open_project(manifest_path).unwrap();
        assert_eq!(data.config.project.name, "Test Project");
        assert!(manager.is_project_open());
    }

    #[test]
    fn test_save_project() {
        let mut manager = ProjectManager::new();

        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("SaveTest");

        // Create project
        manager
            .create_project(
                "Save Test".to_string(),
                project_dir.clone(),
                PlcSettings::default(),
            )
            .unwrap();

        // Mark as modified
        manager.mark_modified();
        assert!(manager.is_modified());

        // Save
        manager.save_project(None).unwrap();
        assert!(!manager.is_modified());
    }

    #[test]
    fn test_save_as() {
        let mut manager = ProjectManager::new();

        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("Original");
        let save_as_dir = temp_dir.path().join("SaveAs");

        // Create project
        manager
            .create_project(
                "Save As Test".to_string(),
                project_dir,
                PlcSettings::default(),
            )
            .unwrap();

        // Save As (for folder projects, provide new directory)
        manager.save_project(Some(save_as_dir.clone())).unwrap();

        // Verify the new directory and manifest exist
        assert!(save_as_dir.exists());
        assert!(save_as_dir.join("Save As Test.mop").exists());
    }

    #[test]
    fn test_close_with_unsaved_changes() {
        let mut manager = ProjectManager::new();

        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("UnsavedTest");

        manager
            .create_project(
                "Unsaved Test".to_string(),
                project_dir,
                PlcSettings::default(),
            )
            .unwrap();

        manager.mark_modified();

        // Should fail with unsaved changes
        let result = manager.close_project();
        assert!(matches!(result, Err(ProjectError::UnsavedChanges)));

        // Force close should work
        manager.close_project_force().unwrap();
        assert!(!manager.is_project_open());
    }

    #[test]
    fn test_recent_projects_list() {
        let mut manager = ProjectManager::new();

        let temp_dir = tempfile::tempdir().unwrap();
        let project_dir = temp_dir.path().join("RecentTest");

        // Create project (which adds to recent)
        let info = manager
            .create_project(
                "Recent Test".to_string(),
                project_dir,
                PlcSettings::default(),
            )
            .unwrap();

        // Check recent projects - should contain the manifest path
        let recent = manager.get_recent_projects();
        assert!(!recent.is_empty());
        assert_eq!(recent[0].path, info.path);
    }

    #[test]
    fn test_concurrent_access() {
        use std::thread;

        let shared = ProjectManager::new_shared();

        let handles: Vec<_> = (0..10)
            .map(|_| {
                let manager = Arc::clone(&shared);
                thread::spawn(move || {
                    let mut m = manager.lock().unwrap();
                    m.mark_modified();
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }

        // Should not panic and manager should still be valid
        let manager = shared.lock().unwrap();
        assert!(!manager.is_project_open());
    }
}
