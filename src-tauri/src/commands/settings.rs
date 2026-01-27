//! Tauri command handlers for application settings
//!
//! This module provides the IPC interface for loading and saving
//! application-wide settings to the app data directory.

use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

// ============================================================================
// Settings Types
// ============================================================================

/// Application-wide settings
/// Must match the TypeScript AppSettings interface in src/types/settings.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    // General settings
    pub language: Language,
    pub auto_save_interval: u32,
    pub start_with_last_project: bool,
    pub telemetry_enabled: bool,

    // Simulation settings
    pub default_scan_time_ms: u32,
    pub timer_precision: TimerPrecision,
    pub simulation_speed_multiplier: f32,
    pub step_execution_mode: StepExecutionMode,

    // Modbus settings
    pub default_tcp_port: u16,
    pub rtu_com_port: String,
    pub rtu_baud_rate: u32,
    pub rtu_parity: Parity,
    pub rtu_stop_bits: u8,
    pub connection_timeout_ms: u32,
    pub auto_reconnect: bool,

    // Appearance settings
    pub theme: Theme,
    pub font_size: u8,
    pub grid_display: bool,
    pub animation_enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Ko,
    En,
    Ja,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimerPrecision {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StepExecutionMode {
    SingleStep,
    UntilBreakpoint,
    Continuous,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Parity {
    None,
    Odd,
    Even,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            // General
            language: Language::Ko,
            auto_save_interval: 60,
            start_with_last_project: true,
            telemetry_enabled: false,

            // Simulation
            default_scan_time_ms: 10,
            timer_precision: TimerPrecision::Medium,
            simulation_speed_multiplier: 1.0,
            step_execution_mode: StepExecutionMode::Continuous,

            // Modbus
            default_tcp_port: 502,
            rtu_com_port: String::new(),
            rtu_baud_rate: 9600,
            rtu_parity: Parity::None,
            rtu_stop_bits: 1,
            connection_timeout_ms: 3000,
            auto_reconnect: true,

            // Appearance
            theme: Theme::System,
            font_size: 14,
            grid_display: true,
            animation_enabled: true,
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

const SETTINGS_FILE: &str = "settings.json";

/// Get the path to the settings file in the app data directory
fn get_settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data_dir.join(SETTINGS_FILE))
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Load application settings from disk
///
/// Returns default settings if the settings file doesn't exist.
#[tauri::command]
pub async fn get_app_settings(app_handle: AppHandle) -> Result<AppSettings, String> {
    let settings_path = get_settings_path(&app_handle)?;

    if !settings_path.exists() {
        log::info!("Settings file not found, using defaults");
        return Ok(AppSettings::default());
    }

    let file = File::open(&settings_path)
        .map_err(|e| format!("Failed to open settings file: {}", e))?;

    let reader = BufReader::new(file);
    let settings: AppSettings = serde_json::from_reader(reader)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    log::info!("Loaded settings from {:?}", settings_path);
    Ok(settings)
}

/// Save application settings to disk
#[tauri::command]
pub async fn save_app_settings(
    app_handle: AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    let settings_path = get_settings_path(&app_handle)?;

    // Create parent directories if needed
    if let Some(parent) = settings_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    let file = File::create(&settings_path)
        .map_err(|e| format!("Failed to create settings file: {}", e))?;

    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, &settings)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    log::info!("Saved settings to {:?}", settings_path);
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let settings = AppSettings::default();
        assert_eq!(settings.language, Language::Ko);
        assert_eq!(settings.auto_save_interval, 60);
        assert_eq!(settings.default_tcp_port, 502);
        assert_eq!(settings.theme, Theme::System);
    }

    #[test]
    fn test_settings_serialization() {
        let settings = AppSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: AppSettings = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.language, settings.language);
        assert_eq!(parsed.auto_save_interval, settings.auto_save_interval);
        assert_eq!(parsed.theme, settings.theme);
    }

    #[test]
    fn test_language_serialization() {
        assert_eq!(serde_json::to_string(&Language::Ko).unwrap(), "\"ko\"");
        assert_eq!(serde_json::to_string(&Language::En).unwrap(), "\"en\"");
        assert_eq!(serde_json::to_string(&Language::Ja).unwrap(), "\"ja\"");
    }

    #[test]
    fn test_theme_serialization() {
        assert_eq!(serde_json::to_string(&Theme::Light).unwrap(), "\"light\"");
        assert_eq!(serde_json::to_string(&Theme::Dark).unwrap(), "\"dark\"");
        assert_eq!(serde_json::to_string(&Theme::System).unwrap(), "\"system\"");
    }

    #[test]
    fn test_step_execution_mode_serialization() {
        assert_eq!(
            serde_json::to_string(&StepExecutionMode::SingleStep).unwrap(),
            "\"single-step\""
        );
        assert_eq!(
            serde_json::to_string(&StepExecutionMode::UntilBreakpoint).unwrap(),
            "\"until-breakpoint\""
        );
        assert_eq!(
            serde_json::to_string(&StepExecutionMode::Continuous).unwrap(),
            "\"continuous\""
        );
    }
}
