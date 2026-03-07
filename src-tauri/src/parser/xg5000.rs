use crate::parser::types::{DataType, DeviceAddress, DeviceType, SymbolEntry};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use bzip2::read::BzDecoder;
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::io::{Cursor, Read};
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum Xg5000ParseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid format: {0}")]
    InvalidFormat(String),
    #[error("Base64 decode failed: {0}")]
    Base64(String),
    #[error("UTF-8 decode failed: {0}")]
    Utf8(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Xg5000SourceKind {
    Prg,
    Xgwx,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000ParseResult {
    pub source_kind: Xg5000SourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configuration_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_type: Option<String>,
    pub programs: Vec<Xg5000Program>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub symbols: Vec<SymbolEntry>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub configurations: Vec<Xg5000XmlNode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub configuration_details: Vec<Xg5000ConfigurationDetails>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000XmlNode {
    pub tag: String,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub attributes: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<Xg5000XmlNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000ConfigurationDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub attributes: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub options: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basic_parameter: Option<Xg5000XmlNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hsc_parameter: Option<Xg5000XmlNode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub io_modules: Vec<Xg5000IoModule>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub io_base_info: Vec<Xg5000XmlNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub global_variables: Option<Xg5000XmlNode>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tasks: Vec<Xg5000ConfigurationTask>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub online_elements: Option<Xg5000XmlNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xgpd: Option<Xg5000XmlNode>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub properties: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub folders: Vec<Xg5000XmlNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000IoModule {
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub attributes: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000ConfigurationTask {
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub attributes: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000Program {
    pub name: String,
    pub payload_bytes: usize,
    pub rows: Vec<Xg5000Row>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Xg5000RowKind {
    Logic,
    BranchTarget,
    EmptyBranchIntermediary,
    Annotation,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000Row {
    pub index: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor_x: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_y: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_metric: Option<u32>,
    pub row_kind: Xg5000RowKind,
    pub bookmark: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub elements: Vec<Xg5000Element>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mnemonics: Vec<Xg5000Mnemonic>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub branch_links: Vec<Xg5000BranchLink>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub raw_blobs: Vec<String>,
    pub raw_header_hex: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Xg5000ElementKind {
    Contact,
    Coil,
    HorizontalWire,
    Annotation,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000Element {
    pub id: String,
    pub kind: Xg5000ElementKind,
    pub variant: String,
    pub opcode: u8,
    pub opcode_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_address: Option<DeviceAddress>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    pub raw_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Xg5000MnemonicKind {
    Call,
    Name,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000Mnemonic {
    pub kind: Xg5000MnemonicKind,
    pub instruction: String,
    pub raw_text: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub operands: Vec<String>,
    /// The visual FB/object binding is still unresolved. Preserve the text now,
    /// and let the future instruction dictionary bind semantics later.
    pub binding_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Xg5000BranchLinkKind {
    ForwardOnly,
    BackwardOnly,
    Middle,
    Raw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000BranchLink {
    pub kind: Xg5000BranchLinkKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch_x: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_y: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_y: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_y: Option<u32>,
    pub has_extra_trailer: bool,
    pub raw_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Xg5000ExtractedProgram {
    pub name: String,
    pub output_path: String,
    pub payload_bytes: usize,
}

#[derive(Debug)]
struct ProgramBlob {
    name: String,
    program_data_b64: String,
}

#[derive(Debug)]
enum Token {
    Opcode { opcode: u8, raw: Vec<u8> },
    Text { text: String },
    Blob { raw: Vec<u8> },
}

#[derive(Debug, Clone)]
enum SymbolToken {
    Text(String),
    Blob(Vec<u8>),
}

pub fn parse_xg5000_file(path: &Path) -> Result<Xg5000ParseResult, Xg5000ParseError> {
    let bytes = fs::read(path)?;
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("prg") => parse_prg_bytes(&bytes, path),
        Some("xgwx") => parse_xgwx_bytes(&bytes, path),
        _ => Err(Xg5000ParseError::InvalidFormat(format!(
            "unsupported file extension: {}",
            path.display()
        ))),
    }
}

pub fn extract_xgwx_programs(
    source_path: &Path,
    output_dir: &Path,
) -> Result<Vec<Xg5000ExtractedProgram>, Xg5000ParseError> {
    let bytes = fs::read(source_path)?;
    let xml = decode_xgwx_xml(&bytes)?;
    let programs = extract_program_blobs(&xml);

    fs::create_dir_all(output_dir)?;

    let mut extracted = Vec::with_capacity(programs.len());
    for program in programs {
        let payload = decode_program_data_payload(&program.program_data_b64)?;
        let prg_bytes = build_prg_bytes(&program.name, &payload);
        let file_name = format!("{}.prg", sanitize_file_name(&program.name));
        let out_path = output_dir.join(file_name);
        fs::write(&out_path, prg_bytes)?;
        extracted.push(Xg5000ExtractedProgram {
            name: program.name,
            output_path: out_path.display().to_string(),
            payload_bytes: payload.len(),
        });
    }

    Ok(extracted)
}

fn parse_prg_bytes(bytes: &[u8], path: &Path) -> Result<Xg5000ParseResult, Xg5000ParseError> {
    let payload_offset = find_prg_payload_offset(bytes)?;
    let payload = &bytes[payload_offset..];
    let program_name = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("program")
        .to_string();

    Ok(Xg5000ParseResult {
        source_kind: Xg5000SourceKind::Prg,
        source_path: Some(path.display().to_string()),
        project_name: None,
        configuration_name: None,
        cpu_type: None,
        programs: vec![parse_program_payload(&program_name, payload)],
        symbols: Vec::new(),
        configurations: Vec::new(),
        configuration_details: Vec::new(),
        warnings: Vec::new(),
    })
}

fn parse_xgwx_bytes(bytes: &[u8], path: &Path) -> Result<Xg5000ParseResult, Xg5000ParseError> {
    let xml = decode_xgwx_xml(bytes)?;
    let programs = extract_program_blobs(&xml);
    let parsed_programs = programs
        .into_iter()
        .map(|program| {
            let payload = decode_program_data_payload(&program.program_data_b64)?;
            Ok(parse_program_payload(&program.name, &payload))
        })
        .collect::<Result<Vec<_>, Xg5000ParseError>>()?;
    let symbols = extract_tag_text(&xml, "Symbols")
        .map(|payload| parse_symbol_entries(&payload))
        .transpose()?
        .unwrap_or_default();
    let configurations = extract_configurations(&xml)?;
    let configuration_details = parse_configuration_details(&configurations);

    Ok(Xg5000ParseResult {
        source_kind: Xg5000SourceKind::Xgwx,
        source_path: Some(path.display().to_string()),
        project_name: extract_attribute(&xml, "Project", &["Name", "name"])
            .or_else(|| extract_leading_tag_text(&xml, "Project")),
        configuration_name: extract_attribute(&xml, "Configuration", &["Name", "name"])
            .or_else(|| extract_leading_tag_text(&xml, "Configuration")),
        cpu_type: extract_first_attribute(
            &xml,
            &[
                ("Module", &["TypeName", "CPUType", "CpuType"]),
                ("Configuration", &["CPUType", "CpuType"]),
            ],
        ),
        programs: parsed_programs,
        symbols,
        configurations,
        configuration_details,
        warnings: Vec::new(),
    })
}

fn parse_program_payload(name: &str, payload: &[u8]) -> Xg5000Program {
    let row_starts = find_row_starts(payload);
    let mut rows = Vec::with_capacity(row_starts.len());

    for (index, start) in row_starts.iter().enumerate() {
        let end = row_starts.get(index + 1).copied().unwrap_or(payload.len());
        rows.push(parse_row(index, &payload[*start..end]));
    }

    Xg5000Program {
        name: name.to_string(),
        payload_bytes: payload.len(),
        rows,
    }
}

fn parse_row(index: usize, row_bytes: &[u8]) -> Xg5000Row {
    let tokens = tokenize_row(row_bytes);
    let mut anchor_x = None;
    let mut row_y = None;
    let mut row_metric = None;
    let mut bookmark = false;
    let mut raw_header_hex = String::new();
    let mut elements: Vec<Xg5000Element> = Vec::new();
    let mut mnemonics = Vec::new();
    let mut branch_links = Vec::new();
    let mut raw_blobs = Vec::new();
    let mut comment = None;
    let mut label = None;
    let mut element_counter = 0usize;

    if let Some(Token::Opcode { opcode: 0x43, raw }) = tokens.first() {
        bookmark = raw.get(2).copied().unwrap_or_default() == 0x01;
        raw_header_hex = hex_preview(raw);
        if raw.len() >= 7 {
            let tail = &raw[raw.len() - 7..];
            anchor_x = Some(tail[1] as u32);
            row_y = Some(tail[2] as u32);
            row_metric = Some(tail[5] as u32);
        }
    }

    let mut token_index = 1usize;
    while token_index < tokens.len() {
        match &tokens[token_index] {
            Token::Text { text } => {
                if let Some(mnemonic) = parse_mnemonic_text(text) {
                    mnemonics.push(mnemonic);
                } else if !text.is_empty() {
                    raw_blobs.push(format!("text:{}", text));
                }
                token_index += 1;
            }
            Token::Blob { raw } => {
                if raw.iter().any(|byte| *byte != 0) {
                    if let Some(link) = parse_branch_link(raw) {
                        branch_links.push(link);
                    } else {
                        raw_blobs.push(hex_preview(raw));
                    }
                }
                token_index += 1;
            }
            Token::Opcode { opcode, raw } => {
                let text = match tokens.get(token_index + 1) {
                    Some(Token::Text { text }) => Some(text.clone()),
                    _ => None,
                };
                let consumed_text = text.is_some();
                if let Some(mnemonic) = text.as_deref().and_then(parse_mnemonic_text) {
                    mnemonics.push(mnemonic);
                }

                match *opcode {
                    0x3F => {
                        comment = text.filter(|value| !value.is_empty());
                    }
                    0x41 => {
                        label = text.filter(|value| !value.is_empty());
                    }
                    0x40 => {
                        if let Some(last) = elements.last_mut() {
                            last.comment = text.filter(|value| !value.is_empty());
                        } else if let Some(text) = text.filter(|value| !value.is_empty()) {
                            elements.push(Xg5000Element {
                                id: format!("row{index}-el{element_counter}"),
                                kind: Xg5000ElementKind::Annotation,
                                variant: "element_comment".to_string(),
                                opcode: *opcode,
                                opcode_name: opcode_name(*opcode).to_string(),
                                address_text: None,
                                device_address: None,
                                text: Some(text),
                                comment: None,
                                raw_hex: hex_preview(raw),
                            });
                            element_counter += 1;
                        }
                    }
                    0x01 | 0x02 => {
                        elements.push(Xg5000Element {
                            id: format!("row{index}-el{element_counter}"),
                            kind: Xg5000ElementKind::HorizontalWire,
                            variant: if *opcode == 0x01 {
                                "manual_tile".to_string()
                            } else {
                                "auto_connector".to_string()
                            },
                            opcode: *opcode,
                            opcode_name: opcode_name(*opcode).to_string(),
                            address_text: None,
                            device_address: None,
                            text: None,
                            comment: None,
                            raw_hex: hex_preview(raw),
                        });
                        element_counter += 1;
                    }
                    0x06..=0x09 | 0x0E..=0x13 => {
                        let address_text = text.clone().filter(|value| is_device_text(value));
                        elements.push(Xg5000Element {
                            id: format!("row{index}-el{element_counter}"),
                            kind: if matches!(*opcode, 0x06..=0x09) {
                                Xg5000ElementKind::Contact
                            } else {
                                Xg5000ElementKind::Coil
                            },
                            variant: opcode_variant(*opcode).to_string(),
                            opcode: *opcode,
                            opcode_name: opcode_name(*opcode).to_string(),
                            device_address: address_text.as_deref().and_then(parse_device_address),
                            address_text,
                            text: text.filter(|value| !value.is_empty()),
                            comment: None,
                            raw_hex: hex_preview(raw),
                        });
                        element_counter += 1;
                    }
                    _ => {
                        elements.push(Xg5000Element {
                            id: format!("row{index}-el{element_counter}"),
                            kind: Xg5000ElementKind::Unknown,
                            variant: "unknown".to_string(),
                            opcode: *opcode,
                            opcode_name: opcode_name(*opcode).to_string(),
                            address_text: text.clone().filter(|value| is_device_text(value)),
                            device_address: text
                                .as_deref()
                                .filter(|value| is_device_text(value))
                                .and_then(parse_device_address),
                            text: text.filter(|value| !value.is_empty()),
                            comment: None,
                            raw_hex: hex_preview(raw),
                        });
                        element_counter += 1;
                    }
                }

                token_index += if consumed_text { 2 } else { 1 };
            }
        }
    }

    let row_kind = classify_row_kind(&elements, &branch_links);

    Xg5000Row {
        index,
        anchor_x,
        row_y,
        row_metric,
        row_kind,
        bookmark,
        comment,
        label,
        elements,
        mnemonics,
        branch_links,
        raw_blobs,
        raw_header_hex,
    }
}

fn classify_row_kind(
    elements: &[Xg5000Element],
    branch_links: &[Xg5000BranchLink],
) -> Xg5000RowKind {
    let Some(first) = elements.first() else {
        return if branch_links.is_empty() {
            Xg5000RowKind::Unknown
        } else {
            Xg5000RowKind::EmptyBranchIntermediary
        };
    };

    if first.kind == Xg5000ElementKind::Annotation {
        return Xg5000RowKind::Annotation;
    }

    if first.kind == Xg5000ElementKind::HorizontalWire && !branch_links.is_empty() {
        return Xg5000RowKind::BranchTarget;
    }

    if matches!(
        first.kind,
        Xg5000ElementKind::Contact | Xg5000ElementKind::HorizontalWire
    ) {
        return Xg5000RowKind::Logic;
    }

    Xg5000RowKind::Unknown
}

fn tokenize_row(row_bytes: &[u8]) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut cursor = 0usize;

    while cursor < row_bytes.len() {
        let Some(marker_pos) = find_next_marker(row_bytes, cursor) else {
            if cursor < row_bytes.len() {
                let raw = row_bytes[cursor..].to_vec();
                if raw.iter().any(|byte| *byte != 0) {
                    tokens.push(Token::Blob { raw });
                }
            }
            break;
        };

        if marker_pos > cursor {
            let raw = row_bytes[cursor..marker_pos].to_vec();
            if raw.iter().any(|byte| *byte != 0) {
                tokens.push(Token::Blob { raw });
            }
        }

        if row_bytes[marker_pos..].starts_with(&[0xFF, 0xFE, 0xFF]) {
            if marker_pos + 4 > row_bytes.len() {
                break;
            }
            let char_len = row_bytes[marker_pos + 3] as usize;
            let text_end = marker_pos + 4 + char_len * 2;
            if text_end > row_bytes.len() {
                break;
            }
            let text = decode_utf16_lossy(&row_bytes[marker_pos + 4..text_end])
                .trim_matches('\u{0}')
                .trim()
                .to_string();
            tokens.push(Token::Text { text });
            cursor = text_end;
            continue;
        }

        let opcode = row_bytes[marker_pos + 1];
        let next_marker = find_next_marker(row_bytes, marker_pos + 2).unwrap_or(row_bytes.len());
        tokens.push(Token::Opcode {
            opcode,
            raw: row_bytes[marker_pos..next_marker].to_vec(),
        });
        cursor = next_marker;
    }

    tokens
}

fn find_row_starts(payload: &[u8]) -> Vec<usize> {
    let mut starts = Vec::new();
    let mut cursor = 0usize;

    while let Some(pos) = find_signature(&payload[cursor..], &[0xFF, 0x43]) {
        let absolute = cursor + pos;
        starts.push(absolute);
        cursor = absolute + 2;
    }

    if starts.is_empty() {
        starts.push(0);
    }

    starts
}

fn find_next_marker(bytes: &[u8], start: usize) -> Option<usize> {
    let mut index = start;
    while index + 1 < bytes.len() {
        if bytes[index] == 0xFF {
            if index + 2 < bytes.len() && bytes[index + 1] == 0xFE && bytes[index + 2] == 0xFF {
                return Some(index);
            }
            if bytes[index + 1] != 0xFE {
                return Some(index);
            }
        }
        index += 1;
    }
    None
}

fn parse_branch_link(raw: &[u8]) -> Option<Xg5000BranchLink> {
    if raw.len() >= 36 && is_backward_only_blob(&raw[..9]) && is_forward_only_blob(&raw[9..36]) {
        let backward = parse_backward_only_blob(&raw[..9]);
        let forward = parse_forward_only_blob(&raw[9..36]);
        return Some(Xg5000BranchLink {
            kind: Xg5000BranchLinkKind::Middle,
            branch_x: forward.branch_x,
            source_y: forward.source_y,
            target_y: forward.target_y,
            previous_y: backward.previous_y,
            has_extra_trailer: raw.len() > 36,
            raw_hex: hex_preview(raw),
        });
    }

    if is_forward_only_blob(raw) {
        return Some(parse_forward_only_blob(raw));
    }

    if is_backward_only_blob(raw) {
        return Some(parse_backward_only_blob(raw));
    }

    None
}

fn is_forward_only_blob(raw: &[u8]) -> bool {
    raw.len() >= 19 && raw[0..5] == [0, 0, 0, 0, 0] && raw[5] == 0x02 && raw[6] == 0x00
}

fn is_backward_only_blob(raw: &[u8]) -> bool {
    raw.len() >= 9
        && raw[0] == 0x01
        && raw[1..5] == [0, 0, 0, 0]
        && raw[7] == 0x00
        && raw[8] == 0x00
}

fn parse_forward_only_blob(raw: &[u8]) -> Xg5000BranchLink {
    Xg5000BranchLink {
        kind: Xg5000BranchLinkKind::ForwardOnly,
        branch_x: raw.get(7).copied().map(u32::from),
        source_y: raw.get(8).copied().map(u32::from),
        target_y: raw.get(18).copied().map(u32::from),
        previous_y: None,
        has_extra_trailer: raw.len() > 27,
        raw_hex: hex_preview(raw),
    }
}

fn parse_backward_only_blob(raw: &[u8]) -> Xg5000BranchLink {
    Xg5000BranchLink {
        kind: Xg5000BranchLinkKind::BackwardOnly,
        branch_x: raw.get(5).copied().map(u32::from),
        source_y: None,
        target_y: None,
        previous_y: raw.get(6).copied().map(u32::from),
        has_extra_trailer: raw.len() > 9,
        raw_hex: hex_preview(raw),
    }
}

fn decode_xgwx_xml(bytes: &[u8]) -> Result<String, Xg5000ParseError> {
    let gzip_offset = find_signature(bytes, &[0x1F, 0x8B, 0x08])
        .ok_or_else(|| Xg5000ParseError::InvalidFormat("gzip stream not found".to_string()))?;
    let xml_bytes = gunzip(&bytes[gzip_offset..])?;
    String::from_utf8(xml_bytes).map_err(|err| Xg5000ParseError::Utf8(err.to_string()))
}

fn decode_program_data_payload(b64_text: &str) -> Result<Vec<u8>, Xg5000ParseError> {
    let compact: String = b64_text
        .chars()
        .filter(|value| !value.is_whitespace())
        .collect();
    let raw = STANDARD
        .decode(compact)
        .map_err(|err| Xg5000ParseError::Base64(err.to_string()))?;

    if raw.starts_with(b"BZh") {
        bunzip2(&raw)
    } else {
        Ok(raw)
    }
}

fn extract_configurations(xml: &str) -> Result<Vec<Xg5000XmlNode>, Xg5000ParseError> {
    let Some(fragment) = extract_tag_text(xml, "Configurations") else {
        return Ok(Vec::new());
    };
    parse_xml_fragment(&fragment)
}

fn parse_configuration_details(nodes: &[Xg5000XmlNode]) -> Vec<Xg5000ConfigurationDetails> {
    nodes
        .iter()
        .filter(|node| node.tag == "Configuration")
        .map(parse_configuration_detail)
        .collect()
}

fn parse_configuration_detail(node: &Xg5000XmlNode) -> Xg5000ConfigurationDetails {
    let parameters = node.children.iter().find(|child| child.tag == "Parameters");
    let basic_parameter = parameters
        .and_then(|group| find_parameter_section(group, "BASIC PARAMETER"))
        .and_then(|parameter| parameter.children.first().cloned());
    let hsc_parameter = parameters
        .and_then(|group| find_parameter_section(group, "HSC PARAMETER"))
        .cloned();
    let io_parameter = parameters.and_then(|group| find_parameter_section(group, "IO PARAMETER"));
    let io_modules = io_parameter
        .map(|section| {
            section
                .children
                .iter()
                .filter(|child| child.tag == "Module")
                .map(|child| Xg5000IoModule {
                    attributes: child.attributes.clone(),
                    name: child
                        .attributes
                        .get("Name")
                        .cloned()
                        .or_else(|| child.text.clone()),
                    comment: child
                        .attributes
                        .get("Comment")
                        .cloned()
                        .filter(|value| !value.is_empty()),
                    details: child
                        .attributes
                        .get("Details")
                        .cloned()
                        .filter(|value| !value.is_empty()),
                })
                .collect()
        })
        .unwrap_or_default();
    let io_base_info = io_parameter
        .and_then(|section| {
            section
                .children
                .iter()
                .find(|child| child.tag == "BaseInfo")
        })
        .map(|base_info| base_info.children.clone())
        .unwrap_or_default();
    let tasks = node
        .children
        .iter()
        .find(|child| child.tag == "Tasks")
        .map(|section| {
            section
                .children
                .iter()
                .filter(|child| child.tag == "Task")
                .map(|child| Xg5000ConfigurationTask {
                    attributes: child.attributes.clone(),
                    name: child.text.clone(),
                })
                .collect()
        })
        .unwrap_or_default();

    Xg5000ConfigurationDetails {
        name: node.text.clone(),
        attributes: node.attributes.clone(),
        options: node
            .children
            .iter()
            .find(|child| child.tag == "Options")
            .and_then(|options| options.attributes.get("Details"))
            .map(|details| parse_options_details(details))
            .unwrap_or_default(),
        basic_parameter,
        hsc_parameter,
        io_modules,
        io_base_info,
        global_variables: node
            .children
            .iter()
            .find(|child| child.tag == "GlobalVariables")
            .cloned(),
        tasks,
        online_elements: node
            .children
            .iter()
            .find(|child| child.tag == "OnlineElements")
            .cloned(),
        xgpd: node
            .children
            .iter()
            .find(|child| child.tag == "XGPD")
            .cloned(),
        properties: node
            .children
            .iter()
            .find(|child| child.tag == "Properties")
            .map(|child| child.attributes.clone())
            .unwrap_or_default(),
        folders: node
            .children
            .iter()
            .filter(|child| child.tag == "Folders")
            .cloned()
            .collect(),
    }
}

fn find_parameter_section<'a>(
    parameters: &'a Xg5000XmlNode,
    parameter_type: &str,
) -> Option<&'a Xg5000XmlNode> {
    parameters.children.iter().find(|child| {
        child.tag == "Parameter"
            && child
                .attributes
                .get("Type")
                .map(|value| value == parameter_type)
                .unwrap_or(false)
    })
}

fn parse_options_details(details: &str) -> BTreeMap<String, String> {
    let Ok(Value::Object(map)) = serde_json::from_str::<Value>(details) else {
        return BTreeMap::new();
    };

    map.into_iter()
        .map(|(key, value)| (key, json_value_to_string(value)))
        .collect()
}

fn json_value_to_string(value: Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value,
        other => other.to_string(),
    }
}

fn parse_xml_fragment(fragment: &str) -> Result<Vec<Xg5000XmlNode>, Xg5000ParseError> {
    let _bytes = fragment.as_bytes();
    let mut cursor = 0usize;
    let mut stack: Vec<Xg5000XmlNode> = Vec::new();
    let mut roots = Vec::new();

    while let Some(rel_lt) = fragment[cursor..].find('<') {
        let lt = cursor + rel_lt;
        let text = fragment[cursor..lt].trim();
        if !text.is_empty() {
            if let Some(current) = stack.last_mut() {
                current.text = Some(match current.text.take() {
                    Some(existing) => format!("{} {}", existing, decode_xml_entities(text)),
                    None => decode_xml_entities(text),
                });
            }
        }

        let gt = find_tag_end(fragment, lt + 1)?;
        let raw = &fragment[lt + 1..gt];
        let tag = raw.trim();

        if tag.starts_with('?') || tag.starts_with('!') {
            cursor = gt + 1;
            continue;
        }

        if let Some(stripped) = tag.strip_prefix('/') {
            let close_name = stripped.trim();
            let node = stack.pop().ok_or_else(|| {
                Xg5000ParseError::InvalidFormat(format!("unexpected closing tag: {close_name}"))
            })?;
            if node.tag != close_name {
                return Err(Xg5000ParseError::InvalidFormat(format!(
                    "mismatched closing tag: expected </{}> but found </{}>",
                    node.tag, close_name
                )));
            }

            if let Some(parent) = stack.last_mut() {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
            cursor = gt + 1;
            continue;
        }

        let self_closing = tag.ends_with('/');
        let tag_body = if self_closing {
            tag[..tag.len() - 1].trim_end()
        } else {
            tag
        };
        let (name, attributes) = parse_tag_body(tag_body)?;
        let node = Xg5000XmlNode {
            tag: name,
            attributes,
            text: None,
            children: Vec::new(),
        };

        if self_closing {
            if let Some(parent) = stack.last_mut() {
                parent.children.push(node);
            } else {
                roots.push(node);
            }
        } else {
            stack.push(node);
        }

        cursor = gt + 1;
    }

    let trailing = fragment[cursor..].trim();
    if !trailing.is_empty() {
        if let Some(current) = stack.last_mut() {
            current.text = Some(match current.text.take() {
                Some(existing) => format!("{} {}", existing, decode_xml_entities(trailing)),
                None => decode_xml_entities(trailing),
            });
        }
    }

    while let Some(node) = stack.pop() {
        if let Some(parent) = stack.last_mut() {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }

    Ok(roots)
}

fn find_tag_end(xml: &str, start: usize) -> Result<usize, Xg5000ParseError> {
    let bytes = xml.as_bytes();
    let mut index = start;
    let mut quote: Option<u8> = None;

    while index < bytes.len() {
        let byte = bytes[index];
        if let Some(active) = quote {
            if byte == active {
                quote = None;
            }
        } else if byte == b'\'' || byte == b'"' {
            quote = Some(byte);
        } else if byte == b'>' {
            return Ok(index);
        }
        index += 1;
    }

    Err(Xg5000ParseError::InvalidFormat(
        "unterminated xml tag in configuration fragment".to_string(),
    ))
}

fn parse_tag_body(tag: &str) -> Result<(String, BTreeMap<String, String>), Xg5000ParseError> {
    let mut chars = tag.char_indices().peekable();
    while let Some((_, ch)) = chars.peek() {
        if ch.is_whitespace() {
            chars.next();
        } else {
            break;
        }
    }

    let name_start = chars.peek().map(|(idx, _)| *idx).unwrap_or(0);
    let mut name_end = tag.len();
    while let Some((idx, ch)) = chars.peek() {
        if ch.is_whitespace() {
            name_end = *idx;
            break;
        }
        chars.next();
    }
    let name = tag[name_start..name_end].trim().to_string();
    let mut rest = &tag[name_end..];
    let mut attributes = BTreeMap::new();

    while !rest.trim().is_empty() {
        rest = rest.trim_start();
        let Some(eq_index) = rest.find('=') else {
            break;
        };
        let key = rest[..eq_index].trim();
        let mut value_rest = rest[eq_index + 1..].trim_start();
        let Some(quote) = value_rest.chars().next() else {
            break;
        };
        if quote != '"' && quote != '\'' {
            break;
        }
        value_rest = &value_rest[quote.len_utf8()..];
        let Some(value_end) = value_rest.find(quote) else {
            return Err(Xg5000ParseError::InvalidFormat(format!(
                "unterminated attribute value for {key}"
            )));
        };
        let value = decode_xml_entities(&value_rest[..value_end]);
        attributes.insert(key.to_string(), value);
        rest = &value_rest[value_end + quote.len_utf8()..];
    }

    Ok((name, attributes))
}

fn decode_xml_entities(text: &str) -> String {
    let mut out = text.replace("&quot;", "\"");
    out = out.replace("&apos;", "'");
    out = out.replace("&lt;", "<");
    out = out.replace("&gt;", ">");
    out = out.replace("&amp;", "&");
    out = out.replace("&#xA;", "\n");
    out = out.replace("&#xD;", "\r");
    out = out.replace("&#x9;", "\t");
    out
}

fn parse_symbol_entries(b64_text: &str) -> Result<Vec<SymbolEntry>, Xg5000ParseError> {
    let bytes = decode_program_data_payload(b64_text)?;
    let tokens = tokenize_symbol_payload(&bytes);
    let mut groups: Vec<Vec<SymbolToken>> = Vec::new();
    let mut current = Vec::new();

    for token in tokens {
        let is_version_marker =
            matches!(&token, SymbolToken::Text(text) if is_symbol_version_marker(text));
        if is_version_marker {
            if !current.is_empty() {
                groups.push(current);
                current = Vec::new();
            }
        }

        if !current.is_empty() || is_version_marker {
            current.push(token);
        }
    }

    if !current.is_empty() {
        groups.push(current);
    }

    Ok(groups
        .iter()
        .filter_map(|group| parse_symbol_entry(group))
        .collect())
}

fn tokenize_symbol_payload(bytes: &[u8]) -> Vec<SymbolToken> {
    let mut tokens = Vec::new();
    let mut cursor = 0usize;

    while let Some(rel_marker) = find_signature(&bytes[cursor..], &[0xFF, 0xFE, 0xFF]) {
        let marker_pos = cursor + rel_marker;
        if marker_pos > cursor {
            let raw = bytes[cursor..marker_pos].to_vec();
            if raw.iter().any(|byte| *byte != 0) {
                tokens.push(SymbolToken::Blob(raw));
            }
        }

        if marker_pos + 4 > bytes.len() {
            break;
        }

        let char_len = bytes[marker_pos + 3] as usize;
        let text_end = marker_pos + 4 + char_len * 2;
        if text_end > bytes.len() {
            break;
        }

        let text = decode_utf16_lossy(&bytes[marker_pos + 4..text_end])
            .trim_matches('\u{0}')
            .trim()
            .to_string();
        tokens.push(SymbolToken::Text(text));
        cursor = text_end;
    }

    if cursor < bytes.len() {
        let raw = bytes[cursor..].to_vec();
        if raw.iter().any(|byte| *byte != 0) {
            tokens.push(SymbolToken::Blob(raw));
        }
    }

    tokens
}

fn parse_symbol_entry(tokens: &[SymbolToken]) -> Option<SymbolEntry> {
    let texts = tokens
        .iter()
        .filter_map(|token| match token {
            SymbolToken::Text(text) if !text.is_empty() => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>();

    if texts.len() < 4 {
        return None;
    }

    let symbol = texts.get(1)?.trim();
    let device_code = texts.get(2)?.trim();
    let data_type = parse_symbol_data_type(texts.get(3)?);
    let comment = texts
        .iter()
        .skip(4)
        .find(|text| !is_symbol_metadata_text(text))
        .map(|text| (*text).to_string());

    let address_blob = tokens.iter().find_map(|token| match token {
        SymbolToken::Blob(raw) if raw.len() >= 4 => Some(raw.as_slice()),
        _ => None,
    })?;
    let address = parse_symbol_address(device_code, address_blob)?;

    Some(SymbolEntry {
        address,
        symbol: Some(symbol.to_string()),
        comment,
        data_type,
    })
}

fn parse_symbol_address(device_code: &str, raw: &[u8]) -> Option<DeviceAddress> {
    let device = DeviceType::from_str(device_code.trim())?;
    let bytes = raw.get(0..4)?;
    let address = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    Some(DeviceAddress::new(device, address))
}

fn parse_symbol_data_type(text: &str) -> Option<DataType> {
    match text.trim().to_ascii_uppercase().as_str() {
        "BIT" | "BOOL" => Some(DataType::Bool),
        "INT" => Some(DataType::Int),
        "WORD" => Some(DataType::Word),
        "DWORD" => Some(DataType::DWord),
        "REAL" => Some(DataType::Real),
        _ => None,
    }
}

fn is_symbol_metadata_text(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }

    (trimmed.starts_with('[') && trimmed.ends_with(']'))
        || trimmed.starts_with("INCOM:")
        || trimmed.starts_with("SV")
}

fn is_symbol_version_marker(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed.len() >= 4
        && trimmed.starts_with("SV")
        && trimmed[2..]
            .chars()
            .all(|ch| ch.is_ascii_digit() || ch == '.')
}

fn build_prg_bytes(name: &str, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&[0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    out.extend_from_slice(&[0xFF, 0xFE, 0xFF, 0x00]);
    out.extend_from_slice(&[0xFF, 0xFE, 0xFF, name.chars().count() as u8]);
    out.extend_from_slice(&encode_utf16le(name));
    out.extend_from_slice(&[0xFF, 0xFE, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00]);
    out.extend_from_slice(&[0xFF, 0xFE, 0xFF, 0x14]);
    out.extend_from_slice(&encode_utf16le("PROGRAM FILE VER 1.1"));
    out.extend_from_slice(&[0x00, 0x00]);
    out.extend_from_slice(&[0xFF, 0xFE, 0xFF, 0x0A]);
    out.extend_from_slice(&encode_utf16le("LD VER 1.1"));
    out.extend_from_slice(&[0x01, 0x00]);
    out.extend_from_slice(payload);
    out
}

fn extract_program_blobs(xml: &str) -> Vec<ProgramBlob> {
    let mut programs = Vec::new();
    let mut cursor = 0usize;

    while let Some(rel_program_open) = xml[cursor..].find("<Program ") {
        let program_open = cursor + rel_program_open;
        let Some(rel_gt) = xml[program_open..].find('>') else {
            break;
        };
        let gt = program_open + rel_gt;
        let body_open = gt + 1;
        let Some(rel_body_tag) = xml[body_open..].find("<Body>") else {
            break;
        };
        let body_tag = body_open + rel_body_tag;
        let name = xml[body_open..body_tag].trim().to_string();

        let Some(rel_program_data_open) = xml[body_tag..].find("<ProgramData") else {
            break;
        };
        let program_data_open = body_tag + rel_program_data_open;
        let Some(rel_program_data_gt) = xml[program_data_open..].find('>') else {
            break;
        };
        let program_data_gt = program_data_open + rel_program_data_gt;
        let Some(rel_program_data_end) = xml[program_data_gt + 1..].find("</ProgramData>") else {
            break;
        };
        let program_data_end = program_data_gt + 1 + rel_program_data_end;
        let program_data_b64 = xml[program_data_gt + 1..program_data_end].to_string();

        programs.push(ProgramBlob {
            name,
            program_data_b64,
        });

        cursor = program_data_end;
    }

    programs
}

fn extract_first_attribute(xml: &str, candidates: &[(&str, &[&str])]) -> Option<String> {
    for (tag, attrs) in candidates {
        for attr in *attrs {
            if let Some(value) = extract_attribute(xml, tag, &[*attr]) {
                return Some(value);
            }
        }
    }
    None
}

fn extract_tag_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}");
    let start = xml.find(&open)?;
    let gt = xml[start..].find('>')? + start;
    let end = xml[gt + 1..].find(&format!("</{tag}>"))? + gt + 1;
    Some(xml[gt + 1..end].to_string())
}

fn extract_leading_tag_text(xml: &str, tag: &str) -> Option<String> {
    let start = xml.find(&format!("<{tag}"))?;
    let gt = xml[start..].find('>')? + start;
    let next_lt = xml[gt + 1..].find('<')? + gt + 1;
    let text = xml[gt + 1..next_lt].trim();
    (!text.is_empty()).then(|| text.to_string())
}

fn extract_attribute(xml: &str, tag: &str, attrs: &[&str]) -> Option<String> {
    let start = xml.find(&format!("<{tag}"))?;
    let end = xml[start..].find('>')? + start;
    let open_tag = &xml[start..=end];

    for attr in attrs {
        for quote in ['"', '\''] {
            let pattern = format!("{attr}={quote}");
            if let Some(attr_start) = open_tag.find(&pattern) {
                let value_start = attr_start + pattern.len();
                if let Some(value_end_rel) = open_tag[value_start..].find(quote) {
                    return Some(open_tag[value_start..value_start + value_end_rel].to_string());
                }
            }
        }
    }

    None
}

fn sanitize_file_name(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect()
}

fn find_prg_payload_offset(bytes: &[u8]) -> Result<usize, Xg5000ParseError> {
    let ld_ver = encode_utf16le("LD VER 1.1");
    let ld_pos = find_signature(bytes, &ld_ver).ok_or_else(|| {
        Xg5000ParseError::InvalidFormat("LD VER 1.1 marker not found".to_string())
    })?;
    let search_start = ld_pos + ld_ver.len();
    find_payload_offset(bytes, search_start).ok_or_else(|| {
        Xg5000ParseError::InvalidFormat(
            "payload zero-run not found after LD VER marker".to_string(),
        )
    })
}

fn find_payload_offset(bytes: &[u8], search_start: usize) -> Option<usize> {
    for index in search_start..bytes.len().saturating_sub(4) {
        if bytes[index..].starts_with(&[0x00, 0x00, 0x00, 0x00])
            && bytes.get(index + 4).copied().unwrap_or(0) != 0
        {
            return Some(index);
        }
    }
    None
}

fn decode_utf16_lossy(bytes: &[u8]) -> String {
    let mut words = Vec::with_capacity(bytes.len() / 2);
    for chunk in bytes.chunks_exact(2) {
        words.push(u16::from_le_bytes([chunk[0], chunk[1]]));
    }
    String::from_utf16_lossy(&words)
}

fn encode_utf16le(text: &str) -> Vec<u8> {
    text.encode_utf16()
        .flat_map(|word| word.to_le_bytes())
        .collect()
}

fn gunzip(bytes: &[u8]) -> Result<Vec<u8>, Xg5000ParseError> {
    let mut decoder = GzDecoder::new(Cursor::new(bytes));
    let mut out = Vec::new();
    decoder.read_to_end(&mut out)?;
    Ok(out)
}

fn bunzip2(bytes: &[u8]) -> Result<Vec<u8>, Xg5000ParseError> {
    let mut decoder = BzDecoder::new(Cursor::new(bytes));
    let mut out = Vec::new();
    decoder.read_to_end(&mut out)?;
    Ok(out)
}

fn find_signature(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn hex_preview(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_mnemonic_text(text: &str) -> Option<Xg5000Mnemonic> {
    let trimmed = text.trim();
    if trimmed.is_empty() || is_device_text(trimmed) {
        return None;
    }

    if trimmed.contains(',') {
        let parts = trimmed
            .split(',')
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        if parts.is_empty() || !is_mnemonic_name(parts[0]) {
            return None;
        }

        return Some(Xg5000Mnemonic {
            kind: Xg5000MnemonicKind::Call,
            instruction: parts[0].to_string(),
            raw_text: trimmed.to_string(),
            operands: parts.into_iter().skip(1).map(str::to_string).collect(),
            binding_status: "unbound_visual".to_string(),
        });
    }

    if is_mnemonic_name(trimmed) {
        return Some(Xg5000Mnemonic {
            kind: Xg5000MnemonicKind::Name,
            instruction: trimmed.to_string(),
            raw_text: trimmed.to_string(),
            operands: Vec::new(),
            binding_status: "unbound_visual".to_string(),
        });
    }

    None
}

fn is_mnemonic_name(text: &str) -> bool {
    if text.is_empty() || text.len() > 24 {
        return false;
    }

    let mut has_alpha = false;
    for ch in text.chars() {
        if ch.is_ascii_alphabetic() {
            has_alpha = true;
            continue;
        }
        if ch.is_ascii_digit() || ch == '_' {
            continue;
        }
        return false;
    }

    has_alpha && text == text.to_ascii_uppercase()
}
fn opcode_name(opcode: u8) -> &'static str {
    match opcode {
        0x01 => "wire-manual-tile",
        0x02 => "wire-auto-connector",
        0x06 => "contact-no",
        0x07 => "contact-nc",
        0x08 => "contact-rise",
        0x09 => "contact-fall",
        0x0E => "coil",
        0x0F => "coil-invert",
        0x10 => "coil-set",
        0x11 => "coil-reset",
        0x12 => "coil-rise",
        0x13 => "coil-fall",
        0x3F => "rung-comment",
        0x40 => "element-comment",
        0x41 => "step-label",
        0x43 => "rung-header",
        _ => "unknown",
    }
}

fn opcode_variant(opcode: u8) -> &'static str {
    match opcode {
        0x06 => "no",
        0x07 => "nc",
        0x08 => "rising_edge",
        0x09 => "falling_edge",
        0x0E => "out",
        0x0F => "invert",
        0x10 => "set",
        0x11 => "reset",
        0x12 => "rising_transition",
        0x13 => "falling_transition",
        _ => "unknown",
    }
}

fn split_device_text(text: &str) -> Option<(&str, &str)> {
    const PREFIXES: [&str; 14] = [
        "ZR", "P", "C", "D", "F", "K", "L", "M", "N", "R", "S", "T", "U", "Z",
    ];

    let trimmed = text.trim();
    PREFIXES.iter().find_map(|prefix| {
        trimmed
            .strip_prefix(prefix)
            .filter(|suffix| !suffix.is_empty() && suffix.chars().all(|ch| ch.is_ascii_digit()))
            .map(|suffix| (*prefix, suffix))
    })
}

fn is_device_text(text: &str) -> bool {
    split_device_text(text).is_some()
}

fn parse_device_address(text: &str) -> Option<DeviceAddress> {
    let (device_code, address_text) = split_device_text(text)?;
    let device = DeviceType::from_str(device_code)?;
    let address = address_text.parse::<u32>().ok()?;
    Some(DeviceAddress::new(device, address))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn asset_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("assets")
            .join("ladder")
            .join("education")
            .join(name)
    }

    #[test]
    fn parses_xgwx_programs_from_workspace() {
        let result = parse_xg5000_file(&asset_path("parsing_example.xgwx")).unwrap();
        assert!(matches!(result.source_kind, Xg5000SourceKind::Xgwx));
        assert_eq!(result.project_name.as_deref(), Some("parsing_example"));
        assert_eq!(result.configuration_name.as_deref(), Some("LSPLC_RE"));
        let names = result
            .programs
            .iter()
            .map(|program| program.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(names, vec!["Interlock", "TON_TOF", "CTU_CTD"]);
    }

    #[test]
    fn parses_symbol_entries_from_workspace() {
        let result = parse_xg5000_file(&asset_path("parsing_example.xgwx")).unwrap();
        assert_eq!(result.symbols.len(), 18);

        let first = &result.symbols[0];
        assert_eq!(first.symbol.as_deref(), Some("VARNAME_COIL_P0"));
        assert_eq!(first.comment.as_deref(), Some("COMMENT_COIL_P0"));
        assert_eq!(first.address.format(), "P0000");
    }

    #[test]
    fn parses_configuration_tree_from_workspace() {
        let result = parse_xg5000_file(&asset_path("parsing_example.xgwx")).unwrap();
        assert_eq!(result.configurations.len(), 1);

        let configuration = &result.configurations[0];
        assert_eq!(configuration.tag, "Configuration");
        assert_eq!(configuration.text.as_deref(), Some("LSPLC_RE"));
        assert_eq!(
            configuration.attributes.get("Type").map(String::as_str),
            Some("20")
        );
        assert!(configuration
            .children
            .iter()
            .any(|child| child.tag == "Parameters"));
        assert!(configuration
            .children
            .iter()
            .any(|child| child.tag == "OnlineElements"));
        assert!(configuration
            .children
            .iter()
            .any(|child| child.tag == "XGPD"));

        assert_eq!(result.configuration_details.len(), 1);
        let details = &result.configuration_details[0];
        assert_eq!(details.name.as_deref(), Some("LSPLC_RE"));
        assert_eq!(
            details
                .options
                .get("m_nOptPulsePercent")
                .map(String::as_str),
            Some("10")
        );
        assert_eq!(details.io_modules.len(), 4);
        assert_eq!(details.tasks[0].name.as_deref(), Some("스캔 프로그램"));
        assert!(details.basic_parameter.is_some());
        assert!(details.online_elements.is_some());
        assert!(details.xgpd.is_some());
    }

    #[test]
    fn parses_extended_device_prefixes() {
        assert!(is_device_text("L1234"));
        assert!(is_device_text("S0001"));
        assert!(is_device_text("U42"));
        assert!(is_device_text("ZR100"));
        assert_eq!(parse_device_address("ZR100").unwrap().format(), "ZR0100");
    }

    #[test]
    fn parses_manual_and_auto_horizontal_wires() {
        let result = parse_xg5000_file(&asset_path("ff01_6.prg")).unwrap();
        let program = &result.programs[0];
        assert!(program.rows.iter().any(|row| {
            row.elements.iter().any(|element| {
                element.kind == Xg5000ElementKind::HorizontalWire
                    && element.variant == "manual_tile"
            })
        }));
        assert!(program.rows.iter().any(|row| {
            row.elements.iter().any(|element| {
                element.kind == Xg5000ElementKind::HorizontalWire
                    && element.variant == "auto_connector"
            })
        }));
    }

    #[test]
    fn parses_branch_links() {
        let result = parse_xg5000_file(&asset_path("vertical_test.prg")).unwrap();
        let program = &result.programs[0];
        assert!(program.rows.iter().any(|row| !row.branch_links.is_empty()));
    }
}

