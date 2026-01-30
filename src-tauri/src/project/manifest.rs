//! Project manifest types for folder-based projects (v2.0)
//!
//! The new manifest format is a YAML file that contains only metadata,
//! while actual project data is stored in a folder structure alongside the manifest.

use chrono::Utc;
use serde::{Deserialize, Serialize};

use super::config::{
    AutoSaveSettings, MemoryMapSettings, ModbusSettings, PlcSettings, ProjectSettings,
};

/// Current manifest version
pub const MANIFEST_VERSION: &str = "2.0";

/// Default directory names
pub const DEFAULT_CANVAS_DIR: &str = "canvas";
pub const DEFAULT_LADDER_DIR: &str = "ladder";
pub const DEFAULT_SCENARIO_DIR: &str = "scenario";

/// Project manifest file (v2.0)
///
/// This is the new format for .mop files - a simple YAML file containing
/// project metadata, with actual data stored in adjacent directories.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectManifest {
    /// Manifest format version
    pub manifest_version: String,

    /// Project metadata
    pub project: ProjectSettings,

    /// Directory configuration
    pub directories: DirectoryConfig,

    /// PLC settings
    pub plc: PlcSettings,

    /// Modbus communication settings
    pub modbus: ModbusSettings,

    /// Memory map settings
    pub memory_map: MemoryMapSettings,

    /// Auto-save settings
    #[serde(default)]
    pub auto_save: AutoSaveSettings,
}

impl ProjectManifest {
    /// Create a new manifest with default settings
    pub fn new(name: &str) -> Self {
        let now = Utc::now();
        Self {
            manifest_version: MANIFEST_VERSION.to_string(),
            project: ProjectSettings {
                name: name.to_string(),
                description: String::new(),
                created_at: now,
                updated_at: now,
            },
            directories: DirectoryConfig::default(),
            plc: PlcSettings::default(),
            modbus: ModbusSettings::default(),
            memory_map: MemoryMapSettings::default(),
            auto_save: AutoSaveSettings::default(),
        }
    }

    /// Create a manifest from an existing ProjectConfig (for migration)
    pub fn from_legacy_config(config: &super::config::ProjectConfig) -> Self {
        Self {
            manifest_version: MANIFEST_VERSION.to_string(),
            project: config.project.clone(),
            directories: DirectoryConfig::default(),
            plc: config.plc.clone(),
            modbus: config.modbus.clone(),
            memory_map: config.memory_map.clone(),
            auto_save: config.auto_save.clone(),
        }
    }

    /// Convert manifest to legacy ProjectConfig format (for compatibility)
    pub fn to_legacy_config(&self) -> super::config::ProjectConfig {
        super::config::ProjectConfig {
            version: "1.0".to_string(), // Legacy version string
            project: self.project.clone(),
            plc: self.plc.clone(),
            modbus: self.modbus.clone(),
            memory_map: self.memory_map.clone(),
            auto_save: self.auto_save.clone(),
        }
    }

    /// Check if this is a v2.0 manifest
    pub fn is_v2(&self) -> bool {
        self.manifest_version.starts_with("2.")
    }

    /// Update the updated_at timestamp
    pub fn touch(&mut self) {
        self.project.updated_at = Utc::now();
    }
}

impl Default for ProjectManifest {
    fn default() -> Self {
        Self::new("")
    }
}

/// Directory configuration for project folders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryConfig {
    /// Canvas diagrams directory name (relative to project root)
    pub canvas: String,

    /// Ladder logic directory name (relative to project root)
    pub ladder: String,

    /// Scenario files directory name (relative to project root)
    pub scenario: String,
}

impl Default for DirectoryConfig {
    fn default() -> Self {
        Self {
            canvas: DEFAULT_CANVAS_DIR.to_string(),
            ladder: DEFAULT_LADDER_DIR.to_string(),
            scenario: DEFAULT_SCENARIO_DIR.to_string(),
        }
    }
}

impl DirectoryConfig {
    /// Create custom directory configuration
    pub fn custom(canvas: &str, ladder: &str, scenario: &str) -> Self {
        Self {
            canvas: canvas.to_string(),
            ladder: ladder.to_string(),
            scenario: scenario.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_new() {
        let manifest = ProjectManifest::new("Test Project");
        assert_eq!(manifest.manifest_version, MANIFEST_VERSION);
        assert_eq!(manifest.project.name, "Test Project");
        assert!(manifest.is_v2());
    }

    #[test]
    fn test_directory_config_default() {
        let config = DirectoryConfig::default();
        assert_eq!(config.canvas, DEFAULT_CANVAS_DIR);
        assert_eq!(config.ladder, DEFAULT_LADDER_DIR);
        assert_eq!(config.scenario, DEFAULT_SCENARIO_DIR);
    }

    #[test]
    fn test_yaml_serialization() {
        let manifest = ProjectManifest::new("Test Project");
        let yaml = serde_yaml::to_string(&manifest).unwrap();

        assert!(yaml.contains("manifest_version: '2.0'") || yaml.contains("manifest_version: \"2.0\""));
        assert!(yaml.contains("name: Test Project"));
        assert!(yaml.contains("canvas:"));
        assert!(yaml.contains("ladder:"));
        assert!(yaml.contains("scenario:"));
    }

    #[test]
    fn test_yaml_roundtrip() {
        let manifest = ProjectManifest::new("Roundtrip Test");
        let yaml = serde_yaml::to_string(&manifest).unwrap();
        let parsed: ProjectManifest = serde_yaml::from_str(&yaml).unwrap();

        assert_eq!(parsed.manifest_version, manifest.manifest_version);
        assert_eq!(parsed.project.name, manifest.project.name);
        assert_eq!(parsed.directories.canvas, manifest.directories.canvas);
    }

    #[test]
    fn test_touch() {
        let mut manifest = ProjectManifest::new("Touch Test");
        let original_updated = manifest.project.updated_at;

        std::thread::sleep(std::time::Duration::from_millis(10));
        manifest.touch();

        assert!(manifest.project.updated_at > original_updated);
    }

    #[test]
    fn test_legacy_conversion() {
        let legacy = super::super::config::ProjectConfig::new("Legacy Project");
        let manifest = ProjectManifest::from_legacy_config(&legacy);

        assert_eq!(manifest.manifest_version, MANIFEST_VERSION);
        assert_eq!(manifest.project.name, "Legacy Project");

        let converted_back = manifest.to_legacy_config();
        assert_eq!(converted_back.project.name, "Legacy Project");
        assert_eq!(converted_back.version, "1.0");
    }
}
