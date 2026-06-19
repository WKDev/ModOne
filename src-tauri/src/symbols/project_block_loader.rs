//! Project Block Loader — reads user-defined XML symbol blocks from the
//! `.modone/symbols/` directory inside a project folder.
//!
//! # Directory layout
//! ```text
//! {project_dir}/
//! └── .modone/
//!     └── symbols/
//!         ├── custom_sensor.symbol.xml
//!         ├── my_relay.symbol.xml
//!         └── ...
//! ```
//!
//! Each `*.symbol.xml` file must contain a valid `<ms:SymbolDefinition>` root
//! element.  Files that fail to parse are skipped and reported as warnings so
//! they don't prevent other symbols from loading.
//!
//! # Relationship to JSON-based storage
//! The existing [`super::storage`] module stores symbols as JSON (created by
//! the GUI Symbol Editor).  The `ProjectBlockLoader` is complementary:
//! it handles *hand-authored* or *imported* XML files that live under
//! `.modone/symbols/` rather than the `symbols/` sub-folder used by JSON
//! storage.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::types::{SymbolDefinition, SymbolSummary, LibraryScope};
use super::xml_parser::parse_symbol_xml;
use crate::error::{ModOneError, ModOneResult};

// ============================================================================
// Constants
// ============================================================================

/// Path relative to the project root where custom XML blocks are stored.
pub const XML_SYMBOLS_SUBDIR: &str = ".modone/symbols";

/// File extension for XML symbol files.
const SYMBOL_XML_EXT: &str = "symbol.xml";

// ============================================================================
// Public result types
// ============================================================================

/// Lightweight summary of an XML symbol file (no full definition).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XmlSymbolSummary {
    /// Symbol ID (from the `id` attribute of `<ms:SymbolDefinition>`).
    pub id: String,
    /// Display name.
    pub name: String,
    /// Semantic version.
    pub version: String,
    /// Category (e.g., "sensor", "relay").
    pub category: String,
    /// Optional description.
    pub description: Option<String>,
    /// Absolute path to the `.symbol.xml` file.
    pub file_path: String,
    /// Domain from the `domain` attribute (e.g., "circuit", "plc").
    pub domain: Option<String>,
    /// Canonical block type from the `canonicalType` attribute.
    pub canonical_type: Option<String>,
}

/// A fully loaded XML symbol with its definition and any parse warnings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XmlSymbolLoadResult {
    /// Lightweight summary metadata.
    pub summary: XmlSymbolSummary,
    /// Full parsed symbol definition.
    pub definition: SymbolDefinition,
    /// Non-fatal warnings encountered during parsing.
    pub warnings: Vec<String>,
}

// ============================================================================
// ProjectBlockLoader
// ============================================================================

/// Loads and manages user-defined XML symbol blocks for a project.
///
/// # Thread safety
/// This struct is `Clone` and contains only a path, so it is cheap to pass
/// around.  All operations do synchronous file I/O; for async use, call from
/// a blocking Tokio task.
#[derive(Debug, Clone)]
pub struct ProjectBlockLoader {
    project_dir: PathBuf,
}

impl ProjectBlockLoader {
    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    /// Create a new loader for the given project directory.
    pub fn new(project_dir: &Path) -> Self {
        Self {
            project_dir: project_dir.to_path_buf(),
        }
    }

    // ------------------------------------------------------------------
    // Path helpers
    // ------------------------------------------------------------------

    /// Return the absolute path to the XML symbols directory (`.modone/symbols/`).
    ///
    /// The directory may not yet exist; call [`ensure_dir`] to create it.
    pub fn symbols_dir(&self) -> PathBuf {
        self.project_dir.join(XML_SYMBOLS_SUBDIR)
    }

    /// Ensure the XML symbols directory exists, creating it if necessary.
    ///
    /// Returns the absolute path to the directory.
    pub fn ensure_dir(&self) -> ModOneResult<PathBuf> {
        let dir = self.symbols_dir();
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    /// Build a canonical file path for a symbol with the given ID.
    ///
    /// Colons in the ID are replaced with underscores so the name is valid
    /// on all platforms (e.g., `"custom:relay"` → `custom_relay.symbol.xml`).
    pub fn symbol_file_path(&self, id: &str) -> PathBuf {
        let sanitized = sanitize_id_for_filename(id);
        self.symbols_dir()
            .join(format!("{}.{}", sanitized, SYMBOL_XML_EXT))
    }

    // ------------------------------------------------------------------
    // Listing
    // ------------------------------------------------------------------

    /// Scan the XML symbols directory and return lightweight summaries.
    ///
    /// Files that cannot be opened or parsed are silently skipped.
    /// Returns an empty list if the directory does not exist.
    pub fn list_symbols(&self) -> ModOneResult<Vec<XmlSymbolSummary>> {
        let dir = self.symbols_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut summaries = Vec::new();
        let entries = fs::read_dir(&dir).map_err(|e| ModOneError::IoError(e.to_string()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !is_symbol_xml_file(&path) {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Some(summary) = extract_symbol_summary(&content, &path) {
                    summaries.push(summary);
                }
            }
        }

        summaries.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(summaries)
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    /// Load all XML symbols from the directory.
    ///
    /// Each file that fails to parse is included in the `warnings` of the
    /// returned [`XmlSymbolLoadResult`]s, keeping the overall list intact.
    pub fn load_all(&self) -> ModOneResult<Vec<XmlSymbolLoadResult>> {
        let dir = self.symbols_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut results = Vec::new();
        let entries = fs::read_dir(&dir).map_err(|e| ModOneError::IoError(e.to_string()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !is_symbol_xml_file(&path) {
                continue;
            }
            match self.load_file(&path) {
                Ok(result) => results.push(result),
                Err(e) => {
                    log::warn!(
                        "ProjectBlockLoader: skipping {:?} — {}",
                        path.file_name().unwrap_or_default(),
                        e
                    );
                }
            }
        }

        results.sort_by(|a, b| a.summary.name.cmp(&b.summary.name));
        Ok(results)
    }

    /// Load all XML symbols and return only their `SymbolDefinition`s (no summaries).
    pub fn load_all_definitions(&self) -> ModOneResult<Vec<SymbolDefinition>> {
        Ok(self
            .load_all()?
            .into_iter()
            .map(|r| r.definition)
            .collect())
    }

    /// Load a single XML symbol by its ID.
    ///
    /// Tries the canonical file name first, then falls back to scanning all
    /// files for a matching `id` attribute (handles renamed files).
    pub fn load_by_id(&self, id: &str) -> ModOneResult<SymbolDefinition> {
        // Fast path: try canonical filename
        let canonical_path = self.symbol_file_path(id);
        if canonical_path.exists() {
            return Ok(self.load_file(&canonical_path)?.definition);
        }

        // Slow path: scan directory
        let dir = self.symbols_dir();
        if !dir.exists() {
            return Err(ModOneError::ProjectNotFound(format!(
                "XML symbol '{}' not found (directory does not exist)",
                id
            )));
        }

        let entries = fs::read_dir(&dir).map_err(|e| ModOneError::IoError(e.to_string()))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if !is_symbol_xml_file(&path) {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Some(summary) = extract_symbol_summary(&content, &path) {
                    if summary.id == id {
                        return parse_symbol_xml(&content).map_err(|e| {
                            ModOneError::Parse(format!("Failed to parse '{}': {}", id, e))
                        });
                    }
                }
            }
        }

        Err(ModOneError::ProjectNotFound(format!(
            "XML symbol '{}' not found in {}",
            id,
            self.symbols_dir().display()
        )))
    }

    /// Load a single XML symbol file from an absolute path.
    pub fn load_file(&self, path: &Path) -> ModOneResult<XmlSymbolLoadResult> {
        let content = fs::read_to_string(path)
            .map_err(|e| ModOneError::IoError(format!("Cannot read {:?}: {}", path, e)))?;

        let mut warnings: Vec<String> = Vec::new();

        let definition = parse_symbol_xml(&content).map_err(|e| {
            ModOneError::Parse(format!(
                "Failed to parse {}: {}",
                path.display(),
                e
            ))
        })?;

        // Build summary from the parsed definition (authoritative source)
        let summary = XmlSymbolSummary {
            id: definition.id.clone(),
            name: definition.name.clone(),
            version: definition.version.clone(),
            category: definition.category.clone(),
            description: definition.description.clone(),
            file_path: path.to_string_lossy().into_owned(),
            domain: None,       // populated from XML attrs when available
            canonical_type: None, // populated from XML attrs when available
        };

        // Validate: at least one port recommended
        if definition.pins.is_empty() {
            warnings.push(format!(
                "Symbol '{}' has no ports defined",
                definition.id
            ));
        }

        Ok(XmlSymbolLoadResult {
            summary,
            definition,
            warnings,
        })
    }

    // ------------------------------------------------------------------
    // Importing / saving
    // ------------------------------------------------------------------

    /// Parse, validate, and save an XML symbol string into the project's
    /// `.modone/symbols/` directory.
    ///
    /// Returns the parsed `SymbolDefinition` on success.
    ///
    /// # Errors
    /// - Returns a parse error if the XML is invalid.
    /// - Returns an IO error if the directory cannot be created or the file
    ///   cannot be written.
    pub fn import_xml(&self, xml_content: &str) -> ModOneResult<SymbolDefinition> {
        // Parse first to validate
        let definition = parse_symbol_xml(xml_content).map_err(|e| {
            ModOneError::Parse(format!("Invalid symbol XML: {}", e))
        })?;

        // Ensure directory exists
        self.ensure_dir()?;

        // Write the XML file
        let target_path = self.symbol_file_path(&definition.id);
        fs::write(&target_path, xml_content)
            .map_err(|e| ModOneError::IoError(format!("Cannot write symbol file: {}", e)))?;

        log::info!(
            "ProjectBlockLoader: imported XML symbol '{}' → {}",
            definition.id,
            target_path.display()
        );

        Ok(definition)
    }

    // ------------------------------------------------------------------
    // Deletion
    // ------------------------------------------------------------------

    /// Delete the XML file for a symbol with the given ID.
    ///
    /// Tries the canonical filename first, then scans for a matching `id`
    /// attribute (handles renamed files).
    pub fn delete(&self, id: &str) -> ModOneResult<()> {
        // Fast path: try canonical filename
        let canonical_path = self.symbol_file_path(id);
        if canonical_path.exists() {
            fs::remove_file(&canonical_path)
                .map_err(|e| ModOneError::IoError(format!("Cannot delete: {}", e)))?;
            log::info!(
                "ProjectBlockLoader: deleted '{}'",
                canonical_path.display()
            );
            return Ok(());
        }

        // Slow path: scan for matching ID
        let dir = self.symbols_dir();
        if !dir.exists() {
            return Err(ModOneError::ProjectNotFound(format!(
                "XML symbol '{}' not found",
                id
            )));
        }

        let entries = fs::read_dir(&dir).map_err(|e| ModOneError::IoError(e.to_string()))?;
        for entry in entries.flatten() {
            let path = entry.path();
            if !is_symbol_xml_file(&path) {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Some(summary) = extract_symbol_summary(&content, &path) {
                    if summary.id == id {
                        fs::remove_file(&path).map_err(|e| {
                            ModOneError::IoError(format!("Cannot delete: {}", e))
                        })?;
                        log::info!("ProjectBlockLoader: deleted '{}'", path.display());
                        return Ok(());
                    }
                }
            }
        }

        Err(ModOneError::ProjectNotFound(format!(
            "XML symbol '{}' not found",
            id
        )))
    }

    // ------------------------------------------------------------------
    // Integration with JSON symbol storage
    // ------------------------------------------------------------------

    /// Convert all loaded XML symbols to [`SymbolSummary`] entries with
    /// `scope = Project`, compatible with the JSON-based symbol listing API.
    pub fn as_symbol_summaries(&self) -> ModOneResult<Vec<SymbolSummary>> {
        Ok(self
            .list_symbols()?
            .into_iter()
            .map(|s| SymbolSummary {
                id: s.id,
                name: s.name,
                version: s.version,
                category: s.category,
                description: s.description,
                scope: LibraryScope::Project,
                updated_at: chrono::Utc::now().to_rfc3339(),
            })
            .collect())
    }
}

// ============================================================================
// File helpers
// ============================================================================

/// Return `true` if the path looks like a `*.symbol.xml` file.
fn is_symbol_xml_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    name.ends_with(&format!(".{}", SYMBOL_XML_EXT))
}

/// Replace characters that are unsafe in file names with underscores.
pub fn sanitize_id_for_filename(id: &str) -> String {
    id.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' => c,
            _ => '_',
        })
        .collect()
}

/// Quick-parse just the header of an XML symbol to build a [`XmlSymbolSummary`]
/// without deserialising the entire file.  Returns `None` if parsing fails.
///
/// This is more efficient than calling the full parser for listing operations.
fn extract_symbol_summary(xml_content: &str, path: &Path) -> Option<XmlSymbolSummary> {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml_content);
    reader.config_mut().trim_text(true);

    // We only need to read the first few elements
    let mut id: Option<String> = None;
    let mut name: Option<String> = None;
    let mut version: Option<String> = None;
    let mut domain: Option<String> = None;
    let mut canonical_type: Option<String> = None;
    let mut description: Option<String> = None;
    let mut category: Option<String> = None;
    let mut in_description = false;
    let mut in_category = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let local = {
                    let name = e.name();
                    let raw = name.as_ref();
                    let s = std::str::from_utf8(raw).unwrap_or("");
                    if let Some(pos) = s.rfind(':') {
                        s[pos + 1..].to_string()
                    } else {
                        s.to_string()
                    }
                };

                match local.as_str() {
                    "SymbolDefinition" => {
                        for attr in e.attributes().flatten() {
                            let k = {
                                let raw = attr.key.local_name();
                                std::str::from_utf8(raw.as_ref())
                                    .unwrap_or("")
                                    .to_string()
                            };
                            let v = attr
                                .unescape_value()
                                .map(|v| v.into_owned())
                                .unwrap_or_default();
                            match k.as_str() {
                                "id" => id = Some(v),
                                "name" => name = Some(v),
                                "version" => version = Some(v),
                                "domain" => domain = Some(v),
                                "canonicalType" => canonical_type = Some(v),
                                _ => {}
                            }
                        }
                    }
                    "Description" => {
                        in_description = true;
                    }
                    "Category" => {
                        in_category = true;
                    }
                    // Once we've seen Layout we have enough info
                    "Layout" | "Ports" | "Graphics" | "Units" | "Properties" => {
                        break;
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) => {
                // Use raw bytes for the quick summary extraction.
                // Symbol names/categories are plain ASCII so entity unescaping
                // is not needed here.
                let text = std::str::from_utf8(e.as_ref())
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if in_description {
                    description = Some(text);
                    in_description = false;
                } else if in_category {
                    category = Some(text);
                    in_category = false;
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            _ => {}
        }
    }

    let id = id?;
    Some(XmlSymbolSummary {
        id: id.clone(),
        name: name.unwrap_or_else(|| id.clone()),
        version: version.unwrap_or_else(|| "1.0.0".to_string()),
        category: category.unwrap_or_else(|| "custom".to_string()),
        description,
        file_path: path.to_string_lossy().into_owned(),
        domain,
        canonical_type,
    })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_xml(id: &str) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  id="{id}"
  name="Test {id}"
  version="1.0.0"
  domain="circuit"
  canonicalType="sensor">
  <ms:Description>A test symbol</ms:Description>
  <ms:Category>sensor</ms:Category>
  <ms:Layout width="60" height="60" unit="px"/>
  <ms:Ports>
    <ms:Port id="in" name="IN" number="1" electricalType="input"
             shape="line" orientation="left" x="0" y="30" length="0"/>
  </ms:Ports>
  <ms:Graphics>
    <ms:Rect x="10" y="10" width="40" height="40"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
  </ms:Graphics>
</ms:SymbolDefinition>
"#,
            id = id
        )
    }

    #[test]
    fn test_list_empty_directory() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());
        let list = loader.list_symbols().unwrap();
        assert!(list.is_empty());
    }

    #[test]
    fn test_ensure_dir_creates_directory() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());
        let dir = loader.ensure_dir().unwrap();
        assert!(dir.exists());
        assert!(dir.is_dir());
    }

    #[test]
    fn test_import_and_list() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());

        loader.import_xml(&sample_xml("custom:sensor-a")).unwrap();
        loader.import_xml(&sample_xml("custom:sensor-b")).unwrap();

        let list = loader.list_symbols().unwrap();
        assert_eq!(list.len(), 2);
        // Should be sorted by name
        assert!(list[0].name <= list[1].name);
    }

    #[test]
    fn test_load_by_id() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());

        loader.import_xml(&sample_xml("custom:my-relay")).unwrap();

        let sym = loader.load_by_id("custom:my-relay").unwrap();
        assert_eq!(sym.id, "custom:my-relay");
        assert_eq!(sym.category, "sensor");
    }

    #[test]
    fn test_delete_symbol() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());

        loader.import_xml(&sample_xml("test:to-delete")).unwrap();
        assert_eq!(loader.list_symbols().unwrap().len(), 1);

        loader.delete("test:to-delete").unwrap();
        assert!(loader.list_symbols().unwrap().is_empty());
    }

    #[test]
    fn test_load_all_definitions() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());

        loader.import_xml(&sample_xml("sym:one")).unwrap();
        loader.import_xml(&sample_xml("sym:two")).unwrap();
        loader.import_xml(&sample_xml("sym:three")).unwrap();

        let defs = loader.load_all_definitions().unwrap();
        assert_eq!(defs.len(), 3);
    }

    #[test]
    fn test_sanitize_id() {
        assert_eq!(sanitize_id_for_filename("custom:relay"), "custom_relay");
        assert_eq!(sanitize_id_for_filename("my-sensor.v2"), "my-sensor.v2");
        assert_eq!(sanitize_id_for_filename("a/b\\c"), "a_b_c");
    }

    #[test]
    fn test_non_xml_files_skipped() {
        let tmp = TempDir::new().unwrap();
        let loader = ProjectBlockLoader::new(tmp.path());
        loader.ensure_dir().unwrap();

        // Write a non-symbol file
        let dir = loader.symbols_dir();
        fs::write(dir.join("readme.txt"), "not a symbol").unwrap();
        fs::write(dir.join("data.json"), "{}").unwrap();

        let list = loader.list_symbols().unwrap();
        assert!(list.is_empty());
    }
}
