//! Modbus memory implementation with thread-safe access

use bitvec::prelude::*;
use parking_lot::RwLock;
use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::sync::Arc;
use tauri::Emitter;

use super::types::{
    ChangeSource, MemoryBatchChangeEvent, MemoryChangeEvent, MemoryError, MemoryMapSettings,
    MemoryType,
};

// Event channel names
const EVENT_MEMORY_CHANGED: &str = "modbus:memory-changed";
const EVENT_MEMORY_BATCH_CHANGED: &str = "modbus:memory-batch-changed";

/// Thread-safe Modbus memory storage
///
/// Manages four memory types as per Modbus specification:
/// - Coils: Read/write bits (function codes 0x01, 0x05, 0x0F)
/// - Discrete Inputs: Read-only bits (function code 0x02)
/// - Holding Registers: Read/write 16-bit values (function codes 0x03, 0x06, 0x10)
/// - Input Registers: Read-only 16-bit values (function code 0x04)
pub struct ModbusMemory {
    coils: RwLock<BitVec<u8, Msb0>>,
    discrete_inputs: RwLock<BitVec<u8, Msb0>>,
    holding_registers: RwLock<Vec<u16>>,
    input_registers: RwLock<Vec<u16>>,
    config: MemoryMapSettings,
    /// Tauri app handle for event emission
    app_handle: RwLock<Option<Arc<tauri::AppHandle>>>,
    /// Buffer for batching change events
    change_buffer: RwLock<Vec<MemoryChangeEvent>>,
    /// Whether we're in batch mode
    batch_mode: RwLock<bool>,
}

impl ModbusMemory {
    /// Create a new ModbusMemory with the specified configuration
    pub fn new(config: &MemoryMapSettings) -> Self {
        Self {
            coils: RwLock::new(bitvec![u8, Msb0; 0; config.coil_count as usize]),
            discrete_inputs: RwLock::new(bitvec![u8, Msb0; 0; config.discrete_input_count as usize]),
            holding_registers: RwLock::new(vec![0u16; config.holding_register_count as usize]),
            input_registers: RwLock::new(vec![0u16; config.input_register_count as usize]),
            config: config.clone(),
            app_handle: RwLock::new(None),
            change_buffer: RwLock::new(Vec::new()),
            batch_mode: RwLock::new(false),
        }
    }

    /// Create a new ModbusMemory with default configuration
    pub fn with_defaults() -> Self {
        Self::new(&MemoryMapSettings::default())
    }

    /// Get the memory configuration
    pub fn config(&self) -> &MemoryMapSettings {
        &self.config
    }

    // ========== Event Infrastructure ==========

    /// Set the Tauri app handle for event emission
    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.write() = Some(Arc::new(handle));
    }

    /// Start batch mode - changes will be buffered until end_batch is called
    pub fn start_batch(&self) {
        *self.batch_mode.write() = true;
    }

    /// End batch mode and emit all buffered changes as a single batch event
    pub fn end_batch(&self) {
        *self.batch_mode.write() = false;
        self.flush_changes();
    }

    /// Flush all buffered changes as a batch event
    fn flush_changes(&self) {
        let changes: Vec<MemoryChangeEvent> = {
            let mut buffer = self.change_buffer.write();
            std::mem::take(&mut *buffer)
        };

        if changes.is_empty() {
            return;
        }

        if let Some(handle) = self.app_handle.read().as_ref() {
            let event = MemoryBatchChangeEvent { changes };
            let _ = handle.emit(EVENT_MEMORY_BATCH_CHANGED, event);
        }
    }

    /// Emit a single memory change event (or buffer it if in batch mode)
    fn emit_change(&self, event: MemoryChangeEvent) {
        if *self.batch_mode.read() {
            self.change_buffer.write().push(event);
        } else if let Some(handle) = self.app_handle.read().as_ref() {
            let _ = handle.emit(EVENT_MEMORY_CHANGED, event);
        }
    }

    // ========== Coils (Function codes 0x01, 0x05, 0x0F) ==========

    /// Read multiple coils starting from the specified address
    pub fn read_coils(&self, start: u16, count: u16) -> Result<Vec<bool>, MemoryError> {
        self.validate_bit_range(start, count, self.config.coil_count, "coil")?;

        let coils = self.coils.read();
        let start_idx = start as usize;
        let end_idx = start_idx + count as usize;

        Ok(coils[start_idx..end_idx].iter().map(|b| *b).collect())
    }

    /// Write a single coil at the specified address
    pub fn write_coil(&self, address: u16, value: bool) -> Result<(), MemoryError> {
        self.write_coil_with_source(address, value, ChangeSource::Internal)
    }

    /// Write a single coil with specified change source
    pub fn write_coil_with_source(
        &self,
        address: u16,
        value: bool,
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_address(address, self.config.coil_count, "coil")?;

        let old_value = {
            let coils = self.coils.read();
            coils[address as usize]
        };

        {
            let mut coils = self.coils.write();
            coils.set(address as usize, value);
        }

        // Only emit if value actually changed
        if old_value != value {
            self.emit_change(MemoryChangeEvent::coil(address, old_value, value, source.as_str()));
        }

        Ok(())
    }

    /// Write multiple coils starting from the specified address
    pub fn write_coils(&self, start: u16, values: &[bool]) -> Result<(), MemoryError> {
        self.write_coils_with_source(start, values, ChangeSource::Internal)
    }

    /// Write multiple coils with specified change source
    pub fn write_coils_with_source(
        &self,
        start: u16,
        values: &[bool],
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_bit_range(start, values.len() as u16, self.config.coil_count, "coil")?;

        // Read old values first
        let old_values: Vec<bool> = {
            let coils = self.coils.read();
            (0..values.len())
                .map(|i| coils[start as usize + i])
                .collect()
        };

        // Write new values
        {
            let mut coils = self.coils.write();
            for (i, &value) in values.iter().enumerate() {
                coils.set(start as usize + i, value);
            }
        }

        // Emit batch event for changes
        self.start_batch();
        for (i, (&old, &new)) in old_values.iter().zip(values.iter()).enumerate() {
            if old != new {
                self.emit_change(MemoryChangeEvent::coil(
                    start + i as u16,
                    old,
                    new,
                    source.as_str(),
                ));
            }
        }
        self.end_batch();

        Ok(())
    }

    // ========== Discrete Inputs (Function code 0x02) ==========

    /// Read multiple discrete inputs starting from the specified address
    pub fn read_discrete_inputs(&self, start: u16, count: u16) -> Result<Vec<bool>, MemoryError> {
        self.validate_bit_range(start, count, self.config.discrete_input_count, "discrete input")?;

        let inputs = self.discrete_inputs.read();
        let start_idx = start as usize;
        let end_idx = start_idx + count as usize;

        Ok(inputs[start_idx..end_idx].iter().map(|b| *b).collect())
    }

    /// Write a single discrete input (internal use for simulation)
    pub fn write_discrete_input(&self, address: u16, value: bool) -> Result<(), MemoryError> {
        self.write_discrete_input_with_source(address, value, ChangeSource::Internal)
    }

    /// Write a single discrete input with specified change source
    pub fn write_discrete_input_with_source(
        &self,
        address: u16,
        value: bool,
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_address(address, self.config.discrete_input_count, "discrete input")?;

        let old_value = {
            let inputs = self.discrete_inputs.read();
            inputs[address as usize]
        };

        {
            let mut inputs = self.discrete_inputs.write();
            inputs.set(address as usize, value);
        }

        if old_value != value {
            self.emit_change(MemoryChangeEvent::discrete(
                address, old_value, value, source.as_str(),
            ));
        }

        Ok(())
    }

    /// Write multiple discrete inputs (internal use for simulation)
    pub fn write_discrete_inputs(&self, start: u16, values: &[bool]) -> Result<(), MemoryError> {
        self.write_discrete_inputs_with_source(start, values, ChangeSource::Internal)
    }

    /// Write multiple discrete inputs with specified change source
    pub fn write_discrete_inputs_with_source(
        &self,
        start: u16,
        values: &[bool],
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_bit_range(
            start,
            values.len() as u16,
            self.config.discrete_input_count,
            "discrete input",
        )?;

        let old_values: Vec<bool> = {
            let inputs = self.discrete_inputs.read();
            (0..values.len())
                .map(|i| inputs[start as usize + i])
                .collect()
        };

        {
            let mut inputs = self.discrete_inputs.write();
            for (i, &value) in values.iter().enumerate() {
                inputs.set(start as usize + i, value);
            }
        }

        self.start_batch();
        for (i, (&old, &new)) in old_values.iter().zip(values.iter()).enumerate() {
            if old != new {
                self.emit_change(MemoryChangeEvent::discrete(
                    start + i as u16,
                    old,
                    new,
                    source.as_str(),
                ));
            }
        }
        self.end_batch();

        Ok(())
    }

    // ========== Holding Registers (Function codes 0x03, 0x06, 0x10) ==========

    /// Read multiple holding registers starting from the specified address
    pub fn read_holding_registers(&self, start: u16, count: u16) -> Result<Vec<u16>, MemoryError> {
        self.validate_register_range(start, count, self.config.holding_register_count, "holding register")?;

        let registers = self.holding_registers.read();
        let start_idx = start as usize;
        let end_idx = start_idx + count as usize;

        Ok(registers[start_idx..end_idx].to_vec())
    }

    /// Write a single holding register at the specified address
    pub fn write_holding_register(&self, address: u16, value: u16) -> Result<(), MemoryError> {
        self.write_holding_register_with_source(address, value, ChangeSource::Internal)
    }

    /// Write a single holding register with specified change source
    pub fn write_holding_register_with_source(
        &self,
        address: u16,
        value: u16,
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_address(address, self.config.holding_register_count, "holding register")?;

        let old_value = {
            let registers = self.holding_registers.read();
            registers[address as usize]
        };

        {
            let mut registers = self.holding_registers.write();
            registers[address as usize] = value;
        }

        if old_value != value {
            self.emit_change(MemoryChangeEvent::holding(
                address, old_value, value, source.as_str(),
            ));
        }

        Ok(())
    }

    /// Write multiple holding registers starting from the specified address
    pub fn write_holding_registers(&self, start: u16, values: &[u16]) -> Result<(), MemoryError> {
        self.write_holding_registers_with_source(start, values, ChangeSource::Internal)
    }

    /// Write multiple holding registers with specified change source
    pub fn write_holding_registers_with_source(
        &self,
        start: u16,
        values: &[u16],
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_register_range(
            start,
            values.len() as u16,
            self.config.holding_register_count,
            "holding register",
        )?;

        let old_values: Vec<u16> = {
            let registers = self.holding_registers.read();
            registers[start as usize..start as usize + values.len()].to_vec()
        };

        {
            let mut registers = self.holding_registers.write();
            for (i, &value) in values.iter().enumerate() {
                registers[start as usize + i] = value;
            }
        }

        self.start_batch();
        for (i, (&old, &new)) in old_values.iter().zip(values.iter()).enumerate() {
            if old != new {
                self.emit_change(MemoryChangeEvent::holding(
                    start + i as u16,
                    old,
                    new,
                    source.as_str(),
                ));
            }
        }
        self.end_batch();

        Ok(())
    }

    // ========== Input Registers (Function code 0x04) ==========

    /// Read multiple input registers starting from the specified address
    pub fn read_input_registers(&self, start: u16, count: u16) -> Result<Vec<u16>, MemoryError> {
        self.validate_register_range(start, count, self.config.input_register_count, "input register")?;

        let registers = self.input_registers.read();
        let start_idx = start as usize;
        let end_idx = start_idx + count as usize;

        Ok(registers[start_idx..end_idx].to_vec())
    }

    /// Write a single input register (internal use for simulation)
    pub fn write_input_register(&self, address: u16, value: u16) -> Result<(), MemoryError> {
        self.write_input_register_with_source(address, value, ChangeSource::Internal)
    }

    /// Write a single input register with specified change source
    pub fn write_input_register_with_source(
        &self,
        address: u16,
        value: u16,
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_address(address, self.config.input_register_count, "input register")?;

        let old_value = {
            let registers = self.input_registers.read();
            registers[address as usize]
        };

        {
            let mut registers = self.input_registers.write();
            registers[address as usize] = value;
        }

        if old_value != value {
            self.emit_change(MemoryChangeEvent::input(
                address, old_value, value, source.as_str(),
            ));
        }

        Ok(())
    }

    /// Write multiple input registers (internal use for simulation)
    pub fn write_input_registers(&self, start: u16, values: &[u16]) -> Result<(), MemoryError> {
        self.write_input_registers_with_source(start, values, ChangeSource::Internal)
    }

    /// Write multiple input registers with specified change source
    pub fn write_input_registers_with_source(
        &self,
        start: u16,
        values: &[u16],
        source: ChangeSource,
    ) -> Result<(), MemoryError> {
        self.validate_register_range(
            start,
            values.len() as u16,
            self.config.input_register_count,
            "input register",
        )?;

        let old_values: Vec<u16> = {
            let registers = self.input_registers.read();
            registers[start as usize..start as usize + values.len()].to_vec()
        };

        {
            let mut registers = self.input_registers.write();
            for (i, &value) in values.iter().enumerate() {
                registers[start as usize + i] = value;
            }
        }

        self.start_batch();
        for (i, (&old, &new)) in old_values.iter().zip(values.iter()).enumerate() {
            if old != new {
                self.emit_change(MemoryChangeEvent::input(
                    start + i as u16,
                    old,
                    new,
                    source.as_str(),
                ));
            }
        }
        self.end_batch();

        Ok(())
    }

    // ========== CSV Snapshot ==========

    /// Save current memory state to a CSV file
    ///
    /// Format: address,type,value
    /// - type: coil, discrete, holding, input
    /// - value: 0/1 for bits, 0-65535 for registers
    pub fn save_to_csv(&self, path: &Path) -> Result<(), MemoryError> {
        let mut file = File::create(path)?;
        writeln!(file, "address,type,value")?;

        // Save coils
        let coils = self.coils.read();
        for (addr, bit) in coils.iter().enumerate() {
            if *bit {
                writeln!(file, "{},coil,1", addr)?;
            }
        }

        // Save discrete inputs
        let discrete = self.discrete_inputs.read();
        for (addr, bit) in discrete.iter().enumerate() {
            if *bit {
                writeln!(file, "{},discrete,1", addr)?;
            }
        }

        // Save holding registers
        let holding = self.holding_registers.read();
        for (addr, &value) in holding.iter().enumerate() {
            if value != 0 {
                writeln!(file, "{},holding,{}", addr, value)?;
            }
        }

        // Save input registers
        let input = self.input_registers.read();
        for (addr, &value) in input.iter().enumerate() {
            if value != 0 {
                writeln!(file, "{},input,{}", addr, value)?;
            }
        }

        Ok(())
    }

    /// Load memory state from a CSV file
    ///
    /// This clears existing memory before loading.
    pub fn load_from_csv(&self, path: &Path) -> Result<(), MemoryError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);

        // Clear existing memory
        self.clear();

        for (line_num, line_result) in reader.lines().enumerate() {
            let line = line_result?;

            // Skip header and empty lines
            if line_num == 0 && line.starts_with("address") {
                continue;
            }
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() != 3 {
                return Err(MemoryError::CsvParseError {
                    line: line_num + 1,
                    message: format!("Expected 3 fields, got {}", parts.len()),
                });
            }

            let address: u16 = parts[0].trim().parse().map_err(|_| MemoryError::CsvParseError {
                line: line_num + 1,
                message: format!("Invalid address: {}", parts[0]),
            })?;

            let mem_type = MemoryType::from_str(parts[1].trim()).ok_or_else(|| {
                MemoryError::CsvParseError {
                    line: line_num + 1,
                    message: format!("Invalid memory type: {}", parts[1]),
                }
            })?;

            let value: u16 = parts[2].trim().parse().map_err(|_| MemoryError::CsvParseError {
                line: line_num + 1,
                message: format!("Invalid value: {}", parts[2]),
            })?;

            match mem_type {
                MemoryType::Coil => {
                    self.write_coil(address, value != 0)?;
                }
                MemoryType::DiscreteInput => {
                    self.write_discrete_input(address, value != 0)?;
                }
                MemoryType::HoldingRegister => {
                    self.write_holding_register(address, value)?;
                }
                MemoryType::InputRegister => {
                    self.write_input_register(address, value)?;
                }
            }
        }

        Ok(())
    }

    /// Clear all memory to zeros
    pub fn clear(&self) {
        self.coils.write().fill(false);
        self.discrete_inputs.write().fill(false);
        self.holding_registers.write().fill(0);
        self.input_registers.write().fill(0);
    }

    // ========== Validation Helpers ==========

    fn validate_address(&self, address: u16, max: u16, _name: &str) -> Result<(), MemoryError> {
        if address >= max {
            return Err(MemoryError::AddressOutOfRange {
                address,
                start: 0,
                end: max.saturating_sub(1),
            });
        }
        Ok(())
    }

    fn validate_bit_range(&self, start: u16, count: u16, max: u16, _name: &str) -> Result<(), MemoryError> {
        if count == 0 {
            return Err(MemoryError::InvalidCount { count });
        }

        if start >= max {
            return Err(MemoryError::AddressOutOfRange {
                address: start,
                start: 0,
                end: max.saturating_sub(1),
            });
        }

        let end = start.saturating_add(count);
        if end > max {
            return Err(MemoryError::CountExceedsRange {
                address: start,
                count,
                available: max - start,
            });
        }

        Ok(())
    }

    fn validate_register_range(&self, start: u16, count: u16, max: u16, name: &str) -> Result<(), MemoryError> {
        self.validate_bit_range(start, count, max, name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;
    use tempfile::NamedTempFile;

    fn create_test_memory() -> ModbusMemory {
        ModbusMemory::new(&MemoryMapSettings {
            coil_count: 100,
            discrete_input_count: 100,
            holding_register_count: 100,
            input_register_count: 100,
        })
    }

    // ========== Initialization Tests ==========

    #[test]
    fn test_memory_initialization() {
        let memory = create_test_memory();

        // All values should be zero
        assert_eq!(memory.read_coils(0, 10).unwrap(), vec![false; 10]);
        assert_eq!(memory.read_discrete_inputs(0, 10).unwrap(), vec![false; 10]);
        assert_eq!(memory.read_holding_registers(0, 10).unwrap(), vec![0u16; 10]);
        assert_eq!(memory.read_input_registers(0, 10).unwrap(), vec![0u16; 10]);
    }

    // ========== Coil Tests ==========

    #[test]
    fn test_coil_read_write() {
        let memory = create_test_memory();

        // Write single coil
        memory.write_coil(5, true).unwrap();
        assert_eq!(memory.read_coils(5, 1).unwrap(), vec![true]);

        // Write multiple coils
        memory.write_coils(10, &[true, false, true]).unwrap();
        assert_eq!(memory.read_coils(10, 3).unwrap(), vec![true, false, true]);
    }

    #[test]
    fn test_coil_boundary() {
        let memory = create_test_memory();

        // Write at last valid address
        memory.write_coil(99, true).unwrap();
        assert_eq!(memory.read_coils(99, 1).unwrap(), vec![true]);

        // Out of range should fail
        assert!(memory.write_coil(100, true).is_err());
        assert!(memory.read_coils(100, 1).is_err());
    }

    // ========== Holding Register Tests ==========

    #[test]
    fn test_holding_register_read_write() {
        let memory = create_test_memory();

        // Write single register
        memory.write_holding_register(0, 1234).unwrap();
        assert_eq!(memory.read_holding_registers(0, 1).unwrap(), vec![1234]);

        // Write multiple registers
        memory.write_holding_registers(10, &[100, 200, 300]).unwrap();
        assert_eq!(memory.read_holding_registers(10, 3).unwrap(), vec![100, 200, 300]);
    }

    #[test]
    fn test_holding_register_max_value() {
        let memory = create_test_memory();

        memory.write_holding_register(0, u16::MAX).unwrap();
        assert_eq!(memory.read_holding_registers(0, 1).unwrap(), vec![u16::MAX]);
    }

    // ========== Error Tests ==========

    #[test]
    fn test_count_exceeds_range() {
        let memory = create_test_memory();

        // Try to read more than available from near the end
        let result = memory.read_coils(95, 10);
        assert!(matches!(result, Err(MemoryError::CountExceedsRange { .. })));
    }

    #[test]
    fn test_invalid_count() {
        let memory = create_test_memory();

        // Zero count should fail
        let result = memory.read_coils(0, 0);
        assert!(matches!(result, Err(MemoryError::InvalidCount { .. })));
    }

    // ========== Concurrent Access Tests ==========

    #[test]
    fn test_concurrent_reads() {
        let memory = Arc::new(create_test_memory());
        memory.write_holding_register(0, 42).unwrap();

        let handles: Vec<_> = (0..10)
            .map(|_| {
                let mem = Arc::clone(&memory);
                thread::spawn(move || {
                    for _ in 0..100 {
                        let value = mem.read_holding_registers(0, 1).unwrap();
                        assert_eq!(value[0], 42);
                    }
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }
    }

    #[test]
    fn test_concurrent_write_read() {
        let memory = Arc::new(create_test_memory());

        let writer = {
            let mem = Arc::clone(&memory);
            thread::spawn(move || {
                for i in 0..100u16 {
                    mem.write_holding_register(0, i).unwrap();
                }
            })
        };

        let reader = {
            let mem = Arc::clone(&memory);
            thread::spawn(move || {
                for _ in 0..100 {
                    let _ = mem.read_holding_registers(0, 1).unwrap();
                }
            })
        };

        writer.join().unwrap();
        reader.join().unwrap();
    }

    // ========== CSV Tests ==========

    #[test]
    fn test_csv_roundtrip() {
        let memory = create_test_memory();

        // Set some values
        memory.write_coil(0, true).unwrap();
        memory.write_coil(5, true).unwrap();
        memory.write_discrete_input(10, true).unwrap();
        memory.write_holding_register(20, 1234).unwrap();
        memory.write_input_register(30, 5678).unwrap();

        // Save to CSV
        let temp_file = NamedTempFile::new().unwrap();
        memory.save_to_csv(temp_file.path()).unwrap();

        // Create new memory and load
        let memory2 = create_test_memory();
        memory2.load_from_csv(temp_file.path()).unwrap();

        // Verify values
        assert_eq!(memory2.read_coils(0, 1).unwrap(), vec![true]);
        assert_eq!(memory2.read_coils(5, 1).unwrap(), vec![true]);
        assert_eq!(memory2.read_discrete_inputs(10, 1).unwrap(), vec![true]);
        assert_eq!(memory2.read_holding_registers(20, 1).unwrap(), vec![1234]);
        assert_eq!(memory2.read_input_registers(30, 1).unwrap(), vec![5678]);
    }

    #[test]
    fn test_clear() {
        let memory = create_test_memory();

        // Set some values
        memory.write_coil(0, true).unwrap();
        memory.write_holding_register(0, 1234).unwrap();

        // Clear
        memory.clear();

        // Verify cleared
        assert_eq!(memory.read_coils(0, 1).unwrap(), vec![false]);
        assert_eq!(memory.read_holding_registers(0, 1).unwrap(), vec![0]);
    }
}
