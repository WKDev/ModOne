use std::env;
use std::fs;
use std::io::{Cursor, Read};
use std::path::Path;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use bzip2::read::BzDecoder;
use flate2::read::GzDecoder;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        print_usage();
        std::process::exit(2);
    }

    match args[0].as_str() {
        "extract-prg" => {
            if args.len() != 3 {
                print_usage();
                std::process::exit(2);
            }

            if let Err(err) = extract_prg_files(Path::new(&args[1]), Path::new(&args[2])) {
                eprintln!("{}: {}", args[1], err);
                std::process::exit(1);
            }
        }
        "dump-text" => {
            if args.len() < 2 {
                print_usage();
                std::process::exit(2);
            }

            for path in &args[1..] {
                if let Err(err) = dump_text_records(Path::new(path)) {
                    eprintln!("{}: {}", path, err);
                }
            }
        }
        "dump-records" => {
            if args.len() < 2 {
                print_usage();
                std::process::exit(2);
            }

            for path in &args[1..] {
                if let Err(err) = dump_payload_records(Path::new(path)) {
                    eprintln!("{}: {}", path, err);
                }
            }
        }
        "dump-symbols" => {
            if args.len() < 2 {
                print_usage();
                std::process::exit(2);
            }

            for path in &args[1..] {
                if let Err(err) = dump_symbols(Path::new(path)) {
                    eprintln!("{}: {}", path, err);
                }
            }
        }
        "dump-comm" => {
            if args.len() < 2 {
                print_usage();
                std::process::exit(2);
            }

            for path in &args[1..] {
                if let Err(err) = dump_xgcomm_settings(Path::new(path)) {
                    eprintln!("{}: {}", path, err);
                }
            }
        }
        _ => {
            for path in args {
                let path = Path::new(&path);
                let result = match path.extension().and_then(|ext| ext.to_str()) {
                    Some("prg") => inspect_prg(path),
                    _ => inspect_xgwx(path),
                };

                if let Err(err) = result {
                    eprintln!("{}: {}", path.display(), err);
                }
            }
        }
    }
}

fn print_usage() {
    eprintln!("usage:");
    eprintln!("  cargo run -- <file.xgwx|file.prg> [more files]");
    eprintln!("  cargo run -- extract-prg <file.xgwx> <out-dir>");
    eprintln!("  cargo run -- dump-text <file.prg> [more files]");
    eprintln!("  cargo run -- dump-records <file.prg> [more files]");
    eprintln!("  cargo run -- dump-symbols <file.xgwx> [more files]");
    eprintln!("  cargo run -- dump-comm <file.xgwx> [more files]");
}

fn inspect_xgwx(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    println!("=== {} ===", path.display());
    println!("kind: xgwx");
    println!("size: {} bytes", bytes.len());

    let header = decode_utf16_lossy(&bytes[..bytes.len().min(0x40)]);
    println!("header-utf16: {}", header.replace('\u{0}', "\\0"));

    if bytes.len() >= 0x44 {
        let marker = u32::from_le_bytes(bytes[0x40..0x44].try_into().unwrap());
        println!("u32@0x40: 0x{marker:08X} ({marker})");
    }

    let xml = decode_xgwx_xml(&bytes)?;
    println!("outer-xml-bytes: {}", xml.len());

    for tag in [
        "Project",
        "Configuration",
        "POU",
        "Program",
        "LDRoutine",
        "ProgramData",
        "RungTableData",
        "Symbols",
    ] {
        println!("has-{tag}: {}", xml.contains(&format!("<{tag}")));
    }

    let programs = extract_program_blobs(&xml);
    println!("program-count: {}", programs.len());
    for (index, program) in programs.iter().enumerate() {
        println!("program[{index}]-name: {}", program.name);
        inspect_embedded_blob(&format!("ProgramData[{index}]"), &program.program_data_b64)?;
    }

    if let Some(rung_table_b64) = extract_tag_text(&xml, "RungTableData") {
        inspect_embedded_blob("RungTableData", &rung_table_b64)?;
    }

    if let Some(symbols_b64) = extract_tag_text(&xml, "Symbols") {
        inspect_embedded_blob("Symbols", &symbols_b64)?;
    }

    println!();
    Ok(())
}

fn inspect_prg(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    println!("=== {} ===", path.display());
    println!("kind: prg");
    println!("size: {} bytes", bytes.len());

    let utf16_strings = utf16_ascii_runs(&bytes[..bytes.len().min(0x100)], 4);
    if utf16_strings.is_empty() {
        println!("utf16-strings: none");
    } else {
        println!("utf16-strings:");
        for line in utf16_strings {
            println!("  {line}");
        }
    }

    let payload_offset = find_prg_payload_offset(&bytes)?;
    println!("payload-offset: 0x{payload_offset:X}");
    println!("payload-bytes: {}", bytes.len() - payload_offset);
    println!("payload-head: {}", hex_preview(&bytes[payload_offset..], 48));
    println!();
    Ok(())
}

fn dump_text_records(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    let payload_offset = find_prg_payload_offset(&bytes)?;
    let payload = &bytes[payload_offset..];

    println!("=== {} ===", path.display());
    println!("kind: prg-text-dump");
    println!("payload-offset: 0x{payload_offset:X}");

    let records = extract_text_records(payload, payload_offset);
    println!("text-record-count: {}", records.len());
    for record in records {
        println!(
            "0x{:X} payload+0x{:X} kind={} class={} text={} prefix={} suffix={}",
            record.file_offset,
            record.payload_offset,
            record.kind,
            record.class,
            record.text,
            record.prefix_hex,
            record.suffix_hex,
        );
    }

    println!();
    Ok(())
}

fn dump_payload_records(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    let payload_offset = find_prg_payload_offset(&bytes)?;
    let payload = &bytes[payload_offset..];

    println!("=== {} ===", path.display());
    println!("kind: prg-record-dump");
    println!("payload-offset: 0x{payload_offset:X}");

    for record in extract_payload_records(payload, payload_offset) {
        println!(
            "0x{:X} payload+0x{:X} opcode=FF{:02X} name={} header={} text={}",
            record.file_offset,
            record.payload_offset,
            record.opcode,
            record.name,
            record.header_hex,
            record.text.as_deref().unwrap_or("-"),
        );
    }

    println!();
    Ok(())
}

fn dump_symbols(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    let xml = decode_xgwx_xml(&bytes)?;
    let symbols_b64 =
        extract_tag_text(&xml, "Symbols").ok_or_else(|| "Symbols tag not found".to_string())?;
    let decoded = decode_program_data_payload(&symbols_b64)?;

    println!("=== {} ===", path.display());
    println!("kind: xgwx-symbol-dump");
    println!("symbol-bytes: {}", decoded.len());

    let records = extract_marker_strings(&decoded);
    println!("symbol-string-count: {}", records.len());
    for record in records {
        println!(
            "0x{:X} text={} prefix={} suffix={}",
            record.offset, record.text, record.prefix_hex, record.suffix_hex,
        );
    }

    println!();
    Ok(())
}

fn dump_xgcomm_settings(path: &Path) -> Result<(), String> {
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    let xml = decode_xgwx_xml(&bytes)?;
    let hex = extract_tag_attribute(&xml, "XGCommSettings", "Connnections")
        .ok_or_else(|| "XGCommSettings@Connnections not found".to_string())?;
    let raw = decode_hex_string(&hex)?;

    println!("=== {} ===", path.display());
    println!("kind: xgwx-comm-dump");
    println!("conn-bytes: {}", raw.len());
    for (offset, chunk) in raw.chunks(16).enumerate() {
        println!("{:04X}: {}", offset * 16, hex_preview(chunk, chunk.len()));
    }

    let ascii = ascii_runs(&raw, 4);
    if ascii.is_empty() {
        println!("ascii-runs: none");
    } else {
        println!("ascii-runs:");
        for line in ascii {
            println!("  {line}");
        }
    }

    let utf16 = utf16_ascii_runs(&raw, 4);
    if utf16.is_empty() {
        println!("utf16-runs: none");
    } else {
        println!("utf16-runs:");
        for line in utf16 {
            println!("  {line}");
        }
    }

    println!();
    Ok(())
}

fn extract_prg_files(xgwx_path: &Path, out_dir: &Path) -> Result<(), String> {
    let bytes = fs::read(xgwx_path).map_err(|err| err.to_string())?;
    let xml = decode_xgwx_xml(&bytes)?;
    let programs = extract_program_blobs(&xml);

    fs::create_dir_all(out_dir).map_err(|err| err.to_string())?;

    println!("=== {} ===", xgwx_path.display());
    println!("extracting {} programs to {}", programs.len(), out_dir.display());

    for program in programs {
        let payload = decode_program_data_payload(&program.program_data_b64)?;
        let prg_bytes = build_prg_bytes(&program.name, &payload);
        let file_name = format!("{}.prg", sanitize_file_name(&program.name));
        let out_path = out_dir.join(file_name);
        fs::write(&out_path, prg_bytes).map_err(|err| err.to_string())?;
        println!("wrote: {} (payload {} bytes)", out_path.display(), payload.len());
    }

    println!();
    Ok(())
}

fn inspect_embedded_blob(tag: &str, b64_text: &str) -> Result<(), String> {
    let compact: String = b64_text.chars().filter(|c| !c.is_whitespace()).collect();
    println!("{tag}-base64-bytes: {}", compact.len());

    if compact.is_empty() {
        println!("{tag}-decoded: empty");
        return Ok(());
    }

    let raw = STANDARD
        .decode(compact)
        .map_err(|err| format!("{tag} base64 decode failed: {err}"))?;
    println!("{tag}-raw-bytes: {}", raw.len());
    println!("{tag}-raw-head: {}", hex_preview(&raw, 32));

    if raw.starts_with(b"BZh") {
        let decoded = bunzip2(&raw)?;
        println!("{tag}-bz2-decoded-bytes: {}", decoded.len());
        println!("{tag}-bz2-head: {}", hex_preview(&decoded, 48));

        let ascii = ascii_runs(&decoded, 4);
        if ascii.is_empty() {
            println!("{tag}-ascii-runs: none");
        } else {
            println!("{tag}-ascii-runs:");
            for line in ascii.into_iter().take(12) {
                println!("  {line}");
            }
        }
    }

    Ok(())
}

fn decode_xgwx_xml(bytes: &[u8]) -> Result<String, String> {
    let gzip_offset = find_signature(bytes, &[0x1f, 0x8b, 0x08])
        .ok_or_else(|| "gzip stream not found".to_string())?;
    println!("gzip-offset: 0x{gzip_offset:X}");
    let xml_bytes = gunzip(&bytes[gzip_offset..])?;
    String::from_utf8(xml_bytes).map_err(|err| err.to_string())
}

fn decode_program_data_payload(b64_text: &str) -> Result<Vec<u8>, String> {
    let compact: String = b64_text.chars().filter(|c| !c.is_whitespace()).collect();
    let raw = STANDARD
        .decode(compact)
        .map_err(|err| format!("program data base64 decode failed: {err}"))?;

    if raw.starts_with(b"BZh") {
        bunzip2(&raw)
    } else {
        Ok(raw)
    }
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

fn sanitize_file_name(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect()
}

fn find_prg_payload_offset(bytes: &[u8]) -> Result<usize, String> {
    let ld_ver = encode_utf16le("LD VER 1.1");
    let ld_pos = find_signature(bytes, &ld_ver)
        .ok_or_else(|| "LD VER 1.1 marker not found".to_string())?;
    let search_start = ld_pos + ld_ver.len();
    find_payload_offset(bytes, search_start)
        .ok_or_else(|| "payload zero-run not found after LD VER marker".to_string())
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

fn gunzip(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = GzDecoder::new(Cursor::new(bytes));
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|err| err.to_string())?;
    Ok(out)
}

fn bunzip2(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = BzDecoder::new(Cursor::new(bytes));
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|err| err.to_string())?;
    Ok(out)
}

fn find_signature(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn find_payload_offset(bytes: &[u8], search_start: usize) -> Option<usize> {
    for idx in search_start..bytes.len().saturating_sub(4) {
        if bytes[idx..].starts_with(&[0x00, 0x00, 0x00, 0x00])
            && bytes.get(idx + 4).copied().unwrap_or(0) != 0
        {
            return Some(idx);
        }
    }
    None
}

struct ProgramBlob {
    name: String,
    program_data_b64: String,
}

fn extract_program_blobs(xml: &str) -> Vec<ProgramBlob> {
    let mut programs = Vec::new();
    let mut cursor = 0;

    while let Some(rel_program_open) = xml[cursor..].find("<Program ") {
        let program_open = cursor + rel_program_open;
        let Some(rel_gt) = xml[program_open..].find('>') else { break; };
        let gt = program_open + rel_gt;
        let body_open = gt + 1;
        let Some(rel_body_tag) = xml[body_open..].find("<Body>") else { break; };
        let body_tag = body_open + rel_body_tag;
        let name = xml[body_open..body_tag].trim().to_string();

        let Some(rel_program_data_open) = xml[body_tag..].find("<ProgramData") else { break; };
        let program_data_open = body_tag + rel_program_data_open;
        let Some(rel_program_data_gt) = xml[program_data_open..].find('>') else { break; };
        let program_data_gt = program_data_open + rel_program_data_gt;
        let Some(rel_program_data_end) = xml[program_data_gt + 1..].find("</ProgramData>") else { break; };
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

fn extract_tag_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}");
    let start = xml.find(&open)?;
    let gt = xml[start..].find('>')? + start;
    let end = xml[gt + 1..].find(&format!("</{tag}>"))? + gt + 1;
    Some(xml[gt + 1..end].to_string())
}

fn extract_tag_attribute(xml: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{tag}");
    let start = xml.find(&open)?;
    let gt = xml[start..].find('>')? + start;
    let open_tag = &xml[start..=gt];

    for quote in ['"', '\''] {
        let pattern = format!("{attr}={quote}");
        if let Some(attr_start) = open_tag.find(&pattern) {
            let value_start = attr_start + pattern.len();
            if let Some(value_end_rel) = open_tag[value_start..].find(quote) {
                return Some(open_tag[value_start..value_start + value_end_rel].to_string());
            }
        }
    }

    None
}

struct TextRecord {
    file_offset: usize,
    payload_offset: usize,
    kind: String,
    class: String,
    text: String,
    prefix_hex: String,
    suffix_hex: String,
}

struct PayloadRecord {
    file_offset: usize,
    payload_offset: usize,
    opcode: u8,
    name: String,
    header_hex: String,
    text: Option<String>,
}

struct MarkerStringRecord {
    offset: usize,
    text: String,
    prefix_hex: String,
    suffix_hex: String,
}

fn extract_text_records(payload: &[u8], payload_offset: usize) -> Vec<TextRecord> {
    let mut records = Vec::new();
    let mut idx = 0;

    while idx + 4 <= payload.len() {
        if payload[idx..].starts_with(&[0xFF, 0xFE, 0xFF]) {
            let len = payload[idx + 3] as usize;
            let bytes_len = len * 2;
            let data_start = idx + 4;
            let data_end = data_start + bytes_len;
            if data_end <= payload.len() {
                let text = decode_utf16_lossy(&payload[data_start..data_end]);
                let trimmed = text.trim_matches('\u{0}').trim().to_string();
                if !trimmed.is_empty() {
                    let kind = if idx >= 1 {
                        format!("0x{:02X}", payload[idx - 1])
                    } else {
                        "n/a".to_string()
                    };
                    records.push(TextRecord {
                        file_offset: payload_offset + idx,
                        payload_offset: idx,
                        kind,
                        class: classify_text_record(&trimmed),
                        text: trimmed,
                        prefix_hex: hex_preview(&payload[idx.saturating_sub(16)..idx], 16),
                        suffix_hex: hex_preview(&payload[data_end..payload.len().min(data_end + 12)], 12),
                    });
                }
                idx = data_end;
                continue;
            }
        }

        idx += 1;
    }

    records
}

fn extract_payload_records(payload: &[u8], payload_offset: usize) -> Vec<PayloadRecord> {
    let mut records = Vec::new();
    let mut idx = 0;

    while idx + 1 < payload.len() {
        if payload[idx..].starts_with(&[0xFF, 0xFE, 0xFF]) {
            let len = payload.get(idx + 3).copied().unwrap_or(0) as usize;
            let next = idx.saturating_add(4).saturating_add(len * 2);
            idx = next.min(payload.len());
            continue;
        }

        if payload[idx] != 0xFF || payload[idx + 1] == 0xFE {
            idx += 1;
            continue;
        }

        let opcode = payload[idx + 1];
        let max_header_end = (idx + 32).min(payload.len());
        let mut header_end = max_header_end;
        let mut text = None;

        if let Some(rel_text) = find_signature(&payload[idx..max_header_end], &[0xFF, 0xFE, 0xFF]) {
            let text_pos = idx + rel_text;
            if text_pos > idx {
                header_end = text_pos;
                let len = payload.get(text_pos + 3).copied().unwrap_or(0) as usize;
                let data_start = text_pos + 4;
                let data_end = data_start + len * 2;
                if data_end <= payload.len() {
                    let decoded = decode_utf16_lossy(&payload[data_start..data_end]);
                    let trimmed = decoded.trim_matches('\u{0}').trim().to_string();
                    if !trimmed.is_empty() {
                        text = Some(trimmed);
                    }
                }
            }
        } else if let Some(rel_next) = payload[idx + 2..max_header_end].iter().position(|&b| b == 0xFF) {
            header_end = idx + 2 + rel_next;
        }

        records.push(PayloadRecord {
            file_offset: payload_offset + idx,
            payload_offset: idx,
            opcode,
            name: opcode_name(opcode).to_string(),
            header_hex: hex_preview(&payload[idx..header_end], header_end - idx),
            text,
        });

        idx += 1;
    }

    records
}

fn extract_marker_strings(bytes: &[u8]) -> Vec<MarkerStringRecord> {
    let mut records = Vec::new();
    let mut idx = 0;

    while idx + 4 <= bytes.len() {
        if bytes[idx..].starts_with(&[0xFF, 0xFE, 0xFF]) {
            let len = bytes[idx + 3] as usize;
            let data_start = idx + 4;
            let data_end = data_start + len * 2;
            if data_end <= bytes.len() {
                let decoded = decode_utf16_lossy(&bytes[data_start..data_end]);
                let text = decoded.trim_matches('\u{0}').trim().to_string();
                if !text.is_empty() {
                    records.push(MarkerStringRecord {
                        offset: idx,
                        text,
                        prefix_hex: hex_preview(&bytes[idx.saturating_sub(16)..idx], 16),
                        suffix_hex: hex_preview(
                            &bytes[data_end..bytes.len().min(data_end + 16)],
                            16,
                        ),
                    });
                }
                idx = data_end;
                continue;
            }
        }

        idx += 1;
    }

    records
}

fn decode_hex_string(hex: &str) -> Result<Vec<u8>, String> {
    let compact: String = hex.chars().filter(|c| !c.is_whitespace()).collect();
    if compact.len() % 2 != 0 {
        return Err("hex string length is odd".to_string());
    }

    compact
        .as_bytes()
        .chunks_exact(2)
        .map(|chunk| {
            let text = std::str::from_utf8(chunk).map_err(|err| err.to_string())?;
            u8::from_str_radix(text, 16).map_err(|err| err.to_string())
        })
        .collect()
}

fn classify_text_record(text: &str) -> String {
    if text.starts_with("[Rung") {
        return "rung-comment".to_string();
    }

    if text.contains(',') {
        return "mnemonic-call".to_string();
    }

    if matches!(text, "TON" | "TOFF" | "CTU" | "CTD" | "CTR" | "MOV" | "END") {
        return "mnemonic-name".to_string();
    }

    if is_device_text(text) {
        return "device".to_string();
    }

    "text".to_string()
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
        0x41 => "step-label",
        0x40 => "element-comment",
        0x43 => "rung-header",
        _ => "unknown",
    }
}

fn is_device_text(text: &str) -> bool {
    if text.len() < 2 {
        return false;
    }

    let mut chars = text.chars();
    let Some(first) = chars.next() else { return false; };
    if !matches!(first, 'P' | 'M' | 'F' | 'T' | 'C' | 'D' | 'K' | 'R' | 'N' | 'Z') {
        return false;
    }

    chars.all(|ch| ch.is_ascii_digit())
}

fn hex_preview(bytes: &[u8], limit: usize) -> String {
    bytes
        .iter()
        .take(limit)
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn ascii_runs(bytes: &[u8], min_len: usize) -> Vec<String> {
    let mut runs = Vec::new();
    let mut start = None;

    for (idx, byte) in bytes.iter().enumerate() {
        let is_printable = matches!(byte, 0x20..=0x7E);
        match (start, is_printable) {
            (None, true) => start = Some(idx),
            (Some(s), false) => {
                if idx - s >= min_len {
                    let text = String::from_utf8_lossy(&bytes[s..idx]).into_owned();
                    runs.push(format!("0x{s:X}: {text}"));
                }
                start = None;
            }
            _ => {}
        }
    }

    if let Some(s) = start {
        if bytes.len() - s >= min_len {
            let text = String::from_utf8_lossy(&bytes[s..]).into_owned();
            runs.push(format!("0x{s:X}: {text}"));
        }
    }

    runs
}

fn utf16_ascii_runs(bytes: &[u8], min_len: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut idx = 0;

    while idx + 1 < bytes.len() {
        let start = idx;
        let mut chars = String::new();

        while idx + 1 < bytes.len() {
            let word = u16::from_le_bytes([bytes[idx], bytes[idx + 1]]);
            let ch = char::from_u32(word as u32);
            match ch {
                Some(c) if c.is_ascii_graphic() || c == ' ' => {
                    chars.push(c);
                    idx += 2;
                }
                _ => break,
            }
        }

        if chars.len() >= min_len {
            out.push(format!("0x{start:X}: {chars}"));
        }

        idx = if idx == start { idx + 2 } else { idx + 2 };
    }

    out
}










