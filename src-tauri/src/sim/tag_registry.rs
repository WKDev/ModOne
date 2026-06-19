use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use thiserror::Error;

use crate::plc_runtime::{CanonicalAccess, CanonicalAddress, CanonicalAreaKind};

use super::types::{RegisterTagRequest, RuntimeBinding, TagAccessLevel, TagClass, TagDefinition};

const RAW_TAG_PREFIX: &str = "raw:";

#[derive(Debug, Error)]
pub enum TagRegistryError {
    #[error("tag already exists: {0}")]
    DuplicateTag(String),
    #[error("tag not found: {0}")]
    TagNotFound(String),
    #[error("semantic tag ids cannot use the reserved raw: prefix")]
    ReservedTagPrefix,
    #[error("tag request must provide a canonical address or canonical binding")]
    MissingCanonicalBinding,
    #[error("tag access cannot be less restrictive than canonical access")]
    AccessEscalation,
    #[error("tagId is immutable after creation and cannot be changed (tag: {0})")]
    TagIdImmutable(String),
}

pub type TagRegistryResult<T> = Result<T, TagRegistryError>;

#[derive(Default)]
pub struct TagRegistry {
    raw_tags: RwLock<HashMap<String, TagDefinition>>,
    semantic_tags: RwLock<HashMap<String, TagDefinition>>,
    reverse_index: RwLock<HashMap<CanonicalAddress, Vec<String>>>,
}

impl TagRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn resolve(&self, tag_id: &str) -> TagRegistryResult<TagDefinition> {
        if let Some(raw) = self.raw_tags.read().get(tag_id).cloned() {
            return Ok(raw);
        }

        if let Some(raw) = self.try_resolve_raw(tag_id) {
            return Ok(raw);
        }

        self.semantic_tags
            .read()
            .get(tag_id)
            .cloned()
            .ok_or_else(|| TagRegistryError::TagNotFound(tag_id.to_string()))
    }

    pub fn resolve_binding(&self, binding: &RuntimeBinding) -> TagRegistryResult<CanonicalAddress> {
        match binding {
            RuntimeBinding::Canonical { address } => Ok(*address),
            RuntimeBinding::Tag { tag_id } => Ok(self.resolve(tag_id)?.canonical_address),
        }
    }

    pub fn raw_tag_for_address(
        &self,
        address: CanonicalAddress,
        display_name: Option<String>,
        vendor_aliases: Vec<String>,
    ) -> TagDefinition {
        TagDefinition {
            tag_id: raw_tag_id(address),
            class: TagClass::RawBacked,
            display_name: display_name.unwrap_or_else(|| raw_display_name(address)),
            binding: RuntimeBinding::Tag {
                tag_id: raw_tag_id(address),
            },
            canonical_address: address,
            access: access_from_canonical(address.area.default_access()),
            vendor_aliases,
            description: None,
            engineering_unit: None,
            folder_path: None,
        }
    }

    pub fn register_semantic(
        &self,
        request: RegisterTagRequest,
    ) -> TagRegistryResult<TagDefinition> {
        let canonical_address = request
            .canonical_address
            .or_else(|| {
                request.binding.as_ref().and_then(|binding| match binding {
                    RuntimeBinding::Canonical { address } => Some(*address),
                    RuntimeBinding::Tag { .. } => None,
                })
            })
            .ok_or(TagRegistryError::MissingCanonicalBinding)?;

        let tag_id = request
            .tag_id
            .unwrap_or_else(|| semantic_tag_id(&request.display_name));
        if tag_id.starts_with(RAW_TAG_PREFIX) {
            return Err(TagRegistryError::ReservedTagPrefix);
        }

        let default_access = access_from_canonical(canonical_address.area.default_access());
        if request
            .access
            .map(|access| {
                access == TagAccessLevel::ReadWrite && default_access == TagAccessLevel::ReadOnly
            })
            .unwrap_or(false)
        {
            return Err(TagRegistryError::AccessEscalation);
        }

        let definition = TagDefinition {
            tag_id: tag_id.clone(),
            class: TagClass::Semantic,
            display_name: request.display_name,
            binding: RuntimeBinding::Tag {
                tag_id: tag_id.clone(),
            },
            canonical_address,
            access: request.access.unwrap_or(default_access),
            vendor_aliases: request.vendor_aliases,
            description: request.description,
            engineering_unit: request.engineering_unit,
            folder_path: request.folder_path,
        };

        let mut semantic_tags = self.semantic_tags.write();
        if semantic_tags.contains_key(&tag_id) {
            return Err(TagRegistryError::DuplicateTag(tag_id));
        }
        semantic_tags.insert(tag_id.clone(), definition.clone());
        self.reverse_index
            .write()
            .entry(canonical_address)
            .or_default()
            .push(tag_id);
        Ok(definition)
    }

    pub fn register_raw(
        &self,
        address: CanonicalAddress,
        display_name: Option<String>,
        vendor_aliases: Vec<String>,
    ) -> TagDefinition {
        let definition = self.raw_tag_for_address(address, display_name, vendor_aliases);
        self.raw_tags
            .write()
            .insert(definition.tag_id.clone(), definition.clone());
        self.reverse_index
            .write()
            .entry(address)
            .or_default()
            .push(definition.tag_id.clone());
        definition
    }

    /// Update mutable fields of a semantic tag definition.
    ///
    /// The `canonical_address` can be changed; the reverse index is updated
    /// accordingly. Duplicate-address validation is the caller's responsibility.
    pub fn update_semantic(
        &self,
        tag_id: &str,
        display_name: Option<String>,
        canonical_address: Option<CanonicalAddress>,
        access: Option<TagAccessLevel>,
        description: Option<Option<String>>,
        engineering_unit: Option<Option<String>>,
        folder_path: Option<Option<String>>,
    ) -> TagRegistryResult<TagDefinition> {
        if tag_id.starts_with(RAW_TAG_PREFIX) {
            return Err(TagRegistryError::TagNotFound(tag_id.to_string()));
        }

        let mut semantic_tags = self.semantic_tags.write();
        let definition = semantic_tags
            .get_mut(tag_id)
            .ok_or_else(|| TagRegistryError::TagNotFound(tag_id.to_string()))?;

        if let Some(name) = display_name {
            definition.display_name = name;
        }

        if let Some(new_addr) = canonical_address {
            let old_addr = definition.canonical_address;
            if old_addr != new_addr {
                // Validate access escalation against new address
                let new_default = access_from_canonical(new_addr.area.default_access());
                let effective_access = access.unwrap_or(definition.access);
                if effective_access == TagAccessLevel::ReadWrite
                    && new_default == TagAccessLevel::ReadOnly
                {
                    return Err(TagRegistryError::AccessEscalation);
                }

                // Update reverse index
                let mut reverse = self.reverse_index.write();
                if let Some(ids) = reverse.get_mut(&old_addr) {
                    ids.retain(|id| id != tag_id);
                    if ids.is_empty() {
                        reverse.remove(&old_addr);
                    }
                }
                reverse
                    .entry(new_addr)
                    .or_default()
                    .push(tag_id.to_string());

                definition.canonical_address = new_addr;
            }
        }

        if let Some(new_access) = access {
            let addr_default =
                access_from_canonical(definition.canonical_address.area.default_access());
            if new_access == TagAccessLevel::ReadWrite && addr_default == TagAccessLevel::ReadOnly {
                return Err(TagRegistryError::AccessEscalation);
            }
            definition.access = new_access;
        }

        if let Some(desc) = description {
            definition.description = desc;
        }

        if let Some(eu) = engineering_unit {
            definition.engineering_unit = eu;
        }

        if let Some(fp) = folder_path {
            definition.folder_path = fp;
        }

        Ok(definition.clone())
    }

    pub fn remove(&self, tag_id: &str) -> TagRegistryResult<()> {
        if tag_id.starts_with(RAW_TAG_PREFIX) {
            return Err(TagRegistryError::TagNotFound(tag_id.to_string()));
        }

        let removed = self
            .semantic_tags
            .write()
            .remove(tag_id);

        match removed {
            Some(definition) => {
                let mut reverse = self.reverse_index.write();
                if let Some(ids) = reverse.get_mut(&definition.canonical_address) {
                    ids.retain(|id| id != tag_id);
                    if ids.is_empty() {
                        reverse.remove(&definition.canonical_address);
                    }
                }
                Ok(())
            }
            None => Err(TagRegistryError::TagNotFound(tag_id.to_string())),
        }
    }

    pub fn tags_for_address(&self, addr: &CanonicalAddress) -> Vec<String> {
        self.reverse_index
            .read()
            .get(addr)
            .cloned()
            .unwrap_or_default()
    }

    pub fn list(&self, include_raw: bool) -> Vec<TagDefinition> {
        let mut tags: Vec<_> = self.semantic_tags.read().values().cloned().collect();
        if include_raw {
            tags.extend(self.raw_tags.read().values().cloned());
        }

        tags.sort_by(|a, b| a.tag_id.cmp(&b.tag_id));
        tags.dedup_by(|a, b| a.tag_id == b.tag_id);
        tags
    }

    fn try_resolve_raw(&self, tag_id: &str) -> Option<TagDefinition> {
        parse_raw_tag_id(tag_id).map(|address| self.raw_tag_for_address(address, None, Vec::new()))
    }
}

pub type SharedTagRegistry = Arc<TagRegistry>;

fn raw_tag_id(address: CanonicalAddress) -> String {
    match address.bit_index {
        Some(bit_index) => format!(
            "{RAW_TAG_PREFIX}{:?}:{}:bit:{}",
            address.area, address.index, bit_index
        ),
        None => format!("{RAW_TAG_PREFIX}{:?}:{}", address.area, address.index),
    }
}

fn parse_raw_tag_id(tag_id: &str) -> Option<CanonicalAddress> {
    let remainder = tag_id.strip_prefix(RAW_TAG_PREFIX)?;
    let parts: Vec<_> = remainder.split(':').collect();
    match parts.as_slice() {
        [area, index] => Some(CanonicalAddress::new(
            parse_area(area)?,
            index.parse().ok()?,
        )),
        [area, index, "bit", bit_index] => Some(CanonicalAddress::with_bit_index(
            parse_area(area)?,
            index.parse().ok()?,
            bit_index.parse().ok()?,
        )),
        _ => None,
    }
}

fn parse_area(value: &str) -> Option<CanonicalAreaKind> {
    Some(match value {
        "InputBit" => CanonicalAreaKind::InputBit,
        "OutputBit" => CanonicalAreaKind::OutputBit,
        "InternalBit" => CanonicalAreaKind::InternalBit,
        "RetentiveBit" => CanonicalAreaKind::RetentiveBit,
        "SpecialBit" => CanonicalAreaKind::SpecialBit,
        "DataWord" => CanonicalAreaKind::DataWord,
        "RetentiveWord" => CanonicalAreaKind::RetentiveWord,
        "IndexWord" => CanonicalAreaKind::IndexWord,
        "TimerDoneBit" => CanonicalAreaKind::TimerDoneBit,
        "TimerValueWord" => CanonicalAreaKind::TimerValueWord,
        "CounterDoneBit" => CanonicalAreaKind::CounterDoneBit,
        "CounterValueWord" => CanonicalAreaKind::CounterValueWord,
        "SystemBit" => CanonicalAreaKind::SystemBit,
        "SystemWord" => CanonicalAreaKind::SystemWord,
        _ => return None,
    })
}

fn access_from_canonical(access: CanonicalAccess) -> TagAccessLevel {
    match access {
        CanonicalAccess::ReadOnly | CanonicalAccess::InternalOnly => TagAccessLevel::ReadOnly,
        CanonicalAccess::ReadWrite => TagAccessLevel::ReadWrite,
    }
}

fn raw_display_name(address: CanonicalAddress) -> String {
    match address.bit_index {
        Some(bit_index) => format!("{:?}:{}.{}", address.area, address.index, bit_index),
        None => format!("{:?}:{}", address.area, address.index),
    }
}

fn semantic_tag_id(display_name: &str) -> String {
    let slug = display_name
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        format!("tag-{}", uuid::Uuid::new_v4())
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_deterministic_raw_tags() {
        let registry = TagRegistry::new();
        let tag = registry.resolve("raw:InputBit:12").expect("raw");
        assert_eq!(
            tag.canonical_address,
            CanonicalAddress::new(CanonicalAreaKind::InputBit, 12)
        );
        assert_eq!(tag.class, TagClass::RawBacked);
    }

    #[test]
    fn registers_semantic_tags() {
        let registry = TagRegistry::new();
        let tag = registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("motor-run".to_string()),
                display_name: "Motor Run".to_string(),
                binding: Some(RuntimeBinding::canonical(CanonicalAddress::new(
                    CanonicalAreaKind::OutputBit,
                    3,
                ))),
                canonical_address: None,
                vendor_aliases: vec!["Y3".to_string()],
                description: Some("Main motor run command".to_string()),
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .expect("semantic");

        assert_eq!(tag.tag_id, "motor-run");
        assert_eq!(
            registry.resolve("motor-run").unwrap().canonical_address,
            tag.canonical_address
        );
    }

    #[test]
    fn tag_id_immutable_after_creation() {
        let registry = TagRegistry::new();
        // Create a semantic tag
        registry
            .register_semantic(RegisterTagRequest {
                tag_id: Some("pump-status".to_string()),
                display_name: "Pump Status".to_string(),
                binding: None,
                canonical_address: Some(CanonicalAddress::new(
                    CanonicalAreaKind::DataWord,
                    10,
                )),
                vendor_aliases: Vec::new(),
                description: None,
                engineering_unit: None,
                access: None,
                folder_path: None,
            })
            .expect("should register");

        // update_semantic does not accept a new tag_id — the tag_id parameter is
        // lookup-only and the stored tag_id is never mutated.
        let updated = registry
            .update_semantic(
                "pump-status",
                Some("Pump Status Updated".to_string()),
                None,
                None,
                None,
                None,
                None,
            )
            .expect("should update");

        // tag_id remains unchanged despite display_name change
        assert_eq!(updated.tag_id, "pump-status");
        assert_eq!(updated.display_name, "Pump Status Updated");

        // TagIdImmutable error variant exists and formats correctly
        let err = TagRegistryError::TagIdImmutable("pump-status".to_string());
        assert!(err.to_string().contains("immutable"));
        assert!(err.to_string().contains("pump-status"));
    }

    #[test]
    fn persists_explicit_raw_tags_for_listing() {
        let registry = TagRegistry::new();
        let tag = registry.register_raw(
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 5),
            Some("D5 Raw".to_string()),
            vec!["D0005".to_string()],
        );

        let listed = registry.list(true);
        assert!(listed.iter().any(|item| item.tag_id == tag.tag_id));
        assert_eq!(
            registry.resolve(&tag.tag_id).unwrap().display_name,
            "D5 Raw"
        );
    }
}
