use std::collections::BTreeMap;

use thiserror::Error;

use crate::runtime_env;

use super::{
    event_bus::CanonicalMemoryBus,
    types::{
        CanonicalAccess, CanonicalAddress, CanonicalAreaKind, CanonicalMemoryBatchChange,
        CanonicalMemoryChange, CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource,
    },
};

#[derive(Debug, Clone, PartialEq, Eq)]
struct AreaDescriptor {
    access: CanonicalAccess,
    size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum AreaStorage {
    Bit(Vec<bool>),
    Word(Vec<u16>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalMemorySnapshot {
    pub captured_at: String,
    pub areas: BTreeMap<CanonicalAreaKind, Vec<CanonicalValue>>,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CanonicalMemoryError {
    #[error("address out of range for area {area:?}: index={index}, size={size}")]
    AddressOutOfRange {
        area: CanonicalAreaKind,
        index: u32,
        size: usize,
    },
    #[error("bit index out of range: {bit_index}")]
    BitIndexOutOfRange { bit_index: u8 },
    #[error("bit index cannot be used on bit area {area:?}")]
    BitIndexOnBitArea { area: CanonicalAreaKind },
    #[error("type mismatch for area {area:?}")]
    TypeMismatch { area: CanonicalAreaKind },
    #[error("write not allowed for area {area:?} from source {write_source:?}")]
    WriteNotAllowed {
        area: CanonicalAreaKind,
        write_source: CanonicalWriteSource,
    },
    #[error("snapshot size mismatch for area {area:?}: expected={expected}, actual={actual}")]
    SnapshotSizeMismatch {
        area: CanonicalAreaKind,
        expected: usize,
        actual: usize,
    },
}

#[derive(Debug, Clone)]
pub struct CanonicalMemory {
    descriptors: BTreeMap<CanonicalAreaKind, AreaDescriptor>,
    storage: BTreeMap<CanonicalAreaKind, AreaStorage>,
    bus: CanonicalMemoryBus,
}

impl CanonicalMemory {
    pub fn new() -> Self {
        let mut descriptors = BTreeMap::new();
        let mut storage = BTreeMap::new();

        for area in CanonicalAreaKind::ALL {
            let descriptor = AreaDescriptor {
                access: area.default_access(),
                size: area.default_size(),
            };

            let area_storage = if area.is_bit_area() {
                AreaStorage::Bit(vec![false; descriptor.size])
            } else {
                AreaStorage::Word(vec![0; descriptor.size])
            };

            descriptors.insert(area, descriptor);
            storage.insert(area, area_storage);
        }

        Self {
            descriptors,
            storage,
            bus: CanonicalMemoryBus::default(),
        }
    }

    pub fn bus(&self) -> &CanonicalMemoryBus {
        &self.bus
    }

    pub fn read(&self, address: CanonicalAddress) -> Result<CanonicalValue, CanonicalMemoryError> {
        let index = self.ensure_index(address.area, address.index)?;

        match self
            .storage
            .get(&address.area)
            .expect("canonical area storage must exist")
        {
            AreaStorage::Bit(values) => {
                if address.bit_index.is_some() {
                    return Err(CanonicalMemoryError::BitIndexOnBitArea { area: address.area });
                }
                Ok(CanonicalValue::Bool(values[index]))
            }
            AreaStorage::Word(values) => {
                let raw = values[index];
                if let Some(bit_index) = address.bit_index {
                    Self::ensure_word_bit_index(bit_index)?;
                    Ok(CanonicalValue::Bool(((raw >> bit_index) & 1) == 1))
                } else {
                    Ok(CanonicalValue::U16(raw))
                }
            }
        }
    }

    pub fn read_range(
        &self,
        area: CanonicalAreaKind,
        start: u32,
        count: usize,
    ) -> Result<Vec<CanonicalValue>, CanonicalMemoryError> {
        if count == 0 {
            return Ok(Vec::new());
        }

        let mut values = Vec::with_capacity(count);
        for offset in 0..count {
            let index = start + offset as u32;
            values.push(self.read(CanonicalAddress::new(area, index))?);
        }
        Ok(values)
    }

    pub fn write(
        &mut self,
        address: CanonicalAddress,
        value: CanonicalValue,
        source: CanonicalWriteSource,
    ) -> Result<(), CanonicalMemoryError> {
        if let Some(change) = self.write_internal(address, value, source, None)? {
            self.bus.emit(CanonicalMemoryEvent::Single(change));
        }
        Ok(())
    }

    pub fn write_batch(
        &mut self,
        writes: Vec<(CanonicalAddress, CanonicalValue)>,
        source: CanonicalWriteSource,
    ) -> Result<(), CanonicalMemoryError> {
        let timestamp = Self::timestamp();
        let batch_id = runtime_env::new_id();
        let mut changes = Vec::new();

        for (address, value) in writes {
            if let Some(mut change) =
                self.write_internal(address, value, source, Some(batch_id.clone()))?
            {
                change.timestamp = timestamp.clone();
                changes.push(change);
            }
        }

        if !changes.is_empty() {
            self.bus
                .emit(CanonicalMemoryEvent::Batch(CanonicalMemoryBatchChange {
                    batch_id,
                    changes,
                    timestamp,
                }));
        }

        Ok(())
    }

    pub fn clear_all(&mut self) {
        for area in CanonicalAreaKind::ALL {
            self.reset_area(area);
        }
    }

    pub fn clear_volatile(&mut self) {
        for area in CanonicalAreaKind::ALL {
            if !area.is_retentive() {
                self.reset_area(area);
            }
        }
    }

    pub fn snapshot(&self) -> CanonicalMemorySnapshot {
        let mut areas = BTreeMap::new();

        for area in CanonicalAreaKind::ALL {
            let snapshot_values = match self
                .storage
                .get(&area)
                .expect("canonical area storage must exist")
            {
                AreaStorage::Bit(values) => values
                    .iter()
                    .copied()
                    .map(CanonicalValue::Bool)
                    .collect::<Vec<_>>(),
                AreaStorage::Word(values) => values
                    .iter()
                    .copied()
                    .map(CanonicalValue::U16)
                    .collect::<Vec<_>>(),
            };

            areas.insert(area, snapshot_values);
        }

        CanonicalMemorySnapshot {
            captured_at: Self::timestamp(),
            areas,
        }
    }

    pub fn restore_snapshot(
        &mut self,
        snapshot: &CanonicalMemorySnapshot,
    ) -> Result<(), CanonicalMemoryError> {
        for area in CanonicalAreaKind::ALL {
            let descriptor = self.descriptor(area);
            let values =
                snapshot
                    .areas
                    .get(&area)
                    .ok_or(CanonicalMemoryError::SnapshotSizeMismatch {
                        area,
                        expected: descriptor.size,
                        actual: 0,
                    })?;

            if values.len() != descriptor.size {
                return Err(CanonicalMemoryError::SnapshotSizeMismatch {
                    area,
                    expected: descriptor.size,
                    actual: values.len(),
                });
            }

            match self
                .storage
                .get_mut(&area)
                .expect("canonical area storage must exist")
            {
                AreaStorage::Bit(storage) => {
                    for (idx, value) in values.iter().enumerate() {
                        match value {
                            CanonicalValue::Bool(bit) => storage[idx] = *bit,
                            CanonicalValue::U16(_) => {
                                return Err(CanonicalMemoryError::TypeMismatch { area });
                            }
                        }
                    }
                }
                AreaStorage::Word(storage) => {
                    for (idx, value) in values.iter().enumerate() {
                        match value {
                            CanonicalValue::U16(word) => storage[idx] = *word,
                            CanonicalValue::Bool(_) => {
                                return Err(CanonicalMemoryError::TypeMismatch { area });
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn write_internal(
        &mut self,
        address: CanonicalAddress,
        value: CanonicalValue,
        source: CanonicalWriteSource,
        batch_id: Option<String>,
    ) -> Result<Option<CanonicalMemoryChange>, CanonicalMemoryError> {
        let index = self.ensure_index(address.area, address.index)?;
        let access = self.descriptor(address.area).access;
        self.ensure_write_allowed(address.area, access, source)?;

        let timestamp = Self::timestamp();

        let change = match self
            .storage
            .get_mut(&address.area)
            .expect("canonical area storage must exist")
        {
            AreaStorage::Bit(values) => {
                if address.bit_index.is_some() {
                    return Err(CanonicalMemoryError::BitIndexOnBitArea { area: address.area });
                }

                let CanonicalValue::Bool(new_value) = value else {
                    return Err(CanonicalMemoryError::TypeMismatch { area: address.area });
                };

                let old_value = values[index];
                if old_value == new_value {
                    return Ok(None);
                }

                values[index] = new_value;

                CanonicalMemoryChange {
                    address,
                    old_value: Some(CanonicalValue::Bool(old_value)),
                    new_value: CanonicalValue::Bool(new_value),
                    source,
                    timestamp,
                    batch_id,
                }
            }
            AreaStorage::Word(values) => {
                let old_word = values[index];

                match (address.bit_index, value) {
                    (Some(bit_index), CanonicalValue::Bool(new_bit)) => {
                        Self::ensure_word_bit_index(bit_index)?;
                        let mask = 1u16 << bit_index;
                        let new_word = if new_bit {
                            old_word | mask
                        } else {
                            old_word & !mask
                        };

                        if old_word == new_word {
                            return Ok(None);
                        }

                        values[index] = new_word;

                        CanonicalMemoryChange {
                            address,
                            old_value: Some(CanonicalValue::Bool((old_word & mask) != 0)),
                            new_value: CanonicalValue::Bool(new_bit),
                            source,
                            timestamp,
                            batch_id,
                        }
                    }
                    (None, CanonicalValue::U16(new_word)) => {
                        if old_word == new_word {
                            return Ok(None);
                        }

                        values[index] = new_word;

                        CanonicalMemoryChange {
                            address,
                            old_value: Some(CanonicalValue::U16(old_word)),
                            new_value: CanonicalValue::U16(new_word),
                            source,
                            timestamp,
                            batch_id,
                        }
                    }
                    _ => return Err(CanonicalMemoryError::TypeMismatch { area: address.area }),
                }
            }
        };

        Ok(Some(change))
    }

    fn reset_area(&mut self, area: CanonicalAreaKind) {
        match self
            .storage
            .get_mut(&area)
            .expect("canonical area storage must exist")
        {
            AreaStorage::Bit(values) => values.fill(false),
            AreaStorage::Word(values) => values.fill(0),
        }
    }

    fn ensure_index(
        &self,
        area: CanonicalAreaKind,
        index: u32,
    ) -> Result<usize, CanonicalMemoryError> {
        let size = self.descriptor(area).size;
        if index as usize >= size {
            return Err(CanonicalMemoryError::AddressOutOfRange { area, index, size });
        }
        Ok(index as usize)
    }

    fn ensure_word_bit_index(bit_index: u8) -> Result<(), CanonicalMemoryError> {
        if bit_index >= 16 {
            return Err(CanonicalMemoryError::BitIndexOutOfRange { bit_index });
        }
        Ok(())
    }

    fn ensure_write_allowed(
        &self,
        area: CanonicalAreaKind,
        access: CanonicalAccess,
        source: CanonicalWriteSource,
    ) -> Result<(), CanonicalMemoryError> {
        if access.allows_write(source) {
            Ok(())
        } else {
            Err(CanonicalMemoryError::WriteNotAllowed {
                area,
                write_source: source,
            })
        }
    }

    fn descriptor(&self, area: CanonicalAreaKind) -> &AreaDescriptor {
        self.descriptors
            .get(&area)
            .expect("canonical area descriptor must exist")
    }

    fn timestamp() -> String {
        runtime_env::now_rfc3339()
    }
}

impl Default for CanonicalMemory {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supports_single_bool_read_write() {
        let mut memory = CanonicalMemory::new();
        let address = CanonicalAddress::new(CanonicalAreaKind::InternalBit, 10);

        memory
            .write(
                address,
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .expect("write should succeed");

        assert_eq!(memory.read(address), Ok(CanonicalValue::Bool(true)));
    }

    #[test]
    fn supports_word_and_word_bit_access() {
        let mut memory = CanonicalMemory::new();
        let word_address = CanonicalAddress::new(CanonicalAreaKind::DataWord, 4);
        let bit_address = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 4, 3);

        memory
            .write(
                word_address,
                CanonicalValue::U16(0b0000_1000),
                CanonicalWriteSource::Simulation,
            )
            .expect("word write should succeed");
        assert_eq!(memory.read(bit_address), Ok(CanonicalValue::Bool(true)));

        memory
            .write(
                bit_address,
                CanonicalValue::Bool(false),
                CanonicalWriteSource::Simulation,
            )
            .expect("bit write should succeed");

        assert_eq!(memory.read(word_address), Ok(CanonicalValue::U16(0)));
    }

    #[test]
    fn enforces_read_only_areas() {
        let mut memory = CanonicalMemory::new();
        let address = CanonicalAddress::new(CanonicalAreaKind::SpecialBit, 0);

        let result = memory.write(
            address,
            CanonicalValue::Bool(true),
            CanonicalWriteSource::ExternalProtocol,
        );

        assert_eq!(
            result,
            Err(CanonicalMemoryError::WriteNotAllowed {
                area: CanonicalAreaKind::SpecialBit,
                write_source: CanonicalWriteSource::ExternalProtocol,
            })
        );
    }

    #[test]
    fn enforces_internal_only_areas() {
        let mut memory = CanonicalMemory::new();
        let address = CanonicalAddress::new(CanonicalAreaKind::TimerValueWord, 2);

        let external = memory.write(
            address,
            CanonicalValue::U16(100),
            CanonicalWriteSource::ExternalProtocol,
        );
        assert_eq!(
            external,
            Err(CanonicalMemoryError::WriteNotAllowed {
                area: CanonicalAreaKind::TimerValueWord,
                write_source: CanonicalWriteSource::ExternalProtocol,
            })
        );

        memory
            .write(
                address,
                CanonicalValue::U16(100),
                CanonicalWriteSource::Simulation,
            )
            .expect("internal write should succeed");
    }

    #[test]
    fn clears_only_volatile_areas() {
        let mut memory = CanonicalMemory::new();
        let volatile = CanonicalAddress::new(CanonicalAreaKind::InternalBit, 1);
        let retentive = CanonicalAddress::new(CanonicalAreaKind::RetentiveWord, 1);

        memory
            .write(
                volatile,
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .expect("volatile write should succeed");
        memory
            .write(
                retentive,
                CanonicalValue::U16(77),
                CanonicalWriteSource::Simulation,
            )
            .expect("retentive write should succeed");

        memory.clear_volatile();

        assert_eq!(memory.read(volatile), Ok(CanonicalValue::Bool(false)));
        assert_eq!(memory.read(retentive), Ok(CanonicalValue::U16(77)));
    }

    #[test]
    fn snapshot_round_trip_restores_values() {
        let mut memory = CanonicalMemory::new();
        let address = CanonicalAddress::new(CanonicalAreaKind::DataWord, 5);

        memory
            .write(
                address,
                CanonicalValue::U16(1234),
                CanonicalWriteSource::Simulation,
            )
            .expect("write should succeed");

        let snapshot = memory.snapshot();
        memory.clear_all();
        assert_eq!(memory.read(address), Ok(CanonicalValue::U16(0)));

        memory
            .restore_snapshot(&snapshot)
            .expect("restore should succeed");
        assert_eq!(memory.read(address), Ok(CanonicalValue::U16(1234)));
    }

    #[tokio::test]
    async fn emits_single_and_batch_events_in_order() {
        let mut memory = CanonicalMemory::new();
        let mut rx = memory.bus().subscribe();

        memory
            .write(
                CanonicalAddress::new(CanonicalAreaKind::InternalBit, 0),
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .expect("single write should succeed");

        memory
            .write_batch(
                vec![
                    (
                        CanonicalAddress::new(CanonicalAreaKind::DataWord, 1),
                        CanonicalValue::U16(11),
                    ),
                    (
                        CanonicalAddress::new(CanonicalAreaKind::DataWord, 2),
                        CanonicalValue::U16(22),
                    ),
                ],
                CanonicalWriteSource::Simulation,
            )
            .expect("batch write should succeed");

        let first = rx.recv().await.expect("single event");
        let second = rx.recv().await.expect("batch event");

        assert!(matches!(first, CanonicalMemoryEvent::Single(_)));
        match second {
            CanonicalMemoryEvent::Batch(batch) => assert_eq!(batch.changes.len(), 2),
            CanonicalMemoryEvent::Single(_) => panic!("expected batch event"),
        }
    }
}
