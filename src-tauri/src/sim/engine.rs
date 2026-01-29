//! Scan Cycle Engine Module
//!
//! Implements the PLC scan cycle with configurable timing, three-phase execution
//! (input scan, program execution, output scan), and watchdog monitoring.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use thiserror::Error;
use tokio::sync::oneshot;

use super::counter::CounterManager;
use super::executor::{LadderProgram, ProgramExecutor};
use super::memory::DeviceMemory;
use super::timer::TimerManager;
use super::types::{ScanCycleInfo, SimulationConfig, SimulationState, SimulationStatus};

// ============================================================================
// Error Types
// ============================================================================

/// Simulation engine error types
#[derive(Debug, Error)]
pub enum EngineError {
    /// Engine is already running
    #[error("Engine is already running")]
    AlreadyRunning,

    /// Engine is not running
    #[error("Engine is not running")]
    NotRunning,

    /// No program loaded
    #[error("No program loaded")]
    NoProgramLoaded,

    /// Watchdog timeout
    #[error("Watchdog timeout: scan took {elapsed_ms}ms, limit is {limit_ms}ms")]
    WatchdogTimeout { elapsed_ms: u64, limit_ms: u64 },

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type for engine operations
pub type EngineResult<T> = Result<T, EngineError>;

// ============================================================================
// State Constants
// ============================================================================

const STATE_STOPPED: u8 = 0;
const STATE_RUNNING: u8 = 1;
const STATE_PAUSED: u8 = 2;
const STATE_ERROR: u8 = 3;

// ============================================================================
// Events
// ============================================================================

/// Event emitted on each scan cycle completion
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCompleteEvent {
    /// Scan count
    pub scan_count: u64,
    /// Scan time in microseconds
    pub scan_time_us: u64,
    /// Current state
    pub state: SimulationState,
    /// Timestamp (ISO 8601)
    pub timestamp: String,
}

/// Event emitted on state change
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateChangeEvent {
    /// Previous state
    pub previous_state: SimulationState,
    /// New state
    pub new_state: SimulationState,
    /// Timestamp (ISO 8601)
    pub timestamp: String,
}

/// Event emitted on watchdog timeout
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchdogEvent {
    /// Elapsed scan time in milliseconds
    pub elapsed_ms: u64,
    /// Watchdog limit in milliseconds
    pub limit_ms: u64,
    /// Scan count when timeout occurred
    pub scan_count: u64,
    /// Timestamp (ISO 8601)
    pub timestamp: String,
}

// ============================================================================
// Scan Cycle Engine
// ============================================================================

/// PLC Scan Cycle Engine
///
/// Implements the three-phase scan cycle:
/// 1. Input Scan - Read inputs from external sources
/// 2. Program Execution - Execute ladder logic
/// 3. Output Scan - Write outputs to external destinations
pub struct OneSimEngine {
    // Components
    /// Device memory
    memory: Arc<DeviceMemory>,
    /// Program executor
    executor: Arc<ProgramExecutor>,
    /// Timer manager
    timer_mgr: Arc<TimerManager>,
    /// Counter manager
    counter_mgr: Arc<CounterManager>,

    // Configuration
    /// Simulation configuration
    config: RwLock<SimulationConfig>,

    // State
    /// Engine state (stopped=0, running=1, paused=2, error=3)
    state: AtomicU8,
    /// Loaded program
    program: RwLock<Option<LadderProgram>>,
    /// Whether scan loop should exit
    should_stop: AtomicBool,

    // Statistics
    /// Total scan count
    scan_count: AtomicU64,
    /// Last scan time in microseconds
    last_scan_time_us: AtomicU64,
    /// Average scan time in microseconds (exponential moving average)
    avg_scan_time_us: AtomicU64,
    /// Maximum scan time in microseconds
    max_scan_time_us: AtomicU64,
    /// Minimum scan time in microseconds
    min_scan_time_us: AtomicU64,
    /// Total scan time for averaging
    total_scan_time_us: AtomicU64,

    // Error state
    /// Last error message
    last_error: RwLock<Option<String>>,

    // Tauri app handle
    app_handle: RwLock<Option<AppHandle>>,

    // Shutdown signal
    shutdown_tx: RwLock<Option<oneshot::Sender<()>>>,
}

impl OneSimEngine {
    /// Create a new OneSimEngine
    pub fn new() -> Self {
        let memory = Arc::new(DeviceMemory::new());
        let timer_mgr = Arc::new(TimerManager::new());
        let counter_mgr = Arc::new(CounterManager::new());
        let executor = Arc::new(ProgramExecutor::new(
            Arc::clone(&memory),
            Arc::clone(&timer_mgr),
            Arc::clone(&counter_mgr),
        ));

        Self {
            memory,
            executor,
            timer_mgr,
            counter_mgr,
            config: RwLock::new(SimulationConfig::default()),
            state: AtomicU8::new(STATE_STOPPED),
            program: RwLock::new(None),
            should_stop: AtomicBool::new(false),
            scan_count: AtomicU64::new(0),
            last_scan_time_us: AtomicU64::new(0),
            avg_scan_time_us: AtomicU64::new(0),
            max_scan_time_us: AtomicU64::new(0),
            min_scan_time_us: AtomicU64::new(u64::MAX),
            total_scan_time_us: AtomicU64::new(0),
            last_error: RwLock::new(None),
            app_handle: RwLock::new(None),
            shutdown_tx: RwLock::new(None),
        }
    }

    /// Create with custom components (for testing)
    pub fn with_components(
        memory: Arc<DeviceMemory>,
        timer_mgr: Arc<TimerManager>,
        counter_mgr: Arc<CounterManager>,
    ) -> Self {
        let executor = Arc::new(ProgramExecutor::new(
            Arc::clone(&memory),
            Arc::clone(&timer_mgr),
            Arc::clone(&counter_mgr),
        ));

        Self {
            memory,
            executor,
            timer_mgr,
            counter_mgr,
            config: RwLock::new(SimulationConfig::default()),
            state: AtomicU8::new(STATE_STOPPED),
            program: RwLock::new(None),
            should_stop: AtomicBool::new(false),
            scan_count: AtomicU64::new(0),
            last_scan_time_us: AtomicU64::new(0),
            avg_scan_time_us: AtomicU64::new(0),
            max_scan_time_us: AtomicU64::new(0),
            min_scan_time_us: AtomicU64::new(u64::MAX),
            total_scan_time_us: AtomicU64::new(0),
            last_error: RwLock::new(None),
            app_handle: RwLock::new(None),
            shutdown_tx: RwLock::new(None),
        }
    }

    // ========================================================================
    // Accessors
    // ========================================================================

    /// Get device memory
    pub fn memory(&self) -> &Arc<DeviceMemory> {
        &self.memory
    }

    /// Get timer manager
    pub fn timer_mgr(&self) -> &Arc<TimerManager> {
        &self.timer_mgr
    }

    /// Get counter manager
    pub fn counter_mgr(&self) -> &Arc<CounterManager> {
        &self.counter_mgr
    }

    /// Get program executor
    pub fn executor(&self) -> &Arc<ProgramExecutor> {
        &self.executor
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /// Set the Tauri app handle
    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.write() = Some(handle);
    }

    /// Set simulation configuration
    pub fn set_config(&self, config: SimulationConfig) {
        *self.config.write() = config;
    }

    /// Get simulation configuration
    pub fn get_config(&self) -> SimulationConfig {
        self.config.read().clone()
    }

    // ========================================================================
    // Control Methods
    // ========================================================================

    /// Start the simulation with a loaded program
    pub fn start(&self, program: LadderProgram) -> EngineResult<()> {
        let current_state = self.state.load(Ordering::Relaxed);
        if current_state == STATE_RUNNING {
            return Err(EngineError::AlreadyRunning);
        }

        // Load program
        *self.program.write() = Some(program);

        // Reset state
        self.should_stop.store(false, Ordering::Relaxed);
        self.reset_statistics();
        *self.last_error.write() = None;

        // Set state to running
        let prev_state = self.state.swap(STATE_RUNNING, Ordering::SeqCst);
        self.emit_state_change(prev_state, STATE_RUNNING);

        Ok(())
    }

    /// Stop the simulation
    pub fn stop(&self) {
        let prev_state = self.state.swap(STATE_STOPPED, Ordering::SeqCst);
        self.should_stop.store(true, Ordering::Relaxed);

        // Send shutdown signal
        if let Some(tx) = self.shutdown_tx.write().take() {
            let _ = tx.send(());
        }

        // Clear timers and counters
        self.timer_mgr.clear();
        self.counter_mgr.clear();

        if prev_state != STATE_STOPPED {
            self.emit_state_change(prev_state, STATE_STOPPED);
        }
    }

    /// Pause the simulation
    pub fn pause(&self) -> EngineResult<()> {
        let current_state = self.state.load(Ordering::Relaxed);
        if current_state != STATE_RUNNING {
            return Err(EngineError::NotRunning);
        }

        let prev_state = self.state.swap(STATE_PAUSED, Ordering::SeqCst);
        self.emit_state_change(prev_state, STATE_PAUSED);
        Ok(())
    }

    /// Resume the simulation
    pub fn resume(&self) -> EngineResult<()> {
        let current_state = self.state.load(Ordering::Relaxed);
        if current_state != STATE_PAUSED {
            return Err(EngineError::NotRunning);
        }

        let prev_state = self.state.swap(STATE_RUNNING, Ordering::SeqCst);
        self.emit_state_change(prev_state, STATE_RUNNING);
        Ok(())
    }

    /// Execute a single scan cycle (for step mode or testing)
    pub fn single_scan(&self) -> EngineResult<()> {
        if self.program.read().is_none() {
            return Err(EngineError::NoProgramLoaded);
        }

        self.execute_scan_cycle();
        Ok(())
    }

    /// Check if simulation is running
    pub fn is_running(&self) -> bool {
        self.state.load(Ordering::Relaxed) == STATE_RUNNING
    }

    /// Check if simulation is paused
    pub fn is_paused(&self) -> bool {
        self.state.load(Ordering::Relaxed) == STATE_PAUSED
    }

    // ========================================================================
    // Status Methods
    // ========================================================================

    /// Get current simulation status
    pub fn get_status(&self) -> SimulationStatus {
        let state = match self.state.load(Ordering::Relaxed) {
            STATE_STOPPED => SimulationState::Stopped,
            STATE_RUNNING => SimulationState::Running,
            STATE_PAUSED => SimulationState::Paused,
            STATE_ERROR => SimulationState::Error,
            _ => SimulationState::Stopped,
        };

        SimulationStatus {
            state,
            scan_count: self.scan_count.load(Ordering::Relaxed),
            last_scan_time_us: self.last_scan_time_us.load(Ordering::Relaxed),
            avg_scan_time_us: self.avg_scan_time_us.load(Ordering::Relaxed),
            max_scan_time_us: self.max_scan_time_us.load(Ordering::Relaxed),
            min_scan_time_us: {
                let min = self.min_scan_time_us.load(Ordering::Relaxed);
                if min == u64::MAX { 0 } else { min }
            },
            error: self.last_error.read().clone(),
            last_update_time: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Get scan cycle information
    pub fn get_scan_info(&self) -> ScanCycleInfo {
        ScanCycleInfo {
            cycle_count: self.scan_count.load(Ordering::Relaxed),
            last_scan_time: self.last_scan_time_us.load(Ordering::Relaxed),
            average_scan_time: self.avg_scan_time_us.load(Ordering::Relaxed),
            max_scan_time: self.max_scan_time_us.load(Ordering::Relaxed),
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
        }
    }

    // ========================================================================
    // Scan Loop
    // ========================================================================

    /// Run the scan loop (call from tokio task)
    pub async fn run_scan_loop(&self) {
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel();
        *self.shutdown_tx.write() = Some(shutdown_tx);

        let scan_time_ms = self.config.read().scan_time_ms;
        let mut interval = tokio::time::interval(Duration::from_millis(scan_time_ms as u64));

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    // Check if we should stop
                    if self.should_stop.load(Ordering::Relaxed) {
                        break;
                    }

                    // Skip if not running
                    let state = self.state.load(Ordering::Relaxed);
                    if state != STATE_RUNNING {
                        continue;
                    }

                    // Execute scan cycle
                    self.execute_scan_cycle();
                }
                _ = &mut shutdown_rx => {
                    break;
                }
            }
        }
    }

    /// Execute a single scan cycle
    fn execute_scan_cycle(&self) {
        let start = Instant::now();

        // Phase 1: Input Scan
        self.input_scan();

        // Phase 2: Program Execution
        if let Some(ref program) = *self.program.read() {
            // Update timer tick
            let delta_ms = self.config.read().scan_time_ms;
            self.timer_mgr.tick(delta_ms);

            // Execute program
            let result = self.executor.execute_program(program);

            if !result.success {
                if let Some(err) = result.error {
                    self.handle_error(&err);
                }
            }
        }

        // Phase 3: Output Scan
        self.output_scan();

        // Update statistics
        let elapsed = start.elapsed();
        self.update_statistics(elapsed);

        // Check watchdog
        if !self.check_watchdog(elapsed) {
            self.handle_watchdog_timeout(elapsed);
        }

        // Emit scan complete event (throttled)
        let count = self.scan_count.load(Ordering::Relaxed);
        if count % 10 == 0 {
            // Emit every 10 scans to reduce overhead
            self.emit_scan_complete();
        }
    }

    // ========================================================================
    // Scan Phases
    // ========================================================================

    /// Input scan phase - sync from external sources
    fn input_scan(&self) {
        // TODO: Implement ModServer synchronization
        // For now, this is a placeholder that does nothing
        // In the future, this will:
        // 1. Read discrete inputs from Modbus to P relays
        // 2. Read externally written holding registers to D registers
    }

    /// Output scan phase - sync to external destinations
    fn output_scan(&self) {
        // TODO: Implement ModServer synchronization
        // For now, this is a placeholder that does nothing
        // In the future, this will:
        // 1. Write M relays to Modbus coils
        // 2. Write K relays to Modbus coils (with offset)
        // 3. Write D registers to Modbus holding registers
        // 4. Write T/C contacts and values
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /// Reset all statistics
    fn reset_statistics(&self) {
        self.scan_count.store(0, Ordering::Relaxed);
        self.last_scan_time_us.store(0, Ordering::Relaxed);
        self.avg_scan_time_us.store(0, Ordering::Relaxed);
        self.max_scan_time_us.store(0, Ordering::Relaxed);
        self.min_scan_time_us.store(u64::MAX, Ordering::Relaxed);
        self.total_scan_time_us.store(0, Ordering::Relaxed);
    }

    /// Update scan statistics
    fn update_statistics(&self, elapsed: Duration) {
        let elapsed_us = elapsed.as_micros() as u64;

        // Increment scan count
        let count = self.scan_count.fetch_add(1, Ordering::Relaxed) + 1;

        // Update last scan time
        self.last_scan_time_us.store(elapsed_us, Ordering::Relaxed);

        // Update max
        let current_max = self.max_scan_time_us.load(Ordering::Relaxed);
        if elapsed_us > current_max {
            self.max_scan_time_us.store(elapsed_us, Ordering::Relaxed);
        }

        // Update min
        let current_min = self.min_scan_time_us.load(Ordering::Relaxed);
        if elapsed_us < current_min {
            self.min_scan_time_us.store(elapsed_us, Ordering::Relaxed);
        }

        // Update average (simple running average)
        let total = self.total_scan_time_us.fetch_add(elapsed_us, Ordering::Relaxed) + elapsed_us;
        self.avg_scan_time_us.store(total / count, Ordering::Relaxed);
    }

    /// Check watchdog timeout
    fn check_watchdog(&self, elapsed: Duration) -> bool {
        let limit_ms = self.config.read().watchdog_timeout_ms as u64;
        let elapsed_ms = elapsed.as_millis() as u64;
        elapsed_ms < limit_ms
    }

    /// Handle watchdog timeout
    fn handle_watchdog_timeout(&self, elapsed: Duration) {
        let limit_ms = self.config.read().watchdog_timeout_ms as u64;
        let elapsed_ms = elapsed.as_millis() as u64;

        let error_msg = format!(
            "Watchdog timeout: scan took {}ms, limit is {}ms",
            elapsed_ms, limit_ms
        );
        log::warn!("{}", error_msg);

        // Emit watchdog event
        if let Some(handle) = self.app_handle.read().as_ref() {
            let event = WatchdogEvent {
                elapsed_ms,
                limit_ms,
                scan_count: self.scan_count.load(Ordering::Relaxed),
                timestamp: chrono::Utc::now().to_rfc3339(),
            };
            let _ = handle.emit("sim:watchdog", &event);
        }
    }

    // ========================================================================
    // Error Handling
    // ========================================================================

    /// Handle execution error
    fn handle_error(&self, error: &str) {
        log::error!("Simulation error: {}", error);
        *self.last_error.write() = Some(error.to_string());

        // Optionally transition to error state
        // For now, we just log and continue
    }

    // ========================================================================
    // Event Emission
    // ========================================================================

    /// Emit state change event
    fn emit_state_change(&self, prev_state: u8, new_state: u8) {
        if let Some(handle) = self.app_handle.read().as_ref() {
            let prev = match prev_state {
                STATE_RUNNING => SimulationState::Running,
                STATE_PAUSED => SimulationState::Paused,
                STATE_ERROR => SimulationState::Error,
                _ => SimulationState::Stopped,
            };
            let new = match new_state {
                STATE_RUNNING => SimulationState::Running,
                STATE_PAUSED => SimulationState::Paused,
                STATE_ERROR => SimulationState::Error,
                _ => SimulationState::Stopped,
            };

            let event = StateChangeEvent {
                previous_state: prev,
                new_state: new,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };

            let _ = handle.emit("sim:state-change", &event);
        }
    }

    /// Emit scan complete event
    fn emit_scan_complete(&self) {
        if let Some(handle) = self.app_handle.read().as_ref() {
            let state = match self.state.load(Ordering::Relaxed) {
                STATE_RUNNING => SimulationState::Running,
                STATE_PAUSED => SimulationState::Paused,
                STATE_ERROR => SimulationState::Error,
                _ => SimulationState::Stopped,
            };

            let event = ScanCompleteEvent {
                scan_count: self.scan_count.load(Ordering::Relaxed),
                scan_time_us: self.last_scan_time_us.load(Ordering::Relaxed),
                state,
                timestamp: chrono::Utc::now().to_rfc3339(),
            };

            let _ = handle.emit("sim:scan-complete", &event);
        }
    }
}

impl Default for OneSimEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::executor::{LadderNetwork, LadderNode, NodeType};
    use crate::sim::types::SimBitDeviceType;

    fn create_test_program() -> LadderProgram {
        LadderProgram {
            name: "Test".to_string(),
            networks: vec![LadderNetwork {
                id: 0,
                nodes: vec![LadderNode::series(vec![
                    LadderNode::contact(NodeType::ContactNo, "M0"),
                    LadderNode::coil(NodeType::CoilOut, "P0"),
                ])],
                comment: None,
            }],
        }
    }

    #[test]
    fn test_engine_creation() {
        let engine = OneSimEngine::new();
        assert_eq!(engine.state.load(Ordering::Relaxed), STATE_STOPPED);
        assert_eq!(engine.scan_count.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_start_stop() {
        let engine = OneSimEngine::new();
        let program = create_test_program();

        // Start
        assert!(engine.start(program).is_ok());
        assert_eq!(engine.state.load(Ordering::Relaxed), STATE_RUNNING);

        // Can't start again
        let program2 = create_test_program();
        assert!(engine.start(program2).is_err());

        // Stop
        engine.stop();
        assert_eq!(engine.state.load(Ordering::Relaxed), STATE_STOPPED);
    }

    #[test]
    fn test_pause_resume() {
        let engine = OneSimEngine::new();
        let program = create_test_program();

        // Can't pause when stopped
        assert!(engine.pause().is_err());

        // Start
        engine.start(program).unwrap();

        // Pause
        assert!(engine.pause().is_ok());
        assert_eq!(engine.state.load(Ordering::Relaxed), STATE_PAUSED);

        // Resume
        assert!(engine.resume().is_ok());
        assert_eq!(engine.state.load(Ordering::Relaxed), STATE_RUNNING);

        // Stop
        engine.stop();
    }

    #[test]
    fn test_single_scan() {
        let engine = OneSimEngine::new();

        // Can't scan without program
        assert!(engine.single_scan().is_err());

        // Load program
        let program = create_test_program();
        *engine.program.write() = Some(program);

        // Single scan
        assert!(engine.single_scan().is_ok());
        assert_eq!(engine.scan_count.load(Ordering::Relaxed), 1);

        // Another scan
        assert!(engine.single_scan().is_ok());
        assert_eq!(engine.scan_count.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn test_statistics_update() {
        let engine = OneSimEngine::new();
        let program = create_test_program();
        *engine.program.write() = Some(program);

        // Run a few scans
        for _ in 0..5 {
            engine.single_scan().unwrap();
        }

        let status = engine.get_status();
        assert_eq!(status.scan_count, 5);
        assert!(status.avg_scan_time_us > 0);
    }

    #[test]
    fn test_program_execution() {
        let engine = OneSimEngine::new();
        let program = create_test_program();
        *engine.program.write() = Some(program);

        // Set M0 true
        engine.memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();

        // Execute scan
        engine.single_scan().unwrap();

        // P0 should be true
        assert!(engine.memory.read_bit(SimBitDeviceType::P, 0).unwrap());
    }

    #[test]
    fn test_get_status() {
        let engine = OneSimEngine::new();

        let status = engine.get_status();
        assert_eq!(status.state, SimulationState::Stopped);
        assert_eq!(status.scan_count, 0);

        let program = create_test_program();
        engine.start(program).unwrap();

        let status = engine.get_status();
        assert_eq!(status.state, SimulationState::Running);

        engine.stop();
        let status = engine.get_status();
        assert_eq!(status.state, SimulationState::Stopped);
    }

    #[test]
    fn test_get_scan_info() {
        let engine = OneSimEngine::new();
        let program = create_test_program();
        *engine.program.write() = Some(program);

        engine.single_scan().unwrap();
        engine.single_scan().unwrap();
        engine.single_scan().unwrap();

        let info = engine.get_scan_info();
        assert_eq!(info.cycle_count, 3);
        assert!(info.last_scan_time > 0);
        assert!(info.average_scan_time > 0);
    }

    #[test]
    fn test_config() {
        let engine = OneSimEngine::new();

        let config = engine.get_config();
        assert_eq!(config.scan_time_ms, 10); // Default

        let new_config = SimulationConfig {
            scan_time_ms: 20,
            watchdog_timeout_ms: 500,
            ..Default::default()
        };
        engine.set_config(new_config.clone());

        let config = engine.get_config();
        assert_eq!(config.scan_time_ms, 20);
        assert_eq!(config.watchdog_timeout_ms, 500);
    }

    #[test]
    fn test_reset_on_start() {
        let engine = OneSimEngine::new();
        let program = create_test_program();

        // Load and run some scans
        *engine.program.write() = Some(program.clone());
        engine.single_scan().unwrap();
        engine.single_scan().unwrap();

        assert_eq!(engine.scan_count.load(Ordering::Relaxed), 2);

        // Start resets statistics
        engine.start(program).unwrap();
        assert_eq!(engine.scan_count.load(Ordering::Relaxed), 0);

        engine.stop();
    }
}
