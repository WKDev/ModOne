//! Folder-based project handler (v2.0)
//!
//! Handles project operations for the new folder-based format where:
//! - ProjectName.mop is a YAML manifest file
//! - canvas/, ladder/, scenario/ directories contain actual data

use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};

use thiserror::Error;

use super::manifest::ProjectManifest;
use super::config::PlcSettings;

/// Errors specific to folder-based project operations
#[derive(Error, Debug)]
pub enum FolderProjectError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Project directory already exists: {0}")]
    DirectoryExists(PathBuf),

    #[error("Manifest file not found: {0}")]
    ManifestNotFound(PathBuf),

    #[error("Invalid manifest: {0}")]
    InvalidManifest(String),

    #[error("Not a folder-based project: {0}")]
    NotFolderProject(PathBuf),

    #[error("Project directory not found: {0}")]
    ProjectDirNotFound(PathBuf),
}

/// A folder-based project (v2.0 format)
#[derive(Debug)]
pub struct FolderProject {
    /// Path to the .mop manifest file
    manifest_path: PathBuf,

    /// Path to the project root directory
    project_root: PathBuf,

    /// The loaded manifest
    manifest: ProjectManifest,
}

impl FolderProject {
    /// Create a new folder-based project
    ///
    /// # Arguments
    /// * `project_dir` - The directory where the project will be created (e.g., Documents/ModOne/MyProject)
    /// * `name` - The project name (used for the .mop filename)
    /// * `plc` - PLC settings for the project
    ///
    /// # Returns
    /// A new FolderProject instance
    ///
    /// # Structure Created
    /// ```text
    /// project_dir/
    /// ├── {name}.mop     # YAML manifest
    /// ├── canvas/        # Canvas diagrams
    /// ├── ladder/        # Ladder logic files
    /// └── scenario/      # Scenario files
    /// ```
    pub fn create_new(
        project_dir: &Path,
        name: &str,
        plc: PlcSettings,
    ) -> Result<Self, FolderProjectError> {
        // Check if directory already exists
        if project_dir.exists() {
            return Err(FolderProjectError::DirectoryExists(project_dir.to_path_buf()));
        }

        // Create project directory
        fs::create_dir_all(project_dir)?;

        // Create manifest
        let mut manifest = ProjectManifest::new(name);
        manifest.plc = plc;

        // Create subdirectories
        let canvas_dir = project_dir.join(&manifest.directories.canvas);
        let ladder_dir = project_dir.join(&manifest.directories.ladder);
        let scenario_dir = project_dir.join(&manifest.directories.scenario);

        fs::create_dir_all(&canvas_dir)?;
        fs::create_dir_all(&ladder_dir)?;
        fs::create_dir_all(&scenario_dir)?;

        // Write manifest file
        let manifest_filename = format!("{}.mop", name);
        let manifest_path = project_dir.join(&manifest_filename);

        let file = File::create(&manifest_path)?;
        let writer = BufWriter::new(file);
        serde_yaml::to_writer(writer, &manifest)?;

        Ok(Self {
            manifest_path,
            project_root: project_dir.to_path_buf(),
            manifest,
        })
    }

    /// Open an existing folder-based project
    ///
    /// # Arguments
    /// * `manifest_path` - Path to the .mop manifest file
    pub fn open(manifest_path: &Path) -> Result<Self, FolderProjectError> {
        if !manifest_path.exists() {
            return Err(FolderProjectError::ManifestNotFound(manifest_path.to_path_buf()));
        }

        // Verify it's a YAML file (not a ZIP)
        if Self::is_zip_file(manifest_path)? {
            return Err(FolderProjectError::NotFolderProject(manifest_path.to_path_buf()));
        }

        // Read manifest
        let file = File::open(manifest_path)?;
        let reader = BufReader::new(file);
        let manifest: ProjectManifest = serde_yaml::from_reader(reader)?;

        // Validate manifest version
        if !manifest.is_v2() {
            return Err(FolderProjectError::InvalidManifest(format!(
                "Expected manifest version 2.x, got {}",
                manifest.manifest_version
            )));
        }

        // Get project root (parent of manifest file)
        let project_root = manifest_path
            .parent()
            .ok_or_else(|| FolderProjectError::InvalidManifest("Invalid manifest path".to_string()))?
            .to_path_buf();

        if !project_root.exists() {
            return Err(FolderProjectError::ProjectDirNotFound(project_root));
        }

        Ok(Self {
            manifest_path: manifest_path.to_path_buf(),
            project_root,
            manifest,
        })
    }

    /// Save the manifest to disk
    pub fn save(&mut self) -> Result<(), FolderProjectError> {
        // Update timestamp
        self.manifest.touch();

        // Write manifest
        let file = File::create(&self.manifest_path)?;
        let writer = BufWriter::new(file);
        serde_yaml::to_writer(writer, &self.manifest)?;

        Ok(())
    }

    /// Save the manifest to a new location (Save As)
    ///
    /// # Arguments
    /// * `new_project_dir` - New project directory
    /// * `new_name` - New project name (optional, uses existing if None)
    pub fn save_as(
        &mut self,
        new_project_dir: &Path,
        new_name: Option<&str>,
    ) -> Result<(), FolderProjectError> {
        // Check if target already exists
        if new_project_dir.exists() {
            return Err(FolderProjectError::DirectoryExists(new_project_dir.to_path_buf()));
        }

        // Create new directory structure
        fs::create_dir_all(new_project_dir)?;

        // Copy data directories if they exist
        self.copy_directory_if_exists(&self.canvas_dir(), &new_project_dir.join(&self.manifest.directories.canvas))?;
        self.copy_directory_if_exists(&self.ladder_dir(), &new_project_dir.join(&self.manifest.directories.ladder))?;
        self.copy_directory_if_exists(&self.scenario_dir(), &new_project_dir.join(&self.manifest.directories.scenario))?;

        // Update manifest
        if let Some(name) = new_name {
            self.manifest.project.name = name.to_string();
        }
        self.manifest.touch();

        // Determine new manifest filename
        let new_manifest_name = format!("{}.mop", new_name.unwrap_or(&self.manifest.project.name));
        let new_manifest_path = new_project_dir.join(&new_manifest_name);

        // Write new manifest
        let file = File::create(&new_manifest_path)?;
        let writer = BufWriter::new(file);
        serde_yaml::to_writer(writer, &self.manifest)?;

        // Update paths
        self.manifest_path = new_manifest_path;
        self.project_root = new_project_dir.to_path_buf();

        Ok(())
    }

    // ==========================================================================
    // Accessors
    // ==========================================================================

    /// Get the manifest file path
    pub fn manifest_path(&self) -> &Path {
        &self.manifest_path
    }

    /// Get the project root directory
    pub fn project_root(&self) -> &Path {
        &self.project_root
    }

    /// Get a reference to the manifest
    pub fn manifest(&self) -> &ProjectManifest {
        &self.manifest
    }

    /// Get a mutable reference to the manifest
    pub fn manifest_mut(&mut self) -> &mut ProjectManifest {
        &mut self.manifest
    }

    /// Get the canvas directory path
    pub fn canvas_dir(&self) -> PathBuf {
        self.project_root.join(&self.manifest.directories.canvas)
    }

    /// Get the ladder directory path
    pub fn ladder_dir(&self) -> PathBuf {
        self.project_root.join(&self.manifest.directories.ladder)
    }

    /// Get the scenario directory path
    pub fn scenario_dir(&self) -> PathBuf {
        self.project_root.join(&self.manifest.directories.scenario)
    }

    // ==========================================================================
    // Helper Methods
    // ==========================================================================

    /// Check if a file is a ZIP archive by reading magic bytes
    fn is_zip_file(path: &Path) -> Result<bool, FolderProjectError> {
        let mut file = File::open(path)?;
        let mut magic = [0u8; 4];

        use std::io::Read;
        if file.read_exact(&mut magic).is_ok() {
            // ZIP magic bytes: PK\x03\x04
            Ok(magic == [0x50, 0x4B, 0x03, 0x04])
        } else {
            // File too small to be a ZIP
            Ok(false)
        }
    }

    /// Recursively copy a directory if it exists
    fn copy_directory_if_exists(&self, src: &Path, dst: &Path) -> Result<(), FolderProjectError> {
        if !src.exists() {
            // Create empty destination directory
            fs::create_dir_all(dst)?;
            return Ok(());
        }

        fs::create_dir_all(dst)?;

        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            if src_path.is_dir() {
                self.copy_directory_if_exists(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)?;
            }
        }

        Ok(())
    }

    /// Check if the necessary directories exist, create if missing
    pub fn ensure_directories(&self) -> Result<(), FolderProjectError> {
        fs::create_dir_all(self.canvas_dir())?;
        fs::create_dir_all(self.ladder_dir())?;
        fs::create_dir_all(self.scenario_dir())?;
        Ok(())
    }
}

/// Check if a path points to a folder-based project (v2.0)
///
/// Returns true if the file is a YAML file (not a ZIP)
pub fn is_folder_project(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }

    // Check if it's NOT a ZIP file
    if let Ok(file) = File::open(path) {
        let mut reader = BufReader::new(file);
        let mut magic = [0u8; 4];

        use std::io::Read;
        if reader.read_exact(&mut magic).is_ok() {
            // If it starts with ZIP magic bytes, it's a legacy project
            if magic == [0x50, 0x4B, 0x03, 0x04] {
                return false;
            }
        }
    }

    // Try to parse as YAML manifest
    if let Ok(file) = File::open(path) {
        let reader = BufReader::new(file);
        if let Ok(manifest) = serde_yaml::from_reader::<_, ProjectManifest>(reader) {
            return manifest.is_v2();
        }
    }

    false
}

/// Check if a path points to a legacy ZIP project (v1.x)
pub fn is_legacy_project(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }

    if let Ok(mut file) = File::open(path) {
        let mut magic = [0u8; 4];

        use std::io::Read;
        if file.read_exact(&mut magic).is_ok() {
            // ZIP magic bytes: PK\x03\x04
            return magic == [0x50, 0x4B, 0x03, 0x04];
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::manifest::MANIFEST_VERSION;
    use tempfile::TempDir;

    #[test]
    fn test_create_new_project() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().join("TestProject");

        let project = FolderProject::create_new(
            &project_dir,
            "TestProject",
            PlcSettings::default(),
        ).unwrap();

        // Verify structure
        assert!(project_dir.exists());
        assert!(project.manifest_path().exists());
        assert!(project.canvas_dir().exists());
        assert!(project.ladder_dir().exists());
        assert!(project.scenario_dir().exists());

        // Verify manifest content
        assert_eq!(project.manifest().project.name, "TestProject");
        assert_eq!(project.manifest().manifest_version, MANIFEST_VERSION);
    }

    #[test]
    fn test_open_project() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().join("OpenTest");

        // Create project
        let project = FolderProject::create_new(
            &project_dir,
            "OpenTest",
            PlcSettings::default(),
        ).unwrap();

        let manifest_path = project.manifest_path().to_path_buf();

        // Open it
        let opened = FolderProject::open(&manifest_path).unwrap();
        assert_eq!(opened.manifest().project.name, "OpenTest");
    }

    #[test]
    fn test_save_project() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().join("SaveTest");

        let mut project = FolderProject::create_new(
            &project_dir,
            "SaveTest",
            PlcSettings::default(),
        ).unwrap();

        // Modify and save
        project.manifest_mut().project.description = "Updated description".to_string();
        project.save().unwrap();

        // Reopen and verify
        let manifest_path = project.manifest_path().to_path_buf();
        let reopened = FolderProject::open(&manifest_path).unwrap();
        assert_eq!(reopened.manifest().project.description, "Updated description");
    }

    #[test]
    fn test_create_fails_if_exists() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().join("ExistsTest");

        // Create once
        FolderProject::create_new(&project_dir, "ExistsTest", PlcSettings::default()).unwrap();

        // Try to create again - should fail
        let result = FolderProject::create_new(&project_dir, "ExistsTest", PlcSettings::default());
        assert!(matches!(result, Err(FolderProjectError::DirectoryExists(_))));
    }

    #[test]
    fn test_is_folder_project() {
        let temp_dir = TempDir::new().unwrap();
        let project_dir = temp_dir.path().join("FolderCheck");

        let project = FolderProject::create_new(
            &project_dir,
            "FolderCheck",
            PlcSettings::default(),
        ).unwrap();

        assert!(is_folder_project(project.manifest_path()));
        assert!(!is_legacy_project(project.manifest_path()));
    }
}
