//! Tag System Tauri Commands
//!
//! Provides frontend access to the tag registry, tag value read/write,
//! and watched-tag subscription management.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::opcua::{OpcUaMappingStore, SharedMappingStore};
use crate::plc_runtime::{CanonicalAddress, CanonicalAreaKind, CanonicalWriteSource};
use crate::sim::tag_events::TagTypedValue;
use crate::sim::types::{RegisterTagRequest, TagAccessLevel};

use super::sim::SimState;

// ============================================================================
// OPC UA Mapping Store State
// ============================================================================

/// Tauri managed state wrapping the shared [`OpcUaMappingStore`].
///
/// When tags are deleted via [`delete_tag`] or [`delete_tags`], the
/// corresponding [`OpcUaMappingConfig`] entries are automatically removed
/// from this store to maintain consistency.
pub struct MappingStoreState {
    pub store: SharedMappingStore,
}

impl Default for MappingStoreState {
    fn default() -> Self {
        Self {
            store: std::sync::Arc::new(OpcUaMappingStore::new()),
        }
    }
}

// ============================================================================
// DTO types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagDefinitionDto {
    pub tag_id: String,
    pub class: String,
    pub display_name: String,
    pub canonical_address: CanonicalAddressDto,
    pub access: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub vendor_aliases: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engineering_unit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folder_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalAddressDto {
    pub area: String,
    pub index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagValueDto {
    pub tag_id: String,
    pub value: TagTypedValue,
    pub timestamp: String,
}

/// Request DTO for creating a new tag from the frontend.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagRequest {
    /// Optional explicit tag ID; auto-generated from display_name if omitted.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_id: Option<String>,
    /// Human-readable name for the tag.
    pub display_name: String,
    /// Canonical area kind (e.g. "InputBit", "DataWord").
    pub area: String,
    /// Index within the area.
    pub index: u32,
    /// Optional bit index for word-level bit access.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<u8>,
    /// Access level: "read" | "readwrite". Defaults to area default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access: Option<String>,
    /// Optional description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Optional engineering unit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engineering_unit: Option<String>,
    /// Optional dot-separated folder path for OPC UA Address Space hierarchy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_path: Option<String>,
}

/// Request DTO for updating an existing tag definition from the frontend.
/// All fields except `tag_id` are optional — only provided fields are changed.
/// The `tag_id` field is immutable — any attempt to change it via `new_tag_id`
/// will be rejected with an error.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTagRequest {
    /// The tag to update (required, immutable identifier).
    pub tag_id: String,
    /// Rejected if present and different from `tag_id`. Enforces tagId immutability.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_tag_id: Option<String>,
    /// New display name.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    /// New canonical area kind (e.g. "InputBit", "DataWord").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub area: Option<String>,
    /// New index within the area.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub index: Option<u32>,
    /// New optional bit index for word-level bit access.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<Option<u8>>,
    /// New access level: "read" | "readwrite".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access: Option<String>,
    /// New description (explicit null clears it).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<Option<String>>,
    /// New engineering unit (explicit null clears it).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engineering_unit: Option<Option<String>>,
    /// New folder path (explicit null clears it). Dot-separated segments for OPC UA hierarchy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_path: Option<Option<String>>,
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub fn list_tags(
    state: State<'_, SimState>,
    include_raw: Option<bool>,
) -> Result<Vec<TagDefinitionDto>, String> {
    let tags = state.tag_registry().list(include_raw.unwrap_or(true));
    Ok(tags.into_iter().map(tag_to_dto).collect())
}

#[tauri::command]
pub fn create_tag(
    state: State<'_, SimState>,
    request: CreateTagRequest,
) -> Result<TagDefinitionDto, String> {
    let area = parse_area_kind(&request.area)
        .ok_or_else(|| format!("unknown canonical area: {}", request.area))?;

    let canonical_address = match request.bit_index {
        Some(bit) => CanonicalAddress::with_bit_index(area, request.index, bit),
        None => CanonicalAddress::new(area, request.index),
    };

    // Check for duplicate canonical address among existing semantic tags
    let registry = state.tag_registry();
    let existing = registry.tags_for_address(&canonical_address);
    if !existing.is_empty() {
        return Err(format!(
            "canonical address {:?}:{} is already bound to tag(s): {}",
            area,
            request.index,
            existing.join(", ")
        ));
    }

    let access = match request.access.as_deref() {
        Some("read") => Some(TagAccessLevel::ReadOnly),
        Some("readwrite") => Some(TagAccessLevel::ReadWrite),
        Some(other) => return Err(format!("unknown access level: {}", other)),
        None => None,
    };

    let tag_request = RegisterTagRequest {
        tag_id: request.tag_id,
        display_name: request.display_name,
        binding: None,
        canonical_address: Some(canonical_address),
        vendor_aliases: Vec::new(),
        description: request.description,
        engineering_unit: request.engineering_unit,
        access,
        folder_path: request.folder_path,
    };

    let definition = registry
        .register_semantic(tag_request)
        .map_err(|e| e.to_string())?;

    Ok(tag_to_dto(definition))
}

#[tauri::command]
pub fn update_tag_definition(
    state: State<'_, SimState>,
    request: UpdateTagRequest,
) -> Result<TagDefinitionDto, String> {
    // Enforce tagId immutability — reject if new_tag_id is provided and differs
    if let Some(ref new_id) = request.new_tag_id {
        if new_id != &request.tag_id {
            return Err(
                crate::sim::tag_registry::TagRegistryError::TagIdImmutable(
                    request.tag_id.clone(),
                )
                .to_string(),
            );
        }
    }

    let registry = state.tag_registry();

    // Resolve the new canonical address if area/index fields are provided
    let new_canonical_address = if request.area.is_some() || request.index.is_some() {
        // We need to build a full address — fetch current definition for defaults
        let current = registry.resolve(&request.tag_id).map_err(|e| e.to_string())?;
        let current_area_str = format!("{:?}", current.canonical_address.area);
        let area_str = request.area.as_deref().unwrap_or(&current_area_str);
        let area = parse_area_kind(area_str)
            .ok_or_else(|| format!("unknown canonical area: {}", area_str))?;
        let index = request.index.unwrap_or(current.canonical_address.index);
        let bit_index = match request.bit_index {
            Some(bi) => bi,
            None => current.canonical_address.bit_index,
        };
        let addr = match bit_index {
            Some(bit) => CanonicalAddress::with_bit_index(area, index, bit),
            None => CanonicalAddress::new(area, index),
        };

        // Validate no duplicate canonical address (excluding this tag itself)
        let bound_tags = registry.tags_for_address(&addr);
        let others: Vec<_> = bound_tags.iter().filter(|id| id.as_str() != request.tag_id).collect();
        if !others.is_empty() {
            return Err(format!(
                "canonical address {:?}:{} is already bound to tag(s): {}",
                area, index,
                others.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
            ));
        }

        Some(addr)
    } else if request.bit_index.is_some() {
        // Only bit_index changed, keep area/index from current definition
        let current = registry.resolve(&request.tag_id).map_err(|e| e.to_string())?;
        let bit_index = request.bit_index.unwrap(); // we know it's Some
        let addr = match bit_index {
            Some(bit) => CanonicalAddress::with_bit_index(
                current.canonical_address.area,
                current.canonical_address.index,
                bit,
            ),
            None => CanonicalAddress::new(
                current.canonical_address.area,
                current.canonical_address.index,
            ),
        };
        Some(addr)
    } else {
        None
    };

    let access = match request.access.as_deref() {
        Some("read") => Some(TagAccessLevel::ReadOnly),
        Some("readwrite") => Some(TagAccessLevel::ReadWrite),
        Some(other) => return Err(format!("unknown access level: {}", other)),
        None => None,
    };

    let definition = registry
        .update_semantic(
            &request.tag_id,
            request.display_name,
            new_canonical_address,
            access,
            request.description,
            request.engineering_unit,
            request.folder_path,
        )
        .map_err(|e| e.to_string())?;

    Ok(tag_to_dto(definition))
}

/// Check whether a canonical address is already bound to an existing tag.
/// Returns the list of tag IDs bound to that address, optionally excluding
/// a specific tag (useful when editing an existing tag's address).
#[tauri::command]
pub fn check_canonical_address_duplicate(
    state: State<'_, SimState>,
    area: String,
    index: u32,
    bit_index: Option<u8>,
    exclude_tag_id: Option<String>,
) -> Result<Vec<String>, String> {
    let area_kind = parse_area_kind(&area)
        .ok_or_else(|| format!("unknown canonical area: {}", area))?;

    let addr = match bit_index {
        Some(bit) => CanonicalAddress::with_bit_index(area_kind, index, bit),
        None => CanonicalAddress::new(area_kind, index),
    };

    let bound = state.tag_registry().tags_for_address(&addr);

    let result: Vec<String> = match exclude_tag_id {
        Some(ref exclude) => bound.into_iter().filter(|id| id != exclude).collect(),
        None => bound,
    };

    Ok(result)
}

#[tauri::command]
pub fn read_tags(
    state: State<'_, SimState>,
    tag_ids: Vec<String>,
) -> Result<Vec<TagValueDto>, String> {
    let registry = state.tag_registry();
    let runtime = state.runtime();
    let timestamp = chrono::Utc::now().to_rfc3339();
    let mut results = Vec::with_capacity(tag_ids.len());

    for tag_id in tag_ids {
        let definition = registry.resolve(&tag_id).map_err(|e| e.to_string())?;
        let canonical_value = runtime
            .read(definition.canonical_address)
            .map_err(|e| e.to_string())?;
        results.push(TagValueDto {
            tag_id,
            value: TagTypedValue::from_canonical(canonical_value),
            timestamp: timestamp.clone(),
        });
    }

    Ok(results)
}

#[tauri::command]
pub fn write_tag(
    state: State<'_, SimState>,
    tag_id: String,
    value: TagTypedValue,
) -> Result<(), String> {
    let registry = state.tag_registry();
    let definition = registry.resolve(&tag_id).map_err(|e| e.to_string())?;

    if definition.access == crate::sim::types::TagAccessLevel::ReadOnly {
        return Err(format!("tag '{}' is read-only", tag_id));
    }

    let canonical_value = value.to_canonical()?;
    state
        .runtime()
        .write(
            definition.canonical_address,
            canonical_value,
            CanonicalWriteSource::ExternalProtocol,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_tag(
    state: State<'_, SimState>,
    mapping_store: State<'_, MappingStoreState>,
    tag_id: String,
) -> Result<(), String> {
    state
        .tag_registry()
        .remove(&tag_id)
        .map_err(|e| e.to_string())?;
    // Synchronized removal: clean up OpcUaMappingConfig entry for deleted tag
    mapping_store.store.remove(&tag_id);
    Ok(())
}

/// Batch-delete multiple tags in a single IPC round-trip.
/// Returns the list of tag IDs that were successfully deleted.
/// Tags that fail to delete (e.g. not found) are silently skipped.
#[tauri::command]
pub fn delete_tags(
    state: State<'_, SimState>,
    mapping_store: State<'_, MappingStoreState>,
    tag_ids: Vec<String>,
) -> Result<Vec<String>, String> {
    let registry = state.tag_registry();
    let mut deleted = Vec::with_capacity(tag_ids.len());
    for tag_id in tag_ids {
        if registry.remove(&tag_id).is_ok() {
            deleted.push(tag_id);
        }
    }
    // Synchronized removal: clean up OpcUaMappingConfig entries for deleted tags
    if !deleted.is_empty() {
        mapping_store.store.remove_many(&deleted);
    }
    Ok(deleted)
}

#[tauri::command]
pub fn set_watched_tags(
    state: State<'_, TagEventBridgeState>,
    tag_ids: Vec<String>,
) -> Result<(), String> {
    state.bridge.set_watched_tags(tag_ids);
    Ok(())
}

// ============================================================================
// Managed state for TagEventBridge
// ============================================================================

use crate::sim::tag_events::TagEventBridge;

pub struct TagEventBridgeState {
    pub bridge: TagEventBridge,
}

// ============================================================================
// Helpers
// ============================================================================

fn parse_area_kind(value: &str) -> Option<CanonicalAreaKind> {
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

pub(crate) fn tag_to_dto(tag: crate::sim::types::TagDefinition) -> TagDefinitionDto {
    TagDefinitionDto {
        tag_id: tag.tag_id,
        class: match tag.class {
            crate::sim::types::TagClass::RawBacked => "raw".to_string(),
            crate::sim::types::TagClass::Semantic => "semantic".to_string(),
        },
        display_name: tag.display_name,
        canonical_address: CanonicalAddressDto {
            area: format!("{:?}", tag.canonical_address.area),
            index: tag.canonical_address.index,
            bit_index: tag.canonical_address.bit_index,
        },
        access: match tag.access {
            crate::sim::types::TagAccessLevel::ReadOnly => "read".to_string(),
            crate::sim::types::TagAccessLevel::ReadWrite => "readwrite".to_string(),
        },
        vendor_aliases: tag.vendor_aliases,
        description: tag.description,
        engineering_unit: tag.engineering_unit,
        folder_path: tag.folder_path,
    }
}
