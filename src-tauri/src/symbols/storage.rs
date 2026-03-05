use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::types::{LibraryScope, SymbolDefinition, SymbolSummary};
use crate::error::{ModOneError, ModOneResult};

fn get_global_symbols_dir() -> ModOneResult<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| ModOneError::Internal("HOME environment variable not set".to_string()))?;
        Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("ModOne")
            .join("symbols"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| ModOneError::Internal("HOME environment variable not set".to_string()))?;
        Ok(PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ModOne")
            .join("symbols"))
    }

    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| {
            ModOneError::Internal("APPDATA environment variable not set".to_string())
        })?;
        Ok(PathBuf::from(appdata).join("ModOne").join("symbols"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let home = std::env::var("HOME")
            .map_err(|_| ModOneError::Internal("HOME environment variable not set".to_string()))?;
        Ok(PathBuf::from(home).join(".modone").join("symbols"))
    }
}

fn get_symbols_dir(project_dir: &Path, scope: &LibraryScope) -> ModOneResult<PathBuf> {
    let dir = match scope {
        LibraryScope::Project => project_dir.join("symbols"),
        LibraryScope::Global => get_global_symbols_dir()?,
    };
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn symbol_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{}.json", id))
}

pub fn save_symbol(
    project_dir: &Path,
    symbol: &SymbolDefinition,
    scope: &LibraryScope,
) -> ModOneResult<()> {
    let dir = get_symbols_dir(project_dir, scope)?;
    let path = symbol_path(&dir, &symbol.id);
    let json = serde_json::to_string_pretty(symbol)
        .map_err(|e| ModOneError::ConfigError(format!("Failed to serialize symbol: {}", e)))?;
    fs::write(&path, json)?;
    Ok(())
}

pub fn load_symbol(
    project_dir: &Path,
    id: &str,
    scope: &LibraryScope,
) -> ModOneResult<SymbolDefinition> {
    let dir = get_symbols_dir(project_dir, scope)?;
    let path = symbol_path(&dir, id);
    let contents = fs::read_to_string(&path)?;
    let symbol: SymbolDefinition = serde_json::from_str(&contents)
        .map_err(|e| ModOneError::ConfigError(format!("Failed to parse symbol '{}': {}", id, e)))?;
    Ok(symbol)
}

pub fn delete_symbol(project_dir: &Path, id: &str, scope: &LibraryScope) -> ModOneResult<()> {
    let dir = get_symbols_dir(project_dir, scope)?;
    let path = symbol_path(&dir, id);
    if !path.exists() {
        return Err(ModOneError::ProjectNotFound(format!(
            "Symbol '{}' not found",
            id
        )));
    }
    fs::remove_file(&path)?;
    Ok(())
}

pub fn list_symbols(project_dir: &Path, scope: &LibraryScope) -> ModOneResult<Vec<SymbolSummary>> {
    let dir = get_symbols_dir(project_dir, scope)?;
    let scope_clone = match scope {
        LibraryScope::Project => LibraryScope::Project,
        LibraryScope::Global => LibraryScope::Global,
    };
    collect_summaries_from_dir(&dir, scope_clone)
}

pub fn list_all_symbols(project_dir: &Path) -> ModOneResult<Vec<SymbolSummary>> {
    let mut by_id: HashMap<String, SymbolSummary> = HashMap::new();

    let global_dir = get_global_symbols_dir()?;
    if global_dir.exists() {
        let global_summaries = collect_summaries_from_dir(&global_dir, LibraryScope::Global)?;
        for s in global_summaries {
            by_id.insert(s.id.clone(), s);
        }
    }

    let project_dir_symbols = project_dir.join("symbols");
    if project_dir_symbols.exists() {
        let project_summaries =
            collect_summaries_from_dir(&project_dir_symbols, LibraryScope::Project)?;
        for s in project_summaries {
            by_id.insert(s.id.clone(), s);
        }
    }

    let mut results: Vec<SymbolSummary> = by_id.into_values().collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

fn collect_summaries_from_dir(dir: &Path, scope: LibraryScope) -> ModOneResult<Vec<SymbolSummary>> {
    let mut summaries = Vec::new();

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(summaries),
        Err(e) => return Err(ModOneError::IoError(e.to_string())),
    };

    for entry in entries {
        let entry = entry.map_err(|e| ModOneError::IoError(e.to_string()))?;
        let path = entry.path();

        let is_json = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e == "json")
            .unwrap_or(false);

        if !is_json || !path.is_file() {
            continue;
        }

        let contents = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let symbol: SymbolDefinition = match serde_json::from_str(&contents) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let scope_value = match scope {
            LibraryScope::Project => LibraryScope::Project,
            LibraryScope::Global => LibraryScope::Global,
        };

        summaries.push(SymbolSummary {
            id: symbol.id,
            name: symbol.name,
            version: symbol.version,
            category: symbol.category,
            description: symbol.description,
            scope: scope_value,
            updated_at: symbol.updated_at,
        });
    }

    summaries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(summaries)
}
