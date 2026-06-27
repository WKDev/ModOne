//! Per-register dirty flag tracker for OPC UA mapping conversion.
//!
//! Provides change detection so that the mapping layer only converts registers
//! that have actually been modified since the last publish cycle.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use parking_lot::RwLock;

use modone_contract::CanonicalAddress;

use crate::mapping::{OpcUaMappingStore, RegisterRange};

// ---------------------------------------------------------------------------
// Dirty flag tracker — per-register change detection for mapping conversion
// ---------------------------------------------------------------------------

/// Tracks which registers have been modified since the last conversion cycle.
///
/// The dirty tracker maintains a set of [`CanonicalAddress`]es that have been
/// written to.  During the conversion/publish cycle, only tags whose underlying
/// register(s) overlap with the dirty set are converted — all clean tags are
/// skipped.  After conversion the dirty set is cleared (or individual entries
/// are cleared).
///
/// # Design rationale
///
/// PLC memory is updated at high frequency but most registers stay constant
/// between cycles.  Without change detection, the mapping layer would
/// re-convert *every* mapped tag on every tick, wasting CPU.  With dirty flags
/// the conversion cost is proportional to the number of *actually changed*
/// registers, which is typically a small fraction of the total tag count.
///
/// # Thread safety
///
/// All mutating methods take `&self` and use interior mutability via
/// [`parking_lot::RwLock`].  The tracker is designed to be shared across the
/// PLC write path (which marks registers dirty) and the OPC UA publish path
/// (which drains dirty flags and triggers conversions).
///
/// # 10K-tag optimisation
///
/// The dirty set uses a `HashSet<CanonicalAddress>` for O(1) insert/lookup.
/// [`DirtyTracker::collect_dirty_tags`] iterates the mapping store once and
/// probes the dirty set for each tag's register range, keeping overhead linear
/// in the number of configured tags rather than in the total memory size.
#[derive(Debug)]
pub struct DirtyTracker {
    /// Set of registers that have been modified since the last drain.
    dirty: RwLock<HashSet<CanonicalAddress>>,
}

/// Shared, thread-safe handle to a [`DirtyTracker`].
pub type SharedDirtyTracker = Arc<DirtyTracker>;

impl Default for DirtyTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl DirtyTracker {
    /// Creates a new tracker with no dirty registers.
    pub fn new() -> Self {
        Self {
            dirty: RwLock::new(HashSet::new()),
        }
    }

    /// Creates a new tracker pre-allocated for the expected number of
    /// simultaneous dirty entries.
    ///
    /// Useful at startup to avoid repeated re-allocation when a large number
    /// of registers are initially written (e.g. snapshot restore).
    pub fn with_capacity(cap: usize) -> Self {
        Self {
            dirty: RwLock::new(HashSet::with_capacity(cap)),
        }
    }

    // ── Marking dirty ──────────────────────────────────────────────────

    /// Marks a single register address as dirty.
    ///
    /// If the address is already dirty, this is a no-op.
    pub fn mark_dirty(&self, address: CanonicalAddress) {
        self.dirty.write().insert(address);
    }

    /// Marks multiple register addresses as dirty in a single lock acquisition.
    ///
    /// More efficient than calling [`mark_dirty`](Self::mark_dirty) in a loop
    /// when a batch of registers are written simultaneously (e.g. multi-word
    /// write or snapshot restore).
    pub fn mark_dirty_batch(&self, addresses: &[CanonicalAddress]) {
        if addresses.is_empty() {
            return;
        }
        let mut set = self.dirty.write();
        for &addr in addresses {
            set.insert(addr);
        }
    }

    /// Marks all registers covered by a [`RegisterRange`] as dirty.
    ///
    /// Convenience method that expands the range into individual
    /// [`CanonicalAddress`]es and inserts them into the dirty set.
    pub fn mark_range_dirty(&self, range: &RegisterRange) {
        let addrs = range.addresses();
        self.mark_dirty_batch(&addrs);
    }

    // ── Querying ───────────────────────────────────────────────────────

    /// Returns `true` if the given register address is dirty.
    pub fn is_dirty(&self, address: &CanonicalAddress) -> bool {
        self.dirty.read().contains(address)
    }

    /// Returns `true` if *any* register in the given [`RegisterRange`] is dirty.
    ///
    /// This is the primary check used during the publish cycle: a tag's mapping
    /// conversion is skipped entirely when none of its registers are dirty.
    pub fn is_range_dirty(&self, range: &RegisterRange) -> bool {
        let set = self.dirty.read();
        for addr in range.addresses() {
            if set.contains(&addr) {
                return true;
            }
        }
        false
    }

    /// Returns `true` if there are no dirty registers at all.
    pub fn is_clean(&self) -> bool {
        self.dirty.read().is_empty()
    }

    /// Returns the number of currently dirty register addresses.
    pub fn dirty_count(&self) -> usize {
        self.dirty.read().len()
    }

    // ── Draining / clearing ────────────────────────────────────────────

    /// Clears the dirty flag for a single register address.
    ///
    /// Returns `true` if the address was actually dirty (and is now clean).
    pub fn clear_dirty(&self, address: &CanonicalAddress) -> bool {
        self.dirty.write().remove(address)
    }

    /// Clears the dirty flags for all registers in the given [`RegisterRange`].
    ///
    /// Returns the number of addresses that were actually dirty.
    pub fn clear_range(&self, range: &RegisterRange) -> usize {
        let mut set = self.dirty.write();
        let mut count = 0;
        for addr in range.addresses() {
            if set.remove(&addr) {
                count += 1;
            }
        }
        count
    }

    /// Atomically drains all dirty addresses and returns them.
    ///
    /// After this call the tracker is clean. The caller (typically the OPC UA
    /// publish loop) uses the returned set to decide which tags to convert.
    pub fn drain_all(&self) -> HashSet<CanonicalAddress> {
        let mut set = self.dirty.write();
        std::mem::take(&mut *set)
    }

    /// Clears all dirty flags without returning the set.
    pub fn clear_all(&self) {
        self.dirty.write().clear();
    }

    // ── Tag-level filtering ────────────────────────────────────────────

    /// Given a mapping store and a registry of tag→address associations,
    /// returns the list of tag IDs whose register ranges overlap with the
    /// current dirty set.
    ///
    /// This is the main entry point for the publish cycle:
    ///
    /// 1. PLC writes mark registers dirty via [`mark_dirty`](Self::mark_dirty)
    ///    / [`mark_dirty_batch`](Self::mark_dirty_batch).
    /// 2. The publish tick calls `collect_dirty_tags` to find which tags need
    ///    re-conversion.
    /// 3. Only those tags are read from canonical memory and converted via the
    ///    mapping layer.
    /// 4. The caller clears the processed dirty flags (or calls
    ///    [`drain_all`](Self::drain_all) up front).
    ///
    /// `tag_addresses` maps `tag_id → CanonicalAddress` (the tag's
    /// `deviceAddress`). The mapping store supplies the `word_count` needed to
    /// derive the full [`RegisterRange`].
    pub fn collect_dirty_tags(
        &self,
        store: &OpcUaMappingStore,
        tag_addresses: &HashMap<String, CanonicalAddress>,
    ) -> Vec<String> {
        let dirty_set = self.dirty.read();
        if dirty_set.is_empty() {
            return Vec::new();
        }

        let configs = store.snapshot();
        let mut result = Vec::new();

        for (tag_id, config) in configs.iter() {
            if let Some(&device_address) = tag_addresses.get(tag_id) {
                let range = config.register_range(device_address);
                let is_dirty = range.addresses().iter().any(|a| dirty_set.contains(a));
                if is_dirty {
                    result.push(tag_id.clone());
                }
            }
        }

        result
    }

    /// Variant of [`collect_dirty_tags`](Self::collect_dirty_tags) that also
    /// drains all dirty flags atomically.
    ///
    /// This is the preferred method when the caller will process *all* dirty
    /// tags in one go and does not need to inspect the dirty set afterwards.
    /// Combining the collect + drain into one operation avoids a TOCTOU race
    /// where new writes between collect and drain would be lost.
    pub fn collect_and_drain_dirty_tags(
        &self,
        store: &OpcUaMappingStore,
        tag_addresses: &HashMap<String, CanonicalAddress>,
    ) -> Vec<String> {
        let mut dirty_set = self.dirty.write();
        if dirty_set.is_empty() {
            return Vec::new();
        }

        let configs = store.snapshot();
        let mut result = Vec::new();

        for (tag_id, config) in configs.iter() {
            if let Some(&device_address) = tag_addresses.get(tag_id) {
                let range = config.register_range(device_address);
                let is_dirty = range.addresses().iter().any(|a| dirty_set.contains(a));
                if is_dirty {
                    result.push(tag_id.clone());
                }
            }
        }

        dirty_set.clear();
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use modone_contract::CanonicalAreaKind;

    fn addr(area: CanonicalAreaKind, index: u32) -> CanonicalAddress {
        CanonicalAddress::new(area, index)
    }

    fn bit_addr(area: CanonicalAreaKind, index: u32, bit: u8) -> CanonicalAddress {
        CanonicalAddress::with_bit_index(area, index, bit)
    }

    // ── Basic mark / query / clear ─────────────────────────────────────

    #[test]
    fn new_tracker_is_clean() {
        let tracker = DirtyTracker::new();
        assert!(tracker.is_clean());
        assert_eq!(tracker.dirty_count(), 0);
    }

    #[test]
    fn default_tracker_is_clean() {
        let tracker = DirtyTracker::default();
        assert!(tracker.is_clean());
    }

    #[test]
    fn mark_dirty_single_register() {
        let tracker = DirtyTracker::new();
        let a = addr(CanonicalAreaKind::DataWord, 10);
        tracker.mark_dirty(a);

        assert!(!tracker.is_clean());
        assert!(tracker.is_dirty(&a));
        assert_eq!(tracker.dirty_count(), 1);
    }

    #[test]
    fn mark_dirty_idempotent() {
        let tracker = DirtyTracker::new();
        let a = addr(CanonicalAreaKind::DataWord, 10);
        tracker.mark_dirty(a);
        tracker.mark_dirty(a);
        assert_eq!(tracker.dirty_count(), 1);
    }

    #[test]
    fn is_dirty_returns_false_for_clean_register() {
        let tracker = DirtyTracker::new();
        let a = addr(CanonicalAreaKind::DataWord, 10);
        assert!(!tracker.is_dirty(&a));
    }

    #[test]
    fn clear_dirty_removes_flag() {
        let tracker = DirtyTracker::new();
        let a = addr(CanonicalAreaKind::DataWord, 10);
        tracker.mark_dirty(a);
        assert!(tracker.clear_dirty(&a));
        assert!(tracker.is_clean());
    }

    #[test]
    fn clear_dirty_returns_false_when_not_dirty() {
        let tracker = DirtyTracker::new();
        let a = addr(CanonicalAreaKind::DataWord, 10);
        assert!(!tracker.clear_dirty(&a));
    }

    #[test]
    fn clear_all_empties_tracker() {
        let tracker = DirtyTracker::new();
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 0));
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 1));
        tracker.mark_dirty(addr(CanonicalAreaKind::InternalBit, 5));
        assert_eq!(tracker.dirty_count(), 3);

        tracker.clear_all();
        assert!(tracker.is_clean());
    }

    // ── Batch operations ───────────────────────────────────────────────

    #[test]
    fn mark_dirty_batch_multiple_registers() {
        let tracker = DirtyTracker::new();
        let addrs = vec![
            addr(CanonicalAreaKind::DataWord, 0),
            addr(CanonicalAreaKind::DataWord, 1),
            addr(CanonicalAreaKind::DataWord, 2),
        ];
        tracker.mark_dirty_batch(&addrs);
        assert_eq!(tracker.dirty_count(), 3);
        for a in &addrs {
            assert!(tracker.is_dirty(a));
        }
    }

    #[test]
    fn mark_dirty_batch_empty_is_noop() {
        let tracker = DirtyTracker::new();
        tracker.mark_dirty_batch(&[]);
        assert!(tracker.is_clean());
    }

    #[test]
    fn drain_all_returns_dirty_set_and_clears() {
        let tracker = DirtyTracker::new();
        let a0 = addr(CanonicalAreaKind::DataWord, 0);
        let a1 = addr(CanonicalAreaKind::DataWord, 1);
        tracker.mark_dirty(a0);
        tracker.mark_dirty(a1);

        let drained = tracker.drain_all();
        assert_eq!(drained.len(), 2);
        assert!(drained.contains(&a0));
        assert!(drained.contains(&a1));
        assert!(tracker.is_clean());
    }

    #[test]
    fn drain_all_empty_returns_empty() {
        let tracker = DirtyTracker::new();
        let drained = tracker.drain_all();
        assert!(drained.is_empty());
    }

    // ── RegisterRange operations ───────────────────────────────────────

    #[test]
    fn mark_range_dirty_single_word() {
        let tracker = DirtyTracker::new();
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 10,
            word_count: 1,
            bit_index: None,
        };
        tracker.mark_range_dirty(&range);
        assert_eq!(tracker.dirty_count(), 1);
        assert!(tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, 10)));
    }

    #[test]
    fn mark_range_dirty_multi_word() {
        let tracker = DirtyTracker::new();
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 4,
            bit_index: None,
        };
        tracker.mark_range_dirty(&range);
        assert_eq!(tracker.dirty_count(), 4);
        for i in 100..104 {
            assert!(tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, i)));
        }
    }

    #[test]
    fn mark_range_dirty_boolean_bit_address() {
        let tracker = DirtyTracker::new();
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 5,
            word_count: 1,
            bit_index: Some(3),
        };
        tracker.mark_range_dirty(&range);
        assert_eq!(tracker.dirty_count(), 1);
        assert!(tracker.is_dirty(&bit_addr(CanonicalAreaKind::DataWord, 5, 3)));
        // Not dirty without bit_index
        assert!(!tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, 5)));
    }

    #[test]
    fn is_range_dirty_true_when_any_register_dirty() {
        let tracker = DirtyTracker::new();
        // Only mark the second register of a 4-word range
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 101));

        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 4,
            bit_index: None,
        };
        assert!(tracker.is_range_dirty(&range));
    }

    #[test]
    fn is_range_dirty_false_when_no_register_dirty() {
        let tracker = DirtyTracker::new();
        // Dirty a register outside the range
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 99));

        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 4,
            bit_index: None,
        };
        assert!(!tracker.is_range_dirty(&range));
    }

    #[test]
    fn is_range_dirty_different_area_not_dirty() {
        let tracker = DirtyTracker::new();
        tracker.mark_dirty(addr(CanonicalAreaKind::RetentiveWord, 100));

        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 1,
            bit_index: None,
        };
        assert!(!tracker.is_range_dirty(&range));
    }

    #[test]
    fn clear_range_clears_subset() {
        let tracker = DirtyTracker::new();
        // Dirty registers 100..104
        for i in 100..104 {
            tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, i));
        }
        assert_eq!(tracker.dirty_count(), 4);

        // Clear range 100..102 (word_count=2)
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let cleared = tracker.clear_range(&range);
        assert_eq!(cleared, 2);
        assert_eq!(tracker.dirty_count(), 2);
        assert!(!tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, 100)));
        assert!(!tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, 101)));
        assert!(tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, 102)));
        assert!(tracker.is_dirty(&addr(CanonicalAreaKind::DataWord, 103)));
    }

    // ── collect_dirty_tags ─────────────────────────────────────────────

    #[test]
    fn collect_dirty_tags_returns_only_dirty() {
        use crate::mapping::{
            ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
        };

        let store = OpcUaMappingStore::new();
        let tracker = DirtyTracker::new();

        // Tag A: DataWord 100, UInt16 (1 word)
        store.insert(
            "tag-a".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::UInt16,
                word_count: 1,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
                scaling: Default::default(),
            },
        );
        // Tag B: DataWord 200..202, Int32 (2 words)
        store.insert(
            "tag-b".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Int32,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
                scaling: Default::default(),
            },
        );
        // Tag C: DataWord 300, UInt16 (1 word) — not dirty
        store.insert(
            "tag-c".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::UInt16,
                word_count: 1,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
                scaling: Default::default(),
            },
        );

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "tag-a".to_string(),
            addr(CanonicalAreaKind::DataWord, 100),
        );
        tag_addrs.insert(
            "tag-b".to_string(),
            addr(CanonicalAreaKind::DataWord, 200),
        );
        tag_addrs.insert(
            "tag-c".to_string(),
            addr(CanonicalAreaKind::DataWord, 300),
        );

        // Mark only tag-a and one register of tag-b as dirty
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 100));
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 201)); // second word of tag-b

        let mut dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        dirty_tags.sort();
        assert_eq!(dirty_tags, vec!["tag-a", "tag-b"]);
        // tag-c is not in the result
    }

    #[test]
    fn collect_dirty_tags_empty_when_clean() {
        use crate::mapping::{OpcUaMappingConfig, OpcUaMappingStore};

        let store = OpcUaMappingStore::new();
        store.insert("tag-a".to_string(), OpcUaMappingConfig::default_for_word());

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "tag-a".to_string(),
            addr(CanonicalAreaKind::DataWord, 0),
        );

        let tracker = DirtyTracker::new();
        let dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        assert!(dirty_tags.is_empty());
    }

    #[test]
    fn collect_and_drain_returns_dirty_and_clears() {
        use crate::mapping::{OpcUaMappingConfig, OpcUaMappingStore};

        let store = OpcUaMappingStore::new();
        store.insert("tag-a".to_string(), OpcUaMappingConfig::default_for_word());

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "tag-a".to_string(),
            addr(CanonicalAreaKind::DataWord, 0),
        );

        let tracker = DirtyTracker::new();
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 0));

        let dirty_tags = tracker.collect_and_drain_dirty_tags(&store, &tag_addrs);
        assert_eq!(dirty_tags, vec!["tag-a"]);

        // Tracker should be clean now
        assert!(tracker.is_clean());

        // Second call returns empty
        let dirty_tags = tracker.collect_and_drain_dirty_tags(&store, &tag_addrs);
        assert!(dirty_tags.is_empty());
    }

    #[test]
    fn collect_dirty_tags_skips_tags_without_address() {
        use crate::mapping::{OpcUaMappingConfig, OpcUaMappingStore};

        let store = OpcUaMappingStore::new();
        store.insert("tag-a".to_string(), OpcUaMappingConfig::default_for_word());
        store.insert("tag-b".to_string(), OpcUaMappingConfig::default_for_word());

        // Only provide address for tag-a
        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "tag-a".to_string(),
            addr(CanonicalAreaKind::DataWord, 0),
        );

        let tracker = DirtyTracker::new();
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 0));

        let dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        assert_eq!(dirty_tags, vec!["tag-a"]);
    }

    #[test]
    fn collect_dirty_tags_boolean_bit_address() {
        use crate::mapping::{
            ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
        };

        let store = OpcUaMappingStore::new();
        store.insert(
            "motor-run".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Boolean,
                word_count: 1,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
                scaling: Default::default(),
            },
        );

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "motor-run".to_string(),
            bit_addr(CanonicalAreaKind::OutputBit, 3, 0),
        );

        let tracker = DirtyTracker::new();
        // Mark the exact bit address dirty
        tracker.mark_dirty(bit_addr(CanonicalAreaKind::OutputBit, 3, 0));

        let dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        assert_eq!(dirty_tags, vec!["motor-run"]);
    }

    #[test]
    fn with_capacity_creates_clean_tracker() {
        let tracker = DirtyTracker::with_capacity(1000);
        assert!(tracker.is_clean());
        assert_eq!(tracker.dirty_count(), 0);
    }

    #[test]
    fn multi_word_tag_dirty_on_first_register_only() {
        use crate::mapping::{
            ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
        };

        let store = OpcUaMappingStore::new();
        // Float tag: 2 words at DataWord 50..52
        store.insert(
            "temp".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
                scaling: Default::default(),
            },
        );

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert("temp".to_string(), addr(CanonicalAreaKind::DataWord, 50));

        let tracker = DirtyTracker::new();
        // Only mark the first register dirty
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 50));

        let dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        assert_eq!(dirty_tags, vec!["temp"]);
    }

    #[test]
    fn multi_word_tag_dirty_on_last_register_only() {
        use crate::mapping::{
            ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig, OpcUaMappingStore,
        };

        let store = OpcUaMappingStore::new();
        // Double tag: 4 words at DataWord 60..64
        store.insert(
            "pressure".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Double,
                word_count: 4,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadOnly,
                description: None,
                string_config: None,
                scaling: Default::default(),
            },
        );

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "pressure".to_string(),
            addr(CanonicalAreaKind::DataWord, 60),
        );

        let tracker = DirtyTracker::new();
        // Only mark the last register of the 4-word range dirty
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 63));

        let dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        assert_eq!(dirty_tags, vec!["pressure"]);
    }

    #[test]
    fn dirty_register_outside_all_tag_ranges_yields_no_tags() {
        use crate::mapping::{OpcUaMappingConfig, OpcUaMappingStore};

        let store = OpcUaMappingStore::new();
        store.insert("tag-a".to_string(), OpcUaMappingConfig::default_for_word());

        let mut tag_addrs = HashMap::new();
        tag_addrs.insert(
            "tag-a".to_string(),
            addr(CanonicalAreaKind::DataWord, 100),
        );

        let tracker = DirtyTracker::new();
        // Dirty a register not covered by any tag
        tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, 999));

        let dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        assert!(dirty_tags.is_empty());
    }

    #[test]
    fn large_scale_dirty_tracking_10k_tags() {
        use crate::mapping::{OpcUaMappingConfig, OpcUaMappingStore};

        let store = OpcUaMappingStore::new();
        let mut tag_addrs = HashMap::new();

        // Create 10K tags, each at a different DataWord register
        for i in 0..10_000u32 {
            let tag_id = format!("tag-{}", i);
            store.insert(tag_id.clone(), OpcUaMappingConfig::default_for_word());
            tag_addrs.insert(tag_id, addr(CanonicalAreaKind::DataWord, i));
        }

        let tracker = DirtyTracker::new();

        // Mark only 10 registers dirty
        for i in [0, 100, 500, 1000, 2000, 3000, 5000, 7000, 9000, 9999u32] {
            tracker.mark_dirty(addr(CanonicalAreaKind::DataWord, i));
        }

        let mut dirty_tags = tracker.collect_dirty_tags(&store, &tag_addrs);
        dirty_tags.sort();
        assert_eq!(dirty_tags.len(), 10);

        // Verify specific tags
        assert!(dirty_tags.contains(&"tag-0".to_string()));
        assert!(dirty_tags.contains(&"tag-9999".to_string()));
        assert!(!dirty_tags.contains(&"tag-1".to_string()));
    }
}
