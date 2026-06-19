//! Tag Import/Export Tauri Commands
//!
//! Provides CSV and JSON import, and CSV/JSON/NodeSet2 XML export for tags.
//! CSV import requires only `tagId` and `deviceAddress` columns; all other
//! fields receive sensible defaults.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::opcua::{is_bool_address, OpcUaMappingConfig};
use crate::plc_runtime::{CanonicalAddress, CanonicalAreaKind};
use crate::sim::types::{RegisterTagRequest, TagAccessLevel, TagDefinition};

use super::tags::{tag_to_dto, MappingStoreState, TagDefinitionDto};
use super::sim::SimState;

// ============================================================================
// Shared Types
// ============================================================================

/// How to handle conflicts when an imported tag ID already exists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    /// Overwrite existing tags with imported data.
    Overwrite,
    /// Skip tags that already exist.
    Skip,
    /// Abort the entire import if any conflict is found.
    Abort,
}

/// Result of a single tag import attempt.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagImportResult {
    pub tag_id: String,
    pub status: TagImportStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TagImportStatus {
    Created,
    Overwritten,
    Skipped,
    Failed,
}

/// Describes a conflict found during import validation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportConflict {
    /// The tag ID involved in the conflict.
    pub tag_id: String,
    /// The type of conflict: "duplicateTagId", "duplicateAddress", or "internalDuplicateTagId" / "internalDuplicateAddress".
    pub conflict_type: String,
    /// Human-readable description of the conflict.
    pub message: String,
}

/// Summary of an import operation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub total_rows: usize,
    pub created: usize,
    pub overwritten: usize,
    pub skipped: usize,
    pub failed: usize,
    pub results: Vec<TagImportResult>,
    /// Conflicts detected during import (populated when abort mode triggers).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub conflicts: Vec<ImportConflict>,
}

// ============================================================================
// CSV Import Types
// ============================================================================

/// A single row from a CSV import file.
/// Only `tag_id` and `device_address` are required.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CsvTagRow {
    /// Required: unique tag identifier.
    tag_id: String,
    /// Required: device address string like "InputBit:0", "DataWord:100", "DataWord:50.3".
    device_address: String,
    /// Optional: human-readable name; defaults to tag_id.
    #[serde(default)]
    display_name: Option<String>,
    /// Optional: access level "read" | "readwrite"; defaults from area.
    #[serde(default)]
    access: Option<String>,
    /// Optional: dot-separated folder path for OPC UA hierarchy.
    #[serde(default)]
    folder_path: Option<String>,
    /// Optional: description text.
    #[serde(default)]
    description: Option<String>,
    /// Optional: engineering unit (e.g. "°C", "bar").
    #[serde(default)]
    engineering_unit: Option<String>,
}

// ============================================================================
// Address Parsing
// ============================================================================

/// Parses a device address string like "InputBit:42" or "DataWord:100.3" into
/// a `CanonicalAddress`.
///
/// Format: `<AreaKind>:<index>[.<bitIndex>]`
fn parse_device_address(addr: &str) -> Result<CanonicalAddress, String> {
    let (area_str, rest) = addr
        .split_once(':')
        .ok_or_else(|| format!("invalid device address '{}': expected 'Area:index' format", addr))?;

    let area = parse_area_kind(area_str)
        .ok_or_else(|| format!("unknown canonical area '{}' in device address '{}'", area_str, addr))?;

    // Check for bit index: "100.3"
    if let Some((idx_str, bit_str)) = rest.split_once('.') {
        let index: u32 = idx_str
            .parse()
            .map_err(|_| format!("invalid index '{}' in device address '{}'", idx_str, addr))?;
        let bit_index: u8 = bit_str
            .parse()
            .map_err(|_| format!("invalid bit index '{}' in device address '{}'", bit_str, addr))?;
        Ok(CanonicalAddress::with_bit_index(area, index, bit_index))
    } else {
        let index: u32 = rest
            .parse()
            .map_err(|_| format!("invalid index '{}' in device address '{}'", rest, addr))?;
        Ok(CanonicalAddress::new(area, index))
    }
}

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

// ============================================================================
// Conflict Detection
// ============================================================================

/// A lightweight record of (tagId, deviceAddress) for conflict checking.
struct ImportRecord<'a> {
    tag_id: &'a str,
    device_address: &'a str,
}

/// Detect all conflicts for a batch of import records:
/// 1. **Internal duplicates** — duplicate tagId or deviceAddress within the import data itself.
/// 2. **Registry tag ID conflicts** — tagId already exists in the tag registry.
/// 3. **Registry address conflicts** — deviceAddress already maps to a different existing tag.
fn detect_conflicts(
    records: &[ImportRecord<'_>],
    registry: &crate::sim::tag_registry::TagRegistry,
) -> Vec<ImportConflict> {
    let mut conflicts = Vec::new();

    // 1. Internal duplicate tagId detection
    let mut seen_tag_ids: HashMap<&str, usize> = HashMap::new();
    for (idx, rec) in records.iter().enumerate() {
        if let Some(&first_idx) = seen_tag_ids.get(rec.tag_id) {
            conflicts.push(ImportConflict {
                tag_id: rec.tag_id.to_string(),
                conflict_type: "internalDuplicateTagId".to_string(),
                message: format!(
                    "tagId '{}' appears multiple times in import data (rows {} and {})",
                    rec.tag_id,
                    first_idx + 1,
                    idx + 1,
                ),
            });
        } else {
            seen_tag_ids.insert(rec.tag_id, idx);
        }
    }

    // 2. Internal duplicate deviceAddress detection
    let mut seen_addresses: HashMap<&str, usize> = HashMap::new();
    for (idx, rec) in records.iter().enumerate() {
        if let Some(&first_idx) = seen_addresses.get(rec.device_address) {
            conflicts.push(ImportConflict {
                tag_id: rec.tag_id.to_string(),
                conflict_type: "internalDuplicateAddress".to_string(),
                message: format!(
                    "deviceAddress '{}' appears multiple times in import data (rows {} and {})",
                    rec.device_address,
                    first_idx + 1,
                    idx + 1,
                ),
            });
        } else {
            seen_addresses.insert(rec.device_address, idx);
        }
    }

    // 3. Registry conflicts
    for rec in records {
        // Existing tagId conflict
        if registry.resolve(rec.tag_id).is_ok() {
            conflicts.push(ImportConflict {
                tag_id: rec.tag_id.to_string(),
                conflict_type: "duplicateTagId".to_string(),
                message: format!("tagId '{}' already exists in the registry", rec.tag_id),
            });
        }

        // Existing deviceAddress conflict (different tag already bound to this address)
        if let Ok(addr) = parse_device_address(rec.device_address) {
            let existing_tags = registry.tags_for_address(&addr);
            let other_tags: Vec<_> = existing_tags
                .iter()
                .filter(|id| id.as_str() != rec.tag_id)
                .collect();
            if !other_tags.is_empty() {
                conflicts.push(ImportConflict {
                    tag_id: rec.tag_id.to_string(),
                    conflict_type: "duplicateAddress".to_string(),
                    message: format!(
                        "deviceAddress '{}' is already used by existing tag(s): {}",
                        rec.device_address,
                        other_tags.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", "),
                    ),
                });
            }
        }
    }

    conflicts
}

// ============================================================================
// CSV Import Command
// ============================================================================

/// Import tags from CSV content.
///
/// The CSV must contain at minimum `tagId` and `deviceAddress` columns.
/// All other columns are optional and receive defaults:
/// - `displayName` defaults to `tagId`
/// - `access` defaults to the area's default access level
/// - `folderPath`, `description`, `engineeringUnit` default to None
///
/// An OPC UA mapping config is auto-generated for each imported tag
/// using `is_bool` detection from the canonical address.
#[tauri::command]
pub fn import_tags_csv(
    state: tauri::State<'_, SimState>,
    mapping_store: tauri::State<'_, MappingStoreState>,
    csv_content: String,
    conflict_resolution: ConflictResolution,
) -> Result<ImportSummary, String> {
    // Parse CSV rows
    let rows = parse_csv_content(&csv_content)?;

    if rows.is_empty() {
        return Ok(ImportSummary {
            total_rows: 0,
            created: 0,
            overwritten: 0,
            skipped: 0,
            failed: 0,
            results: vec![],
            conflicts: vec![],
        });
    }

    let registry = state.tag_registry();

    // Detect all conflicts (tagId and deviceAddress, both internal and registry)
    let import_records: Vec<ImportRecord<'_>> = rows
        .iter()
        .map(|r| ImportRecord {
            tag_id: &r.tag_id,
            device_address: &r.device_address,
        })
        .collect();
    let detected_conflicts = detect_conflicts(&import_records, &registry);

    // Pre-check for abort mode: abort if any conflicts found
    if conflict_resolution == ConflictResolution::Abort && !detected_conflicts.is_empty() {
        let conflict_summary: Vec<String> = detected_conflicts
            .iter()
            .map(|c| format!("{}: {}", c.tag_id, c.message))
            .collect();
        return Err(format!(
            "Import aborted: {} conflict(s) detected:\n{}",
            detected_conflicts.len(),
            conflict_summary.join("\n")
        ));
    }

    let total_rows = rows.len();
    let mut results = Vec::with_capacity(total_rows);
    let mut created = 0usize;
    let mut overwritten = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;

    for row in rows {
        let tag_id = row.tag_id.clone();

        match import_single_csv_row(&registry, &*mapping_store, row, conflict_resolution) {
            Ok(status) => {
                match status {
                    TagImportStatus::Created => created += 1,
                    TagImportStatus::Overwritten => overwritten += 1,
                    TagImportStatus::Skipped => skipped += 1,
                    TagImportStatus::Failed => failed += 1,
                }
                results.push(TagImportResult {
                    tag_id,
                    status,
                    error: None,
                });
            }
            Err(e) => {
                failed += 1;
                results.push(TagImportResult {
                    tag_id,
                    status: TagImportStatus::Failed,
                    error: Some(e),
                });
            }
        }
    }

    Ok(ImportSummary {
        total_rows,
        created,
        overwritten,
        skipped,
        failed,
        results,
        conflicts: detected_conflicts,
    })
}

/// Parse CSV content into `CsvTagRow` records.
fn parse_csv_content(csv_content: &str) -> Result<Vec<CsvTagRow>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .trim(csv::Trim::All)
        .from_reader(csv_content.as_bytes());

    // Validate required headers
    let headers = reader
        .headers()
        .map_err(|e| format!("failed to read CSV headers: {}", e))?
        .clone();

    let header_names: Vec<&str> = headers.iter().collect();
    if !header_names.contains(&"tagId") {
        return Err("CSV missing required column 'tagId'".to_string());
    }
    if !header_names.contains(&"deviceAddress") {
        return Err("CSV missing required column 'deviceAddress'".to_string());
    }

    let mut rows = Vec::new();
    for (line_idx, result) in reader.deserialize::<CsvTagRow>().enumerate() {
        match result {
            Ok(row) => {
                // Validate required fields are non-empty
                if row.tag_id.trim().is_empty() {
                    return Err(format!("CSV row {} has empty tagId", line_idx + 2));
                }
                if row.device_address.trim().is_empty() {
                    return Err(format!(
                        "CSV row {} has empty deviceAddress",
                        line_idx + 2
                    ));
                }
                rows.push(row);
            }
            Err(e) => {
                return Err(format!("CSV parse error at row {}: {}", line_idx + 2, e));
            }
        }
    }

    Ok(rows)
}

/// Import a single CSV row into the tag registry.
fn import_single_csv_row(
    registry: &crate::sim::tag_registry::TagRegistry,
    mapping_store: &MappingStoreState,
    row: CsvTagRow,
    conflict_resolution: ConflictResolution,
) -> Result<TagImportStatus, String> {
    let canonical_address = parse_device_address(&row.device_address)?;

    // Check if tag already exists
    let existing = registry.resolve(&row.tag_id);
    if existing.is_ok() {
        match conflict_resolution {
            ConflictResolution::Skip => return Ok(TagImportStatus::Skipped),
            ConflictResolution::Abort => {
                // Should have been caught in pre-check, but handle gracefully
                return Err(format!("tag '{}' already exists", row.tag_id));
            }
            ConflictResolution::Overwrite => {
                // Remove existing tag first
                registry
                    .remove(&row.tag_id)
                    .map_err(|e| format!("failed to remove existing tag '{}': {}", row.tag_id, e))?;
                mapping_store.store.remove(&row.tag_id);
            }
        }
    }

    // Parse access level
    let access = match row.access.as_deref() {
        Some("read") => Some(TagAccessLevel::ReadOnly),
        Some("readwrite") => Some(TagAccessLevel::ReadWrite),
        Some("") | None => None, // use area default
        Some(other) => return Err(format!("unknown access level '{}' for tag '{}'", other, row.tag_id)),
    };

    // Build the registration request with defaults
    let display_name = row
        .display_name
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| row.tag_id.clone());

    let tag_request = RegisterTagRequest {
        tag_id: Some(row.tag_id.clone()),
        display_name,
        binding: None,
        canonical_address: Some(canonical_address),
        vendor_aliases: Vec::new(),
        description: row.description.filter(|s| !s.is_empty()),
        engineering_unit: row.engineering_unit.filter(|s| !s.is_empty()),
        access,
        folder_path: row.folder_path.filter(|s| !s.is_empty()),
    };

    // Register the tag
    let _definition = registry
        .register_semantic(tag_request)
        .map_err(|e| format!("failed to register tag '{}': {}", row.tag_id, e))?;

    // Auto-generate OPC UA mapping config using is_bool detection
    let mapping_config = OpcUaMappingConfig::default_for_address(canonical_address);
    mapping_store
        .store
        .insert(row.tag_id.clone(), mapping_config);

    let was_overwrite = existing.is_ok();
    Ok(if was_overwrite {
        TagImportStatus::Overwritten
    } else {
        TagImportStatus::Created
    })
}

// ============================================================================
// Validate CSV Preview (optional utility)
// ============================================================================

/// Validate CSV content and return a preview of tags that would be imported.
/// Does not modify the registry.
#[tauri::command]
pub fn validate_csv_import(
    state: tauri::State<'_, SimState>,
    csv_content: String,
) -> Result<CsvImportPreview, String> {
    let rows = parse_csv_content(&csv_content)?;
    let registry = state.tag_registry();

    let mut new_tags = Vec::new();
    let mut errors = Vec::new();

    for row in &rows {
        // Validate device address
        if let Err(e) = parse_device_address(&row.device_address) {
            errors.push(CsvImportError {
                tag_id: row.tag_id.clone(),
                error: e,
            });
            continue;
        }

        if registry.resolve(&row.tag_id).is_ok() {
            // tagId conflicts are captured by detect_conflicts below
        } else {
            new_tags.push(row.tag_id.clone());
        }
    }

    // Full conflict detection (tagId + deviceAddress, internal + registry)
    let import_records: Vec<ImportRecord<'_>> = rows
        .iter()
        .map(|r| ImportRecord {
            tag_id: &r.tag_id,
            device_address: &r.device_address,
        })
        .collect();
    let detected_conflicts = detect_conflicts(&import_records, &registry);

    // Extract simple tagId conflict list for backward compatibility
    let tag_id_conflicts: Vec<String> = detected_conflicts
        .iter()
        .filter(|c| c.conflict_type == "duplicateTagId")
        .map(|c| c.tag_id.clone())
        .collect();

    Ok(CsvImportPreview {
        total_rows: rows.len(),
        new_tags,
        conflicts: tag_id_conflicts,
        all_conflicts: detected_conflicts,
        errors,
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvImportPreview {
    pub total_rows: usize,
    pub new_tags: Vec<String>,
    /// Backward-compatible: tag IDs that conflict with existing registry entries.
    pub conflicts: Vec<String>,
    /// Detailed conflict information including tagId and deviceAddress conflicts.
    pub all_conflicts: Vec<ImportConflict>,
    pub errors: Vec<CsvImportError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvImportError {
    pub tag_id: String,
    pub error: String,
}

// ============================================================================
// JSON Import Types
// ============================================================================

/// A leaf tag object in the JSON import tree.
///
/// Required fields: `tagId` and `deviceAddress`.
/// All other fields are optional and receive the same defaults as CSV import.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonTagLeaf {
    /// Required: unique tag identifier.
    tag_id: String,
    /// Required: device address string like "InputBit:0", "DataWord:100", "DataWord:50.3".
    device_address: String,
    /// Optional: human-readable name; defaults to tag_id.
    #[serde(default)]
    display_name: Option<String>,
    /// Optional: access level "read" | "readwrite"; defaults from area.
    #[serde(default)]
    access: Option<String>,
    /// Optional: description text.
    #[serde(default)]
    description: Option<String>,
    /// Optional: engineering unit (e.g. "°C", "bar").
    #[serde(default)]
    engineering_unit: Option<String>,
    /// Optional: explicit folder path override. When absent, the folder path
    /// is derived from the nesting structure of the JSON tree.
    #[serde(default)]
    folder_path: Option<String>,
}

/// Intermediate flat record produced by walking the JSON tree.
#[derive(Debug, Clone)]
struct FlatJsonTag {
    tag_id: String,
    device_address: String,
    display_name: Option<String>,
    access: Option<String>,
    description: Option<String>,
    engineering_unit: Option<String>,
    folder_path: Option<String>,
}

// ============================================================================
// JSON Tree Walking
// ============================================================================

/// Recursively walks a JSON value, collecting tag leaf nodes.
///
/// The JSON structure is expected to be a nested object tree where:
/// - **Folder nodes** are JSON objects that do NOT contain both `tagId` and
///   `deviceAddress` string fields. Their keys become folder path segments.
/// - **Tag leaf nodes** are JSON objects containing both `tagId` (string) and
///   `deviceAddress` (string) fields.
///
/// Example:
/// ```json
/// {
///   "Plant": {
///     "Area1": {
///       "Motors": {
///         "motor_run": { "tagId": "motor_run", "deviceAddress": "OutputBit:0" }
///       }
///     }
///   }
/// }
/// ```
///
/// The folder path is built by joining parent folder keys with `.` separators,
/// producing `"Plant.Area1.Motors"` for the tag above.
fn walk_json_tree(
    value: &serde_json::Value,
    current_path: &[String],
    results: &mut Vec<FlatJsonTag>,
) -> Result<(), String> {
    match value {
        serde_json::Value::Object(map) => {
            if is_tag_leaf(value) {
                // Parse the leaf tag object
                let leaf: JsonTagLeaf = serde_json::from_value(value.clone())
                    .map_err(|e| {
                        format!(
                            "failed to parse tag leaf at path '{}': {}",
                            current_path.join("."),
                            e
                        )
                    })?;

                // Derive folder path: explicit override takes priority,
                // otherwise use the tree path (excluding the leaf key itself,
                // which was the last segment added before calling this function
                // on a leaf — we strip it via the parent's perspective).
                let folder_path = leaf.folder_path.or_else(|| {
                    if current_path.is_empty() {
                        None
                    } else {
                        Some(current_path.join("."))
                    }
                });

                results.push(FlatJsonTag {
                    tag_id: leaf.tag_id,
                    device_address: leaf.device_address,
                    display_name: leaf.display_name,
                    access: leaf.access,
                    description: leaf.description,
                    engineering_unit: leaf.engineering_unit,
                    folder_path,
                });
            } else {
                // Folder node — recurse into children
                for (key, child) in map {
                    if child.is_object() && is_tag_leaf(child) {
                        // The child is a tag leaf; current_path is its folder path
                        walk_json_tree(child, current_path, results)?;
                    } else if child.is_object() {
                        // The child is a folder node — extend the path
                        let mut child_path = current_path.to_vec();
                        child_path.push(key.clone());
                        walk_json_tree(child, &child_path, results)?;
                    } else if child.is_array() {
                        // Arrays at folder level
                        walk_json_tree(child, current_path, results)?;
                    }
                    // Primitive values at folder level are ignored
                }
            }
        }
        serde_json::Value::Array(arr) => {
            // Support arrays of tag objects or nested structures
            for (idx, item) in arr.iter().enumerate() {
                if item.is_object() || item.is_array() {
                    walk_json_tree(item, current_path, results)?;
                } else {
                    return Err(format!(
                        "unexpected non-object at array index {} in path '{}'",
                        idx,
                        current_path.join(".")
                    ));
                }
            }
        }
        _ => {
            // Primitive values at non-leaf positions are ignored
        }
    }

    Ok(())
}

/// Returns `true` if the JSON value represents a tag leaf node.
///
/// A tag leaf is a JSON object containing both `tagId` (string) and
/// `deviceAddress` (string) fields.
fn is_tag_leaf(value: &serde_json::Value) -> bool {
    if let serde_json::Value::Object(map) = value {
        let has_tag_id = map.get("tagId").map_or(false, |v| v.is_string());
        let has_device_address = map.get("deviceAddress").map_or(false, |v| v.is_string());
        has_tag_id && has_device_address
    } else {
        false
    }
}

/// Parse JSON content into flat tag records by walking the nested tree.
fn parse_json_tree(json_content: &str) -> Result<Vec<FlatJsonTag>, String> {
    let root: serde_json::Value =
        serde_json::from_str(json_content).map_err(|e| format!("invalid JSON: {}", e))?;

    let mut tags = Vec::new();
    walk_json_tree(&root, &[], &mut tags)?;

    Ok(tags)
}

// ============================================================================
// JSON Import Command
// ============================================================================

/// Import tags from a JSON nested object tree.
///
/// The JSON uses a hierarchical structure where parent objects represent folders
/// in the OPC UA Address Space, and leaf objects (containing `tagId` and
/// `deviceAddress`) represent tags.
///
/// Example input:
/// ```json
/// {
///   "Plant": {
///     "Area1": {
///       "Motors": {
///         "motor_run": { "tagId": "motor_run", "deviceAddress": "OutputBit:0" },
///         "motor_speed": { "tagId": "motor_speed", "deviceAddress": "DataWord:100", "engineeringUnit": "RPM" }
///       }
///     }
///   }
/// }
/// ```
///
/// This creates:
/// - `motor_run` with folderPath "Plant.Area1.Motors"
/// - `motor_speed` with folderPath "Plant.Area1.Motors"
///
/// Default values and OPC UA mapping auto-generation work identically to CSV import.
#[tauri::command]
pub fn import_tags_json(
    state: tauri::State<'_, SimState>,
    mapping_store: tauri::State<'_, MappingStoreState>,
    json_content: String,
    conflict_resolution: ConflictResolution,
) -> Result<ImportSummary, String> {
    let tags = parse_json_tree(&json_content)?;

    if tags.is_empty() {
        return Ok(ImportSummary {
            total_rows: 0,
            created: 0,
            overwritten: 0,
            skipped: 0,
            failed: 0,
            results: vec![],
            conflicts: vec![],
        });
    }

    let registry = state.tag_registry();

    // Detect all conflicts (tagId and deviceAddress, both internal and registry)
    let import_records: Vec<ImportRecord<'_>> = tags
        .iter()
        .map(|t| ImportRecord {
            tag_id: &t.tag_id,
            device_address: &t.device_address,
        })
        .collect();
    let detected_conflicts = detect_conflicts(&import_records, &registry);

    // Pre-check for abort mode: abort if any conflicts found
    if conflict_resolution == ConflictResolution::Abort && !detected_conflicts.is_empty() {
        let conflict_summary: Vec<String> = detected_conflicts
            .iter()
            .map(|c| format!("{}: {}", c.tag_id, c.message))
            .collect();
        return Err(format!(
            "Import aborted: {} conflict(s) detected:\n{}",
            detected_conflicts.len(),
            conflict_summary.join("\n")
        ));
    }

    let total_rows = tags.len();
    let mut results = Vec::with_capacity(total_rows);
    let mut created = 0usize;
    let mut overwritten = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;

    for tag in tags {
        let tag_id = tag.tag_id.clone();

        match import_single_json_tag(&registry, &*mapping_store, tag, conflict_resolution) {
            Ok(status) => {
                match status {
                    TagImportStatus::Created => created += 1,
                    TagImportStatus::Overwritten => overwritten += 1,
                    TagImportStatus::Skipped => skipped += 1,
                    TagImportStatus::Failed => failed += 1,
                }
                results.push(TagImportResult {
                    tag_id,
                    status,
                    error: None,
                });
            }
            Err(e) => {
                failed += 1;
                results.push(TagImportResult {
                    tag_id,
                    status: TagImportStatus::Failed,
                    error: Some(e),
                });
            }
        }
    }

    Ok(ImportSummary {
        total_rows,
        created,
        overwritten,
        skipped,
        failed,
        results,
        conflicts: detected_conflicts,
    })
}

/// Import a single flat JSON tag record into the tag registry.
fn import_single_json_tag(
    registry: &crate::sim::tag_registry::TagRegistry,
    mapping_store: &MappingStoreState,
    tag: FlatJsonTag,
    conflict_resolution: ConflictResolution,
) -> Result<TagImportStatus, String> {
    let canonical_address = parse_device_address(&tag.device_address)?;

    // Check if tag already exists
    let existing = registry.resolve(&tag.tag_id);
    if existing.is_ok() {
        match conflict_resolution {
            ConflictResolution::Skip => return Ok(TagImportStatus::Skipped),
            ConflictResolution::Abort => {
                return Err(format!("tag '{}' already exists", tag.tag_id));
            }
            ConflictResolution::Overwrite => {
                registry
                    .remove(&tag.tag_id)
                    .map_err(|e| {
                        format!("failed to remove existing tag '{}': {}", tag.tag_id, e)
                    })?;
                mapping_store.store.remove(&tag.tag_id);
            }
        }
    }

    // Parse access level
    let access = match tag.access.as_deref() {
        Some("read") => Some(TagAccessLevel::ReadOnly),
        Some("readwrite") => Some(TagAccessLevel::ReadWrite),
        Some("") | None => None,
        Some(other) => {
            return Err(format!(
                "unknown access level '{}' for tag '{}'",
                other, tag.tag_id
            ))
        }
    };

    // Build the registration request with defaults
    let display_name = tag
        .display_name
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| tag.tag_id.clone());

    let tag_request = RegisterTagRequest {
        tag_id: Some(tag.tag_id.clone()),
        display_name,
        binding: None,
        canonical_address: Some(canonical_address),
        vendor_aliases: Vec::new(),
        description: tag.description.filter(|s| !s.is_empty()),
        engineering_unit: tag.engineering_unit.filter(|s| !s.is_empty()),
        access,
        folder_path: tag.folder_path.filter(|s| !s.is_empty()),
    };

    // Register the tag
    let _definition = registry
        .register_semantic(tag_request)
        .map_err(|e| format!("failed to register tag '{}': {}", tag.tag_id, e))?;

    // Auto-generate OPC UA mapping config using is_bool detection
    let mapping_config = OpcUaMappingConfig::default_for_address(canonical_address);
    mapping_store
        .store
        .insert(tag.tag_id.clone(), mapping_config);

    let was_overwrite = existing.is_ok();
    Ok(if was_overwrite {
        TagImportStatus::Overwritten
    } else {
        TagImportStatus::Created
    })
}

/// Validate JSON import content and return a preview.
/// Does not modify the registry.
#[tauri::command]
pub fn validate_json_import(
    state: tauri::State<'_, SimState>,
    json_content: String,
) -> Result<JsonImportPreview, String> {
    let tags = parse_json_tree(&json_content)?;
    let registry = state.tag_registry();

    let mut new_tags = Vec::new();
    let mut errors = Vec::new();

    for tag in &tags {
        if let Err(e) = parse_device_address(&tag.device_address) {
            errors.push(CsvImportError {
                tag_id: tag.tag_id.clone(),
                error: e,
            });
            continue;
        }

        if registry.resolve(&tag.tag_id).is_ok() {
            // tagId conflicts are captured by detect_conflicts below
        } else {
            new_tags.push(tag.tag_id.clone());
        }
    }

    // Full conflict detection (tagId + deviceAddress, internal + registry)
    let import_records: Vec<ImportRecord<'_>> = tags
        .iter()
        .map(|t| ImportRecord {
            tag_id: &t.tag_id,
            device_address: &t.device_address,
        })
        .collect();
    let detected_conflicts = detect_conflicts(&import_records, &registry);

    // Extract simple tagId conflict list for backward compatibility
    let tag_id_conflicts: Vec<String> = detected_conflicts
        .iter()
        .filter(|c| c.conflict_type == "duplicateTagId")
        .map(|c| c.tag_id.clone())
        .collect();

    Ok(JsonImportPreview {
        total_tags: tags.len(),
        new_tags,
        conflicts: tag_id_conflicts,
        all_conflicts: detected_conflicts,
        errors,
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonImportPreview {
    pub total_tags: usize,
    pub new_tags: Vec<String>,
    /// Backward-compatible: tag IDs that conflict with existing registry entries.
    pub conflicts: Vec<String>,
    /// Detailed conflict information including tagId and deviceAddress conflicts.
    pub all_conflicts: Vec<ImportConflict>,
    pub errors: Vec<CsvImportError>,
}

// ============================================================================
// CSV Export Types
// ============================================================================

/// A single row in the CSV export, containing all tag fields plus OPC UA mapping data.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CsvExportRow {
    /// Tag identifier.
    tag_id: String,
    /// Device address in "Area:index[.bitIndex]" format.
    device_address: String,
    /// Human-readable display name.
    display_name: String,
    /// Tag class: "raw" or "semantic".
    class: String,
    /// Access level: "read" or "readwrite".
    access: String,
    /// Dot-separated folder path for OPC UA hierarchy.
    folder_path: String,
    /// Description text.
    description: String,
    /// Engineering unit (e.g. "°C", "bar").
    engineering_unit: String,
    /// OPC UA data type (e.g. "Boolean", "UInt16", "Int32").
    opcua_data_type: String,
    /// Number of consecutive U16 registers consumed.
    opcua_word_count: u16,
    /// Byte order for multi-register assembly.
    opcua_byte_order: String,
    /// OPC UA access level: "ReadOnly" or "ReadWrite".
    opcua_access_level: String,
}

/// Filter tags based on optional tag ID selection.
///
/// If `tag_ids` is `None` or empty, returns all tags unchanged.
/// Otherwise, returns only tags whose `tag_id` appears in the selection list.
fn filter_tags_by_selection(
    all_tags: Vec<TagDefinition>,
    tag_ids: &Option<Vec<String>>,
) -> Vec<TagDefinition> {
    match tag_ids {
        Some(ids) if !ids.is_empty() => {
            let id_set: std::collections::HashSet<&str> =
                ids.iter().map(|s| s.as_str()).collect();
            all_tags
                .into_iter()
                .filter(|t| id_set.contains(t.tag_id.as_str()))
                .collect()
        }
        _ => all_tags,
    }
}

/// Count tag leaves in a JSON export tree.
///
/// A leaf is identified by having a "tagId" key (as opposed to folder nodes).
fn count_json_tree_leaves(map: &serde_json::Map<String, serde_json::Value>) -> usize {
    let mut count = 0;
    for (_key, value) in map {
        if let serde_json::Value::Object(obj) = value {
            if obj.contains_key("tagId") {
                count += 1;
            } else {
                count += count_json_tree_leaves(obj);
            }
        }
    }
    count
}

/// Format a canonical address as a device address string.
///
/// Produces strings like "InputBit:42", "DataWord:100", or "DataWord:50.3".
fn format_device_address(addr: &crate::plc_runtime::CanonicalAddress) -> String {
    let area_str = format!("{:?}", addr.area);
    match addr.bit_index {
        Some(bit) => format!("{}:{}.{}", area_str, addr.index, bit),
        None => format!("{}:{}", area_str, addr.index),
    }
}

// ============================================================================
// Export Parameters
// ============================================================================

/// Parameters for export commands.
///
/// All fields are optional — when omitted, sensible defaults apply:
/// - `tag_ids`: if `None` or empty, export all tags
/// - `include_header`: CSV only; defaults to `true`
/// - `pretty`: JSON only; defaults to `true` (pretty-print)
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportParams {
    /// Optional list of tag IDs to export.
    /// When `None` or empty, all tags are exported.
    #[serde(default)]
    pub tag_ids: Option<Vec<String>>,

    /// (CSV) Whether to include the header row. Defaults to `true`.
    #[serde(default)]
    pub include_header: Option<bool>,

    /// (JSON) Whether to pretty-print the output. Defaults to `true`.
    #[serde(default)]
    pub pretty: Option<bool>,
}

/// Successful export result returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// The exported content string (CSV, JSON, or XML).
    pub content: String,
    /// Number of tags included in the export.
    pub tag_count: usize,
    /// The export format used.
    pub format: String,
}

// ============================================================================
// CSV Export Command
// ============================================================================

/// Export tags as CSV content including full field set and OPC UA mapping data.
///
/// Accepts optional `ExportParams` to filter tags and control formatting.
/// Returns an `ExportResult` containing the CSV string and metadata.
///
/// Each row contains:
/// - Tag fields: tagId, deviceAddress, displayName, class, access, folderPath,
///   description, engineeringUnit
/// - OPC UA mapping fields: opcuaDataType, opcuaWordCount, opcuaByteOrder,
///   opcuaAccessLevel
///
/// If a tag has no explicit OPC UA mapping config, a default is auto-generated
/// based on is_bool detection from the canonical address.
#[tauri::command]
pub fn export_tags_csv(
    state: tauri::State<'_, SimState>,
    mapping_store: tauri::State<'_, MappingStoreState>,
    params: Option<ExportParams>,
) -> Result<ExportResult, String> {
    let params = params.unwrap_or_default();
    let include_header = params.include_header.unwrap_or(true);

    // Fetch all tags (semantic only by default, excluding raw auto-generated tags)
    let all_tags = state.tag_registry().list(false);

    // Apply tag selection filter
    let tags = filter_tags_by_selection(all_tags, &params.tag_ids);

    if tags.is_empty() {
        // Return header-only CSV for empty tag set
        let content = if include_header {
            "tagId,deviceAddress,displayName,class,access,folderPath,description,engineeringUnit,opcuaDataType,opcuaWordCount,opcuaByteOrder,opcuaAccessLevel\n"
                .to_string()
        } else {
            String::new()
        };
        return Ok(ExportResult {
            content,
            tag_count: 0,
            format: "csv".to_string(),
        });
    }

    // Take a snapshot of all OPC UA mappings
    let mapping_snapshot = mapping_store.store.snapshot();

    // Build export rows
    let mut rows: Vec<CsvExportRow> = Vec::with_capacity(tags.len());
    for tag in &tags {
        let device_address = format_device_address(&tag.canonical_address);

        // Get OPC UA mapping: use stored config or auto-generate default
        let mapping = mapping_snapshot
            .get(&tag.tag_id)
            .cloned()
            .unwrap_or_else(|| OpcUaMappingConfig::default_for_address(tag.canonical_address));

        let class_str = match tag.class {
            crate::sim::types::TagClass::RawBacked => "raw",
            crate::sim::types::TagClass::Semantic => "semantic",
        };

        let access_str = match tag.access {
            TagAccessLevel::ReadOnly => "read",
            TagAccessLevel::ReadWrite => "readwrite",
        };

        rows.push(CsvExportRow {
            tag_id: tag.tag_id.clone(),
            device_address,
            display_name: tag.display_name.clone(),
            class: class_str.to_string(),
            access: access_str.to_string(),
            folder_path: tag.folder_path.clone().unwrap_or_default(),
            description: tag.description.clone().unwrap_or_default(),
            engineering_unit: tag.engineering_unit.clone().unwrap_or_default(),
            opcua_data_type: mapping.opcua_data_type.to_string(),
            opcua_word_count: mapping.word_count,
            opcua_byte_order: mapping.byte_order.to_string(),
            opcua_access_level: mapping.access_level.to_string(),
        });
    }

    let tag_count = rows.len();

    // Serialize to CSV
    let mut writer = if include_header {
        csv::Writer::from_writer(Vec::new())
    } else {
        csv::WriterBuilder::new()
            .has_headers(false)
            .from_writer(Vec::new())
    };

    // When headers are enabled, csv crate auto-writes them on first serialize call.
    // When disabled, WriterBuilder::has_headers(false) suppresses them.
    for row in &rows {
        writer
            .serialize(row)
            .map_err(|e| format!("CSV serialization error: {}", e))?;
    }
    writer
        .flush()
        .map_err(|e| format!("CSV flush error: {}", e))?;

    let csv_bytes = writer
        .into_inner()
        .map_err(|e| format!("CSV writer error: {}", e))?;

    let content = String::from_utf8(csv_bytes).map_err(|e| format!("CSV encoding error: {}", e))?;

    Ok(ExportResult {
        content,
        tag_count,
        format: "csv".to_string(),
    })
}

// ============================================================================
// JSON Export Command
// ============================================================================

/// Export tags as a JSON nested folder tree structure.
///
/// Accepts optional `ExportParams` to filter tags and control formatting.
/// Returns an `ExportResult` containing the JSON string and metadata.
///
/// Tags are organized into a hierarchical tree based on their `folderPath`.
/// For example, a tag with `folderPath = "Plant.Area1.Motors"` becomes:
/// ```json
/// {
///   "Plant": {
///     "Area1": {
///       "Motors": {
///         "motor_run": { "tagId": "motor_run", ... }
///       }
///     }
///   }
/// }
/// ```
///
/// Tags without a folder path are placed at the root level.
/// Each tag leaf includes all tag fields plus OPC UA mapping data.
#[tauri::command]
pub fn export_tags_json(
    state: tauri::State<'_, SimState>,
    mapping_store: tauri::State<'_, MappingStoreState>,
    params: Option<ExportParams>,
) -> Result<ExportResult, String> {
    let params = params.unwrap_or_default();
    let pretty = params.pretty.unwrap_or(true);

    let all_tags = state.tag_registry().list(false);
    let tags = filter_tags_by_selection(all_tags, &params.tag_ids);

    if tags.is_empty() {
        return Ok(ExportResult {
            content: "{}".to_string(),
            tag_count: 0,
            format: "json".to_string(),
        });
    }

    // Take a snapshot of all OPC UA mappings
    let mapping_snapshot = mapping_store.store.snapshot();

    // Build the nested tree using serde_json::Value
    let mut root = serde_json::Map::new();

    for tag in &tags {
        let device_address = format_device_address(&tag.canonical_address);

        // Get OPC UA mapping: use stored config or auto-generate default
        let mapping = mapping_snapshot
            .get(&tag.tag_id)
            .cloned()
            .unwrap_or_else(|| OpcUaMappingConfig::default_for_address(tag.canonical_address));

        let class_str = match tag.class {
            crate::sim::types::TagClass::RawBacked => "raw",
            crate::sim::types::TagClass::Semantic => "semantic",
        };

        let access_str = match tag.access {
            TagAccessLevel::ReadOnly => "read",
            TagAccessLevel::ReadWrite => "readwrite",
        };

        // Build the tag leaf object
        let leaf = build_json_export_leaf(
            &tag.tag_id,
            &device_address,
            &tag.display_name,
            class_str,
            access_str,
            tag.description.as_deref(),
            tag.engineering_unit.as_deref(),
            tag.folder_path.as_deref(),
            &mapping,
        );

        // Insert into the tree based on folder_path
        match &tag.folder_path {
            Some(folder_path) if !folder_path.is_empty() => {
                let segments: Vec<&str> = folder_path.split('.').collect();
                insert_into_tree(&mut root, &segments, &tag.tag_id, leaf);
            }
            _ => {
                // No folder path — place at root
                root.insert(tag.tag_id.clone(), leaf);
            }
        }
    }

    let tag_count = count_json_tree_leaves(&root);

    let content = if pretty {
        serde_json::to_string_pretty(&serde_json::Value::Object(root))
    } else {
        serde_json::to_string(&serde_json::Value::Object(root))
    }
    .map_err(|e| format!("JSON serialization error: {}", e))?;

    Ok(ExportResult {
        content,
        tag_count,
        format: "json".to_string(),
    })
}

/// Build a JSON Value representing a tag leaf for export.
fn build_json_export_leaf(
    tag_id: &str,
    device_address: &str,
    display_name: &str,
    class: &str,
    access: &str,
    description: Option<&str>,
    engineering_unit: Option<&str>,
    folder_path: Option<&str>,
    mapping: &OpcUaMappingConfig,
) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    obj.insert("tagId".to_string(), serde_json::Value::String(tag_id.to_string()));
    obj.insert("deviceAddress".to_string(), serde_json::Value::String(device_address.to_string()));
    obj.insert("displayName".to_string(), serde_json::Value::String(display_name.to_string()));
    obj.insert("class".to_string(), serde_json::Value::String(class.to_string()));
    obj.insert("access".to_string(), serde_json::Value::String(access.to_string()));
    if let Some(desc) = description {
        obj.insert("description".to_string(), serde_json::Value::String(desc.to_string()));
    }
    if let Some(eu) = engineering_unit {
        obj.insert("engineeringUnit".to_string(), serde_json::Value::String(eu.to_string()));
    }
    if let Some(fp) = folder_path {
        obj.insert("folderPath".to_string(), serde_json::Value::String(fp.to_string()));
    }
    obj.insert("opcuaDataType".to_string(), serde_json::Value::String(mapping.opcua_data_type.to_string()));
    obj.insert("opcuaWordCount".to_string(), serde_json::json!(mapping.word_count));
    obj.insert("opcuaByteOrder".to_string(), serde_json::Value::String(mapping.byte_order.to_string()));
    obj.insert("opcuaAccessLevel".to_string(), serde_json::Value::String(mapping.access_level.to_string()));
    serde_json::Value::Object(obj)
}

/// Recursively insert a tag leaf into the nested folder tree.
///
/// Given segments `["Plant", "Area1", "Motors"]` and a tag leaf, this creates
/// or traverses the nested object structure and places the leaf at the final level.
fn insert_into_tree(
    current: &mut serde_json::Map<String, serde_json::Value>,
    segments: &[&str],
    tag_id: &str,
    leaf: serde_json::Value,
) {
    if segments.is_empty() {
        current.insert(tag_id.to_string(), leaf);
        return;
    }

    let segment = segments[0];
    let remaining = &segments[1..];

    // Get or create the folder node
    let folder = current
        .entry(segment.to_string())
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));

    // Ensure it's an object (could conflict if a tag has the same name as a folder)
    if let serde_json::Value::Object(ref mut map) = folder {
        insert_into_tree(map, remaining, tag_id, leaf);
    } else {
        // If there's a naming conflict (tag name == folder name), place at current level
        current.insert(tag_id.to_string(), leaf);
    }
}

// ============================================================================
// NodeSet2 XML Export
// ============================================================================

/// OPC UA standard namespace URI.
const OPC_UA_NAMESPACE: &str = "http://opcfoundation.org/UA/";

/// Application-specific namespace URI for exported tags.
const APP_NAMESPACE: &str = "urn:modone:tags";

/// Map an OpcUaDataType to the OPC UA standard NodeId integer for that type.
///
/// These are the well-known NodeIds from the OPC UA specification (Part 6, Table A.1).
fn opcua_data_type_node_id(dt: &crate::opcua::OpcUaDataType) -> u32 {
    use crate::opcua::OpcUaDataType;
    match dt {
        OpcUaDataType::Boolean => 1,   // i=1
        OpcUaDataType::SByte => 2,     // i=2
        OpcUaDataType::Byte => 3,      // i=3
        OpcUaDataType::Int16 => 4,     // i=4
        OpcUaDataType::UInt16 => 5,    // i=5
        OpcUaDataType::Int32 => 6,     // i=6
        OpcUaDataType::UInt32 => 7,    // i=7
        OpcUaDataType::Int64 => 8,     // i=8
        OpcUaDataType::UInt64 => 9,    // i=9
        OpcUaDataType::Float => 10,    // i=10
        OpcUaDataType::Double => 11,   // i=11
        OpcUaDataType::String => 12,   // i=12
    }
}

/// Map MappingAccessLevel to the OPC UA AccessLevel bitmask.
///
/// OPC UA Part 3, Table 37: bit 0 = CurrentRead, bit 1 = CurrentWrite.
fn access_level_value(al: &crate::opcua::MappingAccessLevel) -> u8 {
    use crate::opcua::MappingAccessLevel;
    match al {
        MappingAccessLevel::ReadOnly => 1,   // bit 0 only
        MappingAccessLevel::ReadWrite => 3,  // bits 0 + 1
    }
}

/// Represents a folder in the NodeSet2 hierarchy, identified by a string NodeId.
struct NodeSet2Folder {
    node_id: String,
    browse_name: String,
    display_name: String,
    parent_node_id: String,
}

/// Build the NodeSet2 XML document from the tag registry and mapping store.
///
/// This is a pure function that takes tags + mappings and returns the XML string.
/// It can be tested without Tauri state.
fn build_nodeset2_xml(
    tags: &[TagDefinition],
    mapping_snapshot: &std::collections::HashMap<String, OpcUaMappingConfig>,
) -> Result<String, String> {
    use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
    use quick_xml::Writer;
    use std::collections::HashMap;
    use std::io::Cursor;

    let mut writer = Writer::new_with_indent(Cursor::new(Vec::new()), b' ', 2);

    // XML declaration
    writer
        .write_event(Event::Decl(BytesDecl::new("1.0", Some("utf-8"), None)))
        .map_err(|e| format!("XML write error: {}", e))?;

    // <UANodeSet> root element
    let mut nodeset_start = BytesStart::new("UANodeSet");
    nodeset_start.push_attribute(("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd"));
    nodeset_start.push_attribute(("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance"));
    nodeset_start.push_attribute(("xmlns:xsd", "http://www.w3.org/2001/XMLSchema"));
    nodeset_start.push_attribute(("xmlns:uax", "http://opcfoundation.org/UA/2008/02/Types.xsd"));
    writer
        .write_event(Event::Start(nodeset_start))
        .map_err(|e| format!("XML write error: {}", e))?;

    // <NamespaceUris>
    writer
        .write_event(Event::Start(BytesStart::new("NamespaceUris")))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::Start(BytesStart::new("Uri")))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::Text(BytesText::new(APP_NAMESPACE)))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::End(BytesEnd::new("Uri")))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::End(BytesEnd::new("NamespaceUris")))
        .map_err(|e| format!("XML write error: {}", e))?;

    // <Aliases> — declare commonly used NodeId aliases
    writer
        .write_event(Event::Start(BytesStart::new("Aliases")))
        .map_err(|e| format!("XML write error: {}", e))?;

    let aliases = [
        ("Boolean", "i=1"),
        ("SByte", "i=2"),
        ("Byte", "i=3"),
        ("Int16", "i=4"),
        ("UInt16", "i=5"),
        ("Int32", "i=6"),
        ("UInt32", "i=7"),
        ("Int64", "i=8"),
        ("UInt64", "i=9"),
        ("Float", "i=10"),
        ("Double", "i=11"),
        ("String", "i=12"),
        ("HasTypeDefinition", "i=40"),
        ("HasComponent", "i=47"),
        ("Organizes", "i=35"),
        ("BaseDataVariableType", "i=63"),
        ("FolderType", "i=61"),
    ];

    for (alias_name, alias_value) in &aliases {
        let mut alias_el = BytesStart::new("Alias");
        alias_el.push_attribute(("Alias", *alias_name));
        writer
            .write_event(Event::Start(alias_el))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::Text(BytesText::new(alias_value)))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::End(BytesEnd::new("Alias")))
            .map_err(|e| format!("XML write error: {}", e))?;
    }

    writer
        .write_event(Event::End(BytesEnd::new("Aliases")))
        .map_err(|e| format!("XML write error: {}", e))?;

    // Collect all unique folder paths and assign NodeIds.
    // folder_path is dot-separated: "Plant.Area1.Motors"
    // We create folder objects for each intermediate segment.
    let mut folder_node_ids: HashMap<String, String> = HashMap::new();
    let mut folders_to_write: Vec<NodeSet2Folder> = Vec::new();
    let mut next_folder_id: u32 = 1;

    // The root folder for all tags uses a well-known NodeId in namespace 1.
    let root_folder_node_id = "ns=1;s=Tags";

    for tag in tags {
        if let Some(ref fp) = tag.folder_path {
            if fp.is_empty() {
                continue;
            }
            let segments: Vec<&str> = fp.split('.').collect();
            for depth in 0..segments.len() {
                let path_key = segments[..=depth].join(".");
                if folder_node_ids.contains_key(&path_key) {
                    continue;
                }

                let folder_id = format!("ns=1;s=Folder_{}", next_folder_id);
                next_folder_id += 1;

                let parent = if depth == 0 {
                    root_folder_node_id.to_string()
                } else {
                    let parent_path = segments[..depth].join(".");
                    folder_node_ids
                        .get(&parent_path)
                        .cloned()
                        .unwrap_or_else(|| root_folder_node_id.to_string())
                };

                folders_to_write.push(NodeSet2Folder {
                    node_id: folder_id.clone(),
                    browse_name: format!("1:{}", segments[depth]),
                    display_name: segments[depth].to_string(),
                    parent_node_id: parent,
                });

                folder_node_ids.insert(path_key, folder_id);
            }
        }
    }

    // Write the root "Tags" folder as a UAObject under Objects (i=85)
    {
        let mut obj = BytesStart::new("UAObject");
        obj.push_attribute(("NodeId", root_folder_node_id));
        obj.push_attribute(("BrowseName", "1:Tags"));
        obj.push_attribute(("ParentNodeId", "i=85"));
        writer
            .write_event(Event::Start(obj))
            .map_err(|e| format!("XML write error: {}", e))?;

        // DisplayName
        writer
            .write_event(Event::Start(BytesStart::new("DisplayName")))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::Text(BytesText::new("Tags")))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::End(BytesEnd::new("DisplayName")))
            .map_err(|e| format!("XML write error: {}", e))?;

        // References
        writer
            .write_event(Event::Start(BytesStart::new("References")))
            .map_err(|e| format!("XML write error: {}", e))?;

        // Organized by Objects folder
        write_reference(&mut writer, "Organizes", "i=85", true)?;
        // HasTypeDefinition → FolderType
        write_reference(&mut writer, "HasTypeDefinition", "i=61", false)?;

        writer
            .write_event(Event::End(BytesEnd::new("References")))
            .map_err(|e| format!("XML write error: {}", e))?;

        writer
            .write_event(Event::End(BytesEnd::new("UAObject")))
            .map_err(|e| format!("XML write error: {}", e))?;
    }

    // Write intermediate folder UAObjects
    for folder in &folders_to_write {
        let mut obj = BytesStart::new("UAObject");
        obj.push_attribute(("NodeId", folder.node_id.as_str()));
        obj.push_attribute(("BrowseName", folder.browse_name.as_str()));
        obj.push_attribute(("ParentNodeId", folder.parent_node_id.as_str()));
        writer
            .write_event(Event::Start(obj))
            .map_err(|e| format!("XML write error: {}", e))?;

        // DisplayName
        writer
            .write_event(Event::Start(BytesStart::new("DisplayName")))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::Text(BytesText::new(&folder.display_name)))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::End(BytesEnd::new("DisplayName")))
            .map_err(|e| format!("XML write error: {}", e))?;

        // References
        writer
            .write_event(Event::Start(BytesStart::new("References")))
            .map_err(|e| format!("XML write error: {}", e))?;
        write_reference(&mut writer, "Organizes", &folder.parent_node_id, true)?;
        write_reference(&mut writer, "HasTypeDefinition", "i=61", false)?;
        writer
            .write_event(Event::End(BytesEnd::new("References")))
            .map_err(|e| format!("XML write error: {}", e))?;

        writer
            .write_event(Event::End(BytesEnd::new("UAObject")))
            .map_err(|e| format!("XML write error: {}", e))?;
    }

    // Write each tag as a UAVariable node
    for tag in tags {
        let mapping = mapping_snapshot
            .get(&tag.tag_id)
            .cloned()
            .unwrap_or_else(|| OpcUaMappingConfig::default_for_address(tag.canonical_address));

        let node_id = format!("ns=1;s={}", tag.tag_id);
        let browse_name = format!("1:{}", tag.tag_id);
        let data_type_id = format!("i={}", opcua_data_type_node_id(&mapping.opcua_data_type));
        let access_level = access_level_value(&mapping.access_level);
        let access_level_str = access_level.to_string();

        // Determine parent folder
        let parent = match &tag.folder_path {
            Some(fp) if !fp.is_empty() => folder_node_ids
                .get(fp.as_str())
                .cloned()
                .unwrap_or_else(|| root_folder_node_id.to_string()),
            _ => root_folder_node_id.to_string(),
        };

        // ValueRank: -1 = Scalar (no array)
        let mut var_el = BytesStart::new("UAVariable");
        var_el.push_attribute(("NodeId", node_id.as_str()));
        var_el.push_attribute(("BrowseName", browse_name.as_str()));
        var_el.push_attribute(("ParentNodeId", parent.as_str()));
        var_el.push_attribute(("DataType", data_type_id.as_str()));
        var_el.push_attribute(("AccessLevel", access_level_str.as_str()));
        var_el.push_attribute(("UserAccessLevel", access_level_str.as_str()));
        var_el.push_attribute(("ValueRank", "-1"));
        writer
            .write_event(Event::Start(var_el))
            .map_err(|e| format!("XML write error: {}", e))?;

        // DisplayName
        writer
            .write_event(Event::Start(BytesStart::new("DisplayName")))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::Text(BytesText::new(&tag.display_name)))
            .map_err(|e| format!("XML write error: {}", e))?;
        writer
            .write_event(Event::End(BytesEnd::new("DisplayName")))
            .map_err(|e| format!("XML write error: {}", e))?;

        // Description (optional)
        if let Some(ref desc) = tag.description {
            if !desc.is_empty() {
                writer
                    .write_event(Event::Start(BytesStart::new("Description")))
                    .map_err(|e| format!("XML write error: {}", e))?;
                writer
                    .write_event(Event::Text(BytesText::new(desc)))
                    .map_err(|e| format!("XML write error: {}", e))?;
                writer
                    .write_event(Event::End(BytesEnd::new("Description")))
                    .map_err(|e| format!("XML write error: {}", e))?;
            }
        }

        // References
        writer
            .write_event(Event::Start(BytesStart::new("References")))
            .map_err(|e| format!("XML write error: {}", e))?;
        // HasComponent from parent (inverse) — correct reference for Variables
        write_reference(&mut writer, "HasComponent", &parent, true)?;
        // HasTypeDefinition → BaseDataVariableType (i=63)
        write_reference(&mut writer, "HasTypeDefinition", "i=63", false)?;
        writer
            .write_event(Event::End(BytesEnd::new("References")))
            .map_err(|e| format!("XML write error: {}", e))?;

        // Value — default initial value based on the OPC UA data type
        write_variable_default_value(&mut writer, &mapping.opcua_data_type)?;

        writer
            .write_event(Event::End(BytesEnd::new("UAVariable")))
            .map_err(|e| format!("XML write error: {}", e))?;
    }

    // Close </UANodeSet>
    writer
        .write_event(Event::End(BytesEnd::new("UANodeSet")))
        .map_err(|e| format!("XML write error: {}", e))?;

    let xml_bytes = writer.into_inner().into_inner();
    String::from_utf8(xml_bytes).map_err(|e| format!("XML encoding error: {}", e))
}

/// Write a single OPC UA Reference element inside a References block.
fn write_reference(
    writer: &mut quick_xml::Writer<std::io::Cursor<Vec<u8>>>,
    reference_type: &str,
    target: &str,
    is_inverse: bool,
) -> Result<(), String> {
    use quick_xml::events::{BytesEnd, BytesStart, BytesText, Event};

    let mut ref_el = BytesStart::new("Reference");
    ref_el.push_attribute(("ReferenceType", reference_type));
    if is_inverse {
        ref_el.push_attribute(("IsForward", "false"));
    }
    writer
        .write_event(Event::Start(ref_el))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::Text(BytesText::new(target)))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::End(BytesEnd::new("Reference")))
        .map_err(|e| format!("XML write error: {}", e))?;
    Ok(())
}

/// Write a `<Value>` element containing the default (zero/false/empty) value
/// for the given OPC UA data type.
///
/// The value element uses the UAX (OPC UA XML Types) namespace for the typed
/// child element, conforming to the NodeSet2 schema:
/// ```xml
/// <Value>
///   <uax:UInt16>0</uax:UInt16>
/// </Value>
/// ```
fn write_variable_default_value(
    writer: &mut quick_xml::Writer<std::io::Cursor<Vec<u8>>>,
    data_type: &crate::opcua::OpcUaDataType,
) -> Result<(), String> {
    use quick_xml::events::{BytesEnd, BytesStart, BytesText, Event};

    // Map data type to the UAX element name and default value text
    let (uax_elem, default_text) = match data_type {
        crate::opcua::OpcUaDataType::Boolean => ("uax:Boolean", "false"),
        crate::opcua::OpcUaDataType::SByte => ("uax:SByte", "0"),
        crate::opcua::OpcUaDataType::Byte => ("uax:Byte", "0"),
        crate::opcua::OpcUaDataType::Int16 => ("uax:Int16", "0"),
        crate::opcua::OpcUaDataType::UInt16 => ("uax:UInt16", "0"),
        crate::opcua::OpcUaDataType::Int32 => ("uax:Int32", "0"),
        crate::opcua::OpcUaDataType::UInt32 => ("uax:UInt32", "0"),
        crate::opcua::OpcUaDataType::Int64 => ("uax:Int64", "0"),
        crate::opcua::OpcUaDataType::UInt64 => ("uax:UInt64", "0"),
        crate::opcua::OpcUaDataType::Float => ("uax:Float", "0"),
        crate::opcua::OpcUaDataType::Double => ("uax:Double", "0"),
        crate::opcua::OpcUaDataType::String => ("uax:String", ""),
    };

    // <Value>
    writer
        .write_event(Event::Start(BytesStart::new("Value")))
        .map_err(|e| format!("XML write error: {}", e))?;

    //   <uax:TypeName>default</uax:TypeName>
    writer
        .write_event(Event::Start(BytesStart::new(uax_elem)))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::Text(BytesText::new(default_text)))
        .map_err(|e| format!("XML write error: {}", e))?;
    writer
        .write_event(Event::End(BytesEnd::new(uax_elem)))
        .map_err(|e| format!("XML write error: {}", e))?;

    // </Value>
    writer
        .write_event(Event::End(BytesEnd::new("Value")))
        .map_err(|e| format!("XML write error: {}", e))?;

    Ok(())
}

/// Validate the generated NodeSet2 XML against basic OPC UA schema requirements.
///
/// Checks:
/// 1. Valid XML structure (well-formed)
/// 2. Root element is `<UANodeSet>` with correct namespace
/// 3. Required child elements: `<NamespaceUris>`, `<Aliases>`
/// 4. Every `<UAVariable>` has required attributes: NodeId, BrowseName, DataType
/// 5. Every `<UAObject>` has required attributes: NodeId, BrowseName
/// 6. Every node has a `<DisplayName>` child element
/// 7. Every node has at least one `<Reference>` within `<References>`
/// 8. NodeIds are unique across the document
fn validate_nodeset2_xml(xml: &str) -> Result<(), Vec<String>> {
    use quick_xml::events::Event;
    use quick_xml::Reader;
    use std::collections::HashSet;

    let mut errors: Vec<String> = Vec::new();
    let mut reader = Reader::from_str(xml);

    let mut found_root = false;
    let mut found_namespace_uris = false;
    let mut found_aliases = false;
    let mut all_node_ids: HashSet<String> = HashSet::new();

    // Track the current element context
    let mut in_ua_variable = false;
    let mut in_ua_object = false;
    let mut current_node_id: Option<String> = None;
    let mut has_display_name = false;
    let mut has_references = false;
    let mut depth: u32 = 0;
    let mut node_depth: u32 = 0;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                depth += 1;
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();

                match name.as_str() {
                    "UANodeSet" => {
                        found_root = true;
                        // Check namespace attribute
                        let has_ns = e.attributes().any(|a| {
                            if let Ok(attr) = a {
                                attr.key.as_ref() == b"xmlns"
                                    && attr.value.as_ref()
                                        == b"http://opcfoundation.org/UA/2011/03/UANodeSet.xsd"
                            } else {
                                false
                            }
                        });
                        if !has_ns {
                            errors.push(
                                "UANodeSet missing required xmlns attribute".to_string(),
                            );
                        }
                    }
                    "NamespaceUris" => {
                        found_namespace_uris = true;
                    }
                    "Aliases" => {
                        found_aliases = true;
                    }
                    "UAVariable" => {
                        in_ua_variable = true;
                        node_depth = depth;
                        has_display_name = false;
                        has_references = false;

                        // Check required attributes
                        let attrs: std::collections::HashMap<String, String> = e
                            .attributes()
                            .filter_map(|a| a.ok())
                            .map(|a| {
                                (
                                    String::from_utf8_lossy(a.key.as_ref()).to_string(),
                                    String::from_utf8_lossy(&a.value).to_string(),
                                )
                            })
                            .collect();

                        if let Some(nid) = attrs.get("NodeId") {
                            if !all_node_ids.insert(nid.clone()) {
                                errors.push(format!("Duplicate NodeId: {}", nid));
                            }
                            current_node_id = Some(nid.clone());
                        } else {
                            errors.push("UAVariable missing NodeId attribute".to_string());
                            current_node_id = None;
                        }

                        if !attrs.contains_key("BrowseName") {
                            errors.push(format!(
                                "UAVariable {} missing BrowseName",
                                current_node_id.as_deref().unwrap_or("(unknown)")
                            ));
                        }
                        if !attrs.contains_key("DataType") {
                            errors.push(format!(
                                "UAVariable {} missing DataType",
                                current_node_id.as_deref().unwrap_or("(unknown)")
                            ));
                        }
                    }
                    "UAObject" => {
                        in_ua_object = true;
                        node_depth = depth;
                        has_display_name = false;
                        has_references = false;

                        let attrs: std::collections::HashMap<String, String> = e
                            .attributes()
                            .filter_map(|a| a.ok())
                            .map(|a| {
                                (
                                    String::from_utf8_lossy(a.key.as_ref()).to_string(),
                                    String::from_utf8_lossy(&a.value).to_string(),
                                )
                            })
                            .collect();

                        if let Some(nid) = attrs.get("NodeId") {
                            if !all_node_ids.insert(nid.clone()) {
                                errors.push(format!("Duplicate NodeId: {}", nid));
                            }
                            current_node_id = Some(nid.clone());
                        } else {
                            errors.push("UAObject missing NodeId attribute".to_string());
                            current_node_id = None;
                        }

                        if !attrs.contains_key("BrowseName") {
                            errors.push(format!(
                                "UAObject {} missing BrowseName",
                                current_node_id.as_deref().unwrap_or("(unknown)")
                            ));
                        }
                    }
                    "DisplayName" if (in_ua_variable || in_ua_object) => {
                        has_display_name = true;
                    }
                    "References" if (in_ua_variable || in_ua_object) => {
                        has_references = true;
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();

                if (name == "UAVariable" || name == "UAObject") && depth == node_depth {
                    let node_label = current_node_id
                        .as_deref()
                        .unwrap_or("(unknown)")
                        .to_string();

                    if !has_display_name {
                        errors.push(format!("{} {} missing DisplayName", name, node_label));
                    }
                    if !has_references {
                        errors.push(format!("{} {} missing References", name, node_label));
                    }

                    in_ua_variable = false;
                    in_ua_object = false;
                    current_node_id = None;
                }

                depth -= 1;
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                errors.push(format!("XML parse error: {}", e));
                break;
            }
            _ => {}
        }
    }

    if !found_root {
        errors.push("Missing UANodeSet root element".to_string());
    }
    if !found_namespace_uris {
        errors.push("Missing NamespaceUris element".to_string());
    }
    if !found_aliases {
        errors.push("Missing Aliases element".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Export tags as OPC UA NodeSet2 XML content.
///
/// Accepts optional `ExportParams` to filter tags by tag ID selection.
/// Returns an `ExportResult` containing the XML string and metadata.
///
/// Generates a valid NodeSet2 XML document containing:
/// - Namespace declarations (OPC UA base + application-specific)
/// - Type aliases for common OPC UA node IDs
/// - UAObject folder hierarchy derived from tag `folderPath` values
/// - UAVariable nodes for each tag with correct DataType, AccessLevel,
///   DisplayName, and References
///
/// The output is validated against OPC UA NodeSet2 schema requirements
/// before being returned.
#[tauri::command]
pub fn export_tags_nodeset2(
    state: tauri::State<'_, SimState>,
    mapping_store: tauri::State<'_, MappingStoreState>,
    params: Option<ExportParams>,
) -> Result<ExportResult, String> {
    let params = params.unwrap_or_default();

    let all_tags = state.tag_registry().list(false);
    let tags = filter_tags_by_selection(all_tags, &params.tag_ids);
    let tag_count = tags.len();

    if tags.is_empty() {
        // Return a minimal valid NodeSet2 with no nodes
        let empty_tags: Vec<TagDefinition> = Vec::new();
        let empty_mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&empty_tags, &empty_mappings)?;
        return Ok(ExportResult {
            content: xml,
            tag_count: 0,
            format: "nodeset2".to_string(),
        });
    }

    let mapping_snapshot = mapping_store.store.snapshot();
    let xml = build_nodeset2_xml(&tags, &mapping_snapshot)?;

    // Validate the output before returning
    if let Err(validation_errors) = validate_nodeset2_xml(&xml) {
        return Err(format!(
            "NodeSet2 XML validation failed:\n{}",
            validation_errors.join("\n")
        ));
    }

    Ok(ExportResult {
        content: xml,
        tag_count,
        format: "nodeset2".to_string(),
    })
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_device_address_bit() {
        let addr = parse_device_address("InputBit:42").unwrap();
        assert_eq!(addr.area, CanonicalAreaKind::InputBit);
        assert_eq!(addr.index, 42);
        assert_eq!(addr.bit_index, None);
    }

    #[test]
    fn test_parse_device_address_word() {
        let addr = parse_device_address("DataWord:100").unwrap();
        assert_eq!(addr.area, CanonicalAreaKind::DataWord);
        assert_eq!(addr.index, 100);
        assert_eq!(addr.bit_index, None);
    }

    #[test]
    fn test_parse_device_address_word_with_bit() {
        let addr = parse_device_address("DataWord:50.3").unwrap();
        assert_eq!(addr.area, CanonicalAreaKind::DataWord);
        assert_eq!(addr.index, 50);
        assert_eq!(addr.bit_index, Some(3));
    }

    #[test]
    fn test_parse_device_address_invalid_format() {
        assert!(parse_device_address("BadAddress").is_err());
    }

    #[test]
    fn test_parse_device_address_unknown_area() {
        assert!(parse_device_address("UnknownArea:0").is_err());
    }

    #[test]
    fn test_parse_device_address_invalid_index() {
        assert!(parse_device_address("DataWord:abc").is_err());
    }

    #[test]
    fn test_parse_csv_content_minimal() {
        let csv = "tagId,deviceAddress\ntemp_sensor,DataWord:100\nmotor_run,OutputBit:0";
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].tag_id, "temp_sensor");
        assert_eq!(rows[0].device_address, "DataWord:100");
        assert!(rows[0].display_name.is_none());
        assert_eq!(rows[1].tag_id, "motor_run");
        assert_eq!(rows[1].device_address, "OutputBit:0");
    }

    #[test]
    fn test_parse_csv_content_with_optional_fields() {
        let csv = "tagId,deviceAddress,displayName,access,folderPath,description,engineeringUnit\ntemp_sensor,DataWord:100,Temperature Sensor,readwrite,Plant.Area1,Temp reading,°C";
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].tag_id, "temp_sensor");
        assert_eq!(rows[0].display_name.as_deref(), Some("Temperature Sensor"));
        assert_eq!(rows[0].access.as_deref(), Some("readwrite"));
        assert_eq!(rows[0].folder_path.as_deref(), Some("Plant.Area1"));
        assert_eq!(rows[0].description.as_deref(), Some("Temp reading"));
        assert_eq!(rows[0].engineering_unit.as_deref(), Some("°C"));
    }

    #[test]
    fn test_parse_csv_content_missing_tag_id_header() {
        let csv = "deviceAddress\nDataWord:100";
        let result = parse_csv_content(csv);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("tagId"));
    }

    #[test]
    fn test_parse_csv_content_missing_device_address_header() {
        let csv = "tagId\nmy_tag";
        let result = parse_csv_content(csv);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("deviceAddress"));
    }

    #[test]
    fn test_parse_csv_content_empty_tag_id() {
        let csv = "tagId,deviceAddress\n,DataWord:100";
        let result = parse_csv_content(csv);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty tagId"));
    }

    #[test]
    fn test_parse_csv_content_empty_device_address() {
        let csv = "tagId,deviceAddress\nmy_tag,";
        let result = parse_csv_content(csv);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty deviceAddress"));
    }

    #[test]
    fn test_parse_csv_content_empty_body() {
        let csv = "tagId,deviceAddress\n";
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows.len(), 0);
    }

    #[test]
    fn test_parse_csv_with_trimming() {
        let csv = "tagId , deviceAddress\n  temp_sensor , DataWord:100 \n";
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].tag_id, "temp_sensor");
        assert_eq!(rows[0].device_address, "DataWord:100");
    }

    // ========================================================================
    // JSON Import — Tree Walking Tests
    // ========================================================================

    #[test]
    fn test_is_tag_leaf_with_required_fields() {
        let val: serde_json::Value = serde_json::json!({
            "tagId": "motor_run",
            "deviceAddress": "OutputBit:0"
        });
        assert!(is_tag_leaf(&val));
    }

    #[test]
    fn test_is_tag_leaf_missing_device_address() {
        let val: serde_json::Value = serde_json::json!({
            "tagId": "motor_run"
        });
        assert!(!is_tag_leaf(&val));
    }

    #[test]
    fn test_is_tag_leaf_missing_tag_id() {
        let val: serde_json::Value = serde_json::json!({
            "deviceAddress": "OutputBit:0"
        });
        assert!(!is_tag_leaf(&val));
    }

    #[test]
    fn test_is_tag_leaf_non_string_tag_id() {
        let val: serde_json::Value = serde_json::json!({
            "tagId": 123,
            "deviceAddress": "OutputBit:0"
        });
        assert!(!is_tag_leaf(&val));
    }

    #[test]
    fn test_is_tag_leaf_empty_object() {
        let val: serde_json::Value = serde_json::json!({});
        assert!(!is_tag_leaf(&val));
    }

    #[test]
    fn test_is_tag_leaf_non_object() {
        let val: serde_json::Value = serde_json::json!("just a string");
        assert!(!is_tag_leaf(&val));
    }

    #[test]
    fn test_parse_json_tree_flat_tags() {
        let json = r#"{
            "motor_run": { "tagId": "motor_run", "deviceAddress": "OutputBit:0" },
            "temp_sensor": { "tagId": "temp_sensor", "deviceAddress": "DataWord:100" }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 2);

        // Tags at root level should have no folder path
        let motor = tags.iter().find(|t| t.tag_id == "motor_run").unwrap();
        assert_eq!(motor.device_address, "OutputBit:0");
        assert!(motor.folder_path.is_none());

        let temp = tags.iter().find(|t| t.tag_id == "temp_sensor").unwrap();
        assert_eq!(temp.device_address, "DataWord:100");
        assert!(temp.folder_path.is_none());
    }

    #[test]
    fn test_parse_json_tree_nested_folders() {
        let json = r#"{
            "Plant": {
                "Area1": {
                    "Motors": {
                        "motor_run": { "tagId": "motor_run", "deviceAddress": "OutputBit:0" },
                        "motor_speed": { "tagId": "motor_speed", "deviceAddress": "DataWord:100", "engineeringUnit": "RPM" }
                    }
                }
            }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 2);

        let motor_run = tags.iter().find(|t| t.tag_id == "motor_run").unwrap();
        assert_eq!(motor_run.folder_path.as_deref(), Some("Plant.Area1.Motors"));

        let motor_speed = tags.iter().find(|t| t.tag_id == "motor_speed").unwrap();
        assert_eq!(motor_speed.folder_path.as_deref(), Some("Plant.Area1.Motors"));
        assert_eq!(motor_speed.engineering_unit.as_deref(), Some("RPM"));
    }

    #[test]
    fn test_parse_json_tree_mixed_depth() {
        let json = r#"{
            "root_tag": { "tagId": "root_tag", "deviceAddress": "InternalBit:0" },
            "Plant": {
                "nested_tag": { "tagId": "nested_tag", "deviceAddress": "DataWord:50" }
            }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 2);

        let root_tag = tags.iter().find(|t| t.tag_id == "root_tag").unwrap();
        assert!(root_tag.folder_path.is_none());

        let nested_tag = tags.iter().find(|t| t.tag_id == "nested_tag").unwrap();
        assert_eq!(nested_tag.folder_path.as_deref(), Some("Plant"));
    }

    #[test]
    fn test_parse_json_tree_explicit_folder_path_override() {
        let json = r#"{
            "Plant": {
                "Area1": {
                    "my_tag": {
                        "tagId": "my_tag",
                        "deviceAddress": "DataWord:100",
                        "folderPath": "Custom.Path"
                    }
                }
            }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 1);
        // Explicit folderPath overrides the tree-derived path
        assert_eq!(tags[0].folder_path.as_deref(), Some("Custom.Path"));
    }

    #[test]
    fn test_parse_json_tree_with_optional_fields() {
        let json = r#"{
            "Sensors": {
                "temp": {
                    "tagId": "temp_sensor",
                    "deviceAddress": "DataWord:100",
                    "displayName": "Temperature",
                    "access": "readwrite",
                    "description": "Main boiler temp",
                    "engineeringUnit": "°C"
                }
            }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].tag_id, "temp_sensor");
        assert_eq!(tags[0].display_name.as_deref(), Some("Temperature"));
        assert_eq!(tags[0].access.as_deref(), Some("readwrite"));
        assert_eq!(tags[0].description.as_deref(), Some("Main boiler temp"));
        assert_eq!(tags[0].engineering_unit.as_deref(), Some("°C"));
        assert_eq!(tags[0].folder_path.as_deref(), Some("Sensors"));
    }

    #[test]
    fn test_parse_json_tree_array_of_tags() {
        let json = r#"[
            { "tagId": "tag_a", "deviceAddress": "InputBit:0" },
            { "tagId": "tag_b", "deviceAddress": "DataWord:200" }
        ]"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 2);
        assert!(tags.iter().any(|t| t.tag_id == "tag_a"));
        assert!(tags.iter().any(|t| t.tag_id == "tag_b"));
    }

    #[test]
    fn test_parse_json_tree_empty_object() {
        let json = "{}";
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 0);
    }

    #[test]
    fn test_parse_json_tree_empty_array() {
        let json = "[]";
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 0);
    }

    #[test]
    fn test_parse_json_tree_deeply_nested() {
        let json = r#"{
            "Level1": {
                "Level2": {
                    "Level3": {
                        "Level4": {
                            "deep_tag": { "tagId": "deep_tag", "deviceAddress": "RetentiveWord:10" }
                        }
                    }
                }
            }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(
            tags[0].folder_path.as_deref(),
            Some("Level1.Level2.Level3.Level4")
        );
    }

    #[test]
    fn test_parse_json_tree_multiple_folders() {
        let json = r#"{
            "Plant": {
                "Sensors": {
                    "temp": { "tagId": "temp", "deviceAddress": "DataWord:0" }
                },
                "Actuators": {
                    "valve": { "tagId": "valve", "deviceAddress": "OutputBit:5" }
                }
            }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 2);

        let temp = tags.iter().find(|t| t.tag_id == "temp").unwrap();
        assert_eq!(temp.folder_path.as_deref(), Some("Plant.Sensors"));

        let valve = tags.iter().find(|t| t.tag_id == "valve").unwrap();
        assert_eq!(valve.folder_path.as_deref(), Some("Plant.Actuators"));
    }

    #[test]
    fn test_parse_json_tree_invalid_json() {
        let result = parse_json_tree("not valid json {{{");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("invalid JSON"));
    }

    #[test]
    fn test_parse_json_tree_tag_with_bit_index_address() {
        let json = r#"{
            "tag_with_bit": { "tagId": "bit_tag", "deviceAddress": "DataWord:50.3" }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].device_address, "DataWord:50.3");
    }

    #[test]
    fn test_parse_json_tree_tag_defaults_display_name() {
        let json = r#"{
            "my_tag": { "tagId": "my_tag", "deviceAddress": "DataWord:0" }
        }"#;
        let tags = parse_json_tree(json).unwrap();
        assert_eq!(tags.len(), 1);
        // display_name should be None (defaulted to tag_id at import time)
        assert!(tags[0].display_name.is_none());
    }

    // ---- CSV Export Tests ----

    #[test]
    fn test_format_device_address_simple() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        assert_eq!(format_device_address(&addr), "DataWord:100");
    }

    #[test]
    fn test_format_device_address_bit_area() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::InputBit, 42);
        assert_eq!(format_device_address(&addr), "InputBit:42");
    }

    #[test]
    fn test_format_device_address_with_bit_index() {
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 50, 3);
        assert_eq!(format_device_address(&addr), "DataWord:50.3");
    }

    #[test]
    fn test_format_device_address_roundtrip() {
        let test_cases = vec![
            "InputBit:0",
            "OutputBit:15",
            "DataWord:100",
            "RetentiveWord:50",
            "DataWord:50.3",
        ];
        for addr_str in test_cases {
            let addr = parse_device_address(addr_str).unwrap();
            let formatted = format_device_address(&addr);
            assert_eq!(formatted, addr_str, "roundtrip failed for '{}'", addr_str);
        }
    }

    #[test]
    fn test_csv_export_row_serialization() {
        let row = CsvExportRow {
            tag_id: "temp_sensor".to_string(),
            device_address: "DataWord:100".to_string(),
            display_name: "Temperature Sensor".to_string(),
            class: "semantic".to_string(),
            access: "readwrite".to_string(),
            folder_path: "Plant.Area1".to_string(),
            description: "Main temperature".to_string(),
            engineering_unit: "°C".to_string(),
            opcua_data_type: "UInt16".to_string(),
            opcua_word_count: 1,
            opcua_byte_order: "BigEndian".to_string(),
            opcua_access_level: "ReadOnly".to_string(),
        };

        let mut writer = csv::Writer::from_writer(Vec::new());
        writer.serialize(&row).unwrap();
        writer.flush().unwrap();
        let csv_output = String::from_utf8(writer.into_inner().unwrap()).unwrap();

        // Verify CSV header contains all expected columns
        assert!(csv_output.contains("tagId,"));
        assert!(csv_output.contains("deviceAddress,"));
        assert!(csv_output.contains("displayName,"));
        assert!(csv_output.contains("class,"));
        assert!(csv_output.contains("access,"));
        assert!(csv_output.contains("folderPath,"));
        assert!(csv_output.contains("description,"));
        assert!(csv_output.contains("engineeringUnit,"));
        assert!(csv_output.contains("opcuaDataType,"));
        assert!(csv_output.contains("opcuaWordCount,"));
        assert!(csv_output.contains("opcuaByteOrder,"));
        assert!(csv_output.contains("opcuaAccessLevel"));

        // Verify data row values are present
        assert!(csv_output.contains("temp_sensor"));
        assert!(csv_output.contains("DataWord:100"));
        assert!(csv_output.contains("Temperature Sensor"));
        assert!(csv_output.contains("Plant.Area1"));
        assert!(csv_output.contains("UInt16"));
        assert!(csv_output.contains("BigEndian"));
    }

    #[test]
    fn test_csv_export_row_empty_optional_fields() {
        let row = CsvExportRow {
            tag_id: "motor_run".to_string(),
            device_address: "OutputBit:0".to_string(),
            display_name: "motor_run".to_string(),
            class: "semantic".to_string(),
            access: "read".to_string(),
            folder_path: "".to_string(),
            description: "".to_string(),
            engineering_unit: "".to_string(),
            opcua_data_type: "Boolean".to_string(),
            opcua_word_count: 1,
            opcua_byte_order: "BigEndian".to_string(),
            opcua_access_level: "ReadOnly".to_string(),
        };

        let mut writer = csv::Writer::from_writer(Vec::new());
        writer.serialize(&row).unwrap();
        writer.flush().unwrap();
        let csv_output = String::from_utf8(writer.into_inner().unwrap()).unwrap();

        assert!(csv_output.contains("motor_run"));
        assert!(csv_output.contains("OutputBit:0"));
        assert!(csv_output.contains("Boolean"));
        assert!(csv_output.contains("ReadOnly"));
    }

    #[test]
    fn test_csv_export_multiple_rows() {
        let rows = vec![
            CsvExportRow {
                tag_id: "tag1".to_string(),
                device_address: "DataWord:0".to_string(),
                display_name: "Tag 1".to_string(),
                class: "semantic".to_string(),
                access: "readwrite".to_string(),
                folder_path: "Folder1".to_string(),
                description: "First tag".to_string(),
                engineering_unit: "V".to_string(),
                opcua_data_type: "UInt16".to_string(),
                opcua_word_count: 1,
                opcua_byte_order: "BigEndian".to_string(),
                opcua_access_level: "ReadWrite".to_string(),
            },
            CsvExportRow {
                tag_id: "tag2".to_string(),
                device_address: "InputBit:5".to_string(),
                display_name: "Tag 2".to_string(),
                class: "semantic".to_string(),
                access: "read".to_string(),
                folder_path: "Folder2".to_string(),
                description: "Second tag".to_string(),
                engineering_unit: "".to_string(),
                opcua_data_type: "Boolean".to_string(),
                opcua_word_count: 1,
                opcua_byte_order: "BigEndian".to_string(),
                opcua_access_level: "ReadOnly".to_string(),
            },
        ];

        let mut writer = csv::Writer::from_writer(Vec::new());
        for row in &rows {
            writer.serialize(row).unwrap();
        }
        writer.flush().unwrap();
        let csv_output = String::from_utf8(writer.into_inner().unwrap()).unwrap();

        // Should have header + 2 data rows
        let lines: Vec<&str> = csv_output.trim().lines().collect();
        assert_eq!(lines.len(), 3, "expected header + 2 data rows");
        assert!(lines[0].starts_with("tagId,"));
        assert!(lines[1].contains("tag1"));
        assert!(lines[2].contains("tag2"));
    }

    // ---- JSON Export Tests ----

    #[test]
    fn test_insert_into_tree_root_level() {
        let mut root = serde_json::Map::new();
        let leaf = serde_json::json!({"tagId": "my_tag", "deviceAddress": "DataWord:0"});
        insert_into_tree(&mut root, &[], "my_tag", leaf.clone());
        assert_eq!(root.get("my_tag"), Some(&leaf));
    }

    #[test]
    fn test_insert_into_tree_single_folder() {
        let mut root = serde_json::Map::new();
        let leaf = serde_json::json!({"tagId": "temp", "deviceAddress": "DataWord:100"});
        insert_into_tree(&mut root, &["Sensors"], "temp", leaf);

        let sensors = root.get("Sensors").unwrap().as_object().unwrap();
        assert!(sensors.contains_key("temp"));
        assert_eq!(sensors["temp"]["tagId"], "temp");
    }

    #[test]
    fn test_insert_into_tree_nested_folders() {
        let mut root = serde_json::Map::new();
        let leaf = serde_json::json!({"tagId": "motor_run", "deviceAddress": "OutputBit:0"});
        insert_into_tree(&mut root, &["Plant", "Area1", "Motors"], "motor_run", leaf);

        let plant = root.get("Plant").unwrap().as_object().unwrap();
        let area1 = plant.get("Area1").unwrap().as_object().unwrap();
        let motors = area1.get("Motors").unwrap().as_object().unwrap();
        assert!(motors.contains_key("motor_run"));
        assert_eq!(motors["motor_run"]["tagId"], "motor_run");
    }

    #[test]
    fn test_insert_into_tree_multiple_tags_same_folder() {
        let mut root = serde_json::Map::new();
        let leaf1 = serde_json::json!({"tagId": "tag_a"});
        let leaf2 = serde_json::json!({"tagId": "tag_b"});
        insert_into_tree(&mut root, &["Plant", "Motors"], "tag_a", leaf1);
        insert_into_tree(&mut root, &["Plant", "Motors"], "tag_b", leaf2);

        let motors = root["Plant"].as_object().unwrap()["Motors"].as_object().unwrap();
        assert!(motors.contains_key("tag_a"));
        assert!(motors.contains_key("tag_b"));
    }

    #[test]
    fn test_insert_into_tree_sibling_folders() {
        let mut root = serde_json::Map::new();
        let leaf1 = serde_json::json!({"tagId": "temp"});
        let leaf2 = serde_json::json!({"tagId": "valve"});
        insert_into_tree(&mut root, &["Plant", "Sensors"], "temp", leaf1);
        insert_into_tree(&mut root, &["Plant", "Actuators"], "valve", leaf2);

        let plant = root.get("Plant").unwrap().as_object().unwrap();
        assert!(plant.contains_key("Sensors"));
        assert!(plant.contains_key("Actuators"));
        assert!(plant["Sensors"].as_object().unwrap().contains_key("temp"));
        assert!(plant["Actuators"].as_object().unwrap().contains_key("valve"));
    }

    #[test]
    fn test_build_json_export_leaf_all_fields() {
        let mapping = OpcUaMappingConfig::default_for_bool();
        let leaf = build_json_export_leaf(
            "motor_run",
            "OutputBit:0",
            "Motor Run",
            "semantic",
            "read",
            Some("Motor control"),
            Some("RPM"),
            Some("Plant.Motors"),
            &mapping,
        );

        let obj = leaf.as_object().unwrap();
        assert_eq!(obj["tagId"], "motor_run");
        assert_eq!(obj["deviceAddress"], "OutputBit:0");
        assert_eq!(obj["displayName"], "Motor Run");
        assert_eq!(obj["class"], "semantic");
        assert_eq!(obj["access"], "read");
        assert_eq!(obj["description"], "Motor control");
        assert_eq!(obj["engineeringUnit"], "RPM");
        assert_eq!(obj["folderPath"], "Plant.Motors");
        assert!(obj.contains_key("opcuaDataType"));
        assert!(obj.contains_key("opcuaWordCount"));
        assert!(obj.contains_key("opcuaByteOrder"));
        assert!(obj.contains_key("opcuaAccessLevel"));
    }

    #[test]
    fn test_build_json_export_leaf_optional_fields_omitted() {
        let mapping = OpcUaMappingConfig::default_for_word();
        let leaf = build_json_export_leaf(
            "temp",
            "DataWord:100",
            "Temperature",
            "semantic",
            "readwrite",
            None,
            None,
            None,
            &mapping,
        );

        let obj = leaf.as_object().unwrap();
        assert_eq!(obj["tagId"], "temp");
        assert!(!obj.contains_key("description"));
        assert!(!obj.contains_key("engineeringUnit"));
        assert!(!obj.contains_key("folderPath"));
    }

    // ========================================================================
    // NodeSet2 XML Export Tests
    // ========================================================================

    use crate::sim::types::TagClass;

    /// Helper to create a TagDefinition for tests.
    fn make_test_tag(
        tag_id: &str,
        area: CanonicalAreaKind,
        index: u32,
        bit_index: Option<u8>,
        folder_path: Option<&str>,
        description: Option<&str>,
    ) -> TagDefinition {
        let canonical_address = match bit_index {
            Some(b) => CanonicalAddress::with_bit_index(area, index, b),
            None => CanonicalAddress::new(area, index),
        };
        TagDefinition {
            tag_id: tag_id.to_string(),
            class: TagClass::Semantic,
            display_name: tag_id.to_string(),
            binding: crate::sim::types::RuntimeBinding::canonical(canonical_address),
            canonical_address,
            access: TagAccessLevel::ReadOnly,
            vendor_aliases: vec![],
            description: description.map(|s| s.to_string()),
            engineering_unit: None,
            folder_path: folder_path.map(|s| s.to_string()),
        }
    }

    #[test]
    fn test_nodeset2_empty_tags() {
        let tags: Vec<TagDefinition> = vec![];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Should be valid XML
        assert!(xml.contains("<?xml"));
        assert!(xml.contains("<UANodeSet"));
        assert!(xml.contains("</UANodeSet>"));
        assert!(xml.contains("<NamespaceUris>"));
        assert!(xml.contains("<Aliases>"));
        // Should still have the root Tags folder
        assert!(xml.contains("ns=1;s=Tags"));

        // Should pass validation
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_single_tag_at_root() {
        let tags = vec![make_test_tag(
            "motor_run",
            CanonicalAreaKind::OutputBit,
            0,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Should contain the variable node
        assert!(xml.contains("ns=1;s=motor_run"));
        assert!(xml.contains("1:motor_run"));
        // Boolean type for OutputBit
        assert!(xml.contains("i=1")); // Boolean data type id

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_word_tag_data_type() {
        let tags = vec![make_test_tag(
            "temp_sensor",
            CanonicalAreaKind::DataWord,
            100,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // UInt16 for DataWord → DataType="i=5"
        assert!(xml.contains("DataType=\"i=5\""));
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_tag_with_explicit_mapping() {
        use crate::opcua::{ByteOrder, MappingAccessLevel, OpcUaDataType};
        let tags = vec![make_test_tag(
            "pressure",
            CanonicalAreaKind::DataWord,
            200,
            None,
            None,
            None,
        )];
        let mut mappings = std::collections::HashMap::new();
        mappings.insert(
            "pressure".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: None,
                string_config: None,
            },
        );
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Float → DataType="i=10", AccessLevel="3" (read-write)
        assert!(xml.contains("DataType=\"i=10\""));
        assert!(xml.contains("AccessLevel=\"3\""));
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_folder_hierarchy() {
        let tags = vec![
            make_test_tag(
                "motor_run",
                CanonicalAreaKind::OutputBit,
                0,
                None,
                Some("Plant.Area1.Motors"),
                None,
            ),
            make_test_tag(
                "temp",
                CanonicalAreaKind::DataWord,
                100,
                None,
                Some("Plant.Area1.Sensors"),
                None,
            ),
        ];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Should contain folder objects for Plant, Area1, Motors, Sensors
        assert!(xml.contains("<DisplayName>Plant</DisplayName>"));
        assert!(xml.contains("<DisplayName>Area1</DisplayName>"));
        assert!(xml.contains("<DisplayName>Motors</DisplayName>"));
        assert!(xml.contains("<DisplayName>Sensors</DisplayName>"));

        // All folders should be UAObject with FolderType reference (i=61)
        // Count UAObject elements (root Tags + Plant + Area1 + Motors + Sensors = 5)
        let ua_object_count = xml.matches("<UAObject ").count();
        assert_eq!(ua_object_count, 5, "expected 5 UAObject elements (root + 4 folders)");

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_tag_with_description() {
        let tags = vec![make_test_tag(
            "boiler_temp",
            CanonicalAreaKind::DataWord,
            50,
            None,
            None,
            Some("Main boiler temperature reading"),
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        assert!(xml.contains("<Description>Main boiler temperature reading</Description>"));
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_multiple_tags_mixed() {
        let tags = vec![
            make_test_tag("root_tag", CanonicalAreaKind::InternalBit, 0, None, None, None),
            make_test_tag(
                "nested_tag",
                CanonicalAreaKind::DataWord,
                10,
                None,
                Some("Folder1"),
                Some("A nested tag"),
            ),
            make_test_tag(
                "deep_tag",
                CanonicalAreaKind::RetentiveWord,
                20,
                None,
                Some("Folder1.Sub1.Sub2"),
                None,
            ),
        ];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // All three variable nodes present
        assert!(xml.contains("ns=1;s=root_tag"));
        assert!(xml.contains("ns=1;s=nested_tag"));
        assert!(xml.contains("ns=1;s=deep_tag"));

        // Folder hierarchy
        assert!(xml.contains("<DisplayName>Folder1</DisplayName>"));
        assert!(xml.contains("<DisplayName>Sub1</DisplayName>"));
        assert!(xml.contains("<DisplayName>Sub2</DisplayName>"));

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_unique_node_ids() {
        // Two tags with different IDs should produce unique NodeIds
        let tags = vec![
            make_test_tag("tag_a", CanonicalAreaKind::DataWord, 0, None, Some("Shared"), None),
            make_test_tag("tag_b", CanonicalAreaKind::DataWord, 1, None, Some("Shared"), None),
        ];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        assert!(xml.contains("ns=1;s=tag_a"));
        assert!(xml.contains("ns=1;s=tag_b"));

        // Validation checks uniqueness
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_access_level_readonly() {
        let tags = vec![make_test_tag(
            "ro_tag",
            CanonicalAreaKind::InputBit,
            5,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Default mapping for InputBit is ReadOnly → AccessLevel="1"
        assert!(xml.contains("AccessLevel=\"1\""));
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_value_rank_scalar() {
        let tags = vec![make_test_tag(
            "scalar_tag",
            CanonicalAreaKind::DataWord,
            0,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // All tags should be scalar (ValueRank="-1")
        assert!(xml.contains("ValueRank=\"-1\""));
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_xml_well_formed() {
        let tags = vec![
            make_test_tag("tag1", CanonicalAreaKind::OutputBit, 0, None, Some("A.B"), None),
            make_test_tag("tag2", CanonicalAreaKind::DataWord, 100, None, Some("A.C"), None),
        ];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Verify well-formed XML by parsing with quick-xml
        use quick_xml::events::Event;
        use quick_xml::Reader;
        let mut reader = Reader::from_str(&xml);
        let mut count = 0;
        loop {
            match reader.read_event() {
                Ok(Event::Eof) => break,
                Err(e) => panic!("XML parse error: {}", e),
                _ => count += 1,
            }
        }
        assert!(count > 0, "XML should contain events");
    }

    #[test]
    fn test_nodeset2_namespace_uris() {
        let tags: Vec<TagDefinition> = vec![];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        assert!(xml.contains(APP_NAMESPACE));
        assert!(xml.contains("http://opcfoundation.org/UA/2011/03/UANodeSet.xsd"));
    }

    #[test]
    fn test_nodeset2_aliases_section() {
        let tags: Vec<TagDefinition> = vec![];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Should contain all standard type aliases
        assert!(xml.contains("Alias=\"Boolean\""));
        assert!(xml.contains("Alias=\"UInt16\""));
        assert!(xml.contains("Alias=\"Float\""));
        assert!(xml.contains("Alias=\"Double\""));
        assert!(xml.contains("Alias=\"String\""));
        assert!(xml.contains("Alias=\"HasTypeDefinition\""));
        assert!(xml.contains("Alias=\"Organizes\""));
        assert!(xml.contains("Alias=\"HasComponent\""));
        assert!(xml.contains("Alias=\"FolderType\""));
        assert!(xml.contains("Alias=\"BaseDataVariableType\""));
    }

    #[test]
    fn test_nodeset2_has_type_definition_references() {
        let tags = vec![make_test_tag(
            "my_tag",
            CanonicalAreaKind::DataWord,
            0,
            None,
            Some("MyFolder"),
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Variables should reference BaseDataVariableType (i=63)
        assert!(xml.contains("i=63"));
        // Folders should reference FolderType (i=61)
        assert!(xml.contains("i=61"));

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_bit_index_tag() {
        let tags = vec![make_test_tag(
            "word_bit",
            CanonicalAreaKind::DataWord,
            50,
            Some(3),
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // DataWord with bit_index is boolean → DataType="i=1"
        assert!(xml.contains("DataType=\"i=1\""));
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_all_data_types() {
        use crate::opcua::{ByteOrder, MappingAccessLevel, OpcUaDataType};
        let all_types = [
            (OpcUaDataType::Boolean, 1),
            (OpcUaDataType::SByte, 2),
            (OpcUaDataType::Byte, 3),
            (OpcUaDataType::Int16, 4),
            (OpcUaDataType::UInt16, 5),
            (OpcUaDataType::Int32, 6),
            (OpcUaDataType::UInt32, 7),
            (OpcUaDataType::Int64, 8),
            (OpcUaDataType::UInt64, 9),
            (OpcUaDataType::Float, 10),
            (OpcUaDataType::Double, 11),
            (OpcUaDataType::String, 12),
        ];

        for (dt, expected_id) in &all_types {
            assert_eq!(
                opcua_data_type_node_id(dt),
                *expected_id,
                "Mismatch for {:?}",
                dt
            );
        }
    }

    #[test]
    fn test_nodeset2_access_level_values() {
        use crate::opcua::MappingAccessLevel;
        assert_eq!(access_level_value(&MappingAccessLevel::ReadOnly), 1);
        assert_eq!(access_level_value(&MappingAccessLevel::ReadWrite), 3);
    }

    #[test]
    fn test_validate_nodeset2_rejects_invalid_xml() {
        let bad_xml = "<not-valid><<<";
        let result = validate_nodeset2_xml(bad_xml);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_nodeset2_rejects_missing_root() {
        let xml = r#"<?xml version="1.0" encoding="utf-8"?><SomethingElse/>"#;
        let result = validate_nodeset2_xml(xml);
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("UANodeSet")));
    }

    #[test]
    fn test_nodeset2_shared_folder_reuse() {
        // Two tags in same folder should share the folder node
        let tags = vec![
            make_test_tag("tag_x", CanonicalAreaKind::DataWord, 0, None, Some("Plant.Line1"), None),
            make_test_tag("tag_y", CanonicalAreaKind::DataWord, 1, None, Some("Plant.Line1"), None),
        ];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Should have root Tags + Plant + Line1 = 3 UAObject nodes, not 4
        let ua_object_count = xml.matches("<UAObject ").count();
        assert_eq!(ua_object_count, 3, "folder objects should be deduplicated");

        validate_nodeset2_xml(&xml).unwrap();
    }

    // ---- Variable node Value element tests ----

    #[test]
    fn test_nodeset2_variable_has_value_element() {
        let tags = vec![make_test_tag(
            "temp",
            CanonicalAreaKind::DataWord,
            100,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // UInt16 is the default for DataWord tags
        assert!(
            xml.contains("<Value>"),
            "UAVariable should contain a <Value> element"
        );
        assert!(
            xml.contains("<uax:UInt16>0</uax:UInt16>"),
            "DataWord tag should have a UInt16 default value of 0"
        );
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_boolean_variable_value() {
        let tags = vec![make_test_tag(
            "switch",
            CanonicalAreaKind::OutputBit,
            5,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        assert!(
            xml.contains("<uax:Boolean>false</uax:Boolean>"),
            "Bit-area tag should have a Boolean default value of false"
        );
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_explicit_mapping_value() {
        use crate::opcua::{ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig};

        let tags = vec![make_test_tag(
            "pressure",
            CanonicalAreaKind::DataWord,
            200,
            None,
            None,
            None,
        )];
        let mut mappings = std::collections::HashMap::new();
        mappings.insert(
            "pressure".to_string(),
            OpcUaMappingConfig {
                opcua_data_type: OpcUaDataType::Float,
                word_count: 2,
                byte_order: ByteOrder::BigEndian,
                access_level: MappingAccessLevel::ReadWrite,
                description: None,
                string_config: None,
            },
        );
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        assert!(
            xml.contains("<uax:Float>0</uax:Float>"),
            "Float-mapped tag should have a Float default value"
        );
        assert!(
            xml.contains("DataType=\"i=10\""),
            "Float-mapped tag should have DataType=i=10"
        );
        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_all_data_type_values() {
        use crate::opcua::{ByteOrder, MappingAccessLevel, OpcUaDataType, OpcUaMappingConfig};

        let data_types = vec![
            (OpcUaDataType::Boolean, "uax:Boolean", "false"),
            (OpcUaDataType::SByte, "uax:SByte", "0"),
            (OpcUaDataType::Byte, "uax:Byte", "0"),
            (OpcUaDataType::Int16, "uax:Int16", "0"),
            (OpcUaDataType::UInt16, "uax:UInt16", "0"),
            (OpcUaDataType::Int32, "uax:Int32", "0"),
            (OpcUaDataType::UInt32, "uax:UInt32", "0"),
            (OpcUaDataType::Int64, "uax:Int64", "0"),
            (OpcUaDataType::UInt64, "uax:UInt64", "0"),
            (OpcUaDataType::Float, "uax:Float", "0"),
            (OpcUaDataType::Double, "uax:Double", "0"),
            (OpcUaDataType::String, "uax:String", ""),
        ];

        for (dt, expected_elem, expected_val) in &data_types {
            let tags = vec![make_test_tag(
                "test_tag",
                CanonicalAreaKind::DataWord,
                0,
                None,
                None,
                None,
            )];
            let mut mappings = std::collections::HashMap::new();
            mappings.insert(
                "test_tag".to_string(),
                OpcUaMappingConfig {
                    opcua_data_type: *dt,
                    word_count: dt.default_word_count(),
                    byte_order: ByteOrder::BigEndian,
                    access_level: MappingAccessLevel::ReadOnly,
                    description: None,
                    string_config: None,
                },
            );
            let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

            let expected = format!("<{0}>{1}</{0}>", expected_elem, expected_val);
            assert!(
                xml.contains(&expected),
                "Data type {:?} should produce {}, got XML:\n{}",
                dt,
                expected,
                xml
            );
        }
    }

    // ---- HasComponent reference tests for variables ----

    #[test]
    fn test_nodeset2_variable_uses_has_component_reference() {
        let tags = vec![make_test_tag(
            "motor",
            CanonicalAreaKind::OutputBit,
            0,
            None,
            Some("Actuators"),
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Variables should use HasComponent, not Organizes
        assert!(
            xml.contains("ReferenceType=\"HasComponent\""),
            "UAVariable references should use HasComponent"
        );

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_folder_uses_organizes_reference() {
        let tags = vec![make_test_tag(
            "sensor",
            CanonicalAreaKind::DataWord,
            0,
            None,
            Some("Sensors"),
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Folders should use Organizes
        assert!(
            xml.contains("ReferenceType=\"Organizes\""),
            "UAObject folder references should use Organizes"
        );

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_variable_parent_child_in_folder() {
        let tags = vec![make_test_tag(
            "valve_pos",
            CanonicalAreaKind::DataWord,
            50,
            None,
            Some("Plant.Valves"),
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Variable should have HasComponent inverse reference pointing to its parent folder
        assert!(
            xml.contains("ReferenceType=\"HasComponent\" IsForward=\"false\""),
            "Variable should have an inverse HasComponent reference to its parent"
        );

        // Folder hierarchy: Root "Tags" → "Plant" → "Valves"
        // All folders should have HasTypeDefinition → FolderType
        assert!(
            xml.contains("HasTypeDefinition"),
            "All nodes should have HasTypeDefinition"
        );

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_root_variable_parent_is_tags_folder() {
        let tags = vec![make_test_tag(
            "root_var",
            CanonicalAreaKind::InternalBit,
            0,
            None,
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        // Variable at root should reference "ns=1;s=Tags" as parent
        assert!(
            xml.contains("ns=1;s=Tags"),
            "Root variable should reference Tags folder as parent"
        );

        validate_nodeset2_xml(&xml).unwrap();
    }

    #[test]
    fn test_nodeset2_variable_bit_index_boolean_value() {
        // A DataWord with bit_index should default to Boolean
        let tags = vec![make_test_tag(
            "bit_flag",
            CanonicalAreaKind::DataWord,
            10,
            Some(3),
            None,
            None,
        )];
        let mappings = std::collections::HashMap::new();
        let xml = build_nodeset2_xml(&tags, &mappings).unwrap();

        assert!(
            xml.contains("DataType=\"i=1\""),
            "DataWord with bit_index should map to Boolean DataType"
        );
        assert!(
            xml.contains("<uax:Boolean>false</uax:Boolean>"),
            "DataWord with bit_index should have Boolean value"
        );
        validate_nodeset2_xml(&xml).unwrap();
    }

    // ========================================================================
    // AC2: CSV Import Default Application Tests
    // ========================================================================

    /// Helper: create a TagRegistry + MappingStoreState for import tests.
    fn make_import_env() -> (
        crate::sim::tag_registry::TagRegistry,
        MappingStoreState,
    ) {
        let registry = crate::sim::tag_registry::TagRegistry::new();
        let mapping_store = MappingStoreState::default();
        (registry, mapping_store)
    }

    #[test]
    fn test_csv_import_display_name_defaults_to_tag_id() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "my_sensor".to_string(),
            device_address: "DataWord:100".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        let status = import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        assert_eq!(status, TagImportStatus::Created);
        let tag = registry.resolve("my_sensor").unwrap();
        assert_eq!(tag.display_name, "my_sensor", "displayName should default to tagId");
    }

    #[test]
    fn test_csv_import_display_name_used_when_provided() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "my_sensor".to_string(),
            device_address: "DataWord:100".to_string(),
            display_name: Some("Temperature Sensor".to_string()),
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("my_sensor").unwrap();
        assert_eq!(tag.display_name, "Temperature Sensor");
    }

    #[test]
    fn test_csv_import_display_name_empty_string_defaults_to_tag_id() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "motor_run".to_string(),
            device_address: "OutputBit:5".to_string(),
            display_name: Some("".to_string()),
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("motor_run").unwrap();
        assert_eq!(tag.display_name, "motor_run", "empty displayName should default to tagId");
    }

    #[test]
    fn test_csv_import_folder_path_defaults_to_none() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "my_tag".to_string(),
            device_address: "DataWord:200".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("my_tag").unwrap();
        assert_eq!(tag.folder_path, None, "folderPath should default to None when not provided");
    }

    #[test]
    fn test_csv_import_folder_path_empty_string_defaults_to_none() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "my_tag".to_string(),
            device_address: "DataWord:200".to_string(),
            display_name: None,
            access: None,
            folder_path: Some("".to_string()),
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("my_tag").unwrap();
        assert_eq!(tag.folder_path, None, "empty folderPath should default to None");
    }

    #[test]
    fn test_csv_import_folder_path_preserved_when_provided() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "my_tag".to_string(),
            device_address: "DataWord:200".to_string(),
            display_name: None,
            access: None,
            folder_path: Some("Plant.Area1.Motors".to_string()),
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("my_tag").unwrap();
        assert_eq!(tag.folder_path.as_deref(), Some("Plant.Area1.Motors"));
    }

    #[test]
    fn test_csv_import_opcua_mapping_bool_for_bit_address() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "input_switch".to_string(),
            device_address: "InputBit:42".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let mapping = mapping_store.store.get("input_switch")
            .expect("OPC UA mapping should be auto-generated for imported tag");
        assert_eq!(
            mapping.opcua_data_type,
            crate::opcua::OpcUaDataType::Boolean,
            "InputBit address should get Boolean OPC UA data type via is_bool detection"
        );
    }

    #[test]
    fn test_csv_import_opcua_mapping_uint16_for_word_address() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "temp_reading".to_string(),
            device_address: "DataWord:100".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let mapping = mapping_store.store.get("temp_reading")
            .expect("OPC UA mapping should be auto-generated for imported tag");
        assert_eq!(
            mapping.opcua_data_type,
            crate::opcua::OpcUaDataType::UInt16,
            "DataWord address should get UInt16 OPC UA data type via is_bool detection"
        );
    }

    #[test]
    fn test_csv_import_opcua_mapping_bool_for_output_bit() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "motor_out".to_string(),
            device_address: "OutputBit:0".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let mapping = mapping_store.store.get("motor_out").unwrap();
        assert_eq!(
            mapping.opcua_data_type,
            crate::opcua::OpcUaDataType::Boolean,
            "OutputBit address should get Boolean OPC UA data type"
        );
    }

    #[test]
    fn test_csv_import_opcua_mapping_bool_for_internal_bit() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "flag_m100".to_string(),
            device_address: "InternalBit:100".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let mapping = mapping_store.store.get("flag_m100").unwrap();
        assert_eq!(
            mapping.opcua_data_type,
            crate::opcua::OpcUaDataType::Boolean,
            "InternalBit address should get Boolean OPC UA data type"
        );
    }

    #[test]
    fn test_csv_import_all_defaults_minimal_csv() {
        let csv = "tagId,deviceAddress\nsensor_1,DataWord:50";
        let rows = parse_csv_content(csv).unwrap();
        assert_eq!(rows.len(), 1);
        let (registry, mapping_store) = make_import_env();
        import_single_csv_row(&registry, &mapping_store, rows.into_iter().next().unwrap(), ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("sensor_1").unwrap();
        assert_eq!(tag.display_name, "sensor_1", "displayName defaults to tagId");
        assert_eq!(tag.folder_path, None, "folderPath defaults to None");
        assert_eq!(tag.description, None, "description defaults to None");
        assert_eq!(tag.engineering_unit, None, "engineeringUnit defaults to None");
        let mapping = mapping_store.store.get("sensor_1").unwrap();
        assert_eq!(mapping.opcua_data_type, crate::opcua::OpcUaDataType::UInt16,
            "DataWord tag should auto-generate UInt16 mapping");
        assert_eq!(mapping.word_count, 1);
    }

    #[test]
    fn test_csv_import_defaults_for_bit_tag_end_to_end() {
        let csv = "tagId,deviceAddress\nvalve_open,OutputBit:3";
        let rows = parse_csv_content(csv).unwrap();
        let (registry, mapping_store) = make_import_env();
        import_single_csv_row(&registry, &mapping_store, rows.into_iter().next().unwrap(), ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("valve_open").unwrap();
        assert_eq!(tag.display_name, "valve_open");
        assert_eq!(tag.folder_path, None);
        let mapping = mapping_store.store.get("valve_open").unwrap();
        assert_eq!(mapping.opcua_data_type, crate::opcua::OpcUaDataType::Boolean,
            "OutputBit tag should auto-generate Boolean mapping");
    }

    #[test]
    fn test_csv_import_description_and_unit_default_to_none() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "bare_tag".to_string(),
            device_address: "DataWord:0".to_string(),
            display_name: None,
            access: None,
            folder_path: None,
            description: None,
            engineering_unit: None,
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("bare_tag").unwrap();
        assert_eq!(tag.description, None);
        assert_eq!(tag.engineering_unit, None);
    }

    #[test]
    fn test_csv_import_description_and_unit_preserved_when_provided() {
        let (registry, mapping_store) = make_import_env();
        let row = CsvTagRow {
            tag_id: "temp_tag".to_string(),
            device_address: "DataWord:10".to_string(),
            display_name: Some("Temperature".to_string()),
            access: None,
            folder_path: None,
            description: Some("Main boiler temperature".to_string()),
            engineering_unit: Some("°C".to_string()),
        };
        import_single_csv_row(&registry, &mapping_store, row, ConflictResolution::Skip).unwrap();
        let tag = registry.resolve("temp_tag").unwrap();
        assert_eq!(tag.description.as_deref(), Some("Main boiler temperature"));
        assert_eq!(tag.engineering_unit.as_deref(), Some("°C"));
    }
}
