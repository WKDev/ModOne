use std::path::Path;

use crate::symbols::storage;
use crate::symbols::types::{LibraryScope, SymbolDefinition, SymbolSummary};

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
