use std::path::Path;

use crate::symbols::project_block_loader::{ProjectBlockLoader, XmlSymbolLoadResult, XmlSymbolSummary};
use crate::symbols::storage;
use crate::symbols::types::{LibraryScope, SymbolDefinition, SymbolSummary};

// ============================================================================
// JSON-backed symbol commands (existing)
// ============================================================================

#[tauri::command]
pub async fn symbol_save(
    project_dir: String,
    symbol: SymbolDefinition,
    scope: LibraryScope,
) -> Result<(), String> {
    storage::save_symbol(Path::new(&project_dir), &symbol, &scope).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn symbol_load(
    project_dir: String,
    id: String,
    scope: LibraryScope,
) -> Result<SymbolDefinition, String> {
    storage::load_symbol(Path::new(&project_dir), &id, &scope).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn symbol_delete(
    project_dir: String,
    id: String,
    scope: LibraryScope,
) -> Result<(), String> {
    storage::delete_symbol(Path::new(&project_dir), &id, &scope).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn symbol_list(
    project_dir: String,
    scope: LibraryScope,
) -> Result<Vec<SymbolSummary>, String> {
    storage::list_symbols(Path::new(&project_dir), &scope).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn symbol_list_all(project_dir: String) -> Result<Vec<SymbolSummary>, String> {
    storage::list_all_symbols(Path::new(&project_dir)).map_err(|e| e.to_string())
}

// ============================================================================
// XML-backed project block commands (ProjectBlockLoader)
// ============================================================================

/// List all `.symbol.xml` files in `{project_dir}/.modone/symbols/`.
///
/// Returns lightweight [`XmlSymbolSummary`] objects; the full definitions are
/// not loaded.  Files that cannot be parsed are silently skipped.
#[tauri::command]
pub async fn project_block_list(
    project_dir: String,
) -> Result<Vec<XmlSymbolSummary>, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader.list_symbols().map_err(|e| e.to_string())
}

/// Load a single XML symbol by its `id` attribute.
///
/// Tries the canonical filename (`{sanitized_id}.symbol.xml`) first, then
/// scans all files in the directory for a matching `id`.
#[tauri::command]
pub async fn project_block_load(
    project_dir: String,
    id: String,
) -> Result<SymbolDefinition, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader.load_by_id(&id).map_err(|e| e.to_string())
}

/// Load every `.symbol.xml` file in the project's XML symbols directory.
///
/// Returns full [`SymbolDefinition`] objects for all valid files.
/// Invalid files are skipped with a log warning.
#[tauri::command]
pub async fn project_block_load_all(
    project_dir: String,
) -> Result<Vec<SymbolDefinition>, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader.load_all_definitions().map_err(|e| e.to_string())
}

/// Load every `.symbol.xml` file and return both definitions and warnings.
///
/// This is the detailed variant of [`project_block_load_all`].  Each result
/// contains the symbol definition plus any non-fatal warnings (e.g. no ports).
#[tauri::command]
pub async fn project_block_load_all_with_warnings(
    project_dir: String,
) -> Result<Vec<XmlSymbolLoadResult>, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader.load_all().map_err(|e| e.to_string())
}

/// Delete the `.symbol.xml` file for a symbol with the given `id`.
#[tauri::command]
pub async fn project_block_delete(
    project_dir: String,
    id: String,
) -> Result<(), String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader.delete(&id).map_err(|e| e.to_string())
}

/// Ensure the `.modone/symbols/` directory exists, creating it if necessary.
///
/// Returns the absolute path to the directory as a string.
#[tauri::command]
pub async fn project_block_ensure_dir(project_dir: String) -> Result<String, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader
        .ensure_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// Validate and import an XML symbol string into the project's `.modone/symbols/`.
///
/// The XML must contain a valid `<ms:SymbolDefinition>` root element.  On
/// success the parsed [`SymbolDefinition`] is returned so the caller can
/// immediately add it to the canvas without a second round-trip.
#[tauri::command]
pub async fn project_block_import_xml(
    project_dir: String,
    xml_content: String,
) -> Result<SymbolDefinition, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    loader.import_xml(&xml_content).map_err(|e| e.to_string())
}

/// Return the path to the `.modone/symbols/` directory for the given project.
///
/// The directory is *not* created; use [`project_block_ensure_dir`] to create it.
#[tauri::command]
pub async fn project_block_symbols_dir(project_dir: String) -> Result<String, String> {
    let loader = ProjectBlockLoader::new(Path::new(&project_dir));
    Ok(loader.symbols_dir().to_string_lossy().into_owned())
}
