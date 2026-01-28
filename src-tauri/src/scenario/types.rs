//! Scenario Type Definitions
//!
//! Rust types matching the frontend TypeScript scenario types.

use serde::{Deserialize, Serialize};

/// A single timed memory write event in a scenario
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioEvent {
    /// Unique identifier (UUID)
    pub id: String,
    /// Time in seconds from simulation start
    pub time: f64,
    /// Modbus address (e.g., 'C:0x0001', 'H:0x0100')
    pub address: String,
    /// Value to write (0-65535 for registers, 0-1 for coils)
    pub value: u16,
    /// Whether the value persists after being set
    pub persist: bool,
    /// Auto-release duration in ms (when persist=false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persist_duration: Option<u64>,
    /// Description/note for this event
    pub note: String,
    /// Whether the event is enabled
    pub enabled: bool,
}

/// Scenario metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioMetadata {
    /// Scenario name
    pub name: String,
    /// Scenario description
    pub description: String,
    /// Creation timestamp (ISO 8601)
    pub created_at: String,
    /// Last update timestamp (ISO 8601)
    pub updated_at: String,
    /// Author name
    pub author: String,
}

/// Scenario execution settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioSettings {
    /// Whether to loop the scenario
    pub loop_enabled: bool,
    /// Number of loop iterations (0 = infinite)
    pub loop_count: u32,
    /// Delay between loops in ms
    pub loop_delay: u64,
    /// Whether to start automatically when loaded
    pub auto_start: bool,
}

/// Complete scenario definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scenario {
    /// Scenario metadata
    pub metadata: ScenarioMetadata,
    /// Execution settings
    pub settings: ScenarioSettings,
    /// Ordered list of events
    pub events: Vec<ScenarioEvent>,
}

impl Default for ScenarioMetadata {
    fn default() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            name: "Untitled Scenario".to_string(),
            description: String::new(),
            created_at: now.clone(),
            updated_at: now,
            author: String::new(),
        }
    }
}

impl Default for ScenarioSettings {
    fn default() -> Self {
        Self {
            loop_enabled: false,
            loop_count: 1,
            loop_delay: 0,
            auto_start: false,
        }
    }
}

impl Default for Scenario {
    fn default() -> Self {
        Self {
            metadata: ScenarioMetadata::default(),
            settings: ScenarioSettings::default(),
            events: Vec::new(),
        }
    }
}

/// CSV row structure for import/export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvEventRow {
    pub time: f64,
    pub address: String,
    pub value: u16,
    pub persist: bool,
    #[serde(default)]
    pub persist_duration: Option<u64>,
    #[serde(default)]
    pub note: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

impl From<&ScenarioEvent> for CsvEventRow {
    fn from(event: &ScenarioEvent) -> Self {
        Self {
            time: event.time,
            address: event.address.clone(),
            value: event.value,
            persist: event.persist,
            persist_duration: event.persist_duration,
            note: event.note.clone(),
            enabled: event.enabled,
        }
    }
}

impl CsvEventRow {
    /// Convert to ScenarioEvent with a generated UUID
    pub fn into_event(self) -> ScenarioEvent {
        ScenarioEvent {
            id: uuid::Uuid::new_v4().to_string(),
            time: self.time,
            address: self.address,
            value: self.value,
            persist: self.persist,
            persist_duration: self.persist_duration,
            note: self.note,
            enabled: self.enabled,
        }
    }
}
