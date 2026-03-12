//! Canonical runtime type definitions.

use serde::{Deserialize, Serialize};

/// Protocol-agnostic canonical area kinds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub enum CanonicalAreaKind {
    InputBit,
    OutputBit,
    InternalBit,
    RetentiveBit,
    SpecialBit,
    DataWord,
    RetentiveWord,
    IndexWord,
    TimerDoneBit,
    TimerValueWord,
    CounterDoneBit,
    CounterValueWord,
    SystemBit,
    SystemWord,
}

impl CanonicalAreaKind {
    pub const ALL: [Self; 14] = [
        Self::InputBit,
        Self::OutputBit,
        Self::InternalBit,
        Self::RetentiveBit,
        Self::SpecialBit,
        Self::DataWord,
        Self::RetentiveWord,
        Self::IndexWord,
        Self::TimerDoneBit,
        Self::TimerValueWord,
        Self::CounterDoneBit,
        Self::CounterValueWord,
        Self::SystemBit,
        Self::SystemWord,
    ];

    /// Returns true when the area stores boolean values.
    pub fn is_bit_area(&self) -> bool {
        matches!(
            self,
            Self::InputBit
                | Self::OutputBit
                | Self::InternalBit
                | Self::RetentiveBit
                | Self::SpecialBit
                | Self::TimerDoneBit
                | Self::CounterDoneBit
                | Self::SystemBit
        )
    }

    /// Returns true when the area stores 16-bit values.
    pub fn is_word_area(&self) -> bool {
        !self.is_bit_area()
    }

    /// Returns true when the area survives a volatile reset.
    pub fn is_retentive(&self) -> bool {
        matches!(self, Self::RetentiveBit | Self::RetentiveWord)
    }

    /// Default access classification for the area kind.
    pub fn default_access(&self) -> CanonicalAccess {
        match self {
            Self::SpecialBit => CanonicalAccess::ReadOnly,
            Self::TimerDoneBit
            | Self::TimerValueWord
            | Self::CounterDoneBit
            | Self::CounterValueWord
            | Self::SystemBit
            | Self::SystemWord => CanonicalAccess::InternalOnly,
            _ => CanonicalAccess::ReadWrite,
        }
    }

    /// Default storage size used by the initial runtime bootstrap.
    pub fn default_size(&self) -> usize {
        match self {
            Self::InputBit => 2048,
            Self::OutputBit => 2048,
            Self::InternalBit => 8192,
            Self::RetentiveBit => 2048,
            Self::SpecialBit => 2048,
            Self::DataWord => 10000,
            Self::RetentiveWord => 10000,
            Self::IndexWord => 16,
            Self::TimerDoneBit => 2048,
            Self::TimerValueWord => 2048,
            Self::CounterDoneBit => 2048,
            Self::CounterValueWord => 2048,
            Self::SystemBit => 2048,
            Self::SystemWord => 8192,
        }
    }
}

/// Access semantics for canonical memory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CanonicalAccess {
    ReadOnly,
    ReadWrite,
    InternalOnly,
}

impl CanonicalAccess {
    /// Returns true when the access level allows this source to mutate memory.
    pub fn allows_write(&self, source: CanonicalWriteSource) -> bool {
        match self {
            Self::ReadOnly => false,
            Self::ReadWrite => true,
            Self::InternalOnly => source.is_internal(),
        }
    }
}

/// Canonical memory value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum CanonicalValue {
    Bool(bool),
    U16(u16),
}

/// Origin of a canonical memory mutation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CanonicalWriteSource {
    InternalRuntime,
    Simulation,
    ExternalProtocol,
    SnapshotRestore,
    Migration,
    Test,
}

impl CanonicalWriteSource {
    /// Returns true when the source is trusted to mutate internal-only areas.
    pub fn is_internal(&self) -> bool {
        matches!(
            self,
            Self::InternalRuntime
                | Self::Simulation
                | Self::SnapshotRestore
                | Self::Migration
                | Self::Test
        )
    }
}

/// Canonical address identity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct CanonicalAddress {
    pub area: CanonicalAreaKind,
    pub index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<u8>,
}

impl CanonicalAddress {
    /// Creates an address without a word bit selector.
    pub fn new(area: CanonicalAreaKind, index: u32) -> Self {
        Self {
            area,
            index,
            bit_index: None,
        }
    }

    /// Creates an address with a word bit selector.
    pub fn with_bit_index(area: CanonicalAreaKind, index: u32, bit_index: u8) -> Self {
        Self {
            area,
            index,
            bit_index: Some(bit_index),
        }
    }
}

/// Single canonical memory change event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CanonicalMemoryChange {
    pub address: CanonicalAddress,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_value: Option<CanonicalValue>,
    pub new_value: CanonicalValue,
    pub source: CanonicalWriteSource,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
}

/// Ordered batch of canonical memory changes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CanonicalMemoryBatchChange {
    pub batch_id: String,
    pub changes: Vec<CanonicalMemoryChange>,
    pub timestamp: String,
}

/// Event stream envelope for canonical memory notifications.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "payload", rename_all = "snake_case")]
pub enum CanonicalMemoryEvent {
    Single(CanonicalMemoryChange),
    Batch(CanonicalMemoryBatchChange),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_area_defaults() {
        assert!(CanonicalAreaKind::InputBit.is_bit_area());
        assert!(CanonicalAreaKind::DataWord.is_word_area());
        assert!(CanonicalAreaKind::RetentiveWord.is_retentive());
        assert_eq!(
            CanonicalAreaKind::TimerValueWord.default_access(),
            CanonicalAccess::InternalOnly
        );
    }

    #[test]
    fn test_internal_only_write_policy() {
        assert!(CanonicalAccess::InternalOnly.allows_write(CanonicalWriteSource::Simulation));
        assert!(!CanonicalAccess::InternalOnly.allows_write(CanonicalWriteSource::ExternalProtocol));
    }

    #[test]
    fn test_address_creation() {
        let address = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 10, 3);
        assert_eq!(address.area, CanonicalAreaKind::DataWord);
        assert_eq!(address.index, 10);
        assert_eq!(address.bit_index, Some(3));
    }
}
