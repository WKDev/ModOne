//! .mop file handler for ZIP-based project archives
//!
//! The .mop format is a ZIP archive containing:
//! - modone/config.yml - Project configuration
//! - plc_csv/ - PLC CSV export files
//! - one_canvas/ - One Canvas diagram files
//! - mod_server_memory.csv - Modbus memory snapshot
//! - scenario.csv - Test scenario data

use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};

use tempfile::TempDir;
use thiserror::Error;
use zip::read::ZipArchive;
use zip::write::{FileOptions, ZipWriter};
use zip::CompressionMethod;

// Directory and file path constants
const MODONE_DIR: &str = "modone";
const CONFIG_FILE: &str = "modone/config.yml";
const PLC_CSV_DIR: &str = "plc_csv";
const ONE_CANVAS_DIR: &str = "one_canvas";
const MOD_SERVER_MEMORY_FILE: &str = "mod_server_memory.csv";
const SCENARIO_FILE: &str = "scenario.csv";

/// Errors that can occur during .mop file operations
#[derive(Error, Debug)]
pub enum MopFileError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("ZIP error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Invalid .mop structure: {0}")]
    InvalidStructure(String),

    #[error("Config parse error: {0}")]
    ConfigParse(#[from] serde_yaml::Error),

    #[error("Path traversal attack detected")]
    PathTraversal,
}

/// Handler for .mop project archive files
#[derive(Debug)]
pub struct MopFile {
    /// Temporary directory containing extracted files
    temp_dir: TempDir,

    /// Original file path if opened from existing file
    source_path: Option<PathBuf>,
}

impl MopFile {
    /// Create a new .mop structure in a temporary directory
    pub fn create_new() -> Result<Self, MopFileError> {
        let temp_dir = TempDir::new()?;
        let root = temp_dir.path();

        // Create required directories
        fs::create_dir_all(root.join(MODONE_DIR))?;
        fs::create_dir_all(root.join(PLC_CSV_DIR))?;
        fs::create_dir_all(root.join(ONE_CANVAS_DIR))?;

        // Create empty placeholder files with UTF-8 headers
        Self::create_csv_with_header(
            &root.join(MOD_SERVER_MEMORY_FILE),
            "address,type,value",
        )?;
        Self::create_csv_with_header(
            &root.join(SCENARIO_FILE),
            "step,action,address,value,delay_ms",
        )?;

        Ok(Self {
            temp_dir,
            source_path: None,
        })
    }

    /// Open and extract a .mop file to a temporary directory
    pub fn open(path: &Path) -> Result<Self, MopFileError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut archive = ZipArchive::new(reader)?;

        let temp_dir = TempDir::new()?;
        let root = temp_dir.path();

        // Extract all files from the archive
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)?;
            let entry_path = entry.mangled_name();

            // Security check: ensure path doesn't escape temp directory
            let full_path = root.join(&entry_path);
            if !full_path.starts_with(root) {
                return Err(MopFileError::PathTraversal);
            }

            if entry.is_dir() {
                fs::create_dir_all(&full_path)?;
            } else {
                // Ensure parent directory exists
                if let Some(parent) = full_path.parent() {
                    fs::create_dir_all(parent)?;
                }

                // Extract file contents
                let mut outfile = File::create(&full_path)?;
                std::io::copy(&mut entry, &mut outfile)?;
            }
        }

        let mop_file = Self {
            temp_dir,
            source_path: Some(path.to_path_buf()),
        };

        // Validate the extracted structure
        mop_file.validate_structure()?;

        Ok(mop_file)
    }

    /// Save the temporary directory contents to a .mop file
    pub fn save(&mut self, path: &Path) -> Result<(), MopFileError> {
        // Create parent directories if they don't exist
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = File::create(path)?;
        let writer = BufWriter::new(file);
        let mut zip = ZipWriter::new(writer);

        let options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o644);

        // Recursively add all files and directories
        Self::add_directory_to_zip(&mut zip, self.temp_dir.path(), self.temp_dir.path(), options)?;

        zip.finish()?;

        // Update source path
        self.source_path = Some(path.to_path_buf());

        Ok(())
    }

    /// Get the root path of the temporary directory
    pub fn root_path(&self) -> &Path {
        self.temp_dir.path()
    }

    /// Get the path to config.yml
    pub fn config_path(&self) -> PathBuf {
        self.temp_dir.path().join(CONFIG_FILE)
    }

    /// Get the path to the modone directory
    pub fn modone_dir(&self) -> PathBuf {
        self.temp_dir.path().join(MODONE_DIR)
    }

    /// Get the path to the plc_csv directory
    pub fn plc_csv_dir(&self) -> PathBuf {
        self.temp_dir.path().join(PLC_CSV_DIR)
    }

    /// Get the path to the one_canvas directory
    pub fn one_canvas_dir(&self) -> PathBuf {
        self.temp_dir.path().join(ONE_CANVAS_DIR)
    }

    /// Get the path to mod_server_memory.csv
    pub fn mod_server_memory_path(&self) -> PathBuf {
        self.temp_dir.path().join(MOD_SERVER_MEMORY_FILE)
    }

    /// Get the path to scenario.csv
    pub fn scenario_path(&self) -> PathBuf {
        self.temp_dir.path().join(SCENARIO_FILE)
    }

    /// Get the original source path if opened from file
    pub fn source_path(&self) -> Option<&Path> {
        self.source_path.as_deref()
    }

    /// Validate the .mop directory structure
    fn validate_structure(&self) -> Result<(), MopFileError> {
        let root = self.temp_dir.path();

        // Check for required modone directory
        if !root.join(MODONE_DIR).is_dir() {
            return Err(MopFileError::InvalidStructure(
                "Missing required directory: modone/".to_string(),
            ));
        }

        Ok(())
    }

    /// Create a CSV file with a header line
    fn create_csv_with_header(path: &Path, header: &str) -> Result<(), std::io::Error> {
        let mut file = File::create(path)?;
        writeln!(file, "{}", header)?;
        Ok(())
    }

    /// Recursively add a directory to a ZIP archive
    fn add_directory_to_zip(
        zip: &mut ZipWriter<BufWriter<File>>,
        base_path: &Path,
        current_path: &Path,
        options: FileOptions,
    ) -> Result<(), MopFileError> {
        for entry in fs::read_dir(current_path)? {
            let entry = entry?;
            let path = entry.path();
            let relative_path = path
                .strip_prefix(base_path)
                .map_err(|_| MopFileError::InvalidStructure("Invalid path prefix".to_string()))?;

            // Convert to forward slashes for ZIP compatibility
            let zip_path = relative_path
                .to_string_lossy()
                .replace('\\', "/");

            if path.is_dir() {
                // Add directory entry (with trailing slash)
                zip.add_directory(&format!("{}/", zip_path), options)?;
                // Recurse into subdirectory
                Self::add_directory_to_zip(zip, base_path, &path, options)?;
            } else {
                // Add file
                zip.start_file(&zip_path, options)?;
                let mut file = File::open(&path)?;
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)?;
                zip.write_all(&buffer)?;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_new() {
        let mop = MopFile::create_new().unwrap();

        // Verify directories exist
        assert!(mop.modone_dir().is_dir());
        assert!(mop.plc_csv_dir().is_dir());
        assert!(mop.one_canvas_dir().is_dir());

        // Verify files exist
        assert!(mop.mod_server_memory_path().is_file());
        assert!(mop.scenario_path().is_file());
    }

    #[test]
    fn test_helper_paths() {
        let mop = MopFile::create_new().unwrap();

        assert!(mop.config_path().ends_with("modone/config.yml") || mop.config_path().ends_with("modone\\config.yml"));
        assert!(mop.plc_csv_dir().ends_with("plc_csv"));
        assert!(mop.one_canvas_dir().ends_with("one_canvas"));
    }

    #[test]
    fn test_save_and_open_roundtrip() {
        // Create new mop file
        let mut mop = MopFile::create_new().unwrap();

        // Add a test config file
        let config_content = "version: '1.0'\nproject:\n  name: Test\n";
        fs::write(mop.config_path(), config_content).unwrap();

        // Add a test file in plc_csv
        let test_csv_path = mop.plc_csv_dir().join("test.csv");
        fs::write(&test_csv_path, "col1,col2\nval1,val2\n").unwrap();

        // Save to a temporary file
        let temp_file = tempfile::NamedTempFile::new().unwrap();
        let save_path = temp_file.path().with_extension("mop");
        mop.save(&save_path).unwrap();

        // Open the saved file
        let opened_mop = MopFile::open(&save_path).unwrap();

        // Verify contents
        let read_config = fs::read_to_string(opened_mop.config_path()).unwrap();
        assert_eq!(read_config, config_content);

        let read_csv = fs::read_to_string(opened_mop.plc_csv_dir().join("test.csv")).unwrap();
        assert_eq!(read_csv, "col1,col2\nval1,val2\n");

        // Cleanup
        let _ = fs::remove_file(&save_path);
    }

    #[test]
    fn test_validate_structure_missing_modone() {
        let temp_dir = TempDir::new().unwrap();
        // Don't create modone directory

        let mop = MopFile {
            temp_dir,
            source_path: None,
        };

        let result = mop.validate_structure();
        assert!(matches!(result, Err(MopFileError::InvalidStructure(_))));
    }

    #[test]
    fn test_tempdir_cleanup() {
        let temp_path: PathBuf;

        {
            let mop = MopFile::create_new().unwrap();
            temp_path = mop.root_path().to_path_buf();
            assert!(temp_path.exists());
        }

        // After MopFile is dropped, temp directory should be cleaned up
        assert!(!temp_path.exists());
    }

    #[test]
    fn test_source_path() {
        let mop = MopFile::create_new().unwrap();
        assert!(mop.source_path().is_none());

        // After save, source_path should be set
        let mut mop = MopFile::create_new().unwrap();
        // Create config to pass validation
        fs::create_dir_all(mop.modone_dir()).unwrap();

        let temp_file = tempfile::NamedTempFile::new().unwrap();
        let save_path = temp_file.path().with_extension("mop");
        mop.save(&save_path).unwrap();

        assert_eq!(mop.source_path(), Some(save_path.as_path()));

        // Cleanup
        let _ = fs::remove_file(&save_path);
    }
}
