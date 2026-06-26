// 태그ID→매핑 설정을 보관하는 스레드 안전 저장소(OpcUaMappingStore)와 공유 핸들

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;

use crate::mapping::OpcUaMappingConfig;

/// Thread-safe store for per-tag [`OpcUaMappingConfig`] entries.
///
/// Maps `tag_id → OpcUaMappingConfig`, providing insert/get/remove/clear
/// operations. When a tag is deleted from the [`TagRegistry`], the
/// corresponding entry must also be removed from this store to maintain
/// consistency.
///
/// The store is designed to be shared across threads via [`SharedMappingStore`].
#[derive(Debug, Default)]
pub struct OpcUaMappingStore {
    configs: RwLock<HashMap<String, OpcUaMappingConfig>>,
}

/// Shared, thread-safe handle to an [`OpcUaMappingStore`].
pub type SharedMappingStore = Arc<OpcUaMappingStore>;

impl OpcUaMappingStore {
    /// Creates a new empty store.
    pub fn new() -> Self {
        Self {
            configs: RwLock::new(HashMap::new()),
        }
    }

    /// Inserts or replaces the mapping config for the given tag.
    ///
    /// Returns the previous config if one existed.
    pub fn insert(&self, tag_id: String, config: OpcUaMappingConfig) -> Option<OpcUaMappingConfig> {
        self.configs.write().insert(tag_id, config)
    }

    /// Returns the mapping config for the given tag, if present.
    pub fn get(&self, tag_id: &str) -> Option<OpcUaMappingConfig> {
        self.configs.read().get(tag_id).cloned()
    }

    /// Removes the mapping config for the given tag.
    ///
    /// Returns the removed config, or `None` if no entry existed.
    /// This should be called whenever a tag is deleted from the tag registry
    /// to keep the store synchronized.
    pub fn remove(&self, tag_id: &str) -> Option<OpcUaMappingConfig> {
        self.configs.write().remove(tag_id)
    }

    /// Removes mapping configs for multiple tags in a single lock acquisition.
    ///
    /// Returns the tag IDs that had configs removed. Useful for batch tag
    /// deletion to minimize lock contention.
    pub fn remove_many(&self, tag_ids: &[String]) -> Vec<String> {
        let mut configs = self.configs.write();
        let mut removed = Vec::new();
        for tag_id in tag_ids {
            if configs.remove(tag_id).is_some() {
                removed.push(tag_id.clone());
            }
        }
        removed
    }

    /// Returns `true` if the store contains a mapping config for the given tag.
    pub fn contains(&self, tag_id: &str) -> bool {
        self.configs.read().contains_key(tag_id)
    }

    /// Returns the number of mapping configs currently stored.
    pub fn len(&self) -> usize {
        self.configs.read().len()
    }

    /// Returns `true` if the store contains no mapping configs.
    pub fn is_empty(&self) -> bool {
        self.configs.read().is_empty()
    }

    /// Removes all mapping configs from the store.
    pub fn clear(&self) {
        self.configs.write().clear();
    }

    /// Returns a snapshot of all stored configs as a `HashMap`.
    ///
    /// Useful for serialization and bulk operations.
    pub fn snapshot(&self) -> HashMap<String, OpcUaMappingConfig> {
        self.configs.read().clone()
    }

    /// Replaces all entries from a `HashMap`.
    ///
    /// Useful for deserialization / bulk restore.
    pub fn load_from(&self, configs: HashMap<String, OpcUaMappingConfig>) {
        *self.configs.write() = configs;
    }

    /// Returns a list of all tag IDs that have mapping configs.
    pub fn tag_ids(&self) -> Vec<String> {
        self.configs.read().keys().cloned().collect()
    }
}
