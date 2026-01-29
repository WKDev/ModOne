//! Tauri command handlers for project file exploration
//!
//! This module provides commands for listing and exploring project file structures.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

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
