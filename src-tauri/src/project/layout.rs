//! Layout Configuration Types and Storage
//!
//! Types for serializing and persisting layout configurations.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Current version of the layout storage format
pub const LAYOUT_STORAGE_VERSION: &str = "1.0";

/// Special layout name for auto-saved session
pub const LAST_SESSION_LAYOUT: &str = "_lastSession";

/// Built-in layout preset names
pub mod built_in_names {
    pub const DEFAULT: &str = "Default";
    pub const COMPACT: &str = "Compact";
    pub const DEBUG: &str = "Debug";
    pub const MEMORY_FOCUS: &str = "Memory Focus";
}

/// Grid configuration (columns and rows)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridConfig {
    /// Array of grid-template-columns values
    pub columns: Vec<String>,
    /// Array of grid-template-rows values
    pub rows: Vec<String>,
}

/// Configuration for a single tab within a panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabLayoutConfig {
    /// Type of panel content this tab displays
    #[serde(rename = "type")]
    pub panel_type: String,
    /// Display title for the tab
    pub title: String,
}

/// Configuration for a single panel
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelLayoutConfig {
    /// Unique identifier for the panel
    pub id: String,
    /// Type of panel content
    #[serde(rename = "type")]
    pub panel_type: String,
    /// CSS grid-area value
    pub grid_area: String,
    /// Optional array of tabs within this panel
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tabs: Option<Vec<TabLayoutConfig>>,
    /// ID of the active tab
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_tab_id: Option<String>,
}

/// Configuration for sidebar state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidebarLayoutConfig {
    /// Whether sidebar is visible
    pub visible: bool,
    /// Sidebar width in pixels
    pub width: i32,
    /// Currently active sidebar panel
    pub active_panel: String,
}

/// Complete layout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutConfig {
    /// Name of the layout preset
    pub name: String,
    /// Grid configuration
    pub grid: GridConfig,
    /// Array of panel configurations
    pub panels: Vec<PanelLayoutConfig>,
    /// Sidebar configuration
    pub sidebar: SidebarLayoutConfig,
    /// Whether this is a built-in preset
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_built_in: Option<bool>,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Creation timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    /// Last modified timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

/// Layout storage format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayoutStorage {
    /// Version of the layout storage format
    pub version: String,
    /// Array of saved layout configurations
    pub layouts: Vec<LayoutConfig>,
    /// Name of the last active layout
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_layout: Option<String>,
    /// Whether to restore last session on startup
    #[serde(default)]
    pub restore_last_session: bool,
}

impl Default for LayoutStorage {
    fn default() -> Self {
        Self {
            version: LAYOUT_STORAGE_VERSION.to_string(),
            layouts: Vec::new(),
            last_active_layout: None,
            restore_last_session: true,
        }
    }
}

/// Layout storage manager
pub struct LayoutStorageManager {
    storage_path: PathBuf,
}

impl LayoutStorageManager {
    /// Create a new layout storage manager
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;

        // Ensure directory exists
        if !app_data_dir.exists() {
            fs::create_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to create app data directory: {}", e))?;
        }

        let storage_path = app_data_dir.join("layouts.json");

        Ok(Self { storage_path })
    }

    /// Load layout storage from file
    pub fn load(&self) -> Result<LayoutStorage, String> {
        if !self.storage_path.exists() {
            return Ok(LayoutStorage::default());
        }

        let content = fs::read_to_string(&self.storage_path)
            .map_err(|e| format!("Failed to read layouts file: {}", e))?;

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse layouts file: {}", e))
    }

    /// Save layout storage to file
    pub fn save(&self, storage: &LayoutStorage) -> Result<(), String> {
        let content = serde_json::to_string_pretty(storage)
            .map_err(|e| format!("Failed to serialize layouts: {}", e))?;

        fs::write(&self.storage_path, content)
            .map_err(|e| format!("Failed to write layouts file: {}", e))?;

        Ok(())
    }

    /// Save a single layout (add or update)
    pub fn save_layout(&self, config: LayoutConfig) -> Result<(), String> {
        let mut storage = self.load()?;

        // Check if layout with same name exists
        if let Some(index) = storage.layouts.iter().position(|l| l.name == config.name) {
            // Check if trying to overwrite a built-in layout
            if storage.layouts[index].is_built_in == Some(true) && config.is_built_in != Some(true)
            {
                return Err(format!(
                    "Cannot overwrite built-in layout '{}'",
                    config.name
                ));
            }
            storage.layouts[index] = config;
        } else {
            storage.layouts.push(config);
        }

        self.save(&storage)
    }

    /// Load a single layout by name
    pub fn load_layout(&self, name: &str) -> Result<LayoutConfig, String> {
        let storage = self.load()?;

        storage
            .layouts
            .into_iter()
            .find(|l| l.name == name)
            .ok_or_else(|| format!("Layout '{}' not found", name))
    }

    /// List all layout names
    pub fn list_layouts(&self) -> Result<Vec<String>, String> {
        let storage = self.load()?;
        Ok(storage.layouts.iter().map(|l| l.name.clone()).collect())
    }

    /// Delete a layout by name
    pub fn delete_layout(&self, name: &str) -> Result<(), String> {
        let mut storage = self.load()?;

        // Check if layout exists and is not built-in
        let index = storage
            .layouts
            .iter()
            .position(|l| l.name == name)
            .ok_or_else(|| format!("Layout '{}' not found", name))?;

        if storage.layouts[index].is_built_in == Some(true) {
            return Err(format!("Cannot delete built-in layout '{}'", name));
        }

        storage.layouts.remove(index);
        self.save(&storage)
    }

    /// Set the last active layout
    pub fn set_last_active(&self, name: Option<String>) -> Result<(), String> {
        let mut storage = self.load()?;
        storage.last_active_layout = name;
        self.save(&storage)
    }

    /// Get the last active layout name
    pub fn get_last_active(&self) -> Result<Option<String>, String> {
        let storage = self.load()?;
        Ok(storage.last_active_layout)
    }

    /// Set restore last session preference
    pub fn set_restore_last_session(&self, restore: bool) -> Result<(), String> {
        let mut storage = self.load()?;
        storage.restore_last_session = restore;
        self.save(&storage)
    }

    /// Get restore last session preference
    pub fn get_restore_last_session(&self) -> Result<bool, String> {
        let storage = self.load()?;
        Ok(storage.restore_last_session)
    }
}

/// Check if a layout name is a built-in preset
pub fn is_built_in_layout(name: &str) -> bool {
    matches!(
        name,
        built_in_names::DEFAULT
            | built_in_names::COMPACT
            | built_in_names::DEBUG
            | built_in_names::MEMORY_FOCUS
    )
}

/// Check if a layout name is reserved
pub fn is_reserved_layout_name(name: &str) -> bool {
    name.starts_with('_') || is_built_in_layout(name)
}
