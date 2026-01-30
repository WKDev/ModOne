//! Tauri command handlers for project file exploration
//!
//! This module provides commands for listing and exploring project file structures.

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::project::SharedProjectManager;

// ============================================================================
// Types
// ============================================================================

/// Represents a file or directory node in the project tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    /// Display name of the file or directory
    pub name: String,
    /// Path relative to the project root
    pub path: String,
    /// Absolute filesystem path
    pub absolute_path: String,
    /// Whether this is a directory
    pub is_dir: bool,
    /// Child nodes (only for directories)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Directories to exclude from the file tree
const EXCLUDED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    ".taskmaster",
    "__pycache__",
    ".vscode",
    ".idea",
    "target",
];

/// Files to exclude from the file tree
const EXCLUDED_FILES: &[&str] = &[
    ".DS_Store",
    "Thumbs.db",
    ".gitignore",
    ".gitattributes",
];

/// Check if a path should be excluded
fn should_exclude(name: &str, is_dir: bool) -> bool {
    if is_dir {
        EXCLUDED_DIRS.contains(&name)
    } else {
        EXCLUDED_FILES.contains(&name)
    }
}

/// Recursively scan a directory and build the file tree
fn scan_directory(dir: &Path, project_root: &Path, depth: usize) -> Result<Vec<FileNode>, String> {
    // Limit recursion depth to prevent infinite loops
    if depth > 10 {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut nodes: Vec<FileNode> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        let is_dir = path.is_dir();

        // Skip excluded items
        if should_exclude(&name, is_dir) {
            continue;
        }

        // Calculate relative path
        let relative_path = path
            .strip_prefix(project_root)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        let absolute_path = path.to_string_lossy().to_string();

        let children = if is_dir {
            Some(scan_directory(&path, project_root, depth + 1)?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: relative_path,
            absolute_path,
            is_dir,
            children,
        });
    }

    // Sort: directories first, then alphabetically
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// List all files and directories in a project directory
///
/// Returns a hierarchical tree structure of the project files.
///
/// # Arguments
/// * `project_root` - Path to the project root directory (where .mop file is located)
#[tauri::command]
pub async fn list_project_files(project_root: String) -> Result<Vec<FileNode>, String> {
    let root_path = PathBuf::from(&project_root);

    if !root_path.exists() {
        return Err(format!("Project directory not found: {}", project_root));
    }

    if !root_path.is_dir() {
        return Err(format!("Path is not a directory: {}", project_root));
    }

    scan_directory(&root_path, &root_path, 0)
}

/// Read the contents of a file
///
/// # Arguments
/// * `path` - Full path to the file
#[tauri::command]
pub async fn read_file_contents(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Check if a file or directory exists
///
/// # Arguments
/// * `path` - Full path to check
#[tauri::command]
pub async fn path_exists(path: String) -> Result<bool, String> {
    let file_path = PathBuf::from(&path);
    Ok(file_path.exists())
}

/// Get file metadata
///
/// # Arguments
/// * `path` - Full path to the file
#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileNode, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("Path not found: {}", path));
    }

    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "".to_string());

    let is_dir = file_path.is_dir();
    let absolute_path = file_path.to_string_lossy().to_string();

    Ok(FileNode {
        name,
        path: absolute_path.clone(),
        absolute_path,
        is_dir,
        children: None,
    })
}

// ============================================================================
// File Creation Commands
// ============================================================================

/// Default template content for canvas YAML files
const CANVAS_TEMPLATE: &str = r#"# ModOne Canvas File
# Version: 1.0
version: "1.0"
blocks: []
wires: []
"#;

/// Default template content for ladder CSV files
const LADDER_TEMPLATE: &str = "Address,Symbol,Comment\n";

/// Default template content for scenario CSV files
const SCENARIO_TEMPLATE: &str = "Time,Address,Value,Comment\n";

/// Create a new project file (canvas, ladder, or scenario)
///
/// # Arguments
/// * `state` - Shared project manager state
/// * `file_type` - Type of file to create: "canvas", "ladder", or "scenario"
/// * `file_name` - Name for the new file (without extension)
/// * `target_dir` - Optional target directory path (if not specified, uses the default directory for the file type)
///
/// # Returns
/// The full path to the created file
#[tauri::command]
pub async fn create_project_file(
    state: State<'_, SharedProjectManager>,
    file_type: String,
    file_name: String,
    target_dir: Option<String>,
) -> Result<String, String> {
    // Validate file type
    let (extension, template, default_dir) = match file_type.as_str() {
        "canvas" => (".yaml", CANVAS_TEMPLATE, "canvas"),
        "ladder" => (".csv", LADDER_TEMPLATE, "ladder"),
        "scenario" => (".csv", SCENARIO_TEMPLATE, "scenario"),
        _ => return Err(format!("Invalid file type: {}. Must be 'canvas', 'ladder', or 'scenario'", file_type)),
    };

    // Validate file name
    if file_name.is_empty() {
        return Err("File name cannot be empty".to_string());
    }

    // Check for invalid characters in file name
    let invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if file_name.chars().any(|c| invalid_chars.contains(&c)) {
        return Err(format!("File name contains invalid characters: {:?}", invalid_chars));
    }

    // Get the project manager
    let manager = state.lock().map_err(|e| format!("Failed to lock project manager: {}", e))?;

    // Get the current project
    let project = manager.get_current_project().ok_or("No project is currently open")?;

    // Determine the target directory
    let target_path = if let Some(dir) = target_dir {
        PathBuf::from(dir)
    } else {
        // Use the default directory based on project storage
        match &project.storage {
            crate::project::ProjectStorage::Folder(folder_project) => {
                match file_type.as_str() {
                    "canvas" => folder_project.canvas_dir(),
                    "ladder" => folder_project.ladder_dir(),
                    "scenario" => folder_project.scenario_dir(),
                    _ => unreachable!(),
                }
            }
            crate::project::ProjectStorage::LegacyZip(mop_file) => {
                // For legacy projects, use the root path + default dir name
                mop_file.root_path().join(default_dir)
            }
        }
    };

    // Ensure the target directory exists
    if !target_path.exists() {
        fs::create_dir_all(&target_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Construct the full file path
    let file_name_with_ext = if file_name.ends_with(extension) {
        file_name
    } else {
        format!("{}{}", file_name, extension)
    };
    let file_path = target_path.join(&file_name_with_ext);

    // Check if file already exists
    if file_path.exists() {
        return Err(format!("File already exists: {}", file_path.display()));
    }

    // Create the file with template content
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(template.as_bytes())
        .map_err(|e| format!("Failed to write file content: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
