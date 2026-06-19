//! Canonical runtime facade for the OneSim simulator.
//!
//! This replaces the old simulator memory implementation with a thin adapter over
//! the canonical PLC runtime model. The simulator can still use convenience
//! methods such as `read_bit`/`write_word`, but the single source of truth is
//! always `CanonicalMemory`.

use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

use crate::plc_runtime::{
    CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalMemoryError,
    CanonicalMemorySnapshot, CanonicalValue, CanonicalWriteSource,
};

use super::types::{CounterState, MemorySnapshot, SimBitDeviceType, SimWordDeviceType, TimerState};

#[derive(Debug, Error)]
pub enum SimMemoryError {
    #[error("canonical memory error: {0}")]
    Canonical(#[from] CanonicalMemoryError),
    #[error("device {device} is not writable")]
    ReadOnlyDevice { device: String },
}

pub type SimMemoryResult<T> = Result<T, SimMemoryError>;

#[derive(Debug, Clone)]
pub struct CanonicalRuntimeFacade {
    memory: Arc<RwLock<CanonicalMemory>>,
}

impl CanonicalRuntimeFacade {
    pub fn new() -> Self {
        Self {
            memory: Arc::new(RwLock::new(CanonicalMemory::new())),
        }
    }

    pub fn with_memory(memory: Arc<RwLock<CanonicalMemory>>) -> Self {
        Self { memory }
    }

    pub fn handle(&self) -> Arc<RwLock<CanonicalMemory>> {
        Arc::clone(&self.memory)
    }

    pub fn read(&self, address: CanonicalAddress) -> SimMemoryResult<CanonicalValue> {
        Ok(self.memory.read().read(address)?)
    }

    pub fn read_range(
        &self,
        area: CanonicalAreaKind,
        start: u32,
        count: usize,
    ) -> SimMemoryResult<Vec<CanonicalValue>> {
        Ok(self.memory.read().read_range(area, start, count)?)
    }

    pub fn write(
        &self,
        address: CanonicalAddress,
        value: CanonicalValue,
        source: CanonicalWriteSource,
    ) -> SimMemoryResult<()> {
        Ok(self.memory.write().write(address, value, source)?)
    }

    pub fn write_batch(
        &self,
        writes: Vec<(CanonicalAddress, CanonicalValue)>,
        source: CanonicalWriteSource,
    ) -> SimMemoryResult<()> {
        Ok(self.memory.write().write_batch(writes, source)?)
    }

    pub fn clear_all(&self) {
        self.memory.write().clear_all();
    }

    pub fn clear_volatile(&self) {
        self.memory.write().clear_volatile();
    }

    pub fn snapshot(&self) -> CanonicalMemorySnapshot {
        self.memory.read().snapshot()
    }

    pub fn restore_snapshot(&self, snapshot: &CanonicalMemorySnapshot) -> SimMemoryResult<()> {
        Ok(self.memory.write().restore_snapshot(snapshot)?)
    }

    pub fn read_bool(&self, address: CanonicalAddress) -> SimMemoryResult<bool> {
        match self.read(address)? {
            CanonicalValue::Bool(value) => Ok(value),
            CanonicalValue::U16(value) => Ok(value != 0),
        }
    }

    pub fn write_bool(
        &self,
        address: CanonicalAddress,
        value: bool,
        source: CanonicalWriteSource,
    ) -> SimMemoryResult<()> {
        self.write(address, CanonicalValue::Bool(value), source)
    }

    pub fn read_word_value(&self, address: CanonicalAddress) -> SimMemoryResult<u16> {
        match self.read(address)? {
            CanonicalValue::U16(value) => Ok(value),
            CanonicalValue::Bool(value) => Ok(if value { 1 } else { 0 }),
        }
    }

    pub fn write_word_value(
        &self,
        address: CanonicalAddress,
        value: u16,
        source: CanonicalWriteSource,
    ) -> SimMemoryResult<()> {
        self.write(address, CanonicalValue::U16(value), source)
    }

    pub fn read_bit(&self, device: SimBitDeviceType, address: u16) -> SimMemoryResult<bool> {
        self.read_bool(bit_device_address(device, address))
    }

    pub fn write_bit(
        &self,
        device: SimBitDeviceType,
        address: u16,
        value: bool,
    ) -> SimMemoryResult<()> {
        if device.is_readonly() {
            return Err(SimMemoryError::ReadOnlyDevice {
                device: device.as_str().to_string(),
            });
        }
        self.write_bool(
            bit_device_address(device, address),
            value,
            CanonicalWriteSource::Simulation,
        )
    }

    pub fn write_bit_internal(
        &self,
        device: SimBitDeviceType,
        address: u16,
        value: bool,
    ) -> SimMemoryResult<()> {
        self.write_bool(
            bit_device_address(device, address),
            value,
            CanonicalWriteSource::InternalRuntime,
        )
    }

    pub fn read_word_device(
        &self,
        device: SimWordDeviceType,
        address: u16,
    ) -> SimMemoryResult<u16> {
        self.read_word_value(word_device_address(device, address))
    }

    pub fn read_word(&self, device: SimWordDeviceType, address: u16) -> SimMemoryResult<u16> {
        self.read_word_device(device, address)
    }

    pub fn write_word_device(
        &self,
        device: SimWordDeviceType,
        address: u16,
        value: u16,
    ) -> SimMemoryResult<()> {
        self.write_word_value(
            word_device_address(device, address),
            value,
            CanonicalWriteSource::Simulation,
        )
    }

    pub fn write_word(
        &self,
        device: SimWordDeviceType,
        address: u16,
        value: u16,
    ) -> SimMemoryResult<()> {
        self.write_word_device(device, address, value)
    }

    pub fn write_word_internal(
        &self,
        device: SimWordDeviceType,
        address: u16,
        value: u16,
    ) -> SimMemoryResult<()> {
        self.write_word_value(
            word_device_address(device, address),
            value,
            CanonicalWriteSource::InternalRuntime,
        )
    }

    pub fn read_word_bit(
        &self,
        device: SimWordDeviceType,
        address: u16,
        bit_index: u8,
    ) -> SimMemoryResult<bool> {
        self.read_bool(word_device_address(device, address).with_bit(bit_index))
    }

    pub fn write_word_bit(
        &self,
        device: SimWordDeviceType,
        address: u16,
        bit_index: u8,
        value: bool,
    ) -> SimMemoryResult<()> {
        self.write_bool(
            word_device_address(device, address).with_bit(bit_index),
            value,
            CanonicalWriteSource::Simulation,
        )
    }

    pub fn get_snapshot(
        &self,
        name: &str,
        scan_count: u64,
        timer_states: HashMap<u32, TimerState>,
        counter_states: HashMap<u32, CounterState>,
    ) -> MemorySnapshot {
        let snapshot = self.snapshot();
        let mut bit_devices: HashMap<String, HashMap<u32, bool>> = HashMap::new();
        let mut word_devices: HashMap<String, HashMap<u32, i32>> = HashMap::new();

        for (area, values) in snapshot.areas {
            if area.is_bit_area() {
                let entries = values
                    .into_iter()
                    .enumerate()
                    .filter_map(|(index, value)| match value {
                        CanonicalValue::Bool(true) => Some((index as u32, true)),
                        _ => None,
                    })
                    .collect::<HashMap<_, _>>();
                if !entries.is_empty() {
                    bit_devices.insert(format!("{area:?}"), entries);
                }
            } else {
                let entries = values
                    .into_iter()
                    .enumerate()
                    .filter_map(|(index, value)| match value {
                        CanonicalValue::U16(word) if word != 0 => Some((index as u32, word as i32)),
                        _ => None,
                    })
                    .collect::<HashMap<_, _>>();
                if !entries.is_empty() {
                    word_devices.insert(format!("{area:?}"), entries);
                }
            }
        }

        MemorySnapshot {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            bit_devices,
            word_devices,
            timer_states,
            counter_states,
            scan_count,
        }
    }
}

impl Default for CanonicalRuntimeFacade {
    fn default() -> Self {
        Self::new()
    }
}

trait CanonicalAddressExt {
    fn with_bit(self, bit_index: u8) -> CanonicalAddress;
}

impl CanonicalAddressExt for CanonicalAddress {
    fn with_bit(self, bit_index: u8) -> CanonicalAddress {
        CanonicalAddress::with_bit_index(self.area, self.index, bit_index)
    }
}

fn bit_device_address(device: SimBitDeviceType, address: u16) -> CanonicalAddress {
    let area = match device {
        SimBitDeviceType::X => CanonicalAreaKind::InputBit,
        SimBitDeviceType::Y | SimBitDeviceType::P => CanonicalAreaKind::OutputBit,
        SimBitDeviceType::M => CanonicalAreaKind::InternalBit,
        SimBitDeviceType::K => CanonicalAreaKind::RetentiveBit,
        SimBitDeviceType::F => CanonicalAreaKind::SpecialBit,
        SimBitDeviceType::T => CanonicalAreaKind::TimerDoneBit,
        SimBitDeviceType::C => CanonicalAreaKind::CounterDoneBit,
    };

    CanonicalAddress::new(area, address as u32)
}

fn word_device_address(device: SimWordDeviceType, address: u16) -> CanonicalAddress {
    let area = match device {
        SimWordDeviceType::D => CanonicalAreaKind::DataWord,
        SimWordDeviceType::R => CanonicalAreaKind::RetentiveWord,
        SimWordDeviceType::Z => CanonicalAreaKind::IndexWord,
        SimWordDeviceType::N => CanonicalAreaKind::SystemWord,
        SimWordDeviceType::Td => CanonicalAreaKind::TimerValueWord,
        SimWordDeviceType::Cd => CanonicalAreaKind::CounterValueWord,
    };

    CanonicalAddress::new(area, address as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_reads_bits_from_canonical_runtime() {
        let runtime = CanonicalRuntimeFacade::new();

        runtime.write_bit(SimBitDeviceType::M, 10, true).unwrap();

        assert!(runtime.read_bit(SimBitDeviceType::M, 10).unwrap());
        assert!(runtime
            .read_bool(CanonicalAddress::new(CanonicalAreaKind::InternalBit, 10))
            .unwrap());
    }

    #[test]
    fn writes_and_reads_word_bits() {
        let runtime = CanonicalRuntimeFacade::new();

        runtime.write_word(SimWordDeviceType::D, 100, 0).unwrap();
        runtime
            .write_word_bit(SimWordDeviceType::D, 100, 5, true)
            .unwrap();

        assert!(runtime.read_word_bit(SimWordDeviceType::D, 100, 5).unwrap());
        assert_eq!(runtime.read_word(SimWordDeviceType::D, 100).unwrap(), 32);
    }

    #[test]
    fn snapshot_contains_non_zero_entries() {
        let runtime = CanonicalRuntimeFacade::new();
        runtime.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        runtime.write_word(SimWordDeviceType::D, 1, 42).unwrap();

        let snapshot = runtime.get_snapshot("test", 3, HashMap::new(), HashMap::new());
        assert_eq!(snapshot.scan_count, 3);
        assert!(snapshot.bit_devices.contains_key("InternalBit"));
        assert!(snapshot.word_devices.contains_key("DataWord"));
    }
}
