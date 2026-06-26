// 레지스터 ↔ 문자열 변환(UTF-8/ASCII/UTF-16, null 종료/바이트 한계 처리)

use crate::mapping::byte_order::{combine_bytes, split_register};
use crate::mapping::{ByteOrder, StringEncoding, StringMappingConfig};

// ─── Register ↔ String conversion ──────────────────────────────────────────

/// Reads a `String` from a slice of U16 registers using the given configuration.
///
/// The `registers` slice must contain the registers for this tag's mapping.
/// Byte order controls how each U16 is split into bytes for byte-oriented
/// encodings (UTF-8/ASCII). For UTF-16, each register is one code unit.
pub fn registers_to_string(
    registers: &[u16],
    byte_order: ByteOrder,
    config: &StringMappingConfig,
) -> Result<String, String> {
    if registers.is_empty() {
        return Ok(String::new());
    }

    match config.encoding {
        StringEncoding::Utf16 => {
            let mut code_units: Vec<u16> = Vec::with_capacity(registers.len());
            for &reg in registers {
                if config.null_terminated && reg == 0 {
                    break;
                }
                code_units.push(reg);
            }
            String::from_utf16(&code_units)
                .map_err(|e| format!("invalid UTF-16 in registers: {}", e))
        }
        encoding @ (StringEncoding::Utf8 | StringEncoding::Ascii) => {
            let max_bytes = config.effective_max_bytes(registers.len() as u16) as usize;
            let mut bytes: Vec<u8> = Vec::with_capacity(max_bytes);

            for &reg in registers {
                if bytes.len() >= max_bytes {
                    break;
                }
                let (b0, b1) = split_register(reg, byte_order);

                if config.null_terminated && b0 == 0 {
                    break;
                }
                bytes.push(b0);
                if bytes.len() >= max_bytes {
                    break;
                }

                if config.null_terminated && b1 == 0 {
                    break;
                }
                bytes.push(b1);
            }

            if encoding == StringEncoding::Ascii {
                if let Some(pos) = bytes.iter().position(|&b| b > 0x7F) {
                    return Err(format!(
                        "non-ASCII byte 0x{:02X} at position {}",
                        bytes[pos], pos
                    ));
                }
            }

            String::from_utf8(bytes).map_err(|e| format!("invalid UTF-8 in registers: {}", e))
        }
    }
}

/// Writes a `String` into a vec of U16 registers.
///
/// Returns a `Vec<u16>` of exactly `word_count` registers. If the string is
/// shorter than the available space, remaining registers are zero-filled.
pub fn string_to_registers(
    s: &str,
    word_count: u16,
    byte_order: ByteOrder,
    config: &StringMappingConfig,
) -> Result<Vec<u16>, String> {
    let wc = word_count as usize;
    if wc == 0 {
        return Err("wordCount must be >= 1".to_string());
    }

    match config.encoding {
        StringEncoding::Utf16 => {
            let code_units: Vec<u16> = s.encode_utf16().collect();
            let max_units = if config.null_terminated {
                wc.saturating_sub(1)
            } else {
                wc
            };

            if code_units.len() > max_units {
                return Err(format!(
                    "string requires {} UTF-16 code units but only {} slots available \
                     (wordCount={}, nullTerminated={})",
                    code_units.len(),
                    max_units,
                    word_count,
                    config.null_terminated
                ));
            }

            let mut regs = vec![0u16; wc];
            for (i, &cu) in code_units.iter().enumerate() {
                regs[i] = cu;
            }
            Ok(regs)
        }
        encoding @ (StringEncoding::Utf8 | StringEncoding::Ascii) => {
            let payload = s.as_bytes();
            let capacity = wc * 2;
            let max_bytes = config.effective_max_bytes(word_count) as usize;
            let usable = max_bytes.min(capacity);

            if encoding == StringEncoding::Ascii {
                if let Some(pos) = payload.iter().position(|&b| b > 0x7F) {
                    return Err(format!(
                        "non-ASCII byte 0x{:02X} at position {}",
                        payload[pos], pos
                    ));
                }
            }

            let effective_limit = if config.null_terminated {
                usable.saturating_sub(1)
            } else {
                usable
            };

            if payload.len() > effective_limit {
                return Err(format!(
                    "string is {} bytes but only {} available \
                     (maxBytes={}, nullTerminated={})",
                    payload.len(),
                    effective_limit,
                    usable,
                    config.null_terminated
                ));
            }

            let mut buf = vec![0u8; capacity];
            buf[..payload.len()].copy_from_slice(payload);

            let mut regs = Vec::with_capacity(wc);
            for chunk in buf.chunks(2) {
                let b0 = chunk[0];
                let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
                regs.push(combine_bytes(b0, b1, byte_order));
            }
            Ok(regs)
        }
    }
}
