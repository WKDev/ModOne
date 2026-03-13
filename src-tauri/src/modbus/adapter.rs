use std::collections::HashSet;
use std::sync::Arc;

use parking_lot::RwLock;
use thiserror::Error;

use crate::plc_runtime::{
    CanonicalAddress, CanonicalAreaKind, CanonicalMemory, CanonicalMemoryError, CanonicalValue,
    CanonicalWriteSource, ModbusAddressSpace, ModbusMappingPolicy, ModbusMappingRule,
};

use super::{ChangeSource, MemoryError, ModbusMemory};

#[derive(Debug, Error)]
pub enum ModbusAdapterError {
    #[error("canonical runtime error: {0}")]
    Canonical(#[from] CanonicalMemoryError),
    #[error("modbus memory error: {0}")]
    Modbus(#[from] MemoryError),
}

pub type ModbusAdapterResult<T> = Result<T, ModbusAdapterError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DirtyPublishWindow {
    pub area: CanonicalAreaKind,
    pub start_index: u32,
    pub end_index: u32,
}

impl DirtyPublishWindow {
    pub fn single(address: CanonicalAddress) -> Self {
        Self {
            area: address.area,
            start_index: address.index,
            end_index: address.index,
        }
    }

    fn intersects_rule(&self, rule: &ModbusMappingRule) -> bool {
        if self.area != rule.canonical_area {
            return false;
        }

        let rule_end = rule.count.saturating_sub(1) as u32;
        self.start_index <= rule_end
    }
}

/// Canonical-runtime-first Modbus adapter.
///
/// This is the canonical Modbus runtime boundary: Modbus reads/writes operate on
/// the canonical runtime model, not on simulator-specific device-letter storage.
pub struct ModbusAdapter {
    canonical_memory: Arc<RwLock<CanonicalMemory>>,
    modbus_memory: Arc<ModbusMemory>,
    policy: RwLock<ModbusMappingPolicy>,
}

impl ModbusAdapter {
    pub fn new(
        canonical_memory: Arc<RwLock<CanonicalMemory>>,
        modbus_memory: Arc<ModbusMemory>,
        policy: ModbusMappingPolicy,
    ) -> Self {
        Self {
            canonical_memory,
            modbus_memory,
            policy: RwLock::new(policy),
        }
    }

    pub fn canonical_memory(&self) -> &Arc<RwLock<CanonicalMemory>> {
        &self.canonical_memory
    }

    pub fn modbus_memory(&self) -> &Arc<ModbusMemory> {
        &self.modbus_memory
    }

    pub fn policy(&self) -> ModbusMappingPolicy {
        self.policy.read().clone()
    }

    pub fn set_policy(&self, policy: ModbusMappingPolicy) {
        *self.policy.write() = policy;
    }

    /// Apply only external Modbus client writes back into canonical memory.
    ///
    /// This intentionally ignores `DiscreteInput`/`InputRegister` because external
    /// Modbus clients cannot mutate those spaces.
    pub fn apply_external_writes(&self) -> ModbusAdapterResult<()> {
        let policy = self.policy();
        let external_coil_writes: HashSet<u16> = self
            .modbus_memory
            .take_external_coil_writes()
            .into_iter()
            .collect();
        let external_holding_writes: HashSet<u16> = self
            .modbus_memory
            .take_external_holding_writes()
            .into_iter()
            .collect();

        for rule in &policy.rules {
            match rule.address_space {
                ModbusAddressSpace::Coil => {
                    self.apply_external_bit_rule(rule, &external_coil_writes)?;
                }
                ModbusAddressSpace::HoldingRegister => {
                    self.apply_external_word_rule(rule, &external_holding_writes)?;
                }
                ModbusAddressSpace::DiscreteInput | ModbusAddressSpace::InputRegister => {}
            }
        }

        Ok(())
    }

    /// Publish canonical runtime state into the configured Modbus spaces.
    pub fn publish_runtime_state(&self) -> ModbusAdapterResult<()> {
        let policy = self.policy();

        for rule in &policy.rules {
            match rule.address_space {
                ModbusAddressSpace::Coil => self.publish_bit_rule_to_coils(rule)?,
                ModbusAddressSpace::DiscreteInput => self.publish_bit_rule_to_discrete_inputs(rule)?,
                ModbusAddressSpace::HoldingRegister => {
                    self.publish_word_rule_to_holding_registers(rule)?
                }
                ModbusAddressSpace::InputRegister => self.publish_word_rule_to_input_registers(rule)?,
            }
        }

        Ok(())
    }

    /// Publish only rules intersecting the dirty canonical windows.
    pub fn publish_dirty_state(
        &self,
        dirty_windows: &[DirtyPublishWindow],
    ) -> ModbusAdapterResult<()> {
        if dirty_windows.is_empty() {
            return Ok(());
        }

        let policy = self.policy();
        for rule in &policy.rules {
            if !dirty_windows.iter().any(|window| window.intersects_rule(rule)) {
                continue;
            }

            match rule.address_space {
                ModbusAddressSpace::Coil => self.publish_bit_rule_to_coils(rule)?,
                ModbusAddressSpace::DiscreteInput => self.publish_bit_rule_to_discrete_inputs(rule)?,
                ModbusAddressSpace::HoldingRegister => {
                    self.publish_word_rule_to_holding_registers(rule)?
                }
                ModbusAddressSpace::InputRegister => self.publish_word_rule_to_input_registers(rule)?,
            }
        }

        Ok(())
    }

    pub fn full_sync(&self) -> ModbusAdapterResult<()> {
        self.apply_external_writes()?;
        self.publish_runtime_state()
    }

    fn apply_external_bit_rule(
        &self,
        rule: &ModbusMappingRule,
        external_writes: &HashSet<u16>,
    ) -> ModbusAdapterResult<()> {
        let Some((modbus_start, count)) = self.resolve_bit_window(rule) else {
            return Ok(());
        };
        if external_writes.is_empty() {
            return Ok(());
        }

        let mut canonical = self.canonical_memory.write();
        for address in external_writes.iter().copied() {
            let Some(relative) = address.checked_sub(modbus_start) else {
                continue;
            };
            if relative >= count {
                continue;
            }

            let value = self.modbus_memory.read_coils(address, 1)?;
            if let Some(bit) = value.first() {
                canonical.write(
                    CanonicalAddress::new(rule.canonical_area, relative as u32),
                    CanonicalValue::Bool(*bit),
                    CanonicalWriteSource::ExternalProtocol,
                )?;
            }
        }

        Ok(())
    }

    fn apply_external_word_rule(
        &self,
        rule: &ModbusMappingRule,
        external_writes: &HashSet<u16>,
    ) -> ModbusAdapterResult<()> {
        let Some((modbus_start, count)) = self.resolve_word_window(rule) else {
            return Ok(());
        };
        if external_writes.is_empty() {
            return Ok(());
        }

        let mut canonical = self.canonical_memory.write();
        for address in external_writes.iter().copied() {
            let Some(relative) = address.checked_sub(modbus_start) else {
                continue;
            };
            if relative >= count {
                continue;
            }

            let value = self.modbus_memory.read_holding_registers(address, 1)?;
            if let Some(word) = value.first() {
                canonical.write(
                    CanonicalAddress::new(rule.canonical_area, relative as u32),
                    CanonicalValue::U16(*word),
                    CanonicalWriteSource::ExternalProtocol,
                )?;
            }
        }

        Ok(())
    }

    fn publish_bit_rule_to_coils(&self, rule: &ModbusMappingRule) -> ModbusAdapterResult<()> {
        let Some((modbus_start, count)) = self.resolve_bit_window(rule) else {
            return Ok(());
        };
        let values = self.read_canonical_bools(rule.canonical_area, count)?;
        self.modbus_memory
            .write_coils_with_source(modbus_start, &values, ChangeSource::Simulation)?;
        Ok(())
    }

    fn publish_bit_rule_to_discrete_inputs(
        &self,
        rule: &ModbusMappingRule,
    ) -> ModbusAdapterResult<()> {
        let Some((modbus_start, count)) = self.resolve_bit_window(rule) else {
            return Ok(());
        };
        let values = self.read_canonical_bools(rule.canonical_area, count)?;
        self.modbus_memory.write_discrete_inputs_with_source(
            modbus_start,
            &values,
            ChangeSource::Simulation,
        )?;
        Ok(())
    }

    fn publish_word_rule_to_holding_registers(
        &self,
        rule: &ModbusMappingRule,
    ) -> ModbusAdapterResult<()> {
        let Some((modbus_start, count)) = self.resolve_word_window(rule) else {
            return Ok(());
        };
        let values = self.read_canonical_words(rule.canonical_area, count)?;
        self.modbus_memory.write_holding_registers_with_source(
            modbus_start,
            &values,
            ChangeSource::Simulation,
        )?;
        Ok(())
    }

    fn publish_word_rule_to_input_registers(
        &self,
        rule: &ModbusMappingRule,
    ) -> ModbusAdapterResult<()> {
        let Some((modbus_start, count)) = self.resolve_word_window(rule) else {
            return Ok(());
        };
        let values = self.read_canonical_words(rule.canonical_area, count)?;
        self.modbus_memory.write_input_registers_with_source(
            modbus_start,
            &values,
            ChangeSource::Simulation,
        )?;
        Ok(())
    }

    fn read_canonical_bools(
        &self,
        area: CanonicalAreaKind,
        count: u16,
    ) -> ModbusAdapterResult<Vec<bool>> {
        let canonical = self.canonical_memory.read();
        let values = canonical.read_range(area, 0, count as usize)?;
        Ok(values
            .into_iter()
            .map(|value| match value {
                CanonicalValue::Bool(bit) => bit,
                CanonicalValue::U16(_) => false,
            })
            .collect())
    }

    fn read_canonical_words(
        &self,
        area: CanonicalAreaKind,
        count: u16,
    ) -> ModbusAdapterResult<Vec<u16>> {
        let canonical = self.canonical_memory.read();
        let values = canonical.read_range(area, 0, count as usize)?;
        Ok(values
            .into_iter()
            .map(|value| match value {
                CanonicalValue::U16(word) => word,
                CanonicalValue::Bool(bit) => u16::from(bit),
            })
            .collect())
    }

    fn resolve_bit_window(&self, rule: &ModbusMappingRule) -> Option<(u16, u16)> {
        let config = self.modbus_memory.config();
        let (start, space_count) = match rule.address_space {
            ModbusAddressSpace::Coil => (config.coil_start, config.coil_count),
            ModbusAddressSpace::DiscreteInput => (config.discrete_input_start, config.discrete_input_count),
            ModbusAddressSpace::HoldingRegister | ModbusAddressSpace::InputRegister => return None,
        };

        let count = clamp_rule_count(space_count, rule.offset, rule.count, rule.canonical_area);
        if count == 0 {
            return None;
        }

        Some((start.saturating_add(rule.offset), count))
    }

    fn resolve_word_window(&self, rule: &ModbusMappingRule) -> Option<(u16, u16)> {
        let config = self.modbus_memory.config();
        let (start, space_count) = match rule.address_space {
            ModbusAddressSpace::HoldingRegister => {
                (config.holding_register_start, config.holding_register_count)
            }
            ModbusAddressSpace::InputRegister => (config.input_register_start, config.input_register_count),
            ModbusAddressSpace::Coil | ModbusAddressSpace::DiscreteInput => return None,
        };

        let count = clamp_rule_count(space_count, rule.offset, rule.count, rule.canonical_area);
        if count == 0 {
            return None;
        }

        Some((start.saturating_add(rule.offset), count))
    }
}

fn clamp_rule_count(
    space_count: u16,
    offset: u16,
    requested: u16,
    canonical_area: CanonicalAreaKind,
) -> u16 {
    if offset >= space_count {
        return 0;
    }

    requested
        .min(space_count - offset)
        .min(canonical_area.default_size() as u16)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::MemoryMapSettings;
    use crate::plc_runtime::{
        CanonicalMemory, CanonicalWriteSource, ModbusMappingSource, VendorProfileId,
    };

    fn test_policy() -> ModbusMappingPolicy {
        ModbusMappingPolicy {
            profile_id: VendorProfileId::LsXg5000,
            source: ModbusMappingSource::Recommended,
            rules: vec![
                ModbusMappingRule {
                    family: "M".to_string(),
                    canonical_area: CanonicalAreaKind::InternalBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 0,
                    count: 32,
                },
                ModbusMappingRule {
                    family: "D".to_string(),
                    canonical_area: CanonicalAreaKind::DataWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 0,
                    count: 32,
                },
            ],
        }
    }

    #[test]
    fn publishes_canonical_state_into_modbus_memory() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::InternalBit, 3),
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::DataWord, 4),
                CanonicalValue::U16(1234),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();

        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings::default()));
        let adapter = ModbusAdapter::new(canonical, Arc::clone(&modbus_memory), test_policy());
        adapter.publish_runtime_state().unwrap();

        assert!(modbus_memory.read_coils(3, 1).unwrap()[0]);
        assert_eq!(modbus_memory.read_holding_registers(4, 1).unwrap()[0], 1234);
    }

    #[test]
    fn applies_external_writes_back_into_canonical_memory() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings::default()));
        let adapter = ModbusAdapter::new(
            Arc::clone(&canonical),
            Arc::clone(&modbus_memory),
            test_policy(),
        );

        modbus_memory
            .write_coil_with_source(5, true, ChangeSource::External)
            .unwrap();
        modbus_memory
            .write_holding_register_with_source(6, 4321, ChangeSource::External)
            .unwrap();

        adapter.apply_external_writes().unwrap();

        assert_eq!(
            canonical
                .read()
                .read(CanonicalAddress::new(CanonicalAreaKind::InternalBit, 5))
                .unwrap(),
            CanonicalValue::Bool(true)
        );
        assert_eq!(
            canonical
                .read()
                .read(CanonicalAddress::new(CanonicalAreaKind::DataWord, 6))
                .unwrap(),
            CanonicalValue::U16(4321)
        );
    }

    #[test]
    fn publishes_discrete_inputs_and_input_registers_with_offsets() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::InputBit, 2),
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Test,
            )
            .unwrap();
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::RetentiveWord, 1),
                CanonicalValue::U16(777),
                CanonicalWriteSource::Test,
            )
            .unwrap();

        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_start: 100,
            coil_count: 16,
            discrete_input_start: 200,
            discrete_input_count: 16,
            holding_register_start: 300,
            holding_register_count: 16,
            input_register_start: 400,
            input_register_count: 16,
        }));

        let policy = ModbusMappingPolicy {
            profile_id: VendorProfileId::MelsecFxQCommon,
            source: ModbusMappingSource::Custom,
            rules: vec![
                ModbusMappingRule {
                    family: "X".to_string(),
                    canonical_area: CanonicalAreaKind::InputBit,
                    address_space: ModbusAddressSpace::DiscreteInput,
                    offset: 3,
                    count: 8,
                },
                ModbusMappingRule {
                    family: "R".to_string(),
                    canonical_area: CanonicalAreaKind::RetentiveWord,
                    address_space: ModbusAddressSpace::InputRegister,
                    offset: 4,
                    count: 8,
                },
            ],
        };

        let adapter = ModbusAdapter::new(canonical, Arc::clone(&modbus_memory), policy);
        adapter.publish_runtime_state().unwrap();

        assert!(modbus_memory.read_discrete_inputs(205, 1).unwrap()[0]);
        assert_eq!(modbus_memory.read_input_registers(405, 1).unwrap()[0], 777);
    }

    #[test]
    fn full_sync_honors_configured_window_starts_and_rule_offsets() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::OutputBit, 1),
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::DataWord, 2),
                CanonicalValue::U16(2222),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();

        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings {
            coil_start: 10,
            coil_count: 16,
            discrete_input_start: 110,
            discrete_input_count: 16,
            holding_register_start: 210,
            holding_register_count: 16,
            input_register_start: 310,
            input_register_count: 16,
        }));

        let policy = ModbusMappingPolicy {
            profile_id: VendorProfileId::LsXg5000,
            source: ModbusMappingSource::Custom,
            rules: vec![
                ModbusMappingRule {
                    family: "P".to_string(),
                    canonical_area: CanonicalAreaKind::OutputBit,
                    address_space: ModbusAddressSpace::Coil,
                    offset: 1,
                    count: 8,
                },
                ModbusMappingRule {
                    family: "D".to_string(),
                    canonical_area: CanonicalAreaKind::DataWord,
                    address_space: ModbusAddressSpace::HoldingRegister,
                    offset: 2,
                    count: 8,
                },
            ],
        };

        let adapter = ModbusAdapter::new(
            Arc::clone(&canonical),
            Arc::clone(&modbus_memory),
            policy,
        );

        modbus_memory
            .write_coil_with_source(13, true, ChangeSource::External)
            .unwrap();
        modbus_memory
            .write_holding_register_with_source(214, 4444, ChangeSource::External)
            .unwrap();

        adapter.full_sync().unwrap();

        assert!(modbus_memory.read_coils(12, 1).unwrap()[0]);
        assert_eq!(modbus_memory.read_holding_registers(214, 1).unwrap()[0], 4444);
        assert_eq!(
            canonical
                .read()
                .read(CanonicalAddress::new(CanonicalAreaKind::OutputBit, 3))
                .unwrap(),
            CanonicalValue::Bool(true)
        );
        assert_eq!(
            canonical
                .read()
                .read(CanonicalAddress::new(CanonicalAreaKind::DataWord, 4))
                .unwrap(),
            CanonicalValue::U16(4444)
        );
    }

    #[test]
    fn dirty_publish_flushes_rule_when_window_only_partially_overlaps() {
        let canonical = Arc::new(RwLock::new(CanonicalMemory::new()));
        canonical
            .write()
            .write(
                CanonicalAddress::new(CanonicalAreaKind::InternalBit, 9),
                CanonicalValue::Bool(true),
                CanonicalWriteSource::Simulation,
            )
            .unwrap();

        let modbus_memory = Arc::new(ModbusMemory::new(&MemoryMapSettings::default()));
        let adapter = ModbusAdapter::new(Arc::clone(&canonical), Arc::clone(&modbus_memory), test_policy());

        adapter
            .publish_dirty_state(&[DirtyPublishWindow {
                area: CanonicalAreaKind::InternalBit,
                start_index: 9,
                end_index: 20,
            }])
            .unwrap();

        assert!(modbus_memory.read_coils(9, 1).unwrap()[0]);
    }
}
