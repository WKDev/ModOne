//! Device Memory Module
//!
//! Manages all PLC device memory areas for the OneSim simulation engine.
//! Provides thread-safe access to bit devices (P, M, K, F, T, C) and
//! word devices (D, R, Z, N, TD, CD) using bitvec and parking_lot.

use bitvec::prelude::*;
use parking_lot::RwLock;
use std::collections::HashMap;
use thiserror::Error;

use super::types::{MemorySnapshot, SimBitDeviceType, SimWordDeviceType};

// ============================================================================
// Error Types
// ============================================================================

/// Simulation memory error types
#[derive(Debug, Error)]
pub enum SimMemoryError {
    /// Address is out of range for the device
    #[error("Address {address} out of range for device {device} (max: {max})")]
    AddressOutOfRange {
        device: String,
        address: u16,
        max: u16,
    },

    /// Attempted to write to a read-only device
    #[error("Cannot write to read-only device {device}")]
    ReadOnlyDevice { device: String },

    /// Bit index is out of range (0-15)
    #[error("Bit index {index} out of range (0-15)")]
    BitIndexOutOfRange { index: u8 },
}

/// Result type for memory operations
pub type SimMemoryResult<T> = Result<T, SimMemoryError>;

// ============================================================================
// Device Memory Sizes
// ============================================================================

/// P relay size (Input Relay)
const P_SIZE: usize = 2048;
/// M relay size (Auxiliary Relay)
const M_SIZE: usize = 8192;
/// K relay size (Keep Relay - persistent)
const K_SIZE: usize = 2048;
/// F relay size (Special Relay - read-only)
const F_SIZE: usize = 2048;
/// T contact size (Timer Contact)
const T_SIZE: usize = 2048;
/// C contact size (Counter Contact)
const C_SIZE: usize = 2048;

/// D register size (Data Register)
const D_SIZE: usize = 10000;
/// R register size (Retentive Data Register)
const R_SIZE: usize = 10000;
/// Z register size (Index Register)
const Z_SIZE: usize = 16;
/// N register size (Link Register)
const N_SIZE: usize = 8192;
/// TD register size (Timer Current Value)
const TD_SIZE: usize = 2048;
/// CD register size (Counter Current Value)
const CD_SIZE: usize = 2048;

// ============================================================================
// Device Memory Structure
// ============================================================================

/// PLC Device Memory
///
/// Manages all memory areas for the simulated PLC including bit devices
/// (relays/contacts) and word devices (registers).
pub struct DeviceMemory {
    // Bit devices
    /// P - Input Relay (2048 bits)
    p_relays: RwLock<BitVec<u8, Msb0>>,
    /// M - Auxiliary Relay (8192 bits)
    m_relays: RwLock<BitVec<u8, Msb0>>,
    /// K - Keep Relay (2048 bits, persistent)
    k_relays: RwLock<BitVec<u8, Msb0>>,
    /// F - Special Relay (2048 bits, read-only)
    f_relays: RwLock<BitVec<u8, Msb0>>,
    /// T - Timer Contact (2048 bits)
    t_contacts: RwLock<BitVec<u8, Msb0>>,
    /// C - Counter Contact (2048 bits)
    c_contacts: RwLock<BitVec<u8, Msb0>>,

    // Word devices
    /// D - Data Register (10000 words)
    d_registers: RwLock<Vec<u16>>,
    /// R - Retentive Data Register (10000 words)
    r_registers: RwLock<Vec<u16>>,
    /// Z - Index Register (16 words)
    z_registers: RwLock<Vec<u16>>,
    /// N - Link Register (8192 words)
    n_registers: RwLock<Vec<u16>>,
    /// TD - Timer Current Value (2048 words)
    td_values: RwLock<Vec<u16>>,
    /// CD - Counter Current Value (2048 words)
    cd_values: RwLock<Vec<u16>>,

    /// Previous bit states for edge detection
    previous_bits: RwLock<HashMap<String, bool>>,
}

impl DeviceMemory {
    /// Create a new DeviceMemory instance with all areas initialized to zero
    pub fn new() -> Self {
        Self {
            // Bit devices
            p_relays: RwLock::new(bitvec![u8, Msb0; 0; P_SIZE]),
            m_relays: RwLock::new(bitvec![u8, Msb0; 0; M_SIZE]),
            k_relays: RwLock::new(bitvec![u8, Msb0; 0; K_SIZE]),
            f_relays: RwLock::new(bitvec![u8, Msb0; 0; F_SIZE]),
            t_contacts: RwLock::new(bitvec![u8, Msb0; 0; T_SIZE]),
            c_contacts: RwLock::new(bitvec![u8, Msb0; 0; C_SIZE]),

            // Word devices
            d_registers: RwLock::new(vec![0u16; D_SIZE]),
            r_registers: RwLock::new(vec![0u16; R_SIZE]),
            z_registers: RwLock::new(vec![0u16; Z_SIZE]),
            n_registers: RwLock::new(vec![0u16; N_SIZE]),
            td_values: RwLock::new(vec![0u16; TD_SIZE]),
            cd_values: RwLock::new(vec![0u16; CD_SIZE]),

            // Edge detection
            previous_bits: RwLock::new(HashMap::new()),
        }
    }

    // ========================================================================
    // Bit Device Operations
    // ========================================================================

    /// Get the maximum address for a bit device type
    fn bit_device_max(&self, device: SimBitDeviceType) -> u16 {
        match device {
            SimBitDeviceType::P => P_SIZE as u16 - 1,
            SimBitDeviceType::M => M_SIZE as u16 - 1,
            SimBitDeviceType::K => K_SIZE as u16 - 1,
            SimBitDeviceType::F => F_SIZE as u16 - 1,
            SimBitDeviceType::T => T_SIZE as u16 - 1,
            SimBitDeviceType::C => C_SIZE as u16 - 1,
        }
    }

    /// Validate a bit device address
    fn validate_bit_address(&self, device: SimBitDeviceType, address: u16) -> SimMemoryResult<()> {
        let max = self.bit_device_max(device);
        if address > max {
            return Err(SimMemoryError::AddressOutOfRange {
                device: device.as_str().to_string(),
                address,
                max,
            });
        }
        Ok(())
    }

    /// Read a single bit from a bit device
    pub fn read_bit(&self, device: SimBitDeviceType, address: u16) -> SimMemoryResult<bool> {
        self.validate_bit_address(device, address)?;

        let idx = address as usize;
        let value = match device {
            SimBitDeviceType::P => *self.p_relays.read().get(idx).unwrap(),
            SimBitDeviceType::M => *self.m_relays.read().get(idx).unwrap(),
            SimBitDeviceType::K => *self.k_relays.read().get(idx).unwrap(),
            SimBitDeviceType::F => *self.f_relays.read().get(idx).unwrap(),
            SimBitDeviceType::T => *self.t_contacts.read().get(idx).unwrap(),
            SimBitDeviceType::C => *self.c_contacts.read().get(idx).unwrap(),
        };
        Ok(value)
    }

    /// Write a single bit to a bit device
    pub fn write_bit(
        &self,
        device: SimBitDeviceType,
        address: u16,
        value: bool,
    ) -> SimMemoryResult<()> {
        self.validate_bit_address(device, address)?;

        // Check if device is read-only
        if device.is_readonly() {
            return Err(SimMemoryError::ReadOnlyDevice {
                device: device.as_str().to_string(),
            });
        }

        let idx = address as usize;
        match device {
            SimBitDeviceType::P => self.p_relays.write().set(idx, value),
            SimBitDeviceType::M => self.m_relays.write().set(idx, value),
            SimBitDeviceType::K => self.k_relays.write().set(idx, value),
            SimBitDeviceType::F | SimBitDeviceType::T | SimBitDeviceType::C => {
                // Should not reach here due to is_readonly check above
                unreachable!()
            }
        }
        Ok(())
    }

    /// Write a single bit to a bit device (internal use - bypasses readonly check)
    ///
    /// Used by the simulation engine to update T/C contacts
    pub(crate) fn write_bit_internal(
        &self,
        device: SimBitDeviceType,
        address: u16,
        value: bool,
    ) -> SimMemoryResult<()> {
        self.validate_bit_address(device, address)?;

        let idx = address as usize;
        match device {
            SimBitDeviceType::P => self.p_relays.write().set(idx, value),
            SimBitDeviceType::M => self.m_relays.write().set(idx, value),
            SimBitDeviceType::K => self.k_relays.write().set(idx, value),
            SimBitDeviceType::F => self.f_relays.write().set(idx, value),
            SimBitDeviceType::T => self.t_contacts.write().set(idx, value),
            SimBitDeviceType::C => self.c_contacts.write().set(idx, value),
        }
        Ok(())
    }

    /// Read multiple consecutive bits from a bit device
    pub fn read_bits(
        &self,
        device: SimBitDeviceType,
        start: u16,
        count: u16,
    ) -> SimMemoryResult<Vec<bool>> {
        let end = start.saturating_add(count).saturating_sub(1);
        self.validate_bit_address(device, start)?;
        self.validate_bit_address(device, end)?;

        let start_idx = start as usize;
        let end_idx = start_idx + count as usize;

        let bits: Vec<bool> = match device {
            SimBitDeviceType::P => self.p_relays.read()[start_idx..end_idx]
                .iter()
                .map(|b| *b)
                .collect(),
            SimBitDeviceType::M => self.m_relays.read()[start_idx..end_idx]
                .iter()
                .map(|b| *b)
                .collect(),
            SimBitDeviceType::K => self.k_relays.read()[start_idx..end_idx]
                .iter()
                .map(|b| *b)
                .collect(),
            SimBitDeviceType::F => self.f_relays.read()[start_idx..end_idx]
                .iter()
                .map(|b| *b)
                .collect(),
            SimBitDeviceType::T => self.t_contacts.read()[start_idx..end_idx]
                .iter()
                .map(|b| *b)
                .collect(),
            SimBitDeviceType::C => self.c_contacts.read()[start_idx..end_idx]
                .iter()
                .map(|b| *b)
                .collect(),
        };
        Ok(bits)
    }

    // ========================================================================
    // Word Device Operations
    // ========================================================================

    /// Get the maximum address for a word device type
    fn word_device_max(&self, device: SimWordDeviceType) -> u16 {
        match device {
            SimWordDeviceType::D => D_SIZE as u16 - 1,
            SimWordDeviceType::R => R_SIZE as u16 - 1,
            SimWordDeviceType::Z => Z_SIZE as u16 - 1,
            SimWordDeviceType::N => N_SIZE as u16 - 1,
            SimWordDeviceType::Td => TD_SIZE as u16 - 1,
            SimWordDeviceType::Cd => CD_SIZE as u16 - 1,
        }
    }

    /// Validate a word device address
    fn validate_word_address(
        &self,
        device: SimWordDeviceType,
        address: u16,
    ) -> SimMemoryResult<()> {
        let max = self.word_device_max(device);
        if address > max {
            return Err(SimMemoryError::AddressOutOfRange {
                device: device.as_str().to_string(),
                address,
                max,
            });
        }
        Ok(())
    }

    /// Read a single word from a word device
    pub fn read_word(&self, device: SimWordDeviceType, address: u16) -> SimMemoryResult<u16> {
        self.validate_word_address(device, address)?;

        let idx = address as usize;
        let value = match device {
            SimWordDeviceType::D => self.d_registers.read()[idx],
            SimWordDeviceType::R => self.r_registers.read()[idx],
            SimWordDeviceType::Z => self.z_registers.read()[idx],
            SimWordDeviceType::N => self.n_registers.read()[idx],
            SimWordDeviceType::Td => self.td_values.read()[idx],
            SimWordDeviceType::Cd => self.cd_values.read()[idx],
        };
        Ok(value)
    }

    /// Write a single word to a word device
    pub fn write_word(
        &self,
        device: SimWordDeviceType,
        address: u16,
        value: u16,
    ) -> SimMemoryResult<()> {
        self.validate_word_address(device, address)?;

        let idx = address as usize;
        match device {
            SimWordDeviceType::D => self.d_registers.write()[idx] = value,
            SimWordDeviceType::R => self.r_registers.write()[idx] = value,
            SimWordDeviceType::Z => self.z_registers.write()[idx] = value,
            SimWordDeviceType::N => self.n_registers.write()[idx] = value,
            SimWordDeviceType::Td => self.td_values.write()[idx] = value,
            SimWordDeviceType::Cd => self.cd_values.write()[idx] = value,
        }
        Ok(())
    }

    /// Read multiple consecutive words from a word device
    pub fn read_words(
        &self,
        device: SimWordDeviceType,
        start: u16,
        count: u16,
    ) -> SimMemoryResult<Vec<u16>> {
        let end = start.saturating_add(count).saturating_sub(1);
        self.validate_word_address(device, start)?;
        self.validate_word_address(device, end)?;

        let start_idx = start as usize;
        let end_idx = start_idx + count as usize;

        let words = match device {
            SimWordDeviceType::D => self.d_registers.read()[start_idx..end_idx].to_vec(),
            SimWordDeviceType::R => self.r_registers.read()[start_idx..end_idx].to_vec(),
            SimWordDeviceType::Z => self.z_registers.read()[start_idx..end_idx].to_vec(),
            SimWordDeviceType::N => self.n_registers.read()[start_idx..end_idx].to_vec(),
            SimWordDeviceType::Td => self.td_values.read()[start_idx..end_idx].to_vec(),
            SimWordDeviceType::Cd => self.cd_values.read()[start_idx..end_idx].to_vec(),
        };
        Ok(words)
    }

    // ========================================================================
    // Word Bit Access
    // ========================================================================

    /// Read a single bit from a word device (e.g., D0000.5)
    pub fn read_word_bit(
        &self,
        device: SimWordDeviceType,
        address: u16,
        bit: u8,
    ) -> SimMemoryResult<bool> {
        if bit > 15 {
            return Err(SimMemoryError::BitIndexOutOfRange { index: bit });
        }

        let word = self.read_word(device, address)?;
        Ok((word >> bit) & 1 == 1)
    }

    /// Write a single bit in a word device (e.g., D0000.5)
    pub fn write_word_bit(
        &self,
        device: SimWordDeviceType,
        address: u16,
        bit: u8,
        value: bool,
    ) -> SimMemoryResult<()> {
        if bit > 15 {
            return Err(SimMemoryError::BitIndexOutOfRange { index: bit });
        }

        self.validate_word_address(device, address)?;

        let idx = address as usize;
        let mask = 1u16 << bit;

        match device {
            SimWordDeviceType::D => {
                let mut regs = self.d_registers.write();
                if value {
                    regs[idx] |= mask;
                } else {
                    regs[idx] &= !mask;
                }
            }
            SimWordDeviceType::R => {
                let mut regs = self.r_registers.write();
                if value {
                    regs[idx] |= mask;
                } else {
                    regs[idx] &= !mask;
                }
            }
            SimWordDeviceType::Z => {
                let mut regs = self.z_registers.write();
                if value {
                    regs[idx] |= mask;
                } else {
                    regs[idx] &= !mask;
                }
            }
            SimWordDeviceType::N => {
                let mut regs = self.n_registers.write();
                if value {
                    regs[idx] |= mask;
                } else {
                    regs[idx] &= !mask;
                }
            }
            SimWordDeviceType::Td => {
                let mut regs = self.td_values.write();
                if value {
                    regs[idx] |= mask;
                } else {
                    regs[idx] &= !mask;
                }
            }
            SimWordDeviceType::Cd => {
                let mut regs = self.cd_values.write();
                if value {
                    regs[idx] |= mask;
                } else {
                    regs[idx] &= !mask;
                }
            }
        }
        Ok(())
    }

    // ========================================================================
    // Edge Detection
    // ========================================================================

    /// Detect rising edge (false -> true transition)
    ///
    /// Returns true if the previous value was false and current is true
    pub fn detect_rising_edge(&self, address: &str, current: bool) -> bool {
        let previous = self.previous_bits.read().get(address).copied().unwrap_or(false);
        !previous && current
    }

    /// Detect falling edge (true -> false transition)
    ///
    /// Returns true if the previous value was true and current is false
    pub fn detect_falling_edge(&self, address: &str, current: bool) -> bool {
        let previous = self.previous_bits.read().get(address).copied().unwrap_or(false);
        previous && !current
    }

    /// Update the previous state for a bit address
    pub fn update_previous(&self, address: &str, value: bool) {
        self.previous_bits
            .write()
            .insert(address.to_string(), value);
    }

    // ========================================================================
    // Snapshot and Clear Operations
    // ========================================================================

    /// Get a snapshot of all memory areas
    pub fn get_snapshot(&self, name: &str) -> MemorySnapshot {
        let mut snapshot = MemorySnapshot {
            name: name.to_string(),
            ..Default::default()
        };

        // Capture bit devices
        let bit_devices = &mut snapshot.bit_devices;

        // P relays
        let p_map: std::collections::HashMap<u32, bool> = self
            .p_relays
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v)
            .map(|(i, v)| (i as u32, *v))
            .collect();
        if !p_map.is_empty() {
            bit_devices.insert("P".to_string(), p_map);
        }

        // M relays
        let m_map: std::collections::HashMap<u32, bool> = self
            .m_relays
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v)
            .map(|(i, v)| (i as u32, *v))
            .collect();
        if !m_map.is_empty() {
            bit_devices.insert("M".to_string(), m_map);
        }

        // K relays
        let k_map: std::collections::HashMap<u32, bool> = self
            .k_relays
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v)
            .map(|(i, v)| (i as u32, *v))
            .collect();
        if !k_map.is_empty() {
            bit_devices.insert("K".to_string(), k_map);
        }

        // T contacts
        let t_map: std::collections::HashMap<u32, bool> = self
            .t_contacts
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v)
            .map(|(i, v)| (i as u32, *v))
            .collect();
        if !t_map.is_empty() {
            bit_devices.insert("T".to_string(), t_map);
        }

        // C contacts
        let c_map: std::collections::HashMap<u32, bool> = self
            .c_contacts
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v)
            .map(|(i, v)| (i as u32, *v))
            .collect();
        if !c_map.is_empty() {
            bit_devices.insert("C".to_string(), c_map);
        }

        // Capture word devices (only non-zero values)
        let word_devices = &mut snapshot.word_devices;

        // D registers
        let d_map: std::collections::HashMap<u32, i32> = self
            .d_registers
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v != 0)
            .map(|(i, v)| (i as u32, *v as i32))
            .collect();
        if !d_map.is_empty() {
            word_devices.insert("D".to_string(), d_map);
        }

        // R registers
        let r_map: std::collections::HashMap<u32, i32> = self
            .r_registers
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v != 0)
            .map(|(i, v)| (i as u32, *v as i32))
            .collect();
        if !r_map.is_empty() {
            word_devices.insert("R".to_string(), r_map);
        }

        // Z registers
        let z_map: std::collections::HashMap<u32, i32> = self
            .z_registers
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v != 0)
            .map(|(i, v)| (i as u32, *v as i32))
            .collect();
        if !z_map.is_empty() {
            word_devices.insert("Z".to_string(), z_map);
        }

        // TD values
        let td_map: std::collections::HashMap<u32, i32> = self
            .td_values
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v != 0)
            .map(|(i, v)| (i as u32, *v as i32))
            .collect();
        if !td_map.is_empty() {
            word_devices.insert("TD".to_string(), td_map);
        }

        // CD values
        let cd_map: std::collections::HashMap<u32, i32> = self
            .cd_values
            .read()
            .iter()
            .enumerate()
            .filter(|(_, v)| **v != 0)
            .map(|(i, v)| (i as u32, *v as i32))
            .collect();
        if !cd_map.is_empty() {
            word_devices.insert("CD".to_string(), cd_map);
        }

        snapshot
    }

    /// Clear all memory areas to zero
    pub fn clear(&self) {
        // Clear bit devices
        self.p_relays.write().fill(false);
        self.m_relays.write().fill(false);
        self.k_relays.write().fill(false);
        self.f_relays.write().fill(false);
        self.t_contacts.write().fill(false);
        self.c_contacts.write().fill(false);

        // Clear word devices
        self.d_registers.write().fill(0);
        self.r_registers.write().fill(0);
        self.z_registers.write().fill(0);
        self.n_registers.write().fill(0);
        self.td_values.write().fill(0);
        self.cd_values.write().fill(0);

        // Clear edge detection state
        self.previous_bits.write().clear();
    }

    /// Clear volatile memory (all except K relays which are persistent)
    pub fn clear_volatile(&self) {
        // Clear bit devices (except K)
        self.p_relays.write().fill(false);
        self.m_relays.write().fill(false);
        // K relays are NOT cleared - they are persistent
        self.f_relays.write().fill(false);
        self.t_contacts.write().fill(false);
        self.c_contacts.write().fill(false);

        // Clear word devices (except R which is retentive)
        self.d_registers.write().fill(0);
        // R registers are NOT cleared - they are retentive
        self.z_registers.write().fill(0);
        self.n_registers.write().fill(0);
        self.td_values.write().fill(0);
        self.cd_values.write().fill(0);

        // Clear edge detection state
        self.previous_bits.write().clear();
    }

    /// Restore memory from a snapshot
    pub fn restore_snapshot(&self, snapshot: &MemorySnapshot) {
        // Clear first
        self.clear();

        // Restore bit devices
        if let Some(p_map) = snapshot.bit_devices.get("P") {
            let mut p = self.p_relays.write();
            for (addr, value) in p_map {
                if (*addr as usize) < P_SIZE {
                    p.set(*addr as usize, *value);
                }
            }
        }
        if let Some(m_map) = snapshot.bit_devices.get("M") {
            let mut m = self.m_relays.write();
            for (addr, value) in m_map {
                if (*addr as usize) < M_SIZE {
                    m.set(*addr as usize, *value);
                }
            }
        }
        if let Some(k_map) = snapshot.bit_devices.get("K") {
            let mut k = self.k_relays.write();
            for (addr, value) in k_map {
                if (*addr as usize) < K_SIZE {
                    k.set(*addr as usize, *value);
                }
            }
        }
        if let Some(t_map) = snapshot.bit_devices.get("T") {
            let mut t = self.t_contacts.write();
            for (addr, value) in t_map {
                if (*addr as usize) < T_SIZE {
                    t.set(*addr as usize, *value);
                }
            }
        }
        if let Some(c_map) = snapshot.bit_devices.get("C") {
            let mut c = self.c_contacts.write();
            for (addr, value) in c_map {
                if (*addr as usize) < C_SIZE {
                    c.set(*addr as usize, *value);
                }
            }
        }

        // Restore word devices
        if let Some(d_map) = snapshot.word_devices.get("D") {
            let mut d = self.d_registers.write();
            for (addr, value) in d_map {
                if (*addr as usize) < D_SIZE {
                    d[*addr as usize] = *value as u16;
                }
            }
        }
        if let Some(r_map) = snapshot.word_devices.get("R") {
            let mut r = self.r_registers.write();
            for (addr, value) in r_map {
                if (*addr as usize) < R_SIZE {
                    r[*addr as usize] = *value as u16;
                }
            }
        }
        if let Some(z_map) = snapshot.word_devices.get("Z") {
            let mut z = self.z_registers.write();
            for (addr, value) in z_map {
                if (*addr as usize) < Z_SIZE {
                    z[*addr as usize] = *value as u16;
                }
            }
        }
        if let Some(td_map) = snapshot.word_devices.get("TD") {
            let mut td = self.td_values.write();
            for (addr, value) in td_map {
                if (*addr as usize) < TD_SIZE {
                    td[*addr as usize] = *value as u16;
                }
            }
        }
        if let Some(cd_map) = snapshot.word_devices.get("CD") {
            let mut cd = self.cd_values.write();
            for (addr, value) in cd_map {
                if (*addr as usize) < CD_SIZE {
                    cd[*addr as usize] = *value as u16;
                }
            }
        }
    }
}

impl Default for DeviceMemory {
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

    #[test]
    fn test_new_creates_correct_sizes() {
        let mem = DeviceMemory::new();
        assert_eq!(mem.p_relays.read().len(), P_SIZE);
        assert_eq!(mem.m_relays.read().len(), M_SIZE);
        assert_eq!(mem.k_relays.read().len(), K_SIZE);
        assert_eq!(mem.d_registers.read().len(), D_SIZE);
        assert_eq!(mem.z_registers.read().len(), Z_SIZE);
    }

    #[test]
    fn test_bit_read_write() {
        let mem = DeviceMemory::new();

        // Write and read P relay
        mem.write_bit(SimBitDeviceType::P, 0, true).unwrap();
        assert!(mem.read_bit(SimBitDeviceType::P, 0).unwrap());

        // Write and read M relay at boundary
        mem.write_bit(SimBitDeviceType::M, 8191, true).unwrap();
        assert!(mem.read_bit(SimBitDeviceType::M, 8191).unwrap());

        // K relay
        mem.write_bit(SimBitDeviceType::K, 100, true).unwrap();
        assert!(mem.read_bit(SimBitDeviceType::K, 100).unwrap());
    }

    #[test]
    fn test_bit_readonly_error() {
        let mem = DeviceMemory::new();

        // F relay is read-only
        let result = mem.write_bit(SimBitDeviceType::F, 0, true);
        assert!(matches!(result, Err(SimMemoryError::ReadOnlyDevice { .. })));

        // T contact is read-only
        let result = mem.write_bit(SimBitDeviceType::T, 0, true);
        assert!(matches!(result, Err(SimMemoryError::ReadOnlyDevice { .. })));
    }

    #[test]
    fn test_bit_address_out_of_range() {
        let mem = DeviceMemory::new();

        let result = mem.read_bit(SimBitDeviceType::P, 5000);
        assert!(matches!(
            result,
            Err(SimMemoryError::AddressOutOfRange { .. })
        ));
    }

    #[test]
    fn test_word_read_write() {
        let mem = DeviceMemory::new();

        // Write and read D register
        mem.write_word(SimWordDeviceType::D, 0, 12345).unwrap();
        assert_eq!(mem.read_word(SimWordDeviceType::D, 0).unwrap(), 12345);

        // Boundary address
        mem.write_word(SimWordDeviceType::D, 9999, 65535).unwrap();
        assert_eq!(mem.read_word(SimWordDeviceType::D, 9999).unwrap(), 65535);

        // Z register (smaller range)
        mem.write_word(SimWordDeviceType::Z, 15, 42).unwrap();
        assert_eq!(mem.read_word(SimWordDeviceType::Z, 15).unwrap(), 42);
    }

    #[test]
    fn test_word_address_out_of_range() {
        let mem = DeviceMemory::new();

        // Z register only has 16 addresses
        let result = mem.read_word(SimWordDeviceType::Z, 16);
        assert!(matches!(
            result,
            Err(SimMemoryError::AddressOutOfRange { .. })
        ));
    }

    #[test]
    fn test_word_bit_access() {
        let mem = DeviceMemory::new();

        // Write individual bits
        mem.write_word_bit(SimWordDeviceType::D, 0, 0, true).unwrap();
        mem.write_word_bit(SimWordDeviceType::D, 0, 15, true)
            .unwrap();

        // Read word should be 0x8001
        assert_eq!(mem.read_word(SimWordDeviceType::D, 0).unwrap(), 0x8001);

        // Read individual bits
        assert!(mem.read_word_bit(SimWordDeviceType::D, 0, 0).unwrap());
        assert!(mem.read_word_bit(SimWordDeviceType::D, 0, 15).unwrap());
        assert!(!mem.read_word_bit(SimWordDeviceType::D, 0, 8).unwrap());
    }

    #[test]
    fn test_word_bit_index_out_of_range() {
        let mem = DeviceMemory::new();

        let result = mem.read_word_bit(SimWordDeviceType::D, 0, 16);
        assert!(matches!(
            result,
            Err(SimMemoryError::BitIndexOutOfRange { .. })
        ));
    }

    #[test]
    fn test_rising_edge_detection() {
        let mem = DeviceMemory::new();

        // First call with true - no previous, should detect rising edge
        assert!(mem.detect_rising_edge("M0000", true));
        mem.update_previous("M0000", true);

        // Second call with true - previous is true, no rising edge
        assert!(!mem.detect_rising_edge("M0000", true));

        // Call with false
        mem.update_previous("M0000", false);

        // Call with true - should detect rising edge
        assert!(mem.detect_rising_edge("M0000", true));
    }

    #[test]
    fn test_falling_edge_detection() {
        let mem = DeviceMemory::new();

        // Set up previous state as true
        mem.update_previous("M0001", true);

        // Falling edge: true -> false
        assert!(mem.detect_falling_edge("M0001", false));
        mem.update_previous("M0001", false);

        // No edge: false -> false
        assert!(!mem.detect_falling_edge("M0001", false));
    }

    #[test]
    fn test_clear_volatile_preserves_k() {
        let mem = DeviceMemory::new();

        // Set some values
        mem.write_bit(SimBitDeviceType::P, 0, true).unwrap();
        mem.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        mem.write_bit(SimBitDeviceType::K, 0, true).unwrap();
        mem.write_word(SimWordDeviceType::D, 0, 100).unwrap();
        mem.write_word(SimWordDeviceType::R, 0, 200).unwrap();

        // Clear volatile
        mem.clear_volatile();

        // K should be preserved
        assert!(mem.read_bit(SimBitDeviceType::K, 0).unwrap());
        // R should be preserved (retentive)
        assert_eq!(mem.read_word(SimWordDeviceType::R, 0).unwrap(), 200);

        // P and M should be cleared
        assert!(!mem.read_bit(SimBitDeviceType::P, 0).unwrap());
        assert!(!mem.read_bit(SimBitDeviceType::M, 0).unwrap());
        // D should be cleared
        assert_eq!(mem.read_word(SimWordDeviceType::D, 0).unwrap(), 0);
    }

    #[test]
    fn test_read_bits_range() {
        let mem = DeviceMemory::new();

        // Set some bits
        mem.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        mem.write_bit(SimBitDeviceType::M, 2, true).unwrap();
        mem.write_bit(SimBitDeviceType::M, 4, true).unwrap();

        let bits = mem.read_bits(SimBitDeviceType::M, 0, 5).unwrap();
        assert_eq!(bits, vec![true, false, true, false, true]);
    }

    #[test]
    fn test_read_words_range() {
        let mem = DeviceMemory::new();

        mem.write_word(SimWordDeviceType::D, 0, 10).unwrap();
        mem.write_word(SimWordDeviceType::D, 1, 20).unwrap();
        mem.write_word(SimWordDeviceType::D, 2, 30).unwrap();

        let words = mem.read_words(SimWordDeviceType::D, 0, 3).unwrap();
        assert_eq!(words, vec![10, 20, 30]);
    }

    #[test]
    fn test_snapshot_and_restore() {
        let mem = DeviceMemory::new();

        // Set some values
        mem.write_bit(SimBitDeviceType::M, 100, true).unwrap();
        mem.write_word(SimWordDeviceType::D, 50, 12345).unwrap();

        // Take snapshot
        let snapshot = mem.get_snapshot("test");

        // Clear memory
        mem.clear();
        assert!(!mem.read_bit(SimBitDeviceType::M, 100).unwrap());
        assert_eq!(mem.read_word(SimWordDeviceType::D, 50).unwrap(), 0);

        // Restore
        mem.restore_snapshot(&snapshot);
        assert!(mem.read_bit(SimBitDeviceType::M, 100).unwrap());
        assert_eq!(mem.read_word(SimWordDeviceType::D, 50).unwrap(), 12345);
    }
}
