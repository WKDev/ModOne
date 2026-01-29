//! OneSim Type Definitions
//!
//! Rust types matching the frontend TypeScript OneSim types for
//! PLC simulation including device memory, timer/counter state,
//! simulation configuration, and debugger interfaces.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Device Memory Configuration Types
// ============================================================================

/// Bit device types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SimBitDeviceType {
    /// P - Output Relay
    P,
    /// M - Internal Relay
    M,
    /// K - Keep Relay
    K,
    /// F - Special Relay (read-only)
    F,
    /// T - Timer Contact (read-only)
    T,
    /// C - Counter Contact (read-only)
    C,
}

impl SimBitDeviceType {
    /// Get the device letter
    pub fn as_str(&self) -> &'static str {
        match self {
            SimBitDeviceType::P => "P",
            SimBitDeviceType::M => "M",
            SimBitDeviceType::K => "K",
            SimBitDeviceType::F => "F",
            SimBitDeviceType::T => "T",
            SimBitDeviceType::C => "C",
        }
    }

    /// Get the default size for this device type
    pub fn default_size(&self) -> u32 {
        match self {
            SimBitDeviceType::P => 2048,
            SimBitDeviceType::M => 8192,
            SimBitDeviceType::K => 2048,
            SimBitDeviceType::F => 2048,
            SimBitDeviceType::T => 2048,
            SimBitDeviceType::C => 2048,
        }
    }

    /// Check if this device is read-only
    pub fn is_readonly(&self) -> bool {
        matches!(self, SimBitDeviceType::F | SimBitDeviceType::T | SimBitDeviceType::C)
    }
}

/// Word device types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SimWordDeviceType {
    /// D - Data Register
    D,
    /// R - Retentive Data Register
    R,
    /// Z - Index Register
    Z,
    /// N - Constant Register
    N,
    /// TD - Timer Current Value
    #[serde(rename = "TD")]
    Td,
    /// CD - Counter Current Value
    #[serde(rename = "CD")]
    Cd,
}

impl SimWordDeviceType {
    /// Get the device identifier
    pub fn as_str(&self) -> &'static str {
        match self {
            SimWordDeviceType::D => "D",
            SimWordDeviceType::R => "R",
            SimWordDeviceType::Z => "Z",
            SimWordDeviceType::N => "N",
            SimWordDeviceType::Td => "TD",
            SimWordDeviceType::Cd => "CD",
        }
    }

    /// Get the default size for this device type
    pub fn default_size(&self) -> u32 {
        match self {
            SimWordDeviceType::D => 10000,
            SimWordDeviceType::R => 10000,
            SimWordDeviceType::Z => 16,
            SimWordDeviceType::N => 8192,
            SimWordDeviceType::Td => 2048,
            SimWordDeviceType::Cd => 2048,
        }
    }
}

/// Bit device configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BitDeviceConfig {
    /// Device type
    #[serde(rename = "type")]
    pub device_type: SimBitDeviceType,
    /// Number of addresses available
    pub size: u32,
    /// Whether device is read-only
    pub readonly: bool,
    /// Device description
    pub description: String,
}

/// Word device configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordDeviceConfig {
    /// Device type
    #[serde(rename = "type")]
    pub device_type: SimWordDeviceType,
    /// Number of addresses available
    pub size: u32,
    /// Device description
    pub description: String,
}

// ============================================================================
// Timer Types
// ============================================================================

/// Timer instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SimTimerType {
    /// On-delay timer
    Ton,
    /// Off-delay timer
    Tof,
    /// Accumulating timer
    Tmr,
}

/// Time base options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SimTimeBase {
    /// 1 millisecond
    Ms,
    /// 10 milliseconds
    #[serde(rename = "10ms")]
    Ms10,
    /// 100 milliseconds
    #[serde(rename = "100ms")]
    Ms100,
    /// 1 second
    S,
}

impl SimTimeBase {
    /// Convert to milliseconds multiplier
    pub fn to_ms(&self) -> u32 {
        match self {
            SimTimeBase::Ms => 1,
            SimTimeBase::Ms10 => 10,
            SimTimeBase::Ms100 => 100,
            SimTimeBase::S => 1000,
        }
    }
}

/// Timer runtime state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerState {
    /// Whether timer input is enabled
    pub enabled: bool,
    /// Whether timer has completed (done bit)
    pub done: bool,
    /// Elapsed time in milliseconds
    pub elapsed: u64,
    /// Preset time in time base units
    pub preset: u32,
    /// Time base for preset
    pub time_base: SimTimeBase,
    /// Timer type
    pub timer_type: SimTimerType,
}

impl Default for TimerState {
    fn default() -> Self {
        Self {
            enabled: false,
            done: false,
            elapsed: 0,
            preset: 1000,
            time_base: SimTimeBase::Ms,
            timer_type: SimTimerType::Ton,
        }
    }
}

// ============================================================================
// Counter Types
// ============================================================================

/// Counter instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SimCounterType {
    /// Count up
    Ctu,
    /// Count down
    Ctd,
    /// Count up/down
    Ctud,
}

/// Counter runtime state
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CounterState {
    /// Whether counter has reached preset (done bit)
    pub done: bool,
    /// Current count value
    pub current_value: i32,
    /// Preset value
    pub preset: i32,
    /// Previous state of count-up input (for edge detection)
    pub prev_up: bool,
    /// Previous state of count-down input (for CTUD)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prev_down: Option<bool>,
    /// Previous state of reset input (for edge detection)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prev_reset: Option<bool>,
    /// Counter type
    pub counter_type: SimCounterType,
}

impl Default for CounterState {
    fn default() -> Self {
        Self {
            done: false,
            current_value: 0,
            preset: 10,
            prev_up: false,
            prev_down: None,
            prev_reset: Some(false),
            counter_type: SimCounterType::Ctu,
        }
    }
}

// ============================================================================
// Simulation Configuration Types
// ============================================================================

/// Synchronization mode for memory updates
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncMode {
    /// Update memory immediately
    Immediate,
    /// Update memory at end of scan
    EndOfScan,
    /// Manual synchronization
    Manual,
}

/// Simulation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationConfig {
    /// Target scan time in milliseconds
    pub scan_time_ms: u32,
    /// Watchdog timeout in milliseconds
    pub watchdog_timeout_ms: u32,
    /// Memory synchronization mode
    pub sync_mode: SyncMode,
    /// Maximum history entries for watch variables
    pub max_watch_history: usize,
    /// Enable detailed timing statistics
    pub enable_timing_stats: bool,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            scan_time_ms: 10,
            watchdog_timeout_ms: 1000,
            sync_mode: SyncMode::EndOfScan,
            max_watch_history: 100,
            enable_timing_stats: true,
        }
    }
}

// ============================================================================
// Simulation Status Types
// ============================================================================

/// Simulation runtime state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SimulationState {
    /// Simulation stopped
    Stopped,
    /// Simulation running
    Running,
    /// Simulation paused
    Paused,
    /// Simulation error
    Error,
}

/// Simulation runtime status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationStatus {
    /// Current simulation state
    pub state: SimulationState,
    /// Total number of scan cycles executed
    pub scan_count: u64,
    /// Last scan cycle time in microseconds
    pub last_scan_time_us: u64,
    /// Average scan cycle time in microseconds
    pub avg_scan_time_us: u64,
    /// Maximum scan cycle time in microseconds
    pub max_scan_time_us: u64,
    /// Minimum scan cycle time in microseconds
    pub min_scan_time_us: u64,
    /// Error message if state is 'error'
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Timestamp of last status update (ISO 8601)
    pub last_update_time: String,
}

impl Default for SimulationStatus {
    fn default() -> Self {
        Self {
            state: SimulationState::Stopped,
            scan_count: 0,
            last_scan_time_us: 0,
            avg_scan_time_us: 0,
            max_scan_time_us: 0,
            min_scan_time_us: 0,
            error: None,
            last_update_time: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Scan cycle information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCycleInfo {
    /// Total cycle count
    pub cycle_count: u64,
    /// Last scan time in microseconds
    pub last_scan_time: u64,
    /// Average scan time in microseconds
    pub average_scan_time: u64,
    /// Maximum scan time in microseconds
    pub max_scan_time: u64,
    /// Timestamp of this info (epoch ms)
    pub timestamp: u64,
}

// ============================================================================
// Debugger Types
// ============================================================================

/// Breakpoint types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BreakpointType {
    /// Break at network
    Network,
    /// Break on device value change
    Device,
    /// Break on condition
    Condition,
    /// Break at scan count
    ScanCount,
}

/// Breakpoint definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Breakpoint {
    /// Unique identifier
    pub id: String,
    /// Breakpoint type
    #[serde(rename = "type")]
    pub breakpoint_type: BreakpointType,
    /// Whether breakpoint is enabled
    pub enabled: bool,
    /// Network ID for network breakpoints
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_id: Option<u32>,
    /// Device address for device breakpoints
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_address: Option<String>,
    /// Condition expression for condition breakpoints
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    /// Scan count for scanCount breakpoints
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scan_count: Option<u64>,
    /// Hit count
    pub hit_count: u32,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl Breakpoint {
    /// Create a new breakpoint
    pub fn new(breakpoint_type: BreakpointType) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            breakpoint_type,
            enabled: true,
            network_id: None,
            device_address: None,
            condition: None,
            scan_count: None,
            hit_count: 0,
            description: None,
        }
    }

    /// Check if this is a conditional breakpoint
    pub fn is_conditional(&self) -> bool {
        self.breakpoint_type == BreakpointType::Condition && self.condition.is_some()
    }
}

/// Value history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueHistoryEntry {
    /// Value (number or boolean serialized)
    pub value: serde_json::Value,
    /// Timestamp (epoch ms)
    pub timestamp: u64,
}

/// Watch variable for monitoring device values
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchVariable {
    /// Device address
    pub address: String,
    /// Current value (number or boolean)
    pub current_value: serde_json::Value,
    /// Previous value (number or boolean)
    pub previous_value: serde_json::Value,
    /// Number of times the value has changed
    pub change_count: u32,
    /// Timestamp of last change (epoch ms)
    pub last_change_time: u64,
    /// Value history (newest first)
    pub history: Vec<ValueHistoryEntry>,
    /// Maximum history length
    pub max_history: usize,
}

impl WatchVariable {
    /// Create a new watch variable
    pub fn new(address: String, initial_value: serde_json::Value, max_history: usize) -> Self {
        let now = chrono::Utc::now().timestamp_millis() as u64;
        Self {
            address,
            current_value: initial_value.clone(),
            previous_value: initial_value.clone(),
            change_count: 0,
            last_change_time: now,
            history: vec![ValueHistoryEntry {
                value: initial_value,
                timestamp: now,
            }],
            max_history,
        }
    }

    /// Update with a new value
    pub fn update(&mut self, new_value: serde_json::Value) {
        if self.current_value != new_value {
            let now = chrono::Utc::now().timestamp_millis() as u64;
            self.previous_value = self.current_value.clone();
            self.current_value = new_value.clone();
            self.change_count += 1;
            self.last_change_time = now;

            // Add to history (front)
            self.history.insert(0, ValueHistoryEntry {
                value: new_value,
                timestamp: now,
            });

            // Truncate history
            if self.history.len() > self.max_history {
                self.history.truncate(self.max_history);
            }
        }
    }
}

// ============================================================================
// Memory Snapshot Types
// ============================================================================

/// Memory snapshot for state capture/restore
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySnapshot {
    /// Snapshot ID
    pub id: String,
    /// Snapshot name
    pub name: String,
    /// Timestamp (ISO 8601)
    pub timestamp: String,
    /// Bit device memory (device type -> address -> value)
    pub bit_devices: HashMap<String, HashMap<u32, bool>>,
    /// Word device memory (device type -> address -> value)
    pub word_devices: HashMap<String, HashMap<u32, i32>>,
    /// Timer states
    pub timer_states: HashMap<u32, TimerState>,
    /// Counter states
    pub counter_states: HashMap<u32, CounterState>,
    /// Scan count at snapshot time
    pub scan_count: u64,
}

impl Default for MemorySnapshot {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Snapshot".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            bit_devices: HashMap::new(),
            word_devices: HashMap::new(),
            timer_states: HashMap::new(),
            counter_states: HashMap::new(),
            scan_count: 0,
        }
    }
}

// ============================================================================
// Event Types
// ============================================================================

/// Simulation status change event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimStatusChangedEvent {
    /// Previous state
    pub previous_state: SimulationState,
    /// New state
    pub new_state: SimulationState,
    /// Timestamp
    pub timestamp: String,
}

/// Breakpoint hit event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointHitEvent {
    /// Breakpoint that was hit
    pub breakpoint: Breakpoint,
    /// Scan count when hit
    pub scan_count: u64,
    /// Timestamp
    pub timestamp: String,
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timer_state_serialization() {
        let state = TimerState::default();
        let json = serde_json::to_string(&state).unwrap();
        let parsed: TimerState = serde_json::from_str(&json).unwrap();
        assert_eq!(state.enabled, parsed.enabled);
        assert_eq!(state.preset, parsed.preset);
    }

    #[test]
    fn test_counter_state_serialization() {
        let state = CounterState::default();
        let json = serde_json::to_string(&state).unwrap();
        let parsed: CounterState = serde_json::from_str(&json).unwrap();
        assert_eq!(state.current_value, parsed.current_value);
        assert_eq!(state.preset, parsed.preset);
    }

    #[test]
    fn test_simulation_config_default() {
        let config = SimulationConfig::default();
        assert_eq!(config.scan_time_ms, 10);
        assert_eq!(config.watchdog_timeout_ms, 1000);
    }

    #[test]
    fn test_breakpoint_creation() {
        let bp = Breakpoint::new(BreakpointType::Network);
        assert!(bp.enabled);
        assert_eq!(bp.hit_count, 0);
        assert!(!bp.id.is_empty());
    }

    #[test]
    fn test_watch_variable_update() {
        let mut watch = WatchVariable::new(
            "M0000".to_string(),
            serde_json::json!(false),
            10,
        );

        watch.update(serde_json::json!(true));
        assert_eq!(watch.change_count, 1);
        assert_eq!(watch.current_value, serde_json::json!(true));
        assert_eq!(watch.previous_value, serde_json::json!(false));
        assert_eq!(watch.history.len(), 2);
    }

    #[test]
    fn test_time_base_conversion() {
        assert_eq!(SimTimeBase::Ms.to_ms(), 1);
        assert_eq!(SimTimeBase::Ms10.to_ms(), 10);
        assert_eq!(SimTimeBase::Ms100.to_ms(), 100);
        assert_eq!(SimTimeBase::S.to_ms(), 1000);
    }
}
