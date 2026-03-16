//! Tag System Tauri Commands
//!
//! Provides frontend access to the tag registry, tag value read/write,
//! and watched-tag subscription management.

use serde::Serialize;
use tauri::State;

use crate::plc_runtime::CanonicalWriteSource;
use crate::sim::tag_events::TagTypedValue;

use super::sim::SimState;

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

fn tag_to_dto(tag: crate::sim::types::TagDefinition) -> TagDefinitionDto {
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
    }
}
