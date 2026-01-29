//! ModServer Synchronization Module
//!
//! Provides bidirectional memory synchronization between OneSim DeviceMemory
//! and ModServer (Modbus memory) with configurable sync modes and proper
//! address offset mapping.

use parking_lot::RwLock;
use std::collections::HashSet;
use std::sync::Arc;
use thiserror::Error;

use crate::modbus::{ChangeSource, ModbusMemory};

use super::memory::DeviceMemory;
use super::types::{SimBitDeviceType, SimWordDeviceType, SyncMode};

// ============================================================================
// Address Mapping Constants
// ============================================================================

/// M relay → Coil offset (8192 M relays at offset 0)
const M_COIL_OFFSET: u16 = 0;
/// K relay → Coil offset (2048 K relays at offset 8192)
const K_COIL_OFFSET: u16 = 8192;
/// T contact → Coil offset (2048 T contacts at offset 10240)
const T_COIL_OFFSET: u16 = 10240;
/// C contact → Coil offset (2048 C contacts at offset 12288)
const C_COIL_OFFSET: u16 = 12288;

/// D register → Holding Register offset (10000 D registers at offset 0)
const D_HR_OFFSET: u16 = 0;
/// TD (Timer Current Value) → Holding Register offset (2048 TD at offset 28208)
const TD_HR_OFFSET: u16 = 28208;
/// CD (Counter Current Value) → Holding Register offset (2048 CD at offset 30256)
const CD_HR_OFFSET: u16 = 30256;

/// Number of P (Input) relays to sync from Discrete Inputs
const P_SYNC_COUNT: u16 = 2048;
/// Number of M relays to sync to Coils
const M_SYNC_COUNT: u16 = 8192;
/// Number of K relays to sync to Coils
const K_SYNC_COUNT: u16 = 2048;
/// Number of T contacts to sync to Coils
const T_SYNC_COUNT: u16 = 2048;
/// Number of C contacts to sync to Coils
const C_SYNC_COUNT: u16 = 2048;
/// Number of D registers to sync to Holding Registers
const D_SYNC_COUNT: u16 = 10000;
/// Number of TD registers to sync to Holding Registers
const TD_SYNC_COUNT: u16 = 2048;
/// Number of CD registers to sync to Holding Registers
const CD_SYNC_COUNT: u16 = 2048;

// ============================================================================
// Error Types
// ============================================================================

/// Sync operation errors
#[derive(Debug, Error)]
pub enum SyncError {
    /// Error accessing device memory
    #[error("Device memory error: {0}")]
    DeviceMemoryError(String),

    /// Error accessing Modbus memory
    #[error("Modbus memory error: {0}")]
    ModbusMemoryError(String),

    /// Sync operation not available in current mode
    #[error("Sync not available: {0}")]
    SyncNotAvailable(String),
}

/// Result type for sync operations
pub type SyncResult<T> = Result<T, SyncError>;

// ============================================================================
// ModServer Sync Structure
// ============================================================================

/// Bidirectional memory synchronization between OneSim and ModServer
///
/// Handles mapping between:
/// - Discrete Inputs → P relays (input sync)
/// - M/K/T/C relays → Coils (output sync)
/// - D/TD/CD registers → Holding Registers (output sync)
/// - External HR writes → D registers (input sync)
pub struct ModServerSync {
    /// Simulation memory (DeviceMemory)
    sim_memory: Arc<DeviceMemory>,
    /// Modbus memory
    modbus_memory: Arc<ModbusMemory>,
    /// Current synchronization mode
    sync_mode: RwLock<SyncMode>,
    /// Tracks external writes to Holding Registers
    /// When a Modbus client writes to an HR, the address is added here
    /// so that on the next input sync, we copy the value to D registers
    external_write_flags: RwLock<HashSet<u16>>,
    /// Statistics: number of input syncs performed
    input_sync_count: RwLock<u64>,
    /// Statistics: number of output syncs performed
    output_sync_count: RwLock<u64>,
}

impl ModServerSync {
    /// Create a new ModServerSync instance
    ///
    /// # Arguments
    /// * `sim_memory` - Arc to the simulation DeviceMemory
    /// * `modbus_memory` - Arc to the ModbusMemory
    ///
    /// # Returns
    /// A new ModServerSync with default EndOfScan sync mode
    pub fn new(sim_memory: Arc<DeviceMemory>, modbus_memory: Arc<ModbusMemory>) -> Self {
        Self {
            sim_memory,
            modbus_memory,
            sync_mode: RwLock::new(SyncMode::EndOfScan),
            external_write_flags: RwLock::new(HashSet::new()),
            input_sync_count: RwLock::new(0),
            output_sync_count: RwLock::new(0),
        }
    }

    /// Create a new ModServerSync with specified sync mode
    pub fn with_mode(
        sim_memory: Arc<DeviceMemory>,
        modbus_memory: Arc<ModbusMemory>,
        mode: SyncMode,
    ) -> Self {
        Self {
            sim_memory,
            modbus_memory,
            sync_mode: RwLock::new(mode),
            external_write_flags: RwLock::new(HashSet::new()),
            input_sync_count: RwLock::new(0),
            output_sync_count: RwLock::new(0),
        }
    }

    // ========================================================================
    // Sync Mode Management
    // ========================================================================

    /// Get the current sync mode
    pub fn get_sync_mode(&self) -> SyncMode {
        *self.sync_mode.read()
    }

    /// Set the sync mode
    pub fn set_sync_mode(&self, mode: SyncMode) {
        *self.sync_mode.write() = mode;
    }

    /// Check if sync should occur on memory change (Immediate mode)
    pub fn should_sync_on_change(&self) -> bool {
        matches!(*self.sync_mode.read(), SyncMode::Immediate)
    }

    /// Check if sync should occur at end of scan (EndOfScan mode)
    pub fn should_sync_on_scan_end(&self) -> bool {
        matches!(*self.sync_mode.read(), SyncMode::EndOfScan)
    }

    // ========================================================================
    // External Write Tracking
    // ========================================================================

    /// Mark a Holding Register address as externally written
    ///
    /// Called when a Modbus client writes to a Holding Register.
    /// On the next input sync, this address will be synced to the
    /// corresponding D register.
    pub fn mark_external_write(&self, address: u16) {
        // Only track writes within D register range
        if address < D_SYNC_COUNT {
            self.external_write_flags.write().insert(address);
        }
    }

    /// Check if any external writes are pending
    pub fn has_pending_external_writes(&self) -> bool {
        !self.external_write_flags.read().is_empty()
    }

    /// Get the count of pending external writes
    pub fn pending_external_write_count(&self) -> usize {
        self.external_write_flags.read().len()
    }

    // ========================================================================
    // Input Sync (ModServer → DeviceMemory)
    // ========================================================================

    /// Sync inputs from ModServer to DeviceMemory
    ///
    /// This syncs:
    /// - Discrete Inputs → P relays
    /// - External Holding Register writes → D registers
    pub fn sync_inputs(&self) -> SyncResult<()> {
        self.sync_discrete_inputs_to_p()?;
        self.sync_external_hr_to_d()?;

        *self.input_sync_count.write() += 1;
        Ok(())
    }

    /// Sync Discrete Inputs to P (Input Relay) in DeviceMemory
    fn sync_discrete_inputs_to_p(&self) -> SyncResult<()> {
        // Read Discrete Inputs from ModServer
        let di_values = self
            .modbus_memory
            .read_discrete_inputs(0, P_SYNC_COUNT)
            .map_err(|e| SyncError::ModbusMemoryError(e.to_string()))?;

        // Write to P (Input Relay) in DeviceMemory
        // Note: P relays might be read-only in normal operation,
        // but we use write_bit here for simulation input
        for (i, value) in di_values.iter().enumerate() {
            // P relays are NOT read-only, they can be written from external inputs
            self.sim_memory
                .write_bit(SimBitDeviceType::P, i as u16, *value)
                .map_err(|e| SyncError::DeviceMemoryError(e.to_string()))?;
        }

        Ok(())
    }

    /// Sync external Holding Register writes to D registers
    fn sync_external_hr_to_d(&self) -> SyncResult<()> {
        // Get and clear external write flags atomically
        let external_writes: Vec<u16> = {
            let mut flags = self.external_write_flags.write();
            let writes: Vec<u16> = flags.iter().copied().collect();
            flags.clear();
            writes
        };

        // Sync each externally written address
        for address in external_writes {
            let value = self
                .modbus_memory
                .read_holding_registers(address, 1)
                .map_err(|e| SyncError::ModbusMemoryError(e.to_string()))?;

            if let Some(&hr_value) = value.first() {
                self.sim_memory
                    .write_word(SimWordDeviceType::D, address, hr_value)
                    .map_err(|e| SyncError::DeviceMemoryError(e.to_string()))?;
            }
        }

        Ok(())
    }

    // ========================================================================
    // Output Sync (DeviceMemory → ModServer)
    // ========================================================================

    /// Sync outputs from DeviceMemory to ModServer
    ///
    /// This syncs:
    /// - M relays → Coils at offset 0
    /// - K relays → Coils at offset 8192
    /// - T contacts → Coils at offset 10240
    /// - C contacts → Coils at offset 12288
    /// - D registers → Holding Registers at offset 0
    /// - TD registers → Holding Registers at offset 28208
    /// - CD registers → Holding Registers at offset 30256
    pub fn sync_outputs(&self) -> SyncResult<()> {
        // Sync bit devices to Coils
        self.sync_bit_device_to_coils(SimBitDeviceType::M, M_COIL_OFFSET, M_SYNC_COUNT)?;
        self.sync_bit_device_to_coils(SimBitDeviceType::K, K_COIL_OFFSET, K_SYNC_COUNT)?;
        self.sync_bit_device_to_coils(SimBitDeviceType::T, T_COIL_OFFSET, T_SYNC_COUNT)?;
        self.sync_bit_device_to_coils(SimBitDeviceType::C, C_COIL_OFFSET, C_SYNC_COUNT)?;

        // Sync word devices to Holding Registers
        self.sync_word_device_to_hr(SimWordDeviceType::D, D_HR_OFFSET, D_SYNC_COUNT)?;
        self.sync_word_device_to_hr(SimWordDeviceType::Td, TD_HR_OFFSET, TD_SYNC_COUNT)?;
        self.sync_word_device_to_hr(SimWordDeviceType::Cd, CD_HR_OFFSET, CD_SYNC_COUNT)?;

        *self.output_sync_count.write() += 1;
        Ok(())
    }

    /// Sync a bit device to Coils at specified offset
    fn sync_bit_device_to_coils(
        &self,
        device: SimBitDeviceType,
        offset: u16,
        count: u16,
    ) -> SyncResult<()> {
        let values = self
            .sim_memory
            .read_bits(device, 0, count)
            .map_err(|e| SyncError::DeviceMemoryError(e.to_string()))?;

        self.modbus_memory
            .write_coils_with_source(offset, &values, ChangeSource::Simulation)
            .map_err(|e| SyncError::ModbusMemoryError(e.to_string()))?;

        Ok(())
    }

    /// Sync a word device to Holding Registers at specified offset
    fn sync_word_device_to_hr(
        &self,
        device: SimWordDeviceType,
        offset: u16,
        count: u16,
    ) -> SyncResult<()> {
        let values = self
            .sim_memory
            .read_words(device, 0, count)
            .map_err(|e| SyncError::DeviceMemoryError(e.to_string()))?;

        self.modbus_memory
            .write_holding_registers_with_source(offset, &values, ChangeSource::Simulation)
            .map_err(|e| SyncError::ModbusMemoryError(e.to_string()))?;

        Ok(())
    }

    // ========================================================================
    // Full Sync Operations
    // ========================================================================

    /// Perform a full bidirectional sync (inputs then outputs)
    pub fn full_sync(&self) -> SyncResult<()> {
        self.sync_inputs()?;
        self.sync_outputs()?;
        Ok(())
    }

    /// Called when a memory change occurs (for Immediate mode)
    ///
    /// Only performs sync if in Immediate mode
    pub fn on_memory_change(&self) -> SyncResult<()> {
        if self.should_sync_on_change() {
            self.full_sync()
        } else {
            Ok(())
        }
    }

    /// Called at the end of a scan cycle (for EndOfScan mode)
    ///
    /// Only performs sync if in EndOfScan mode
    pub fn on_scan_end(&self) -> SyncResult<()> {
        if self.should_sync_on_scan_end() {
            self.full_sync()
        } else {
            Ok(())
        }
    }

    /// Manually trigger a sync (for Manual mode or explicit sync requests)
    ///
    /// Performs sync regardless of current mode
    pub fn manual_sync(&self) -> SyncResult<()> {
        self.full_sync()
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /// Get the number of input syncs performed
    pub fn input_sync_count(&self) -> u64 {
        *self.input_sync_count.read()
    }

    /// Get the number of output syncs performed
    pub fn output_sync_count(&self) -> u64 {
        *self.output_sync_count.read()
    }

    /// Reset sync statistics
    pub fn reset_stats(&self) {
        *self.input_sync_count.write() = 0;
        *self.output_sync_count.write() = 0;
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::MemoryMapSettings;

    fn create_test_sync() -> ModServerSync {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        ModServerSync::new(sim_memory, modbus_memory)
    }

    // ========================================================================
    // Initialization Tests
    // ========================================================================

    #[test]
    fn test_new_creates_with_default_mode() {
        let sync = create_test_sync();
        assert_eq!(sync.get_sync_mode(), SyncMode::EndOfScan);
    }

    #[test]
    fn test_with_mode_creates_correct_mode() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::with_defaults());
        let sync = ModServerSync::with_mode(sim_memory, modbus_memory, SyncMode::Immediate);
        assert_eq!(sync.get_sync_mode(), SyncMode::Immediate);
    }

    #[test]
    fn test_set_sync_mode() {
        let sync = create_test_sync();

        sync.set_sync_mode(SyncMode::Immediate);
        assert_eq!(sync.get_sync_mode(), SyncMode::Immediate);

        sync.set_sync_mode(SyncMode::Manual);
        assert_eq!(sync.get_sync_mode(), SyncMode::Manual);
    }

    // ========================================================================
    // Sync Mode Behavior Tests
    // ========================================================================

    #[test]
    fn test_should_sync_on_change_immediate() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::with_defaults());
        let sync = ModServerSync::with_mode(sim_memory, modbus_memory, SyncMode::Immediate);
        assert!(sync.should_sync_on_change());
        assert!(!sync.should_sync_on_scan_end());
    }

    #[test]
    fn test_should_sync_on_scan_end() {
        let sync = create_test_sync(); // Default is EndOfScan
        assert!(!sync.should_sync_on_change());
        assert!(sync.should_sync_on_scan_end());
    }

    #[test]
    fn test_manual_mode_no_auto_sync() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::with_defaults());
        let sync = ModServerSync::with_mode(sim_memory, modbus_memory, SyncMode::Manual);
        assert!(!sync.should_sync_on_change());
        assert!(!sync.should_sync_on_scan_end());
    }

    // ========================================================================
    // External Write Tracking Tests
    // ========================================================================

    #[test]
    fn test_mark_external_write() {
        let sync = create_test_sync();

        assert!(!sync.has_pending_external_writes());

        sync.mark_external_write(100);
        assert!(sync.has_pending_external_writes());
        assert_eq!(sync.pending_external_write_count(), 1);

        sync.mark_external_write(200);
        assert_eq!(sync.pending_external_write_count(), 2);
    }

    #[test]
    fn test_external_writes_cleared_on_sync() {
        let sync = create_test_sync();

        sync.mark_external_write(100);
        sync.mark_external_write(200);
        assert_eq!(sync.pending_external_write_count(), 2);

        // Sync inputs clears external write flags
        sync.sync_inputs().unwrap();
        assert!(!sync.has_pending_external_writes());
    }

    #[test]
    fn test_external_write_outside_d_range_ignored() {
        let sync = create_test_sync();

        // D_SYNC_COUNT is 10000, so addresses >= 10000 should be ignored
        sync.mark_external_write(10001);
        sync.mark_external_write(20000);
        assert!(!sync.has_pending_external_writes());
    }

    // ========================================================================
    // Input Sync Tests
    // ========================================================================

    #[test]
    fn test_sync_discrete_inputs_to_p() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set some Discrete Inputs in ModbusMemory
        modbus_memory.write_discrete_input(0, true).unwrap();
        modbus_memory.write_discrete_input(100, true).unwrap();
        modbus_memory.write_discrete_input(500, true).unwrap();

        // Verify P relays are initially false
        assert!(!sim_memory.read_bit(SimBitDeviceType::P, 0).unwrap());
        assert!(!sim_memory.read_bit(SimBitDeviceType::P, 100).unwrap());

        // Sync inputs
        sync.sync_inputs().unwrap();

        // Verify P relays now match Discrete Inputs
        assert!(sim_memory.read_bit(SimBitDeviceType::P, 0).unwrap());
        assert!(sim_memory.read_bit(SimBitDeviceType::P, 100).unwrap());
        assert!(sim_memory.read_bit(SimBitDeviceType::P, 500).unwrap());
    }

    #[test]
    fn test_sync_external_hr_to_d() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Simulate external write to Holding Register
        modbus_memory.write_holding_register(50, 12345).unwrap();
        sync.mark_external_write(50);

        // Verify D register is initially 0
        assert_eq!(sim_memory.read_word(SimWordDeviceType::D, 50).unwrap(), 0);

        // Sync inputs
        sync.sync_inputs().unwrap();

        // Verify D register now has the external value
        assert_eq!(
            sim_memory.read_word(SimWordDeviceType::D, 50).unwrap(),
            12345
        );
    }

    // ========================================================================
    // Output Sync Tests
    // ========================================================================

    #[test]
    fn test_sync_m_to_coils() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set some M relays
        sim_memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        sim_memory.write_bit(SimBitDeviceType::M, 100, true).unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Coils at M_COIL_OFFSET have the values
        let coils = modbus_memory.read_coils(M_COIL_OFFSET, 2).unwrap();
        assert!(coils[0]); // M0
        assert!(!coils[1]); // M1

        let coils_100 = modbus_memory.read_coils(M_COIL_OFFSET + 100, 1).unwrap();
        assert!(coils_100[0]); // M100
    }

    #[test]
    fn test_sync_k_to_coils() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set K relay
        sim_memory.write_bit(SimBitDeviceType::K, 10, true).unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Coil at K_COIL_OFFSET + 10
        let coils = modbus_memory.read_coils(K_COIL_OFFSET + 10, 1).unwrap();
        assert!(coils[0]);
    }

    #[test]
    fn test_sync_t_to_coils() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set T contact using internal write (T is readonly for normal writes)
        sim_memory
            .write_bit_internal(SimBitDeviceType::T, 5, true)
            .unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Coil at T_COIL_OFFSET + 5
        let coils = modbus_memory.read_coils(T_COIL_OFFSET + 5, 1).unwrap();
        assert!(coils[0]);
    }

    #[test]
    fn test_sync_c_to_coils() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set C contact using internal write (C is readonly for normal writes)
        sim_memory
            .write_bit_internal(SimBitDeviceType::C, 3, true)
            .unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Coil at C_COIL_OFFSET + 3
        let coils = modbus_memory.read_coils(C_COIL_OFFSET + 3, 1).unwrap();
        assert!(coils[0]);
    }

    #[test]
    fn test_sync_d_to_hr() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set D registers
        sim_memory
            .write_word(SimWordDeviceType::D, 0, 1000)
            .unwrap();
        sim_memory
            .write_word(SimWordDeviceType::D, 100, 2000)
            .unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Holding Registers at D_HR_OFFSET
        let hr = modbus_memory
            .read_holding_registers(D_HR_OFFSET, 1)
            .unwrap();
        assert_eq!(hr[0], 1000);

        let hr_100 = modbus_memory
            .read_holding_registers(D_HR_OFFSET + 100, 1)
            .unwrap();
        assert_eq!(hr_100[0], 2000);
    }

    #[test]
    fn test_sync_td_to_hr() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set TD (Timer current value)
        sim_memory
            .write_word(SimWordDeviceType::Td, 0, 500)
            .unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Holding Register at TD_HR_OFFSET
        let hr = modbus_memory
            .read_holding_registers(TD_HR_OFFSET, 1)
            .unwrap();
        assert_eq!(hr[0], 500);
    }

    #[test]
    fn test_sync_cd_to_hr() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set CD (Counter current value)
        sim_memory
            .write_word(SimWordDeviceType::Cd, 0, 42)
            .unwrap();

        // Sync outputs
        sync.sync_outputs().unwrap();

        // Verify Holding Register at CD_HR_OFFSET
        let hr = modbus_memory
            .read_holding_registers(CD_HR_OFFSET, 1)
            .unwrap();
        assert_eq!(hr[0], 42);
    }

    // ========================================================================
    // Full Sync and Mode Tests
    // ========================================================================

    #[test]
    fn test_full_sync() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // Set up input: Discrete Input
        modbus_memory.write_discrete_input(0, true).unwrap();

        // Set up output: M relay and D register
        sim_memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        sim_memory
            .write_word(SimWordDeviceType::D, 0, 9999)
            .unwrap();

        // Full sync
        sync.full_sync().unwrap();

        // Verify input sync happened (DI → P)
        assert!(sim_memory.read_bit(SimBitDeviceType::P, 0).unwrap());

        // Verify output sync happened (M → Coil, D → HR)
        assert!(modbus_memory.read_coils(M_COIL_OFFSET, 1).unwrap()[0]);
        assert_eq!(
            modbus_memory
                .read_holding_registers(D_HR_OFFSET, 1)
                .unwrap()[0],
            9999
        );
    }

    #[test]
    fn test_on_memory_change_immediate_mode() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::with_mode(
            Arc::clone(&sim_memory),
            Arc::clone(&modbus_memory),
            SyncMode::Immediate,
        );

        sim_memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();

        // In immediate mode, on_memory_change should sync
        sync.on_memory_change().unwrap();

        assert!(modbus_memory.read_coils(M_COIL_OFFSET, 1).unwrap()[0]);
    }

    #[test]
    fn test_on_scan_end_endofscan_mode() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        sim_memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();

        // In EndOfScan mode, on_scan_end should sync
        sync.on_scan_end().unwrap();

        assert!(modbus_memory.read_coils(M_COIL_OFFSET, 1).unwrap()[0]);
    }

    #[test]
    fn test_manual_sync_works_in_any_mode() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::with_mode(
            Arc::clone(&sim_memory),
            Arc::clone(&modbus_memory),
            SyncMode::Manual,
        );

        sim_memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();

        // Manual sync should work regardless of mode
        sync.manual_sync().unwrap();

        assert!(modbus_memory.read_coils(M_COIL_OFFSET, 1).unwrap()[0]);
    }

    // ========================================================================
    // Statistics Tests
    // ========================================================================

    #[test]
    fn test_sync_statistics() {
        let sync = create_test_sync();

        assert_eq!(sync.input_sync_count(), 0);
        assert_eq!(sync.output_sync_count(), 0);

        sync.sync_inputs().unwrap();
        assert_eq!(sync.input_sync_count(), 1);
        assert_eq!(sync.output_sync_count(), 0);

        sync.sync_outputs().unwrap();
        assert_eq!(sync.input_sync_count(), 1);
        assert_eq!(sync.output_sync_count(), 1);

        sync.full_sync().unwrap();
        assert_eq!(sync.input_sync_count(), 2);
        assert_eq!(sync.output_sync_count(), 2);

        sync.reset_stats();
        assert_eq!(sync.input_sync_count(), 0);
        assert_eq!(sync.output_sync_count(), 0);
    }

    // ========================================================================
    // Round-trip Tests
    // ========================================================================

    #[test]
    fn test_round_trip_discrete_to_p_to_m_to_coil() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // 1. External sets Discrete Input
        modbus_memory.write_discrete_input(0, true).unwrap();

        // 2. Input sync: DI → P
        sync.sync_inputs().unwrap();
        assert!(sim_memory.read_bit(SimBitDeviceType::P, 0).unwrap());

        // 3. Simulation uses P value to set M (simulating program logic)
        let p_value = sim_memory.read_bit(SimBitDeviceType::P, 0).unwrap();
        sim_memory
            .write_bit(SimBitDeviceType::M, 0, p_value)
            .unwrap();

        // 4. Output sync: M → Coil
        sync.sync_outputs().unwrap();
        assert!(modbus_memory.read_coils(M_COIL_OFFSET, 1).unwrap()[0]);
    }

    #[test]
    fn test_round_trip_external_hr_to_d() {
        let sim_memory = Arc::new(DeviceMemory::new());
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_count: 15000,
            discrete_input_count: 3000,
            holding_register_count: 35000,
            input_register_count: 10000,
        }));
        let sync = ModServerSync::new(Arc::clone(&sim_memory), Arc::clone(&modbus_memory));

        // 1. External client writes to Holding Register
        modbus_memory.write_holding_register(100, 5000).unwrap();
        sync.mark_external_write(100);

        // 2. Input sync: HR → D
        sync.sync_inputs().unwrap();
        assert_eq!(
            sim_memory.read_word(SimWordDeviceType::D, 100).unwrap(),
            5000
        );

        // 3. Simulation modifies D
        sim_memory
            .write_word(SimWordDeviceType::D, 100, 6000)
            .unwrap();

        // 4. Output sync: D → HR
        sync.sync_outputs().unwrap();
        assert_eq!(
            modbus_memory
                .read_holding_registers(D_HR_OFFSET + 100, 1)
                .unwrap()[0],
            6000
        );
    }
}
