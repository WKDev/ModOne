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
}

pub type TagRegistryResult<T> = Result<T, TagRegistryError>;

#[derive(Default)]
pub struct TagRegistry {
    semantic_tags: RwLock<HashMap<String, TagDefinition>>,
}

impl TagRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn resolve(&self, tag_id: &str) -> TagRegistryResult<TagDefinition> {
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
        }
    }

    pub fn register_semantic(&self, request: RegisterTagRequest) -> TagRegistryResult<TagDefinition> {
        let canonical_address = request
            .canonical_address
            .or_else(|| request.binding.as_ref().and_then(|binding| match binding {
                RuntimeBinding::Canonical { address } => Some(*address),
                RuntimeBinding::Tag { .. } => None,
            }))
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
            .map(|access| access == TagAccessLevel::ReadWrite && default_access == TagAccessLevel::ReadOnly)
            .unwrap_or(false)
        {
            return Err(TagRegistryError::AccessEscalation);
        }

        let definition = TagDefinition {
            tag_id: tag_id.clone(),
            class: TagClass::Semantic,
            display_name: request.display_name,
            binding: RuntimeBinding::Tag { tag_id: tag_id.clone() },
            canonical_address,
            access: request.access.unwrap_or(default_access),
            vendor_aliases: request.vendor_aliases,
            description: request.description,
            engineering_unit: request.engineering_unit,
        };

        let mut semantic_tags = self.semantic_tags.write();
        if semantic_tags.contains_key(&tag_id) {
            return Err(TagRegistryError::DuplicateTag(tag_id));
        }
        semantic_tags.insert(tag_id, definition.clone());
        Ok(definition)
    }

    pub fn remove(&self, tag_id: &str) -> TagRegistryResult<()> {
        if tag_id.starts_with(RAW_TAG_PREFIX) {
            return Err(TagRegistryError::TagNotFound(tag_id.to_string()));
        }

        self.semantic_tags
            .write()
            .remove(tag_id)
            .map(|_| ())
            .ok_or_else(|| TagRegistryError::TagNotFound(tag_id.to_string()))
    }

    pub fn list(&self, include_raw: bool) -> Vec<TagDefinition> {
        let mut tags: Vec<_> = self.semantic_tags.read().values().cloned().collect();
        if include_raw {
            let raw_tags: Vec<_> = tags
                .iter()
                .map(|tag| self.raw_tag_for_address(tag.canonical_address, Some(tag.display_name.clone()), tag.vendor_aliases.clone()))
                .collect();
            tags.extend(raw_tags);
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
        Some(bit_index) => format!("{RAW_TAG_PREFIX}{:?}:{}:bit:{}", address.area, address.index, bit_index),
        None => format!("{RAW_TAG_PREFIX}{:?}:{}", address.area, address.index),
    }
}

fn parse_raw_tag_id(tag_id: &str) -> Option<CanonicalAddress> {
    let remainder = tag_id.strip_prefix(RAW_TAG_PREFIX)?;
    let parts: Vec<_> = remainder.split(':').collect();
    match parts.as_slice() {
        [area, index] => Some(CanonicalAddress::new(parse_area(area)?, index.parse().ok()?)),
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
        assert_eq!(tag.canonical_address, CanonicalAddress::new(CanonicalAreaKind::InputBit, 12));
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
            })
            .expect("semantic");

        assert_eq!(tag.tag_id, "motor-run");
        assert_eq!(registry.resolve("motor-run").unwrap().canonical_address, tag.canonical_address);
    }
}
