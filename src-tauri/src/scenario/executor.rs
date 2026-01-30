//! Scenario Executor Module
//!
//! Provides a Rust-based execution engine for scenario playback with precise timing,
//! event scheduling, and Modbus memory integration.

use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use super::types::{Scenario, ScenarioEvent};
use crate::modbus::memory::ModbusMemory;
use crate::modbus::types::{ChangeSource, MemoryType};

// ============================================================================
// Execution State Types
// ============================================================================

/// Scenario execution state
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScenarioState {
    /// No scenario loaded or execution stopped
    Idle,
    /// Scenario is executing
    Running,
    /// Execution is paused
    Paused,
    /// Scenario completed all events
    Completed,
    /// Error occurred during execution
    Error(String),
}

impl Default for ScenarioState {
    fn default() -> Self {
        ScenarioState::Idle
    }
}

// ============================================================================
// Scheduled Event for Min-Heap
// ============================================================================

/// An event scheduled for execution at a specific time
#[derive(Debug, Clone)]
pub struct ScheduledEvent {
    /// The scenario event to execute
    pub event: ScenarioEvent,
    /// When to execute (duration from scenario start)
    pub execute_at: Duration,
}

impl PartialEq for ScheduledEvent {
    fn eq(&self, other: &Self) -> bool {
        self.execute_at == other.execute_at
    }
}

impl Eq for ScheduledEvent {}

impl PartialOrd for ScheduledEvent {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

// Reverse ordering for min-heap (earliest event first)
impl Ord for ScheduledEvent {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse comparison so BinaryHeap gives us earliest first
        other.execute_at.cmp(&self.execute_at)
    }
}

// ============================================================================
// Pending Release
// ============================================================================

/// A pending value release for non-persistent events
#[derive(Debug, Clone)]
pub struct PendingRelease {
    /// The Modbus address to release
    pub address: String,
    /// The original value to restore
    pub original_value: u16,
    /// When to release (instant time)
    pub release_at: Instant,
}

// ============================================================================
// Scenario Status (for Frontend)
// ============================================================================

/// Status information sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioStatus {
    /// Current execution state
    pub state: ScenarioState,
    /// Elapsed time in seconds
    pub elapsed_time: f64,
    /// Total number of events in scenario
    pub total_events: usize,
    /// Number of events executed
    pub executed_events: usize,
    /// Current loop iteration (1-based)
    pub current_loop: u32,
    /// Total loop count (0 = infinite)
    pub total_loops: u32,
    /// Time until next event in seconds (if any)
    pub next_event_time: Option<f64>,
    /// ID of the last executed event
    pub last_executed_event_id: Option<String>,
}

impl Default for ScenarioStatus {
    fn default() -> Self {
        Self {
            state: ScenarioState::Idle,
            elapsed_time: 0.0,
            total_events: 0,
            executed_events: 0,
            current_loop: 1,
            total_loops: 1,
            next_event_time: None,
            last_executed_event_id: None,
        }
    }
}

// ============================================================================
// Event Payloads (for Tauri Events)
// ============================================================================

/// Payload emitted when an event is executed
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventExecutedPayload {
    /// ID of the executed event
    pub event_id: String,
    /// Time at which the event was executed
    pub time: f64,
    /// Modbus address that was written
    pub address: String,
    /// Value that was written
    pub value: u16,
}

/// Payload emitted when a loop completes
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopCompletedPayload {
    /// Which loop iteration just completed (1-based)
    pub loop_number: u32,
    /// Total number of loops (0 = infinite)
    pub total_loops: u32,
}

/// Payload emitted when an error occurs
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionErrorPayload {
    /// Error message
    pub message: String,
    /// Event ID that caused the error (if applicable)
    pub event_id: Option<String>,
}

// ============================================================================
// Control Messages
// ============================================================================

/// Messages to control the execution loop
#[derive(Debug)]
pub enum ExecutorCommand {
    /// Stop execution
    Stop,
    /// Pause execution
    Pause,
    /// Resume execution
    Resume,
}

// ============================================================================
// Scenario Executor
// ============================================================================

/// The main scenario execution engine
pub struct ScenarioExecutor {
    /// Current execution state
    state: ScenarioState,
    /// The loaded scenario (if any)
    scenario: Option<Scenario>,
    /// Queue of events to execute (min-heap by time)
    event_queue: BinaryHeap<ScheduledEvent>,
    /// Pending value releases
    pending_releases: Vec<PendingRelease>,
    /// When execution started
    start_time: Option<Instant>,
    /// When execution was paused
    pause_time: Option<Instant>,
    /// Total duration spent paused
    paused_duration: Duration,
    /// Current loop iteration (1-based)
    current_loop: u32,
    /// Number of events executed in current run
    executed_count: usize,
    /// ID of the last executed event
    last_executed_event_id: Option<String>,
    /// Reference to shared Modbus memory
    modbus_memory: Arc<ModbusMemory>,
    /// Channel to receive control commands
    command_rx: Option<mpsc::Receiver<ExecutorCommand>>,
    /// Channel to send control commands
    command_tx: Option<mpsc::Sender<ExecutorCommand>>,
}

impl ScenarioExecutor {
    /// Create a new executor with access to Modbus memory
    pub fn new(modbus_memory: Arc<ModbusMemory>) -> Self {
        Self {
            state: ScenarioState::Idle,
            scenario: None,
            event_queue: BinaryHeap::new(),
            pending_releases: Vec::new(),
            start_time: None,
            pause_time: None,
            paused_duration: Duration::ZERO,
            current_loop: 1,
            executed_count: 0,
            last_executed_event_id: None,
            modbus_memory,
            command_rx: None,
            command_tx: None,
        }
    }

    /// Load a scenario for execution
    pub fn load(&mut self, scenario: Scenario) -> Result<(), String> {
        // Can only load when idle
        if self.state != ScenarioState::Idle {
            return Err("Cannot load scenario while running".into());
        }

        // Clear any previous state
        self.event_queue.clear();
        self.pending_releases.clear();
        self.executed_count = 0;
        self.last_executed_event_id = None;
        self.current_loop = 1;
        self.paused_duration = Duration::ZERO;

        // Build event queue from enabled events
        for event in scenario.events.iter().filter(|e| e.enabled) {
            let execute_at = Duration::from_secs_f64(event.time);
            self.event_queue.push(ScheduledEvent {
                event: event.clone(),
                execute_at,
            });
        }

        self.scenario = Some(scenario);
        log::info!(
            "Loaded scenario with {} enabled events",
            self.event_queue.len()
        );

        Ok(())
    }

    /// Reload the event queue for the next loop iteration
    fn reload_event_queue(&mut self) {
        self.event_queue.clear();

        if let Some(ref scenario) = self.scenario {
            for event in scenario.events.iter().filter(|e| e.enabled) {
                let execute_at = Duration::from_secs_f64(event.time);
                self.event_queue.push(ScheduledEvent {
                    event: event.clone(),
                    execute_at,
                });
            }
        }

        self.executed_count = 0;
        self.last_executed_event_id = None;
    }

    /// Get the total number of enabled events
    fn total_enabled_events(&self) -> usize {
        self.scenario
            .as_ref()
            .map(|s| s.events.iter().filter(|e| e.enabled).count())
            .unwrap_or(0)
    }

    /// Get the current execution status
    pub fn get_status(&self) -> ScenarioStatus {
        let elapsed = self.calculate_elapsed();
        let total_events = self.total_enabled_events();

        let total_loops = self
            .scenario
            .as_ref()
            .map(|s| {
                if s.settings.loop_enabled {
                    s.settings.loop_count
                } else {
                    1
                }
            })
            .unwrap_or(1);

        let next_event_time = self.event_queue.peek().map(|e| e.execute_at.as_secs_f64());

        ScenarioStatus {
            state: self.state.clone(),
            elapsed_time: elapsed.as_secs_f64(),
            total_events,
            executed_events: self.executed_count,
            current_loop: self.current_loop,
            total_loops,
            next_event_time,
            last_executed_event_id: self.last_executed_event_id.clone(),
        }
    }

    /// Calculate elapsed time accounting for pauses
    fn calculate_elapsed(&self) -> Duration {
        match (self.start_time, self.pause_time) {
            (Some(start), Some(pause)) => {
                // Currently paused - use pause time
                pause.duration_since(start).saturating_sub(self.paused_duration)
            }
            (Some(start), None) => {
                // Currently running
                Instant::now().duration_since(start).saturating_sub(self.paused_duration)
            }
            _ => Duration::ZERO,
        }
    }

    /// Get the current state
    pub fn get_state(&self) -> ScenarioState {
        self.state.clone()
    }

    /// Create command channels for controlling execution
    pub fn create_command_channel(&mut self) -> mpsc::Sender<ExecutorCommand> {
        let (tx, rx) = mpsc::channel(16);
        self.command_rx = Some(rx);
        self.command_tx = Some(tx.clone());
        tx
    }

    /// Pause execution
    pub fn pause(&mut self) -> Result<(), String> {
        if self.state != ScenarioState::Running {
            return Err("Cannot pause: not running".into());
        }

        self.pause_time = Some(Instant::now());
        self.state = ScenarioState::Paused;
        log::info!("Scenario execution paused");

        Ok(())
    }

    /// Resume execution from pause
    pub fn resume(&mut self) -> Result<(), String> {
        if self.state != ScenarioState::Paused {
            return Err("Cannot resume: not paused".into());
        }

        if let Some(pause_time) = self.pause_time.take() {
            self.paused_duration += Instant::now().duration_since(pause_time);
        }

        self.state = ScenarioState::Running;
        log::info!("Scenario execution resumed");

        Ok(())
    }

    /// Stop execution and reset state
    pub fn stop(&mut self) -> Result<(), String> {
        self.state = ScenarioState::Idle;
        self.event_queue.clear();

        // Process all pending releases immediately
        self.release_all_pending()?;

        // Reset counters
        self.start_time = None;
        self.pause_time = None;
        self.paused_duration = Duration::ZERO;
        self.current_loop = 1;
        self.executed_count = 0;
        self.last_executed_event_id = None;

        log::info!("Scenario execution stopped");

        Ok(())
    }

    /// Seek to a specific time position in the scenario
    ///
    /// This adjusts the execution timeline to the specified time:
    /// - Events before the seek time are considered "executed"
    /// - Events at or after the seek time remain in the queue
    /// - The elapsed time is adjusted to match the seek position
    pub fn seek(&mut self, time_secs: f64) -> Result<(), String> {
        // Can only seek when paused or running
        if self.state == ScenarioState::Idle {
            return Err("Cannot seek: no scenario loaded".into());
        }

        let seek_duration = Duration::from_secs_f64(time_secs);

        // Rebuild the event queue with only events at or after seek time
        self.event_queue.clear();

        if let Some(ref scenario) = self.scenario {
            let mut events_before = 0;

            for event in scenario.events.iter().filter(|e| e.enabled) {
                let execute_at = Duration::from_secs_f64(event.time);

                if execute_at >= seek_duration {
                    // Event is at or after seek position, keep it in queue
                    self.event_queue.push(ScheduledEvent {
                        event: event.clone(),
                        execute_at,
                    });
                } else {
                    // Event is before seek position, count as executed
                    events_before += 1;
                }
            }

            self.executed_count = events_before;
        }

        // Adjust timing to match seek position
        // If we're running or paused, we need to adjust start_time so that
        // calculate_elapsed() returns the seek time
        if self.start_time.is_some() {
            let now = Instant::now();

            // If paused, account for pause time
            if self.state == ScenarioState::Paused {
                if let Some(pause_time) = self.pause_time {
                    // Calculate total paused duration up to now
                    self.paused_duration += now.duration_since(pause_time);
                    self.pause_time = Some(now);
                }
            }

            // Adjust start_time so that: now - start_time - paused_duration = seek_duration
            // Therefore: start_time = now - paused_duration - seek_duration
            self.start_time = Some(now - self.paused_duration - seek_duration);
        }

        log::info!(
            "Seeked to {:.2}s, {} events remaining in queue",
            time_secs,
            self.event_queue.len()
        );

        Ok(())
    }

    /// Release all pending values immediately
    fn release_all_pending(&mut self) -> Result<(), String> {
        // Take ownership of pending releases to avoid borrow conflicts
        let releases: Vec<_> = self.pending_releases.drain(..).collect();
        for release in releases {
            if let Err(e) = self.write_to_memory(&release.address, release.original_value) {
                log::warn!("Failed to release {}: {}", release.address, e);
            }
        }
        Ok(())
    }

    /// Run the scenario execution loop
    pub async fn run(&mut self, app_handle: AppHandle) -> Result<(), String> {
        if self.scenario.is_none() {
            return Err("No scenario loaded".into());
        }

        if self.state == ScenarioState::Running {
            return Err("Scenario already running".into());
        }

        // Initialize state
        self.state = ScenarioState::Running;
        self.start_time = Some(Instant::now());
        self.pause_time = None;
        self.paused_duration = Duration::ZERO;
        self.current_loop = 1;
        self.executed_count = 0;

        // Reload event queue
        self.reload_event_queue();

        log::info!("Starting scenario execution");

        // Emit initial status
        let _ = app_handle.emit("scenario:status-changed", self.get_status());

        // Main execution loop
        loop {
            // Check for pause
            if self.state == ScenarioState::Paused {
                // Wait a bit while paused
                tokio::time::sleep(Duration::from_millis(50)).await;
                continue;
            }

            // Check for stop or completion
            if self.state != ScenarioState::Running {
                break;
            }

            // Calculate elapsed time
            let elapsed = self.calculate_elapsed();

            // Process due events
            while let Some(scheduled) = self.event_queue.peek() {
                if scheduled.execute_at <= elapsed {
                    let scheduled = self.event_queue.pop().unwrap();

                    // Execute the event
                    match self.execute_event(&scheduled.event).await {
                        Ok(()) => {
                            self.executed_count += 1;
                            self.last_executed_event_id = Some(scheduled.event.id.clone());

                            // Emit event executed
                            let _ = app_handle.emit(
                                "scenario:event-executed",
                                EventExecutedPayload {
                                    event_id: scheduled.event.id.clone(),
                                    time: elapsed.as_secs_f64(),
                                    address: scheduled.event.address.clone(),
                                    value: scheduled.event.value,
                                },
                            );
                        }
                        Err(e) => {
                            log::error!("Error executing event {}: {}", scheduled.event.id, e);
                            let _ = app_handle.emit(
                                "scenario:error",
                                ExecutionErrorPayload {
                                    message: e.clone(),
                                    event_id: Some(scheduled.event.id),
                                },
                            );
                        }
                    }
                } else {
                    break;
                }
            }

            // Process pending releases
            self.process_releases()?;

            // Emit status update periodically
            let _ = app_handle.emit("scenario:status-changed", self.get_status());

            // Check for scenario completion
            if self.event_queue.is_empty() && self.pending_releases.is_empty() {
                if let Some(ref scenario) = self.scenario {
                    if scenario.settings.loop_enabled {
                        let total_loops = scenario.settings.loop_count;
                        let should_continue = total_loops == 0 || self.current_loop < total_loops;

                        if should_continue {
                            // Emit loop completed
                            let _ = app_handle.emit(
                                "scenario:loop-completed",
                                LoopCompletedPayload {
                                    loop_number: self.current_loop,
                                    total_loops,
                                },
                            );

                            // Increment loop counter
                            self.current_loop += 1;

                            // Sleep for loop delay
                            let delay = Duration::from_millis(scenario.settings.loop_delay);
                            tokio::time::sleep(delay).await;

                            // Reload event queue
                            self.reload_event_queue();
                            self.start_time = Some(Instant::now());
                            self.paused_duration = Duration::ZERO;

                            log::info!("Starting loop iteration {}", self.current_loop);
                            continue;
                        }
                    }
                }

                // Scenario completed
                self.state = ScenarioState::Completed;
                let _ = app_handle.emit("scenario:completed", self.get_status());
                log::info!("Scenario execution completed");
                break;
            }

            // Small sleep to avoid busy loop
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        Ok(())
    }

    /// Execute a single scenario event
    async fn execute_event(&mut self, event: &ScenarioEvent) -> Result<(), String> {
        let (memory_type, address) = parse_modbus_address(&event.address)?;

        // Read original value for non-persistent events
        let original_value = if !event.persist {
            Some(self.read_from_memory(memory_type, address)?)
        } else {
            None
        };

        // Write new value
        self.write_to_memory(&event.address, event.value)?;

        // Schedule release if non-persistent
        if !event.persist {
            if let Some(duration) = event.persist_duration {
                self.pending_releases.push(PendingRelease {
                    address: event.address.clone(),
                    original_value: original_value.unwrap_or(0),
                    release_at: Instant::now() + Duration::from_millis(duration),
                });
            }
        }

        log::debug!(
            "Executed event {}: {} = {}",
            event.id,
            event.address,
            event.value
        );

        Ok(())
    }

    /// Process pending releases that are due
    fn process_releases(&mut self) -> Result<(), String> {
        let now = Instant::now();
        let mut to_release = Vec::new();

        self.pending_releases.retain(|release| {
            if now >= release.release_at {
                to_release.push(release.clone());
                false
            } else {
                true
            }
        });

        for release in to_release {
            if let Err(e) = self.write_to_memory(&release.address, release.original_value) {
                log::warn!("Failed to release {}: {}", release.address, e);
            } else {
                log::debug!("Released {} to {}", release.address, release.original_value);
            }
        }

        Ok(())
    }

    /// Read a value from Modbus memory
    fn read_from_memory(&self, memory_type: MemoryType, address: u16) -> Result<u16, String> {
        // ModbusMemory uses internal RwLock, so we can access it directly
        match memory_type {
            MemoryType::Coil => {
                let values = self
                    .modbus_memory
                    .read_coils(address, 1)
                    .map_err(|e| format!("Failed to read coil: {}", e))?;
                Ok(if values[0] { 1 } else { 0 })
            }
            MemoryType::DiscreteInput => {
                let values = self
                    .modbus_memory
                    .read_discrete_inputs(address, 1)
                    .map_err(|e| format!("Failed to read discrete input: {}", e))?;
                Ok(if values[0] { 1 } else { 0 })
            }
            MemoryType::HoldingRegister => {
                let values = self
                    .modbus_memory
                    .read_holding_registers(address, 1)
                    .map_err(|e| format!("Failed to read holding register: {}", e))?;
                Ok(values[0])
            }
            MemoryType::InputRegister => {
                let values = self
                    .modbus_memory
                    .read_input_registers(address, 1)
                    .map_err(|e| format!("Failed to read input register: {}", e))?;
                Ok(values[0])
            }
        }
    }

    /// Write a value to Modbus memory
    fn write_to_memory(&self, address_str: &str, value: u16) -> Result<(), String> {
        let (memory_type, address) = parse_modbus_address(address_str)?;

        // ModbusMemory uses internal RwLock, so we can access it directly
        match memory_type {
            MemoryType::Coil => self
                .modbus_memory
                .write_coil_with_source(address, value != 0, ChangeSource::Simulation)
                .map_err(|e| format!("Failed to write coil: {}", e)),
            MemoryType::DiscreteInput => self
                .modbus_memory
                .write_discrete_input_with_source(address, value != 0, ChangeSource::Simulation)
                .map_err(|e| format!("Failed to write discrete input: {}", e)),
            MemoryType::HoldingRegister => self
                .modbus_memory
                .write_holding_register_with_source(address, value, ChangeSource::Simulation)
                .map_err(|e| format!("Failed to write holding register: {}", e)),
            MemoryType::InputRegister => self
                .modbus_memory
                .write_input_register_with_source(address, value, ChangeSource::Simulation)
                .map_err(|e| format!("Failed to write input register: {}", e)),
        }
    }
}

// ============================================================================
// Address Parsing Helper
// ============================================================================

/// Parse a Modbus address string (e.g., "C:0x0001", "H:0x0100")
pub fn parse_modbus_address(address: &str) -> Result<(MemoryType, u16), String> {
    let parts: Vec<&str> = address.split(':').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid address format: {}", address));
    }

    let memory_type = match parts[0] {
        "C" => MemoryType::Coil,
        "DI" => MemoryType::DiscreteInput,
        "H" => MemoryType::HoldingRegister,
        "IR" => MemoryType::InputRegister,
        _ => return Err(format!("Unknown address prefix: {}", parts[0])),
    };

    // Parse address - support both hex (0x...) and decimal formats
    let addr_str = parts[1].trim();
    let addr = if addr_str.starts_with("0x") || addr_str.starts_with("0X") {
        u16::from_str_radix(&addr_str[2..], 16)
            .map_err(|e| format!("Invalid hex address '{}': {}", addr_str, e))?
    } else {
        addr_str
            .parse::<u16>()
            .map_err(|e| format!("Invalid decimal address '{}': {}", addr_str, e))?
    };

    Ok((memory_type, addr))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::types::MemoryMapSettings;

    fn create_test_memory() -> Arc<ModbusMemory> {
        Arc::new(ModbusMemory::new(&MemoryMapSettings::default()))
    }

    #[test]
    fn test_parse_modbus_address_hex() {
        let result = parse_modbus_address("C:0x0001").unwrap();
        assert_eq!(result.0, MemoryType::Coil);
        assert_eq!(result.1, 1);

        let result = parse_modbus_address("H:0x0100").unwrap();
        assert_eq!(result.0, MemoryType::HoldingRegister);
        assert_eq!(result.1, 256);

        let result = parse_modbus_address("DI:0xFFFF").unwrap();
        assert_eq!(result.0, MemoryType::DiscreteInput);
        assert_eq!(result.1, 65535);

        let result = parse_modbus_address("IR:0x0000").unwrap();
        assert_eq!(result.0, MemoryType::InputRegister);
        assert_eq!(result.1, 0);
    }

    #[test]
    fn test_parse_modbus_address_decimal() {
        let result = parse_modbus_address("C:100").unwrap();
        assert_eq!(result.0, MemoryType::Coil);
        assert_eq!(result.1, 100);

        let result = parse_modbus_address("H:1000").unwrap();
        assert_eq!(result.0, MemoryType::HoldingRegister);
        assert_eq!(result.1, 1000);
    }

    #[test]
    fn test_parse_modbus_address_invalid() {
        assert!(parse_modbus_address("invalid").is_err());
        assert!(parse_modbus_address("X:0x0001").is_err());
        assert!(parse_modbus_address("C:").is_err());
    }

    #[test]
    fn test_scheduled_event_ordering() {
        let event1 = ScheduledEvent {
            event: ScenarioEvent {
                id: "1".to_string(),
                time: 1.0,
                address: "C:0x0001".to_string(),
                value: 1,
                persist: true,
                persist_duration: None,
                note: String::new(),
                enabled: true,
            },
            execute_at: Duration::from_secs(1),
        };

        let event2 = ScheduledEvent {
            event: ScenarioEvent {
                id: "2".to_string(),
                time: 0.5,
                address: "C:0x0002".to_string(),
                value: 1,
                persist: true,
                persist_duration: None,
                note: String::new(),
                enabled: true,
            },
            execute_at: Duration::from_millis(500),
        };

        // event2 should come first (earlier time)
        assert!(event2 > event1); // BinaryHeap pops greatest first, so reverse ordering
    }

    #[test]
    fn test_executor_load_scenario() {
        let memory = create_test_memory();
        let mut executor = ScenarioExecutor::new(memory);

        let scenario = Scenario {
            metadata: crate::scenario::ScenarioMetadata::default(),
            settings: crate::scenario::ScenarioSettings::default(),
            events: vec![
                ScenarioEvent {
                    id: "1".to_string(),
                    time: 0.0,
                    address: "C:0x0001".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
                ScenarioEvent {
                    id: "2".to_string(),
                    time: 1.0,
                    address: "H:0x0100".to_string(),
                    value: 100,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
                ScenarioEvent {
                    id: "3".to_string(),
                    time: 0.5,
                    address: "C:0x0002".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: false, // Disabled
                },
            ],
        };

        executor.load(scenario).unwrap();

        // Should have 2 events (excluding disabled)
        assert_eq!(executor.total_enabled_events(), 2);
        assert_eq!(executor.event_queue.len(), 2);
    }

    #[test]
    fn test_executor_status() {
        let memory = create_test_memory();
        let executor = ScenarioExecutor::new(memory);

        let status = executor.get_status();
        assert_eq!(status.state, ScenarioState::Idle);
        assert_eq!(status.elapsed_time, 0.0);
        assert_eq!(status.executed_events, 0);
    }

    #[test]
    fn test_scenario_state_serialization() {
        let state = ScenarioState::Running;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"running\"");

        let state = ScenarioState::Error("Test error".to_string());
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("error"));
    }

    #[test]
    fn test_executor_seek_idle_fails() {
        let memory = create_test_memory();
        let mut executor = ScenarioExecutor::new(memory);

        // Seek should fail when idle (no scenario loaded)
        let result = executor.seek(5.0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no scenario loaded"));
    }

    #[test]
    fn test_executor_seek_forward() {
        let memory = create_test_memory();
        let mut executor = ScenarioExecutor::new(memory);

        let scenario = Scenario {
            metadata: crate::scenario::ScenarioMetadata::default(),
            settings: crate::scenario::ScenarioSettings::default(),
            events: vec![
                ScenarioEvent {
                    id: "1".to_string(),
                    time: 0.0,
                    address: "C:0x0001".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
                ScenarioEvent {
                    id: "2".to_string(),
                    time: 1.0,
                    address: "C:0x0002".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
                ScenarioEvent {
                    id: "3".to_string(),
                    time: 2.0,
                    address: "C:0x0003".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
            ],
        };

        executor.load(scenario).unwrap();

        // Manually set state to Paused so seek works
        executor.state = ScenarioState::Paused;
        executor.start_time = Some(std::time::Instant::now());

        // Initially 3 events in queue
        assert_eq!(executor.event_queue.len(), 3);

        // Seek to 1.5 seconds - should skip first 2 events (0.0s and 1.0s)
        executor.seek(1.5).unwrap();

        // Only 1 event should remain (at 2.0s)
        assert_eq!(executor.event_queue.len(), 1);
        assert_eq!(executor.executed_count, 2); // 2 events were "skipped"
    }

    #[test]
    fn test_executor_seek_to_beginning() {
        let memory = create_test_memory();
        let mut executor = ScenarioExecutor::new(memory);

        let scenario = Scenario {
            metadata: crate::scenario::ScenarioMetadata::default(),
            settings: crate::scenario::ScenarioSettings::default(),
            events: vec![
                ScenarioEvent {
                    id: "1".to_string(),
                    time: 1.0,
                    address: "C:0x0001".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
                ScenarioEvent {
                    id: "2".to_string(),
                    time: 2.0,
                    address: "C:0x0002".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
            ],
        };

        executor.load(scenario).unwrap();

        // Manually set state to Paused so seek works
        executor.state = ScenarioState::Paused;
        executor.start_time = Some(std::time::Instant::now());

        // Seek to 0 - all events should be in queue
        executor.seek(0.0).unwrap();

        assert_eq!(executor.event_queue.len(), 2);
        assert_eq!(executor.executed_count, 0);
    }

    #[test]
    fn test_executor_seek_past_end() {
        let memory = create_test_memory();
        let mut executor = ScenarioExecutor::new(memory);

        let scenario = Scenario {
            metadata: crate::scenario::ScenarioMetadata::default(),
            settings: crate::scenario::ScenarioSettings::default(),
            events: vec![
                ScenarioEvent {
                    id: "1".to_string(),
                    time: 1.0,
                    address: "C:0x0001".to_string(),
                    value: 1,
                    persist: true,
                    persist_duration: None,
                    note: String::new(),
                    enabled: true,
                },
            ],
        };

        executor.load(scenario).unwrap();

        // Manually set state to Paused so seek works
        executor.state = ScenarioState::Paused;
        executor.start_time = Some(std::time::Instant::now());

        // Seek past all events
        executor.seek(100.0).unwrap();

        assert_eq!(executor.event_queue.len(), 0);
        assert_eq!(executor.executed_count, 1);
    }
}
