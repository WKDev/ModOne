//! Debugger Module
//!
//! Provides debugging capabilities for the PLC simulation including:
//! - Breakpoint management (network, device, condition, scan count)
//! - Watch variable tracking
//! - Step execution control (network-level and scan-level)

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

use super::memory::DeviceMemory;
use super::types::{Breakpoint, BreakpointType, SimBitDeviceType, SimWordDeviceType, WatchVariable};

// ============================================================================
// Types
// ============================================================================

/// Step execution type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StepType {
    /// Step one network at a time
    Network,
    /// Step one complete scan cycle
    Scan,
}

impl Default for StepType {
    fn default() -> Self {
        StepType::Network
    }
}

/// Represents a breakpoint that was hit during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum BreakpointHit {
    /// Network breakpoint was hit
    #[serde(rename = "network")]
    Network {
        breakpoint_id: String,
        network_id: u32,
    },
    /// Device value change breakpoint was hit
    #[serde(rename = "device")]
    Device {
        breakpoint_id: String,
        address: String,
        old_value: serde_json::Value,
        new_value: serde_json::Value,
    },
    /// Condition breakpoint was hit
    #[serde(rename = "condition")]
    Condition {
        breakpoint_id: String,
        condition: String,
    },
    /// Scan count breakpoint was hit
    #[serde(rename = "scanCount")]
    ScanCount {
        breakpoint_id: String,
        scan_count: u64,
    },
}

/// Result of a step operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepResult {
    /// Whether the step completed successfully
    pub success: bool,
    /// The step type that was executed
    pub step_type: StepType,
    /// Network ID that was executed (for Network step)
    pub network_id: Option<u32>,
    /// Current scan count after step
    pub scan_count: u64,
    /// Breakpoint hit during step (if any)
    pub breakpoint_hit: Option<BreakpointHit>,
}

/// Debugger error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DebuggerError {
    /// Breakpoint not found
    BreakpointNotFound(String),
    /// Watch variable not found
    WatchNotFound(String),
    /// Invalid condition expression
    InvalidCondition(String),
    /// Debugger is not paused
    NotPaused,
    /// Other error
    Other(String),
}

impl std::fmt::Display for DebuggerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DebuggerError::BreakpointNotFound(id) => write!(f, "Breakpoint not found: {}", id),
            DebuggerError::WatchNotFound(addr) => write!(f, "Watch variable not found: {}", addr),
            DebuggerError::InvalidCondition(expr) => write!(f, "Invalid condition: {}", expr),
            DebuggerError::NotPaused => write!(f, "Debugger is not paused"),
            DebuggerError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for DebuggerError {}

pub type DebuggerResult<T> = Result<T, DebuggerError>;

// ============================================================================
// SimDebugger
// ============================================================================

/// PLC Simulation Debugger
///
/// Manages breakpoints, watch variables, and step execution for debugging
/// the PLC simulation.
pub struct SimDebugger {
    /// Collection of breakpoints
    breakpoints: RwLock<Vec<Breakpoint>>,
    /// Watch variables indexed by address
    watches: RwLock<HashMap<String, WatchVariable>>,
    /// Whether step mode is enabled
    step_mode: AtomicBool,
    /// Current step type
    step_type: RwLock<StepType>,
    /// Breakpoint that caused the pause (if any)
    paused_at: RwLock<Option<BreakpointHit>>,
    /// Maximum history entries for watch variables
    max_watch_history: usize,
}

impl Default for SimDebugger {
    fn default() -> Self {
        Self::new(100)
    }
}

impl SimDebugger {
    /// Create a new debugger instance
    pub fn new(max_watch_history: usize) -> Self {
        Self {
            breakpoints: RwLock::new(Vec::new()),
            watches: RwLock::new(HashMap::new()),
            step_mode: AtomicBool::new(false),
            step_type: RwLock::new(StepType::default()),
            paused_at: RwLock::new(None),
            max_watch_history,
        }
    }

    // ========================================================================
    // Breakpoint Management
    // ========================================================================

    /// Add a new breakpoint
    pub fn add_breakpoint(&self, breakpoint: Breakpoint) -> String {
        let id = breakpoint.id.clone();
        self.breakpoints.write().push(breakpoint);
        id
    }

    /// Remove a breakpoint by ID
    pub fn remove_breakpoint(&self, id: &str) -> DebuggerResult<()> {
        let mut breakpoints = self.breakpoints.write();
        let idx = breakpoints
            .iter()
            .position(|bp| bp.id == id)
            .ok_or_else(|| DebuggerError::BreakpointNotFound(id.to_string()))?;
        breakpoints.remove(idx);
        Ok(())
    }

    /// Enable or disable a breakpoint
    pub fn set_breakpoint_enabled(&self, id: &str, enabled: bool) -> DebuggerResult<()> {
        let mut breakpoints = self.breakpoints.write();
        let bp = breakpoints
            .iter_mut()
            .find(|bp| bp.id == id)
            .ok_or_else(|| DebuggerError::BreakpointNotFound(id.to_string()))?;
        bp.enabled = enabled;
        Ok(())
    }

    /// Get all breakpoints
    pub fn get_breakpoints(&self) -> Vec<Breakpoint> {
        self.breakpoints.read().clone()
    }

    /// Clear all breakpoints
    pub fn clear_breakpoints(&self) {
        self.breakpoints.write().clear();
    }

    // ========================================================================
    // Breakpoint Checking
    // ========================================================================

    /// Check if any breakpoint should trigger before network execution
    pub fn check_before_network(
        &self,
        network_id: u32,
        scan_count: u64,
        memory: &DeviceMemory,
    ) -> Option<BreakpointHit> {
        let mut breakpoints = self.breakpoints.write();

        for bp in breakpoints.iter_mut().filter(|b| b.enabled) {
            match bp.breakpoint_type {
                BreakpointType::Network => {
                    if bp.network_id == Some(network_id) {
                        bp.hit_count += 1;
                        return Some(BreakpointHit::Network {
                            breakpoint_id: bp.id.clone(),
                            network_id,
                        });
                    }
                }
                BreakpointType::ScanCount => {
                    if bp.scan_count == Some(scan_count) {
                        bp.hit_count += 1;
                        return Some(BreakpointHit::ScanCount {
                            breakpoint_id: bp.id.clone(),
                            scan_count,
                        });
                    }
                }
                BreakpointType::Condition => {
                    if let Some(ref cond) = bp.condition {
                        if self.evaluate_condition(cond, memory) {
                            bp.hit_count += 1;
                            return Some(BreakpointHit::Condition {
                                breakpoint_id: bp.id.clone(),
                                condition: cond.clone(),
                            });
                        }
                    }
                }
                BreakpointType::Device => {
                    // Device breakpoints are checked separately via check_device_change
                }
            }
        }

        None
    }

    /// Check device breakpoints after a memory write
    pub fn check_device_change(
        &self,
        address: &str,
        old_value: serde_json::Value,
        new_value: serde_json::Value,
    ) -> Option<BreakpointHit> {
        // Only trigger if value actually changed
        if old_value == new_value {
            return None;
        }

        let mut breakpoints = self.breakpoints.write();

        for bp in breakpoints.iter_mut().filter(|b| b.enabled) {
            if bp.breakpoint_type == BreakpointType::Device {
                if bp.device_address.as_deref() == Some(address) {
                    bp.hit_count += 1;
                    return Some(BreakpointHit::Device {
                        breakpoint_id: bp.id.clone(),
                        address: address.to_string(),
                        old_value,
                        new_value,
                    });
                }
            }
        }

        None
    }

    /// Evaluate a condition expression
    ///
    /// Supports simple expressions like:
    /// - "D0001 > 100"
    /// - "M0000 == 1"
    /// - "D0010 != 0"
    fn evaluate_condition(&self, condition: &str, memory: &DeviceMemory) -> bool {
        // Parse condition: DEVICE OP VALUE
        let parts: Vec<&str> = condition.split_whitespace().collect();
        if parts.len() != 3 {
            return false;
        }

        let device_addr = parts[0];
        let operator = parts[1];
        let target_value: i32 = match parts[2].parse() {
            Ok(v) => v,
            Err(_) => return false,
        };

        // Read device value
        let device_value = self.read_device_value(device_addr, memory);

        // Compare
        match operator {
            "==" => device_value == target_value,
            "!=" => device_value != target_value,
            ">" => device_value > target_value,
            "<" => device_value < target_value,
            ">=" => device_value >= target_value,
            "<=" => device_value <= target_value,
            _ => false,
        }
    }

    /// Parse a device address string into bit device type and address
    fn parse_bit_device(address: &str) -> Option<(SimBitDeviceType, u16)> {
        if address.len() < 2 {
            return None;
        }

        let device_char = address.chars().next()?.to_ascii_uppercase();
        let addr_str = &address[1..];
        let addr: u16 = addr_str.parse().ok()?;

        let device_type = match device_char {
            'P' => SimBitDeviceType::P,
            'M' => SimBitDeviceType::M,
            'K' => SimBitDeviceType::K,
            'F' => SimBitDeviceType::F,
            'T' => SimBitDeviceType::T,
            'C' => SimBitDeviceType::C,
            _ => return None,
        };

        Some((device_type, addr))
    }

    /// Parse a device address string into word device type and address
    fn parse_word_device(address: &str) -> Option<(SimWordDeviceType, u16)> {
        if address.len() < 2 {
            return None;
        }

        let upper = address.to_uppercase();

        // Check for two-letter device types first (TD, CD)
        if upper.len() >= 3 {
            if upper.starts_with("TD") {
                let addr: u16 = upper[2..].parse().ok()?;
                return Some((SimWordDeviceType::Td, addr));
            }
            if upper.starts_with("CD") {
                let addr: u16 = upper[2..].parse().ok()?;
                return Some((SimWordDeviceType::Cd, addr));
            }
        }

        let device_char = upper.chars().next()?;
        let addr_str = &upper[1..];
        let addr: u16 = addr_str.parse().ok()?;

        let device_type = match device_char {
            'D' => SimWordDeviceType::D,
            'R' => SimWordDeviceType::R,
            'Z' => SimWordDeviceType::Z,
            'N' => SimWordDeviceType::N,
            _ => return None,
        };

        Some((device_type, addr))
    }

    /// Read a device value from memory as i32
    fn read_device_value(&self, address: &str, memory: &DeviceMemory) -> i32 {
        // Parse address (e.g., "M0000", "D0001")
        if address.is_empty() {
            return 0;
        }

        // Try bit device first
        if let Some((device_type, addr)) = Self::parse_bit_device(address) {
            return if memory.read_bit(device_type, addr).unwrap_or(false) {
                1
            } else {
                0
            };
        }

        // Try word device
        if let Some((device_type, addr)) = Self::parse_word_device(address) {
            return memory.read_word(device_type, addr).unwrap_or(0) as i32;
        }

        0
    }

    // ========================================================================
    // Watch Variable Management
    // ========================================================================

    /// Add a watch variable
    pub fn add_watch(&self, address: &str, memory: &DeviceMemory) {
        let initial_value = self.read_device_json_value(address, memory);
        let watch = WatchVariable::new(
            address.to_string(),
            initial_value,
            self.max_watch_history,
        );
        self.watches.write().insert(address.to_string(), watch);
    }

    /// Remove a watch variable
    pub fn remove_watch(&self, address: &str) -> DebuggerResult<()> {
        self.watches
            .write()
            .remove(address)
            .map(|_| ())
            .ok_or_else(|| DebuggerError::WatchNotFound(address.to_string()))
    }

    /// Get all watch variables
    pub fn get_watches(&self) -> Vec<WatchVariable> {
        self.watches.read().values().cloned().collect()
    }

    /// Update a single watch variable
    pub fn update_watch(&self, address: &str, memory: &DeviceMemory) {
        if let Some(watch) = self.watches.write().get_mut(address) {
            let new_value = self.read_device_json_value(address, memory);
            watch.update(new_value);
        }
    }

    /// Update all watch variables
    pub fn update_all_watches(&self, memory: &DeviceMemory) {
        let mut watches = self.watches.write();
        for (address, watch) in watches.iter_mut() {
            let new_value = self.read_device_json_value(address, memory);
            watch.update(new_value);
        }
    }

    /// Clear all watch variables
    pub fn clear_watches(&self) {
        self.watches.write().clear();
    }

    /// Read device value as JSON for watch variables
    fn read_device_json_value(&self, address: &str, memory: &DeviceMemory) -> serde_json::Value {
        if address.is_empty() {
            return serde_json::Value::Null;
        }

        // Try bit device first
        if let Some((device_type, addr)) = Self::parse_bit_device(address) {
            let value = memory.read_bit(device_type, addr).unwrap_or(false);
            return serde_json::json!(value);
        }

        // Try word device
        if let Some((device_type, addr)) = Self::parse_word_device(address) {
            let value = memory.read_word(device_type, addr).unwrap_or(0);
            return serde_json::json!(value);
        }

        serde_json::Value::Null
    }

    // ========================================================================
    // Step Execution Control
    // ========================================================================

    /// Enable step mode
    pub fn enable_step_mode(&self, step_type: StepType) {
        self.step_mode.store(true, Ordering::SeqCst);
        *self.step_type.write() = step_type;
    }

    /// Disable step mode
    pub fn disable_step_mode(&self) {
        self.step_mode.store(false, Ordering::SeqCst);
    }

    /// Check if step mode is enabled
    pub fn is_step_mode(&self) -> bool {
        self.step_mode.load(Ordering::SeqCst)
    }

    /// Get current step type
    pub fn get_step_type(&self) -> StepType {
        *self.step_type.read()
    }

    /// Pause execution with a breakpoint hit
    pub fn pause(&self, hit: BreakpointHit) {
        *self.paused_at.write() = Some(hit);
        self.step_mode.store(true, Ordering::SeqCst);
    }

    /// Get current pause state
    pub fn get_pause_state(&self) -> Option<BreakpointHit> {
        self.paused_at.read().clone()
    }

    /// Continue execution (clear pause state and disable step mode)
    pub fn continue_execution(&self) {
        *self.paused_at.write() = None;
        self.step_mode.store(false, Ordering::SeqCst);
    }

    /// Check if debugger is paused
    pub fn is_paused(&self) -> bool {
        self.paused_at.read().is_some()
    }

    /// Clear pause state (for after a step completes)
    pub fn clear_pause_state(&self) {
        *self.paused_at.write() = None;
    }

    // ========================================================================
    // State Reset
    // ========================================================================

    /// Reset all debugger state
    pub fn reset(&self) {
        self.breakpoints.write().clear();
        self.watches.write().clear();
        self.step_mode.store(false, Ordering::SeqCst);
        *self.step_type.write() = StepType::default();
        *self.paused_at.write() = None;
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debugger_new() {
        let debugger = SimDebugger::new(100);
        assert!(debugger.get_breakpoints().is_empty());
        assert!(debugger.get_watches().is_empty());
        assert!(!debugger.is_step_mode());
        assert!(!debugger.is_paused());
    }

    #[test]
    fn test_add_remove_breakpoint() {
        let debugger = SimDebugger::new(100);

        let mut bp = Breakpoint::new(BreakpointType::Network);
        bp.network_id = Some(1);
        let id = bp.id.clone();

        debugger.add_breakpoint(bp);
        assert_eq!(debugger.get_breakpoints().len(), 1);

        debugger.remove_breakpoint(&id).unwrap();
        assert!(debugger.get_breakpoints().is_empty());
    }

    #[test]
    fn test_enable_disable_breakpoint() {
        let debugger = SimDebugger::new(100);

        let bp = Breakpoint::new(BreakpointType::Network);
        let id = bp.id.clone();
        debugger.add_breakpoint(bp);

        // Initially enabled
        assert!(debugger.get_breakpoints()[0].enabled);

        // Disable
        debugger.set_breakpoint_enabled(&id, false).unwrap();
        assert!(!debugger.get_breakpoints()[0].enabled);

        // Enable
        debugger.set_breakpoint_enabled(&id, true).unwrap();
        assert!(debugger.get_breakpoints()[0].enabled);
    }

    #[test]
    fn test_step_mode() {
        let debugger = SimDebugger::new(100);

        assert!(!debugger.is_step_mode());

        debugger.enable_step_mode(StepType::Network);
        assert!(debugger.is_step_mode());
        assert_eq!(debugger.get_step_type(), StepType::Network);

        debugger.enable_step_mode(StepType::Scan);
        assert_eq!(debugger.get_step_type(), StepType::Scan);

        debugger.disable_step_mode();
        assert!(!debugger.is_step_mode());
    }

    #[test]
    fn test_pause_and_continue() {
        let debugger = SimDebugger::new(100);

        assert!(!debugger.is_paused());

        debugger.pause(BreakpointHit::Network {
            breakpoint_id: "test".to_string(),
            network_id: 1,
        });
        assert!(debugger.is_paused());
        assert!(debugger.is_step_mode());

        let pause_state = debugger.get_pause_state();
        assert!(pause_state.is_some());

        debugger.continue_execution();
        assert!(!debugger.is_paused());
        assert!(!debugger.is_step_mode());
    }

    #[test]
    fn test_step_type_serialization() {
        let step_type = StepType::Network;
        let json = serde_json::to_string(&step_type).unwrap();
        assert_eq!(json, "\"network\"");

        let step_type = StepType::Scan;
        let json = serde_json::to_string(&step_type).unwrap();
        assert_eq!(json, "\"scan\"");
    }

    #[test]
    fn test_breakpoint_hit_serialization() {
        let hit = BreakpointHit::Network {
            breakpoint_id: "bp-1".to_string(),
            network_id: 5,
        };
        let json = serde_json::to_string(&hit).unwrap();
        assert!(json.contains("\"type\":\"network\""));
        assert!(json.contains("\"networkId\":5"));

        let hit = BreakpointHit::ScanCount {
            breakpoint_id: "bp-2".to_string(),
            scan_count: 100,
        };
        let json = serde_json::to_string(&hit).unwrap();
        assert!(json.contains("\"type\":\"scanCount\""));
        assert!(json.contains("\"scanCount\":100"));
    }

    #[test]
    fn test_debugger_reset() {
        let debugger = SimDebugger::new(100);

        // Add some state
        debugger.add_breakpoint(Breakpoint::new(BreakpointType::Network));
        debugger.enable_step_mode(StepType::Scan);
        debugger.pause(BreakpointHit::ScanCount {
            breakpoint_id: "test".to_string(),
            scan_count: 1,
        });

        // Reset
        debugger.reset();

        // Verify clean state
        assert!(debugger.get_breakpoints().is_empty());
        assert!(debugger.get_watches().is_empty());
        assert!(!debugger.is_step_mode());
        assert!(!debugger.is_paused());
    }

    #[test]
    fn test_check_device_change_triggers() {
        let debugger = SimDebugger::new(100);

        // Add device breakpoint for M0000
        let mut bp = Breakpoint::new(BreakpointType::Device);
        bp.device_address = Some("M0000".to_string());
        let id = bp.id.clone();
        debugger.add_breakpoint(bp);

        // Check device change - should trigger when value changes
        let result = debugger.check_device_change(
            "M0000",
            serde_json::json!(false),
            serde_json::json!(true),
        );
        assert!(result.is_some());
        if let Some(BreakpointHit::Device { address, .. }) = result {
            assert_eq!(address, "M0000");
        } else {
            panic!("Expected Device breakpoint hit");
        }

        // Check hit count increased
        let bps = debugger.get_breakpoints();
        assert_eq!(bps.iter().find(|b| b.id == id).unwrap().hit_count, 1);
    }

    #[test]
    fn test_check_device_change_no_trigger_same_value() {
        let debugger = SimDebugger::new(100);

        // Add device breakpoint
        let mut bp = Breakpoint::new(BreakpointType::Device);
        bp.device_address = Some("M0000".to_string());
        debugger.add_breakpoint(bp);

        // Check device change with same value - should NOT trigger
        let result = debugger.check_device_change(
            "M0000",
            serde_json::json!(true),
            serde_json::json!(true),
        );
        assert!(result.is_none());
    }

    #[test]
    fn test_check_device_change_wrong_address() {
        let debugger = SimDebugger::new(100);

        // Add device breakpoint for M0000
        let mut bp = Breakpoint::new(BreakpointType::Device);
        bp.device_address = Some("M0000".to_string());
        debugger.add_breakpoint(bp);

        // Check different device - should NOT trigger
        let result = debugger.check_device_change(
            "M0001",
            serde_json::json!(false),
            serde_json::json!(true),
        );
        assert!(result.is_none());
    }

    #[test]
    fn test_disabled_breakpoint_skipped() {
        let debugger = SimDebugger::new(100);

        // Add device breakpoint and disable it
        let mut bp = Breakpoint::new(BreakpointType::Device);
        bp.device_address = Some("M0000".to_string());
        let id = bp.id.clone();
        debugger.add_breakpoint(bp);
        debugger.set_breakpoint_enabled(&id, false).unwrap();

        // Check device change - should NOT trigger (disabled)
        let result = debugger.check_device_change(
            "M0000",
            serde_json::json!(false),
            serde_json::json!(true),
        );
        assert!(result.is_none());
    }

    #[test]
    fn test_clear_breakpoints() {
        let debugger = SimDebugger::new(100);

        debugger.add_breakpoint(Breakpoint::new(BreakpointType::Network));
        debugger.add_breakpoint(Breakpoint::new(BreakpointType::Device));
        debugger.add_breakpoint(Breakpoint::new(BreakpointType::Condition));
        assert_eq!(debugger.get_breakpoints().len(), 3);

        debugger.clear_breakpoints();
        assert!(debugger.get_breakpoints().is_empty());
    }

    #[test]
    fn test_remove_nonexistent_breakpoint() {
        let debugger = SimDebugger::new(100);

        let result = debugger.remove_breakpoint("nonexistent");
        assert!(result.is_err());
        if let Err(DebuggerError::BreakpointNotFound(id)) = result {
            assert_eq!(id, "nonexistent");
        } else {
            panic!("Expected BreakpointNotFound error");
        }
    }

    #[test]
    fn test_parse_bit_device() {
        // Test valid bit devices
        assert!(SimDebugger::parse_bit_device("M0000").is_some());
        assert!(SimDebugger::parse_bit_device("P0100").is_some());
        assert!(SimDebugger::parse_bit_device("K0050").is_some());
        assert!(SimDebugger::parse_bit_device("F0001").is_some());
        assert!(SimDebugger::parse_bit_device("T0000").is_some());
        assert!(SimDebugger::parse_bit_device("C0000").is_some());

        // Test parsing correctness
        let (device, addr) = SimDebugger::parse_bit_device("M0100").unwrap();
        assert_eq!(device, SimBitDeviceType::M);
        assert_eq!(addr, 100);

        // Test invalid - word device letter
        assert!(SimDebugger::parse_bit_device("D0000").is_none());

        // Test invalid - too short
        assert!(SimDebugger::parse_bit_device("M").is_none());
        assert!(SimDebugger::parse_bit_device("").is_none());
    }

    #[test]
    fn test_parse_word_device() {
        // Test valid word devices
        assert!(SimDebugger::parse_word_device("D0000").is_some());
        assert!(SimDebugger::parse_word_device("R0100").is_some());
        assert!(SimDebugger::parse_word_device("Z0001").is_some());
        assert!(SimDebugger::parse_word_device("N0050").is_some());
        assert!(SimDebugger::parse_word_device("TD0000").is_some());
        assert!(SimDebugger::parse_word_device("CD0000").is_some());

        // Test parsing correctness for single-letter
        let (device, addr) = SimDebugger::parse_word_device("D0100").unwrap();
        assert_eq!(device, SimWordDeviceType::D);
        assert_eq!(addr, 100);

        // Test parsing correctness for two-letter
        let (device, addr) = SimDebugger::parse_word_device("TD0050").unwrap();
        assert_eq!(device, SimWordDeviceType::Td);
        assert_eq!(addr, 50);

        // Test invalid - bit device letter
        assert!(SimDebugger::parse_word_device("M0000").is_none());

        // Test invalid - too short
        assert!(SimDebugger::parse_word_device("D").is_none());
    }

    // ========================================================================
    // Watch Variable Tests
    // ========================================================================

    #[test]
    fn test_watch_variable_creation() {
        // Test WatchVariable::new
        let initial = serde_json::json!(100);
        let watch = WatchVariable::new("D0001".to_string(), initial.clone(), 50);

        assert_eq!(watch.address, "D0001");
        assert_eq!(watch.current_value, initial);
        assert_eq!(watch.previous_value, initial);
        assert_eq!(watch.change_count, 0);
        assert_eq!(watch.max_history, 50);
        assert_eq!(watch.history.len(), 1); // Initial value in history
    }

    #[test]
    fn test_watch_variable_update() {
        let mut watch = WatchVariable::new("M0000".to_string(), serde_json::json!(false), 100);

        // Update to true
        watch.update(serde_json::json!(true));

        assert_eq!(watch.current_value, serde_json::json!(true));
        assert_eq!(watch.previous_value, serde_json::json!(false));
        assert_eq!(watch.change_count, 1);
        assert_eq!(watch.history.len(), 2); // Initial + 1 change
    }

    #[test]
    fn test_watch_variable_no_update_same_value() {
        let mut watch = WatchVariable::new("M0000".to_string(), serde_json::json!(false), 100);

        // Update with same value - should NOT count as change
        watch.update(serde_json::json!(false));

        assert_eq!(watch.change_count, 0);
        assert_eq!(watch.history.len(), 1); // Only initial
    }

    #[test]
    fn test_watch_variable_history_limit() {
        let mut watch = WatchVariable::new("D0000".to_string(), serde_json::json!(0), 5);

        // Make 10 changes
        for i in 1..=10 {
            watch.update(serde_json::json!(i));
        }

        // History should be limited to max_history (5)
        assert_eq!(watch.history.len(), 5);
        assert_eq!(watch.change_count, 10);

        // Most recent value should be first
        assert_eq!(watch.history[0].value, serde_json::json!(10));
    }

    #[test]
    fn test_debugger_watch_management() {
        let debugger = SimDebugger::new(100);
        let memory = DeviceMemory::new();

        // Add watches
        debugger.add_watch("M0000", &memory);
        debugger.add_watch("D0001", &memory);
        assert_eq!(debugger.get_watches().len(), 2);

        // Remove watch
        debugger.remove_watch("M0000").unwrap();
        assert_eq!(debugger.get_watches().len(), 1);

        // Verify correct watch remains
        let watches = debugger.get_watches();
        assert!(watches.iter().any(|w| w.address == "D0001"));
        assert!(!watches.iter().any(|w| w.address == "M0000"));
    }

    #[test]
    fn test_remove_nonexistent_watch() {
        let debugger = SimDebugger::new(100);

        let result = debugger.remove_watch("nonexistent");
        assert!(result.is_err());
        if let Err(DebuggerError::WatchNotFound(addr)) = result {
            assert_eq!(addr, "nonexistent");
        } else {
            panic!("Expected WatchNotFound error");
        }
    }

    #[test]
    fn test_clear_watches() {
        let debugger = SimDebugger::new(100);
        let memory = DeviceMemory::new();

        debugger.add_watch("M0000", &memory);
        debugger.add_watch("D0001", &memory);
        debugger.add_watch("K0000", &memory);
        assert_eq!(debugger.get_watches().len(), 3);

        debugger.clear_watches();
        assert!(debugger.get_watches().is_empty());
    }
}
