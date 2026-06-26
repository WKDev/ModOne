//! OPC UA data type mapping layer.
//!
//! Converts between PLC core types ([`CanonicalValue`] Bool/U16) and all OPC UA
//! standard basic types. Each tag can carry its own [`OpcUaMappingConfig`] that
//! specifies the target OPC UA data type, register span (word count), byte
//! order, access level, and an optional description.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use modone_contract::CanonicalAddress;

/// All OPC UA standard basic data types that the mapping layer can expose.
///
/// The PLC core stores only `Bool` and `U16` registers.  This enum describes
/// the *presented* type on the OPC UA side — the mapping layer handles the
/// conversion between the canonical register(s) and the wider type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OpcUaDataType {
    /// OPC UA Boolean — maps 1:1 to `CanonicalValue::Bool`.
    Boolean,
    /// OPC UA SByte (Int8) — stored in the low byte of a single U16 register.
    SByte,
    /// OPC UA Byte (UInt8) — stored in the low byte of a single U16 register.
    Byte,
    /// OPC UA Int16 — reinterpret a single U16 register as signed.
    Int16,
    /// OPC UA UInt16 — direct pass-through of a single U16 register.
    UInt16,
    /// OPC UA Int32 — two consecutive U16 registers reinterpreted as signed 32-bit.
    Int32,
    /// OPC UA UInt32 — two consecutive U16 registers as unsigned 32-bit.
    UInt32,
    /// OPC UA Int64 — four consecutive U16 registers as signed 64-bit.
    Int64,
    /// OPC UA UInt64 — four consecutive U16 registers as unsigned 64-bit.
    UInt64,
    /// OPC UA Float (IEEE 754 single) — two consecutive U16 registers.
    Float,
    /// OPC UA Double (IEEE 754 double) — four consecutive U16 registers.
    Double,
    /// OPC UA String — variable-length UTF-8, word count determines max length.
    String,
}

impl OpcUaDataType {
    /// Returns the minimum number of U16 registers required to represent this type.
    pub fn default_word_count(&self) -> u16 {
        match self {
            Self::Boolean => 1,
            Self::SByte | Self::Byte => 1,
            Self::Int16 | Self::UInt16 => 1,
            Self::Int32 | Self::UInt32 => 2,
            Self::Int64 | Self::UInt64 => 4,
            Self::Float => 2,
            Self::Double => 4,
            Self::String => 1, // caller must set actual word count
        }
    }

    /// Returns `true` when the type maps from a boolean canonical value rather
    /// than U16 register(s).
    pub fn is_bool_type(&self) -> bool {
        matches!(self, Self::Boolean)
    }
}

impl std::fmt::Display for OpcUaDataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Boolean => "Boolean",
            Self::SByte => "SByte",
            Self::Byte => "Byte",
            Self::Int16 => "Int16",
            Self::UInt16 => "UInt16",
            Self::Int32 => "Int32",
            Self::UInt32 => "UInt32",
            Self::Int64 => "Int64",
            Self::UInt64 => "UInt64",
            Self::Float => "Float",
            Self::Double => "Double",
            Self::String => "String",
        };
        write!(f, "{}", name)
    }
}

/// Byte order used when assembling multi-register values.
///
/// Determines the order in which consecutive U16 registers are combined into
/// wider types (32-bit, 64-bit, etc.).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ByteOrder {
    /// Big-endian (most-significant word first) — default for most PLCs.
    BigEndian,
    /// Little-endian (least-significant word first).
    LittleEndian,
    /// Big-endian with swapped adjacent words (BA-DC pattern).
    BigEndianWordSwap,
    /// Little-endian with swapped adjacent words (CD-AB pattern).
    LittleEndianWordSwap,
}

impl Default for ByteOrder {
    fn default() -> Self {
        Self::BigEndian
    }
}

impl std::fmt::Display for ByteOrder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::BigEndian => "BigEndian",
            Self::LittleEndian => "LittleEndian",
            Self::BigEndianWordSwap => "BigEndianWordSwap",
            Self::LittleEndianWordSwap => "LittleEndianWordSwap",
        };
        write!(f, "{}", name)
    }
}

/// Access level exposed on the OPC UA side for a mapped tag.
///
/// This is separate from [`crate::address_space_spec::OpcUaAccessLevel`] because the
/// mapping config is independent of the address-space builder and can be
/// serialized/deserialized as part of project configuration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MappingAccessLevel {
    /// Read-only — OPC UA clients may read but not write.
    ReadOnly,
    /// Read-write — OPC UA clients may both read and write.
    ReadWrite,
}

impl Default for MappingAccessLevel {
    fn default() -> Self {
        Self::ReadOnly
    }
}

impl std::fmt::Display for MappingAccessLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ReadOnly => write!(f, "ReadOnly"),
            Self::ReadWrite => write!(f, "ReadWrite"),
        }
    }
}

/// Per-tag OPC UA mapping configuration.
///
/// Describes how a PLC register range (addressed by `deviceAddress`) is
/// converted to/from an OPC UA typed value. The `deviceAddress` field on the
/// tag definition remains the single source of truth for register location —
/// this struct only controls *type interpretation*.
///
/// # Default Generation
///
/// When no explicit config is provided, [`OpcUaMappingConfig::default_for_bool`]
/// or [`OpcUaMappingConfig::default_for_word`] auto-generates a safe default
/// based on the `is_bool` flag:
///
/// - `is_bool == true`  → `Boolean`, wordCount=1, BigEndian, ReadOnly
/// - `is_bool == false` → `UInt16`,  wordCount=1, BigEndian, ReadOnly
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpcUaMappingConfig {
    /// Target OPC UA data type for this tag.
    pub opcua_data_type: OpcUaDataType,

    /// Number of consecutive U16 registers consumed by this mapping.
    /// Must be ≥ the type's [`OpcUaDataType::default_word_count`].
    pub word_count: u16,

    /// Byte (word) order for multi-register assembly.
    pub byte_order: ByteOrder,

    /// OPC UA access level for this tag.
    pub access_level: MappingAccessLevel,

    /// Optional human-readable description exposed as the OPC UA node
    /// Description attribute.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Optional string-specific configuration.
    ///
    /// Only meaningful when `opcua_data_type` is [`OpcUaDataType::String`].
    /// Contains encoding, max byte length, null termination, and the
    /// user-specified maximum register count (`maxStringLength`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub string_config: Option<StringMappingConfig>,
}

impl OpcUaMappingConfig {
    /// Creates the default mapping config for a boolean tag.
    pub fn default_for_bool() -> Self {
        Self {
            opcua_data_type: OpcUaDataType::Boolean,
            word_count: 1,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        }
    }

    /// Creates the default mapping config for a word (U16) tag.
    pub fn default_for_word() -> Self {
        Self {
            opcua_data_type: OpcUaDataType::UInt16,
            word_count: 1,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        }
    }

    /// Auto-generates a default mapping config based on the `is_bool` flag.
    ///
    /// This is the primary entry point for generating defaults when an explicit
    /// mapping config is absent from the tag definition.
    pub fn default_from_is_bool(is_bool: bool) -> Self {
        if is_bool {
            Self::default_for_bool()
        } else {
            Self::default_for_word()
        }
    }

    /// Auto-generates a default mapping config for a given canonical address.
    ///
    /// Uses [`crate::address_space_spec::is_bool_address`] to detect whether the
    /// address is boolean, then delegates to [`Self::default_from_is_bool`].
    ///
    /// This is the primary entry point called during tag creation when no
    /// explicit `OpcUaMappingConfig` is provided.
    pub fn default_for_address(address: CanonicalAddress) -> Self {
        let is_bool = crate::address_space_spec::is_bool_address(address);
        Self::default_from_is_bool(is_bool)
    }


    /// Validates that the word_count is sufficient for the chosen data type.
    ///
    /// Returns `Ok(())` when valid, or an error message describing the problem.
    ///
    /// For `String` types, also validates the [`StringMappingConfig`] if present,
    /// including the `maxStringLength` register-count constraint.
    pub fn validate(&self) -> Result<(), String> {
        let min = self.opcua_data_type.default_word_count();
        if self.word_count < min {
            return Err(format!(
                "wordCount {} is too small for {}; minimum is {}",
                self.word_count, self.opcua_data_type, min
            ));
        }
        if self.opcua_data_type == OpcUaDataType::Boolean && self.word_count != 1 {
            return Err("Boolean mapping must have wordCount=1".to_string());
        }
        // Validate string-specific config when data type is String
        if self.opcua_data_type == OpcUaDataType::String {
            if let Some(ref sc) = self.string_config {
                sc.validate(self.word_count)?;
            }
        }
        // Warn if string_config is set on a non-String type (not an error, but ignored)
        Ok(())
    }

    /// Creates a String mapping config with the specified register count.
    ///
    /// This is the primary way for users to create a String-typed mapping with
    /// a specific maximum register allocation. The `max_string_length` field
    /// constrains the register count.
    ///
    /// # Arguments
    ///
    /// * `word_count` — Number of U16 registers to allocate for this string.
    /// * `max_string_length` — Maximum allowed register count (must be ≥ `word_count`).
    /// * `string_config` — Optional detailed string configuration (encoding, null termination, etc.).
    ///   If `None`, defaults are used with `max_string_length` set.
    pub fn string_with_max_length(word_count: u16, max_string_length: u16) -> Self {
        Self {
            opcua_data_type: OpcUaDataType::String,
            word_count,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig {
                max_string_length: Some(max_string_length),
                ..Default::default()
            }),
        }
    }
}

/// Character encoding used for String-type register mappings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StringEncoding {
    /// UTF-8 encoded bytes packed into U16 registers (2 bytes per register).
    Utf8,
    /// 7-bit ASCII packed into U16 registers (2 characters per register).
    Ascii,
    /// UTF-16 code units stored one per U16 register.
    Utf16,
}

impl Default for StringEncoding {
    fn default() -> Self {
        Self::Utf8
    }
}

impl std::fmt::Display for StringEncoding {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Utf8 => write!(f, "UTF-8"),
            Self::Ascii => write!(f, "ASCII"),
            Self::Utf16 => write!(f, "UTF-16"),
        }
    }
}

/// Configuration specific to [`OpcUaDataType::String`] mappings.
///
/// Controls how a span of U16 registers is interpreted as a string value,
/// including character encoding, maximum byte length, and null-termination
/// handling.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StringMappingConfig {
    /// Character encoding for the register byte payload.
    #[serde(default)]
    pub encoding: StringEncoding,

    /// Maximum *byte* length of the encoded string (must be ≤ `word_count * 2`).
    /// When `None`, defaults to `word_count * 2` (fill all registers).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_byte_length: Option<u16>,

    /// Whether the string in registers is null-terminated.
    ///
    /// When `true` (default), reading stops at the first `0x00` byte (UTF-8 /
    /// ASCII) or `0x0000` word (UTF-16), and writing appends a null terminator
    /// if space permits.
    #[serde(default = "default_true")]
    pub null_terminated: bool,

    /// User-specified maximum register count for this string mapping.
    ///
    /// When set, this constrains the number of U16 registers allocated for the
    /// string. The parent [`OpcUaMappingConfig::word_count`] must be ≤ this
    /// value. This field is the user-facing way to say "this string tag should
    /// use at most N registers".
    ///
    /// When `None`, there is no additional register-count constraint beyond
    /// what `word_count` already provides.
    ///
    /// # Serialization
    ///
    /// Serialized as `"maxStringLength"` in JSON (camelCase).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_string_length: Option<u16>,
}

fn default_true() -> bool {
    true
}

impl Default for StringMappingConfig {
    fn default() -> Self {
        Self {
            encoding: StringEncoding::default(),
            max_byte_length: None,
            null_terminated: true,
            max_string_length: None,
        }
    }
}

impl StringMappingConfig {
    /// Effective maximum byte length for the string payload.
    pub fn effective_max_bytes(&self, word_count: u16) -> u16 {
        self.max_byte_length.unwrap_or(word_count * 2)
    }

    /// Validates the string-specific configuration against the parent word count.
    pub fn validate(&self, word_count: u16) -> Result<(), String> {
        if word_count == 0 {
            return Err("String mapping requires wordCount >= 1".to_string());
        }
        // Validate maxStringLength constraints
        if let Some(max_regs) = self.max_string_length {
            if max_regs == 0 {
                return Err("maxStringLength must be > 0".to_string());
            }
            if word_count > max_regs {
                return Err(format!(
                    "wordCount {} exceeds maxStringLength {} registers",
                    word_count, max_regs
                ));
            }
        }
        let capacity = word_count as u32 * 2;
        if let Some(max_bytes) = self.max_byte_length {
            if max_bytes as u32 > capacity {
                return Err(format!(
                    "maxByteLength {} exceeds register capacity {} (wordCount={} \u{00d7} 2)",
                    max_bytes, capacity, word_count
                ));
            }
            if max_bytes == 0 {
                return Err("maxByteLength must be > 0".to_string());
            }
        }
        Ok(())
    }

    /// Returns the effective word count, clamped by `max_string_length` if set.
    ///
    /// When `max_string_length` is `Some(n)`, returns `min(word_count, n)`.
    /// Otherwise returns `word_count` unchanged.
    pub fn effective_word_count(&self, word_count: u16) -> u16 {
        match self.max_string_length {
            Some(max_regs) => word_count.min(max_regs),
            None => word_count,
        }
    }
}

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

/// Splits a U16 register into two bytes according to byte order.
/// Returns `(first_byte, second_byte)` where "first" is the byte at
/// the lower string offset.
fn split_register(reg: u16, byte_order: ByteOrder) -> (u8, u8) {
    match byte_order {
        ByteOrder::BigEndian | ByteOrder::BigEndianWordSwap => {
            ((reg >> 8) as u8, (reg & 0xFF) as u8)
        }
        ByteOrder::LittleEndian | ByteOrder::LittleEndianWordSwap => {
            ((reg & 0xFF) as u8, (reg >> 8) as u8)
        }
    }
}

/// Combines two bytes into a U16 register according to byte order.
/// `b0` is the first character byte (lower string offset).
fn combine_bytes(b0: u8, b1: u8, byte_order: ByteOrder) -> u16 {
    match byte_order {
        ByteOrder::BigEndian | ByteOrder::BigEndianWordSwap => {
            ((b0 as u16) << 8) | (b1 as u16)
        }
        ByteOrder::LittleEndian | ByteOrder::LittleEndianWordSwap => {
            ((b1 as u16) << 8) | (b0 as u16)
        }
    }
}

impl Default for OpcUaMappingConfig {
    /// Defaults to UInt16, wordCount=1, BigEndian, ReadOnly (same as `default_for_word`).
    fn default() -> Self {
        Self::default_for_word()
    }
}

// ─── RegisterRange — deviceAddress as single source of truth ───────────────

/// A contiguous range of register addresses derived from a base
/// [`CanonicalAddress`] (the tag's `deviceAddress`) plus a `word_count`.
///
/// The `deviceAddress` on the tag is the **single source of truth** for
/// register location.  [`OpcUaMappingConfig`] supplies only the
/// *interpretation* (data type, byte order, access level) and the number of
/// consecutive registers (`word_count`).  This struct materialises the
/// resulting address span so that the bridge / adapter layers can read or
/// write the correct slice of PLC memory.
///
/// For boolean mappings (`word_count == 1`, bool area) the range is a single
/// register or bit.  For multi-word types (Int32, Float, Double, etc.) the
/// range covers `word_count` consecutive registers starting at
/// `device_address.index`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegisterRange {
    /// Memory area of the registers.
    pub area: modone_contract::CanonicalAreaKind,
    /// Start index (inclusive) — copied directly from `deviceAddress.index`.
    pub start_index: u32,
    /// Number of consecutive U16 registers in this range.
    pub word_count: u16,
    /// Optional bit index within the first register (for boolean bit access).
    pub bit_index: Option<u8>,
}

impl RegisterRange {
    /// End index (exclusive): `start_index + word_count`.
    pub fn end_index(&self) -> u32 {
        self.start_index + self.word_count as u32
    }

    /// Returns the sequence of [`CanonicalAddress`]es covered by this range.
    ///
    /// For a single-register boolean with a `bit_index`, the iterator yields
    /// exactly one address with that bit index.  For multi-register word
    /// mappings, it yields `word_count` addresses with consecutive indices and
    /// no bit index.
    pub fn addresses(&self) -> Vec<CanonicalAddress> {
        if let Some(bit) = self.bit_index {
            // Boolean bit access — single address
            vec![CanonicalAddress::with_bit_index(
                self.area,
                self.start_index,
                bit,
            )]
        } else {
            (0..self.word_count as u32)
                .map(|offset| CanonicalAddress::new(self.area, self.start_index + offset))
                .collect()
        }
    }

    /// Returns `true` when the range covers exactly one register or bit.
    pub fn is_single(&self) -> bool {
        self.word_count == 1
    }

    /// Returns `true` when `other` overlaps with this range in the same area.
    ///
    /// Useful for detecting conflicting mappings or validating that two tags
    /// do not claim the same physical registers.
    pub fn overlaps(&self, other: &RegisterRange) -> bool {
        if self.area != other.area {
            return false;
        }
        self.start_index < other.end_index() && other.start_index < self.end_index()
    }

    /// Validates that this range fits within the memory area's default size.
    ///
    /// Returns `Err` if `start_index + word_count` would exceed the area's
    /// `default_size()`.
    pub fn validate_bounds(&self) -> Result<(), String> {
        let area_size = self.area.default_size() as u32;
        let end = self.end_index();
        if end > area_size {
            return Err(format!(
                "register range [{}, {}) exceeds {:?} area size {}",
                self.start_index, end, self.area, area_size,
            ));
        }
        Ok(())
    }
}

impl OpcUaMappingConfig {
    /// Derives the [`RegisterRange`] for a tag given its `deviceAddress`.
    ///
    /// The `device_address` (a [`CanonicalAddress`]) is the **single source of
    /// truth** for register location. This method combines it with the
    /// mapping's `word_count` to produce the concrete register span.
    ///
    /// # Example
    ///
    /// ```ignore
    /// let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
    /// let cfg = OpcUaMappingConfig {
    ///     opcua_data_type: OpcUaDataType::Int32,
    ///     word_count: 2,
    ///     ..Default::default()
    /// };
    /// let range = cfg.register_range(addr);
    /// assert_eq!(range.start_index, 100);
    /// assert_eq!(range.end_index(), 102);
    /// ```
    pub fn register_range(&self, device_address: CanonicalAddress) -> RegisterRange {
        RegisterRange {
            area: device_address.area,
            start_index: device_address.index,
            word_count: self.word_count,
            bit_index: device_address.bit_index,
        }
    }

    /// Derives and validates the [`RegisterRange`] for a tag.
    ///
    /// Combines [`Self::register_range`] with [`Self::validate`] and
    /// [`RegisterRange::validate_bounds`] to ensure the mapping is fully
    /// consistent and fits within PLC memory.
    pub fn validated_register_range(
        &self,
        device_address: CanonicalAddress,
    ) -> Result<RegisterRange, String> {
        self.validate()?;
        let range = self.register_range(device_address);
        range.validate_bounds()?;
        Ok(range)
    }
}

// ─── OpcUaMappingStore ─────────────────────────────────────────────────────

/// Thread-safe store for per-tag [`OpcUaMappingConfig`] entries.
///
/// Maps `tag_id → OpcUaMappingConfig`, providing insert/get/remove/clear
/// operations. When a tag is deleted from the [`TagRegistry`], the
/// corresponding entry must also be removed from this store to maintain
/// consistency.
///
/// The store is designed to be shared across threads via [`SharedMappingStore`].
#[derive(Debug, Default)]
pub struct OpcUaMappingStore {
    configs: RwLock<HashMap<String, OpcUaMappingConfig>>,
}

/// Shared, thread-safe handle to an [`OpcUaMappingStore`].
pub type SharedMappingStore = Arc<OpcUaMappingStore>;

impl OpcUaMappingStore {
    /// Creates a new empty store.
    pub fn new() -> Self {
        Self {
            configs: RwLock::new(HashMap::new()),
        }
    }

    /// Inserts or replaces the mapping config for the given tag.
    ///
    /// Returns the previous config if one existed.
    pub fn insert(&self, tag_id: String, config: OpcUaMappingConfig) -> Option<OpcUaMappingConfig> {
        self.configs.write().insert(tag_id, config)
    }

    /// Returns the mapping config for the given tag, if present.
    pub fn get(&self, tag_id: &str) -> Option<OpcUaMappingConfig> {
        self.configs.read().get(tag_id).cloned()
    }

    /// Removes the mapping config for the given tag.
    ///
    /// Returns the removed config, or `None` if no entry existed.
    /// This should be called whenever a tag is deleted from the tag registry
    /// to keep the store synchronized.
    pub fn remove(&self, tag_id: &str) -> Option<OpcUaMappingConfig> {
        self.configs.write().remove(tag_id)
    }

    /// Removes mapping configs for multiple tags in a single lock acquisition.
    ///
    /// Returns the tag IDs that had configs removed. Useful for batch tag
    /// deletion to minimize lock contention.
    pub fn remove_many(&self, tag_ids: &[String]) -> Vec<String> {
        let mut configs = self.configs.write();
        let mut removed = Vec::new();
        for tag_id in tag_ids {
            if configs.remove(tag_id).is_some() {
                removed.push(tag_id.clone());
            }
        }
        removed
    }

    /// Returns `true` if the store contains a mapping config for the given tag.
    pub fn contains(&self, tag_id: &str) -> bool {
        self.configs.read().contains_key(tag_id)
    }

    /// Returns the number of mapping configs currently stored.
    pub fn len(&self) -> usize {
        self.configs.read().len()
    }

    /// Returns `true` if the store contains no mapping configs.
    pub fn is_empty(&self) -> bool {
        self.configs.read().is_empty()
    }

    /// Removes all mapping configs from the store.
    pub fn clear(&self) {
        self.configs.write().clear();
    }

    /// Returns a snapshot of all stored configs as a `HashMap`.
    ///
    /// Useful for serialization and bulk operations.
    pub fn snapshot(&self) -> HashMap<String, OpcUaMappingConfig> {
        self.configs.read().clone()
    }

    /// Replaces all entries from a `HashMap`.
    ///
    /// Useful for deserialization / bulk restore.
    pub fn load_from(&self, configs: HashMap<String, OpcUaMappingConfig>) {
        *self.configs.write() = configs;
    }

    /// Returns a list of all tag IDs that have mapping configs.
    pub fn tag_ids(&self) -> Vec<String> {
        self.configs.read().keys().cloned().collect()
    }
}

// ---------------------------------------------------------------------------
// Register ↔ typed-value conversion layer
// ---------------------------------------------------------------------------

/// A mapped OPC UA value produced from raw U16 register(s).
///
/// This is the intermediate representation used between the PLC canonical
/// memory (Bool / U16 registers) and OPC UA `Variant` construction.
#[derive(Debug, Clone, PartialEq)]
pub enum MappedValue {
    Boolean(bool),
    SByte(i8),
    Byte(u8),
    Int16(i16),
    UInt16(u16),
    Int32(i32),
    UInt32(u32),
    Int64(i64),
    UInt64(u64),
    Float(f32),
    Double(f64),
    String(std::string::String),
}

/// Errors that can occur during register ↔ typed-value conversion.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MappingError {
    /// Not enough registers supplied for the configured data type.
    InsufficientRegisters { expected: usize, actual: usize },
    /// The data type is not yet supported by this conversion path.
    UnsupportedType(OpcUaDataType),
    /// The MappedValue variant does not match the config's data type.
    TypeMismatch {
        type_name: &'static str,
        detail: std::string::String,
    },
    /// Boolean mapping requires a bool canonical value, not registers.
    BooleanTypeMismatch,
}

impl std::fmt::Display for MappingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InsufficientRegisters { expected, actual } => {
                write!(f, "need {} registers but got {}", expected, actual)
            }
            Self::UnsupportedType(dt) => write!(f, "unsupported data type: {}", dt),
            Self::TypeMismatch { type_name, detail } => {
                write!(f, "type mismatch for {}: {}", type_name, detail)
            }
            Self::BooleanTypeMismatch => {
                write!(f, "Boolean type requires a bool value, not U16 registers")
            }
        }
    }
}

impl std::error::Error for MappingError {}

// ---------------------------------------------------------------------------
// Byte-order helpers: arrange U16 registers into a canonical word array
// ---------------------------------------------------------------------------

impl ByteOrder {
    /// Reorder a slice of U16 registers into *logical* order (MSW first)
    /// according to this byte order.
    ///
    /// The returned `Vec` always has most-significant word at index 0.
    /// Input `regs` are in address order (register N, N+1, …).
    pub fn to_logical_order(&self, regs: &[u16]) -> Vec<u16> {
        match self {
            ByteOrder::BigEndian => regs.to_vec(),
            ByteOrder::LittleEndian => {
                let mut v = regs.to_vec();
                v.reverse();
                v
            }
            // Big-endian but adjacent word-pairs are swapped (AB-CD → BA-DC).
            ByteOrder::BigEndianWordSwap => {
                let mut v = regs.to_vec();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }
            // Little-endian but adjacent word-pairs are swapped (CD-AB → DC-BA).
            ByteOrder::LittleEndianWordSwap => {
                let mut v = regs.to_vec();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v.reverse();
                v
            }
        }
    }

    /// Convert a logical-order word array (MSW first) back into address-order
    /// registers according to this byte order.
    pub fn from_logical_order(&self, logical: &[u16]) -> Vec<u16> {
        match self {
            ByteOrder::BigEndian => logical.to_vec(),
            ByteOrder::LittleEndian => {
                let mut v = logical.to_vec();
                v.reverse();
                v
            }
            ByteOrder::BigEndianWordSwap => {
                let mut v = logical.to_vec();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }
            ByteOrder::LittleEndianWordSwap => {
                let mut v = logical.to_vec();
                v.reverse();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Core conversion: registers → MappedValue (read path)
// ---------------------------------------------------------------------------

/// Read U16 register(s) and produce a [`MappedValue`] according to the
/// mapping config.
///
/// `regs` must contain at least `config.opcua_data_type.default_word_count()`
/// elements in address order. Only the first N required words are consumed.
/// For String types, `config.word_count` registers are expected instead, since
/// the string length is user-specified.
///
/// For `Boolean` type, use [`read_bool_mapped`] instead.
pub fn read_registers_to_mapped(
    config: &OpcUaMappingConfig,
    regs: &[u16],
) -> Result<MappedValue, MappingError> {
    // For String types, use the configured word_count (user-specified register count).
    // For all other types, use the type's default_word_count.
    let needed = if config.opcua_data_type == OpcUaDataType::String {
        config.word_count as usize
    } else {
        config.opcua_data_type.default_word_count() as usize
    };
    if regs.len() < needed {
        return Err(MappingError::InsufficientRegisters {
            expected: needed,
            actual: regs.len(),
        });
    }
    let regs = &regs[..needed];

    match config.opcua_data_type {
        OpcUaDataType::Boolean => Err(MappingError::BooleanTypeMismatch),

        // --- 8-bit types (single register, low byte) ---
        OpcUaDataType::SByte => {
            let raw = regs[0] & 0xFF;
            Ok(MappedValue::SByte(raw as u8 as i8))
        }
        OpcUaDataType::Byte => {
            let raw = regs[0] & 0xFF;
            Ok(MappedValue::Byte(raw as u8))
        }

        // --- 16-bit types (single register) ---
        OpcUaDataType::Int16 => Ok(MappedValue::Int16(regs[0] as i16)),
        OpcUaDataType::UInt16 => Ok(MappedValue::UInt16(regs[0])),

        // --- 32-bit integer types (2 registers) ---
        OpcUaDataType::Int32 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u32) << 16) | (words[1] as u32);
            Ok(MappedValue::Int32(raw as i32))
        }
        OpcUaDataType::UInt32 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u32) << 16) | (words[1] as u32);
            Ok(MappedValue::UInt32(raw))
        }

        // --- 64-bit integer types (4 registers) ---
        OpcUaDataType::Int64 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u64) << 48)
                | ((words[1] as u64) << 32)
                | ((words[2] as u64) << 16)
                | (words[3] as u64);
            Ok(MappedValue::Int64(raw as i64))
        }
        OpcUaDataType::UInt64 => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u64) << 48)
                | ((words[1] as u64) << 32)
                | ((words[2] as u64) << 16)
                | (words[3] as u64);
            Ok(MappedValue::UInt64(raw))
        }

        // --- IEEE 754 floating-point types ---
        OpcUaDataType::Float => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u32) << 16) | (words[1] as u32);
            Ok(MappedValue::Float(f32::from_bits(raw)))
        }
        OpcUaDataType::Double => {
            let words = config.byte_order.to_logical_order(regs);
            let raw = ((words[0] as u64) << 48)
                | ((words[1] as u64) << 32)
                | ((words[2] as u64) << 16)
                | (words[3] as u64);
            Ok(MappedValue::Double(f64::from_bits(raw)))
        }

        // String — uses string_config from the mapping config
        OpcUaDataType::String => {
            let sc = config.string_config.as_ref().cloned().unwrap_or_default();
            let effective_wc = sc.effective_word_count(config.word_count) as usize;
            let slice = if regs.len() >= effective_wc {
                &regs[..effective_wc]
            } else {
                regs
            };
            registers_to_string(slice, config.byte_order, &sc)
                .map(MappedValue::String)
                .map_err(|e| MappingError::TypeMismatch {
                    type_name: "String",
                    detail: e,
                })
        }
    }
}

/// Convenience: read a boolean canonical value as a [`MappedValue::Boolean`].
pub fn read_bool_mapped(value: bool) -> MappedValue {
    MappedValue::Boolean(value)
}

// ---------------------------------------------------------------------------
// Core conversion: MappedValue → registers (write path)
// ---------------------------------------------------------------------------

/// Convert a [`MappedValue`] back into U16 register(s) in address order
/// according to the mapping config's byte order.
///
/// Returns a `Vec<u16>` with exactly `default_word_count()` elements.
///
/// For `Boolean` type, use [`write_bool_mapped`] instead.
pub fn write_mapped_to_registers(
    config: &OpcUaMappingConfig,
    value: &MappedValue,
) -> Result<Vec<u16>, MappingError> {
    match (config.opcua_data_type, value) {
        (OpcUaDataType::Boolean, _) => Err(MappingError::BooleanTypeMismatch),

        // --- 8-bit types ---
        (OpcUaDataType::SByte, MappedValue::SByte(v)) => Ok(vec![(*v as u8) as u16]),
        (OpcUaDataType::Byte, MappedValue::Byte(v)) => Ok(vec![*v as u16]),

        // --- 16-bit types ---
        (OpcUaDataType::Int16, MappedValue::Int16(v)) => Ok(vec![*v as u16]),
        (OpcUaDataType::UInt16, MappedValue::UInt16(v)) => Ok(vec![*v]),

        // --- 32-bit integer types ---
        (OpcUaDataType::Int32, MappedValue::Int32(v)) => {
            let raw = *v as u32;
            let logical = [(raw >> 16) as u16, raw as u16];
            Ok(config.byte_order.from_logical_order(&logical))
        }
        (OpcUaDataType::UInt32, MappedValue::UInt32(v)) => {
            let logical = [(*v >> 16) as u16, *v as u16];
            Ok(config.byte_order.from_logical_order(&logical))
        }

        // --- 64-bit integer types ---
        (OpcUaDataType::Int64, MappedValue::Int64(v)) => {
            let raw = *v as u64;
            let logical = [
                (raw >> 48) as u16,
                (raw >> 32) as u16,
                (raw >> 16) as u16,
                raw as u16,
            ];
            Ok(config.byte_order.from_logical_order(&logical))
        }
        (OpcUaDataType::UInt64, MappedValue::UInt64(v)) => {
            let logical = [
                (*v >> 48) as u16,
                (*v >> 32) as u16,
                (*v >> 16) as u16,
                *v as u16,
            ];
            Ok(config.byte_order.from_logical_order(&logical))
        }

        // --- IEEE 754 floating-point types ---
        (OpcUaDataType::Float, MappedValue::Float(v)) => {
            let bits = v.to_bits();
            let logical = [(bits >> 16) as u16, bits as u16];
            Ok(config.byte_order.from_logical_order(&logical))
        }
        (OpcUaDataType::Double, MappedValue::Double(v)) => {
            let bits = v.to_bits();
            let logical = [
                (bits >> 48) as u16,
                (bits >> 32) as u16,
                (bits >> 16) as u16,
                bits as u16,
            ];
            Ok(config.byte_order.from_logical_order(&logical))
        }

        // String — uses string_config from the mapping config
        (OpcUaDataType::String, MappedValue::String(s)) => {
            let sc = config.string_config.as_ref().cloned().unwrap_or_default();
            let effective_wc = sc.effective_word_count(config.word_count);
            string_to_registers(s, effective_wc, config.byte_order, &sc)
                .map_err(|e| MappingError::TypeMismatch {
                    type_name: "String",
                    detail: e,
                })
        }

        // Type mismatch between config data type and provided MappedValue variant
        (dt, val) => Err(MappingError::TypeMismatch {
            type_name: match dt {
                OpcUaDataType::SByte => "SByte",
                OpcUaDataType::Byte => "Byte",
                OpcUaDataType::Int16 => "Int16",
                OpcUaDataType::UInt16 => "UInt16",
                OpcUaDataType::Int32 => "Int32",
                OpcUaDataType::UInt32 => "UInt32",
                OpcUaDataType::Int64 => "Int64",
                OpcUaDataType::UInt64 => "UInt64",
                OpcUaDataType::Float => "Float",
                OpcUaDataType::Double => "Double",
                _ => "Unknown",
            },
            detail: format!("expected matching MappedValue variant, got {:?}", val),
        }),
    }
}

/// Convenience: extract a boolean from a [`MappedValue::Boolean`].
pub fn write_bool_mapped(value: &MappedValue) -> Result<bool, MappingError> {
    match value {
        MappedValue::Boolean(v) => Ok(*v),
        _ => Err(MappingError::BooleanTypeMismatch),
    }
}

// ---------------------------------------------------------------------------
// Standalone IEEE 754 Float / Double ↔ U16 register helpers
// ---------------------------------------------------------------------------

/// Reads an IEEE 754 **single-precision** (32-bit) float from two U16
/// registers, respecting the given byte order.
///
/// This is a lower-level helper; prefer [`read_registers_to_mapped`] with a
/// `Float` config for the full mapping pipeline.
pub fn registers_to_f32(regs: &[u16], byte_order: ByteOrder) -> f32 {
    let words = byte_order.to_logical_order(regs);
    let raw = ((words[0] as u32) << 16) | (words[1] as u32);
    f32::from_bits(raw)
}

/// Encodes an IEEE 754 **single-precision** float into two U16 registers,
/// respecting the given byte order.
pub fn f32_to_registers(val: f32, byte_order: ByteOrder) -> [u16; 2] {
    let bits = val.to_bits();
    let logical = [(bits >> 16) as u16, bits as u16];
    let out = byte_order.from_logical_order(&logical);
    [out[0], out[1]]
}

/// Reads an IEEE 754 **double-precision** (64-bit) float from four U16
/// registers, respecting the given byte order.
pub fn registers_to_f64(regs: &[u16], byte_order: ByteOrder) -> f64 {
    let words = byte_order.to_logical_order(regs);
    let raw = ((words[0] as u64) << 48)
        | ((words[1] as u64) << 32)
        | ((words[2] as u64) << 16)
        | (words[3] as u64);
    f64::from_bits(raw)
}

/// Encodes an IEEE 754 **double-precision** float into four U16 registers,
/// respecting the given byte order.
pub fn f64_to_registers(val: f64, byte_order: ByteOrder) -> [u16; 4] {
    let bits = val.to_bits();
    let logical = [
        (bits >> 48) as u16,
        (bits >> 32) as u16,
        (bits >> 16) as u16,
        bits as u16,
    ];
    let out = byte_order.from_logical_order(&logical);
    [out[0], out[1], out[2], out[3]]
}

#[cfg(test)]
mod tests {
    use super::*;
    use modone_contract::{CanonicalAddress, CanonicalAreaKind};

    #[test]
    fn default_for_bool_produces_boolean_type() {
        let cfg = OpcUaMappingConfig::default_for_bool();
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::Boolean);
        assert_eq!(cfg.word_count, 1);
        assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
        assert!(cfg.description.is_none());
    }

    #[test]
    fn default_for_word_produces_uint16_type() {
        let cfg = OpcUaMappingConfig::default_for_word();
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::UInt16);
        assert_eq!(cfg.word_count, 1);
        assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
        assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
    }

    #[test]
    fn default_from_is_bool_dispatches_correctly() {
        let bool_cfg = OpcUaMappingConfig::default_from_is_bool(true);
        assert_eq!(bool_cfg.opcua_data_type, OpcUaDataType::Boolean);

        let word_cfg = OpcUaMappingConfig::default_from_is_bool(false);
        assert_eq!(word_cfg.opcua_data_type, OpcUaDataType::UInt16);
    }

    #[test]
    fn validate_accepts_valid_configs() {
        assert!(OpcUaMappingConfig::default_for_bool().validate().is_ok());
        assert!(OpcUaMappingConfig::default_for_word().validate().is_ok());

        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            byte_order: ByteOrder::LittleEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: Some("Motor speed".to_string()),
            string_config: None,
        };
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn validate_rejects_insufficient_word_count() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 1, // needs 2
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validate_rejects_boolean_with_wrong_word_count() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Boolean,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn data_type_default_word_counts() {
        assert_eq!(OpcUaDataType::Boolean.default_word_count(), 1);
        assert_eq!(OpcUaDataType::SByte.default_word_count(), 1);
        assert_eq!(OpcUaDataType::Byte.default_word_count(), 1);
        assert_eq!(OpcUaDataType::Int16.default_word_count(), 1);
        assert_eq!(OpcUaDataType::UInt16.default_word_count(), 1);
        assert_eq!(OpcUaDataType::Int32.default_word_count(), 2);
        assert_eq!(OpcUaDataType::UInt32.default_word_count(), 2);
        assert_eq!(OpcUaDataType::Int64.default_word_count(), 4);
        assert_eq!(OpcUaDataType::UInt64.default_word_count(), 4);
        assert_eq!(OpcUaDataType::Float.default_word_count(), 2);
        assert_eq!(OpcUaDataType::Double.default_word_count(), 4);
        assert_eq!(OpcUaDataType::String.default_word_count(), 1);
    }

    #[test]
    fn serde_round_trip() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Float,
            word_count: 2,
            byte_order: ByteOrder::LittleEndianWordSwap,
            access_level: MappingAccessLevel::ReadWrite,
            description: Some("Temperature sensor".to_string()),
            string_config: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let deserialized: OpcUaMappingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, deserialized);
    }

    #[test]
    fn serde_camel_case_field_names() {
        let cfg = OpcUaMappingConfig::default_for_word();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("opcuaDataType"));
        assert!(json.contains("wordCount"));
        assert!(json.contains("byteOrder"));
        assert!(json.contains("accessLevel"));
        // description is None and skipped
        assert!(!json.contains("description"));
    }

    #[test]
    fn all_byte_orders_display() {
        assert_eq!(ByteOrder::BigEndian.to_string(), "BigEndian");
        assert_eq!(ByteOrder::LittleEndian.to_string(), "LittleEndian");
        assert_eq!(ByteOrder::BigEndianWordSwap.to_string(), "BigEndianWordSwap");
        assert_eq!(
            ByteOrder::LittleEndianWordSwap.to_string(),
            "LittleEndianWordSwap"
        );
    }

    #[test]
    fn validate_accepts_larger_word_count() {
        // It's valid to use more words than the minimum (e.g., padding)
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 4, // min is 2, but 4 is fine
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_ok());
    }

    // ========================================================================
    // AC 7: Default mapping auto-generated on tag creation using is_bool
    // ========================================================================

    #[test]
    fn default_for_address_bool_areas_produce_boolean() {
        // All bit-type areas should produce Boolean mapping
        let bool_areas = [
            CanonicalAreaKind::InputBit,
            CanonicalAreaKind::OutputBit,
            CanonicalAreaKind::InternalBit,
            CanonicalAreaKind::RetentiveBit,
            CanonicalAreaKind::SpecialBit,
            CanonicalAreaKind::TimerDoneBit,
            CanonicalAreaKind::CounterDoneBit,
            CanonicalAreaKind::SystemBit,
        ];
        for area in bool_areas {
            let addr = CanonicalAddress::new(area, 0);
            let cfg = OpcUaMappingConfig::default_for_address(addr);
            assert_eq!(
                cfg.opcua_data_type,
                OpcUaDataType::Boolean,
                "area {:?} should produce Boolean",
                area
            );
            assert_eq!(cfg.word_count, 1);
            assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
            assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
            assert!(cfg.description.is_none());
            assert!(cfg.validate().is_ok());
        }
    }

    #[test]
    fn default_for_address_word_areas_produce_uint16() {
        // All word-type areas should produce UInt16 mapping
        let word_areas = [
            CanonicalAreaKind::DataWord,
            CanonicalAreaKind::RetentiveWord,
            CanonicalAreaKind::IndexWord,
            CanonicalAreaKind::TimerValueWord,
            CanonicalAreaKind::CounterValueWord,
            CanonicalAreaKind::SystemWord,
        ];
        for area in word_areas {
            let addr = CanonicalAddress::new(area, 0);
            let cfg = OpcUaMappingConfig::default_for_address(addr);
            assert_eq!(
                cfg.opcua_data_type,
                OpcUaDataType::UInt16,
                "area {:?} should produce UInt16",
                area
            );
            assert_eq!(cfg.word_count, 1);
            assert_eq!(cfg.byte_order, ByteOrder::BigEndian);
            assert_eq!(cfg.access_level, MappingAccessLevel::ReadOnly);
            assert!(cfg.description.is_none());
            assert!(cfg.validate().is_ok());
        }
    }

    #[test]
    fn default_for_address_with_bit_index_produces_boolean() {
        // A word address with a bit_index should still be detected as boolean
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 5, 3);
        let cfg = OpcUaMappingConfig::default_for_address(addr);
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::Boolean);
    }


    #[test]
    fn default_for_address_various_indices() {
        // Ensure the index value doesn't affect type detection
        for idx in [0, 1, 100, 9999] {
            let bool_cfg =
                OpcUaMappingConfig::default_for_address(CanonicalAddress::new(
                    CanonicalAreaKind::InternalBit,
                    idx,
                ));
            assert_eq!(bool_cfg.opcua_data_type, OpcUaDataType::Boolean);

            let word_cfg =
                OpcUaMappingConfig::default_for_address(CanonicalAddress::new(
                    CanonicalAreaKind::DataWord,
                    idx,
                ));
            assert_eq!(word_cfg.opcua_data_type, OpcUaDataType::UInt16);
        }
    }

    // ========================================================================
    // Sub-AC 3: String mapping — encoding, null termination, multi-register
    // ========================================================================

    // ── StringMappingConfig defaults & validation ──

    #[test]
    fn string_config_defaults() {
        let cfg = StringMappingConfig::default();
        assert_eq!(cfg.encoding, StringEncoding::Utf8);
        assert!(cfg.null_terminated);
        assert!(cfg.max_byte_length.is_none());
    }

    #[test]
    fn string_config_effective_max_bytes_default() {
        let cfg = StringMappingConfig::default();
        assert_eq!(cfg.effective_max_bytes(5), 10); // 5 words × 2
    }

    #[test]
    fn string_config_effective_max_bytes_explicit() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(6),
            ..Default::default()
        };
        assert_eq!(cfg.effective_max_bytes(5), 6);
    }

    #[test]
    fn string_config_validate_ok() {
        assert!(StringMappingConfig::default().validate(4).is_ok());
        let cfg = StringMappingConfig {
            max_byte_length: Some(8),
            ..Default::default()
        };
        assert!(cfg.validate(4).is_ok()); // 8 == 4*2, exactly fits
    }

    #[test]
    fn string_config_validate_rejects_zero_word_count() {
        assert!(StringMappingConfig::default().validate(0).is_err());
    }

    #[test]
    fn string_config_validate_rejects_overflow_max_bytes() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(10),
            ..Default::default()
        };
        assert!(cfg.validate(4).is_err()); // 10 > 4*2=8
    }

    #[test]
    fn string_config_validate_rejects_zero_max_bytes() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(0),
            ..Default::default()
        };
        assert!(cfg.validate(4).is_err());
    }

    #[test]
    fn string_config_serde_round_trip() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            max_byte_length: Some(20),
            null_terminated: false,
            max_string_length: None,
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let de: StringMappingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, de);
    }

    #[test]
    fn string_config_serde_camel_case() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(10),
            ..Default::default()
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("maxByteLength"));
        assert!(json.contains("nullTerminated"));
    }

    #[test]
    fn string_encoding_display() {
        assert_eq!(StringEncoding::Utf8.to_string(), "UTF-8");
        assert_eq!(StringEncoding::Ascii.to_string(), "ASCII");
        assert_eq!(StringEncoding::Utf16.to_string(), "UTF-16");
    }

    // ── registers_to_string (read direction) ──

    #[test]
    fn read_utf8_big_endian_hello() {
        // "Hello" = [0x48, 0x65, 0x6C, 0x6C, 0x6F]
        // Big-endian: reg0 = 0x4865, reg1 = 0x6C6C, reg2 = 0x6F00
        let regs = [0x4865, 0x6C6C, 0x6F00];
        let cfg = StringMappingConfig::default(); // UTF-8, null_terminated
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "Hello");
    }

    #[test]
    fn read_utf8_little_endian() {
        // "Hi" = [0x48, 0x69]
        // Little-endian: low byte first → reg = 0x6948 stores [0x48, 0x69]
        let regs = [0x6948, 0x0000];
        let cfg = StringMappingConfig::default();
        let s = registers_to_string(&regs, ByteOrder::LittleEndian, &cfg).unwrap();
        assert_eq!(s, "Hi");
    }

    #[test]
    fn read_utf8_no_null_termination() {
        // Without null termination, reads all bytes
        let regs = [0x4100, 0x4200]; // BE: 'A','\0','B','\0'
        let cfg = StringMappingConfig {
            null_terminated: false,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "A\0B\0");
    }

    #[test]
    fn read_utf8_null_in_middle_stops() {
        // With null_terminated=true, stops at first \0
        let regs = [0x4100, 0x4200]; // BE: 'A','\0' → stops
        let cfg = StringMappingConfig::default();
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "A");
    }

    #[test]
    fn read_utf8_max_byte_length_limits() {
        // "ABCD" in 2 registers, but max_byte_length=3
        let regs = [0x4142, 0x4344]; // BE: A,B,C,D
        let cfg = StringMappingConfig {
            max_byte_length: Some(3),
            null_terminated: false,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "ABC");
    }

    #[test]
    fn read_empty_registers() {
        let regs: [u16; 0] = [];
        let cfg = StringMappingConfig::default();
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "");
    }

    #[test]
    fn read_ascii_rejects_high_bytes() {
        let regs = [0x41C0]; // BE: 0x41='A', 0xC0 > 0x7F
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            null_terminated: false,
            ..Default::default()
        };
        assert!(registers_to_string(&regs, ByteOrder::BigEndian, &cfg).is_err());
    }

    #[test]
    fn read_utf16_basic() {
        // "Hi" in UTF-16: [0x0048, 0x0069]
        let regs = [0x0048, 0x0069, 0x0000];
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "Hi");
    }

    #[test]
    fn read_utf16_no_null_termination() {
        let regs = [0x0048, 0x0000, 0x0069];
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: false,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "H\0i");
    }

    #[test]
    fn read_utf16_emoji() {
        // '😀' = U+1F600, UTF-16 surrogate pair: 0xD83D, 0xDE00
        let regs = [0xD83D, 0xDE00, 0x0000];
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            ..Default::default()
        };
        let s = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(s, "\u{1F600}");
    }

    // ── string_to_registers (write direction) ──

    #[test]
    fn write_utf8_big_endian_hello() {
        let cfg = StringMappingConfig {
            null_terminated: true,
            ..Default::default()
        };
        let regs = string_to_registers("Hello", 4, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs.len(), 4);
        // "Hello" = 5 bytes + null → 6 bytes → 3 registers used, 4th is padding
        assert_eq!(regs[0], 0x4865); // H, e
        assert_eq!(regs[1], 0x6C6C); // l, l
        assert_eq!(regs[2], 0x6F00); // o, \0
        assert_eq!(regs[3], 0x0000); // padding
    }

    #[test]
    fn write_utf8_little_endian() {
        let cfg = StringMappingConfig {
            null_terminated: false,
            ..Default::default()
        };
        let regs = string_to_registers("AB", 2, ByteOrder::LittleEndian, &cfg).unwrap();
        // LE: b0='A'=0x41 → low byte, b1='B'=0x42 → high byte → 0x4241
        assert_eq!(regs[0], 0x4241);
        assert_eq!(regs[1], 0x0000);
    }

    #[test]
    fn write_utf8_too_long_rejected() {
        let cfg = StringMappingConfig::default(); // null_terminated=true
        // 2 words = 4 bytes capacity, -1 for null = 3 usable
        let result = string_to_registers("ABCD", 2, ByteOrder::BigEndian, &cfg);
        assert!(result.is_err());
    }

    #[test]
    fn write_utf8_exactly_fits_without_null() {
        let cfg = StringMappingConfig {
            null_terminated: false,
            ..Default::default()
        };
        // 2 words = 4 bytes, "ABCD" = 4 bytes — exact fit
        let regs = string_to_registers("ABCD", 2, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs[0], 0x4142);
        assert_eq!(regs[1], 0x4344);
    }

    #[test]
    fn write_utf16_basic() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: true,
            ..Default::default()
        };
        let regs = string_to_registers("Hi", 4, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs.len(), 4);
        assert_eq!(regs[0], 0x0048); // 'H'
        assert_eq!(regs[1], 0x0069); // 'i'
        assert_eq!(regs[2], 0x0000); // null
        assert_eq!(regs[3], 0x0000); // padding
    }

    #[test]
    fn write_utf16_too_long_rejected() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: true,
            ..Default::default()
        };
        // 2 words, -1 for null = 1 slot, but "Hi" needs 2
        let result = string_to_registers("Hi", 2, ByteOrder::BigEndian, &cfg);
        assert!(result.is_err());
    }

    #[test]
    fn write_ascii_rejects_non_ascii() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            null_terminated: false,
            ..Default::default()
        };
        let result = string_to_registers("café", 4, ByteOrder::BigEndian, &cfg);
        assert!(result.is_err());
    }

    #[test]
    fn write_zero_word_count_rejected() {
        let cfg = StringMappingConfig::default();
        assert!(string_to_registers("A", 0, ByteOrder::BigEndian, &cfg).is_err());
    }

    // ── Round-trip (write then read) ──

    #[test]
    fn round_trip_utf8_big_endian() {
        let cfg = StringMappingConfig::default();
        let original = "Test123";
        let regs = string_to_registers(original, 5, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_utf8_little_endian() {
        let cfg = StringMappingConfig::default();
        let original = "LE test";
        let regs = string_to_registers(original, 5, ByteOrder::LittleEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::LittleEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_utf16() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            ..Default::default()
        };
        let original = "UTF16!";
        let regs = string_to_registers(original, 8, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_ascii_no_null() {
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Ascii,
            null_terminated: false,
            ..Default::default()
        };
        let original = "ABCDEF";
        let regs = string_to_registers(original, 3, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    #[test]
    fn round_trip_empty_string() {
        let cfg = StringMappingConfig::default();
        let regs = string_to_registers("", 2, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, "");
    }

    #[test]
    fn round_trip_max_byte_length() {
        let cfg = StringMappingConfig {
            max_byte_length: Some(4),
            null_terminated: false,
            ..Default::default()
        };
        let original = "ABCD";
        let regs = string_to_registers(original, 4, ByteOrder::BigEndian, &cfg).unwrap();
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, original);
    }

    // ── Multi-register combination ──

    #[test]
    fn multi_register_utf8_16_registers() {
        // 16 registers = 32 bytes capacity
        let cfg = StringMappingConfig {
            null_terminated: true,
            ..Default::default()
        };
        let long_str = "This is a long str!"; // 19 chars + null = 20 bytes = 10 regs
        let regs = string_to_registers(long_str, 16, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs.len(), 16);
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, long_str);
    }

    #[test]
    fn multi_register_utf16_surrogate_pair() {
        // '😀' needs 2 UTF-16 code units (surrogate pair) = 2 registers + null
        let cfg = StringMappingConfig {
            encoding: StringEncoding::Utf16,
            null_terminated: true,
            ..Default::default()
        };
        let emoji = "\u{1F600}";
        let regs = string_to_registers(emoji, 4, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(regs[0], 0xD83D);
        assert_eq!(regs[1], 0xDE00);
        assert_eq!(regs[2], 0x0000);
        let result = registers_to_string(&regs, ByteOrder::BigEndian, &cfg).unwrap();
        assert_eq!(result, emoji);
    }

    #[test]
    fn default_for_address_always_validates() {
        // Every auto-generated default should pass validation
        let all_areas = [
            CanonicalAreaKind::InputBit,
            CanonicalAreaKind::OutputBit,
            CanonicalAreaKind::InternalBit,
            CanonicalAreaKind::RetentiveBit,
            CanonicalAreaKind::SpecialBit,
            CanonicalAreaKind::TimerDoneBit,
            CanonicalAreaKind::CounterDoneBit,
            CanonicalAreaKind::SystemBit,
            CanonicalAreaKind::DataWord,
            CanonicalAreaKind::RetentiveWord,
            CanonicalAreaKind::IndexWord,
            CanonicalAreaKind::TimerValueWord,
            CanonicalAreaKind::CounterValueWord,
            CanonicalAreaKind::SystemWord,
        ];
        for area in all_areas {
            let cfg = OpcUaMappingConfig::default_for_address(CanonicalAddress::new(area, 0));
            assert!(
                cfg.validate().is_ok(),
                "auto-generated default for {:?} should validate",
                area
            );
        }
    }

    // ========================================================================
    // AC 8: OpcUaMappingStore — tag deletion triggers synchronized removal
    // ========================================================================

    #[test]
    fn store_insert_and_get() {
        let store = OpcUaMappingStore::new();
        let cfg = OpcUaMappingConfig::default_for_bool();
        store.insert("motor-run".to_string(), cfg.clone());
        assert_eq!(store.get("motor-run"), Some(cfg));
        assert_eq!(store.len(), 1);
    }

    #[test]
    fn store_get_missing_returns_none() {
        let store = OpcUaMappingStore::new();
        assert_eq!(store.get("nonexistent"), None);
    }

    #[test]
    fn store_remove_returns_config() {
        let store = OpcUaMappingStore::new();
        let cfg = OpcUaMappingConfig::default_for_word();
        store.insert("temperature".to_string(), cfg.clone());
        assert_eq!(store.len(), 1);

        let removed = store.remove("temperature");
        assert_eq!(removed, Some(cfg));
        assert!(store.is_empty());
        assert_eq!(store.get("temperature"), None);
    }

    #[test]
    fn store_remove_missing_returns_none() {
        let store = OpcUaMappingStore::new();
        assert_eq!(store.remove("nonexistent"), None);
    }

    #[test]
    fn store_remove_many_batch_deletion() {
        let store = OpcUaMappingStore::new();
        store.insert("tag-a".to_string(), OpcUaMappingConfig::default_for_bool());
        store.insert("tag-b".to_string(), OpcUaMappingConfig::default_for_word());
        store.insert("tag-c".to_string(), OpcUaMappingConfig::default_for_bool());
        assert_eq!(store.len(), 3);

        let removed = store.remove_many(&[
            "tag-a".to_string(),
            "tag-c".to_string(),
            "tag-nonexistent".to_string(),
        ]);

        // Only existing tags are reported as removed
        assert_eq!(removed.len(), 2);
        assert!(removed.contains(&"tag-a".to_string()));
        assert!(removed.contains(&"tag-c".to_string()));

        // tag-b remains
        assert_eq!(store.len(), 1);
        assert!(store.contains("tag-b"));
        assert!(!store.contains("tag-a"));
        assert!(!store.contains("tag-c"));
    }

    #[test]
    fn store_clear_removes_all() {
        let store = OpcUaMappingStore::new();
        store.insert("a".to_string(), OpcUaMappingConfig::default());
        store.insert("b".to_string(), OpcUaMappingConfig::default());
        assert_eq!(store.len(), 2);

        store.clear();
        assert!(store.is_empty());
        assert_eq!(store.len(), 0);
    }

    #[test]
    fn store_contains() {
        let store = OpcUaMappingStore::new();
        store.insert("exists".to_string(), OpcUaMappingConfig::default());
        assert!(store.contains("exists"));
        assert!(!store.contains("missing"));
    }

    #[test]
    fn store_insert_replaces_existing() {
        let store = OpcUaMappingStore::new();
        let bool_cfg = OpcUaMappingConfig::default_for_bool();
        let word_cfg = OpcUaMappingConfig::default_for_word();

        store.insert("tag".to_string(), bool_cfg.clone());
        assert_eq!(store.get("tag").unwrap().opcua_data_type, OpcUaDataType::Boolean);

        let old = store.insert("tag".to_string(), word_cfg.clone());
        assert_eq!(old, Some(bool_cfg));
        assert_eq!(store.get("tag").unwrap().opcua_data_type, OpcUaDataType::UInt16);
        assert_eq!(store.len(), 1); // still just one entry
    }

    #[test]
    fn store_snapshot_returns_clone() {
        let store = OpcUaMappingStore::new();
        store.insert("x".to_string(), OpcUaMappingConfig::default_for_bool());
        store.insert("y".to_string(), OpcUaMappingConfig::default_for_word());

        let snapshot = store.snapshot();
        assert_eq!(snapshot.len(), 2);
        assert!(snapshot.contains_key("x"));
        assert!(snapshot.contains_key("y"));

        // Mutating the store doesn't affect the snapshot
        store.remove("x");
        assert_eq!(snapshot.len(), 2); // snapshot is independent
    }

    #[test]
    fn store_load_from_replaces_all() {
        let store = OpcUaMappingStore::new();
        store.insert("old".to_string(), OpcUaMappingConfig::default());

        let mut new_configs = HashMap::new();
        new_configs.insert("new-a".to_string(), OpcUaMappingConfig::default_for_bool());
        new_configs.insert("new-b".to_string(), OpcUaMappingConfig::default_for_word());

        store.load_from(new_configs);
        assert_eq!(store.len(), 2);
        assert!(!store.contains("old"));
        assert!(store.contains("new-a"));
        assert!(store.contains("new-b"));
    }

    #[test]
    fn store_tag_ids() {
        let store = OpcUaMappingStore::new();
        store.insert("alpha".to_string(), OpcUaMappingConfig::default());
        store.insert("beta".to_string(), OpcUaMappingConfig::default());

        let mut ids = store.tag_ids();
        ids.sort();
        assert_eq!(ids, vec!["alpha", "beta"]);
    }

    #[test]
    fn store_default_is_empty() {
        let store = OpcUaMappingStore::default();
        assert!(store.is_empty());
        assert_eq!(store.len(), 0);
    }


    // ========================================================================
    // IEEE 754 Float/Double register mapping tests
    // ========================================================================

    fn float_config(byte_order: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Float,
            word_count: 2,
            byte_order,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    fn double_config(byte_order: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Double,
            word_count: 4,
            byte_order,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    // --- f32 round-trip with all byte orders ---

    #[test]
    fn f32_round_trip_big_endian() {
        let val: f32 = 1.0;
        // IEEE 754: 1.0f32 = 0x3F800000
        let regs = f32_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs, [0x3F80, 0x0000]);
        let result = registers_to_f32(&regs, ByteOrder::BigEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_round_trip_little_endian() {
        let val: f32 = 1.0;
        let regs = f32_to_registers(val, ByteOrder::LittleEndian);
        assert_eq!(regs, [0x0000, 0x3F80]); // reversed
        let result = registers_to_f32(&regs, ByteOrder::LittleEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_round_trip_big_endian_word_swap() {
        let val: f32 = 1.0;
        let regs = f32_to_registers(val, ByteOrder::BigEndianWordSwap);
        assert_eq!(regs, [0x0000, 0x3F80]); // adjacent pair swapped
        let result = registers_to_f32(&regs, ByteOrder::BigEndianWordSwap);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_round_trip_little_endian_word_swap() {
        let val: f32 = 1.0;
        let regs = f32_to_registers(val, ByteOrder::LittleEndianWordSwap);
        assert_eq!(regs, [0x3F80, 0x0000]); // reverse then swap = identity for 2 words
        let result = registers_to_f32(&regs, ByteOrder::LittleEndianWordSwap);
        assert_eq!(result, val);
    }

    #[test]
    fn f32_various_values() {
        for val in [0.0f32, -1.0, 3.14, f32::MAX, f32::MIN, f32::INFINITY, f32::NEG_INFINITY] {
            for bo in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let regs = f32_to_registers(val, bo);
                let result = registers_to_f32(&regs, bo);
                assert_eq!(result, val, "f32 round-trip failed for {} with {:?}", val, bo);
            }
        }
    }

    #[test]
    fn f32_nan_round_trip() {
        let val = f32::NAN;
        let regs = f32_to_registers(val, ByteOrder::BigEndian);
        let result = registers_to_f32(&regs, ByteOrder::BigEndian);
        assert!(result.is_nan());
    }

    // --- f64 round-trip with all byte orders ---

    #[test]
    fn f64_round_trip_big_endian() {
        let val: f64 = 1.0;
        // IEEE 754: 1.0f64 = 0x3FF0000000000000
        let regs = f64_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs, [0x3FF0, 0x0000, 0x0000, 0x0000]);
        let result = registers_to_f64(&regs, ByteOrder::BigEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f64_round_trip_little_endian() {
        let val: f64 = 1.0;
        let regs = f64_to_registers(val, ByteOrder::LittleEndian);
        assert_eq!(regs, [0x0000, 0x0000, 0x0000, 0x3FF0]); // reversed
        let result = registers_to_f64(&regs, ByteOrder::LittleEndian);
        assert_eq!(result, val);
    }

    #[test]
    fn f64_round_trip_big_endian_word_swap() {
        let val: f64 = 1.0;
        let regs = f64_to_registers(val, ByteOrder::BigEndianWordSwap);
        // [0x3FF0, 0x0000, 0x0000, 0x0000] → swap pairs → [0x0000, 0x3FF0, 0x0000, 0x0000]
        assert_eq!(regs, [0x0000, 0x3FF0, 0x0000, 0x0000]);
        let result = registers_to_f64(&regs, ByteOrder::BigEndianWordSwap);
        assert_eq!(result, val);
    }

    #[test]
    fn f64_various_values() {
        for val in [0.0f64, -1.0, std::f64::consts::PI, f64::MAX, f64::MIN, f64::INFINITY] {
            for bo in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let regs = f64_to_registers(val, bo);
                let result = registers_to_f64(&regs, bo);
                assert_eq!(result, val, "f64 round-trip failed for {} with {:?}", val, bo);
            }
        }
    }

    #[test]
    fn f64_nan_round_trip() {
        let val = f64::NAN;
        let regs = f64_to_registers(val, ByteOrder::BigEndian);
        let result = registers_to_f64(&regs, ByteOrder::BigEndian);
        assert!(result.is_nan());
    }

    // --- read_registers_to_mapped for Float/Double ---

    #[test]
    fn read_registers_float_big_endian() {
        let cfg = float_config(ByteOrder::BigEndian);
        // 1.0f32 = 0x3F800000
        let regs = [0x3F80u16, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::Float(1.0));
    }

    #[test]
    fn read_registers_float_little_endian() {
        let cfg = float_config(ByteOrder::LittleEndian);
        let regs = [0x0000u16, 0x3F80]; // LE: LSW first
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::Float(1.0));
    }

    #[test]
    fn read_registers_double_big_endian() {
        let cfg = double_config(ByteOrder::BigEndian);
        // 1.0f64 = 0x3FF0000000000000
        let regs = [0x3FF0u16, 0x0000, 0x0000, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::Double(1.0));
    }

    #[test]
    fn read_registers_float_insufficient_regs() {
        let cfg = float_config(ByteOrder::BigEndian);
        let regs = [0x3F80u16]; // only 1, need 2
        let result = read_registers_to_mapped(&cfg, &regs);
        assert!(result.is_err());
        match result.unwrap_err() {
            MappingError::InsufficientRegisters { expected, actual } => {
                assert_eq!(expected, 2);
                assert_eq!(actual, 1);
            }
            other => panic!("unexpected error: {:?}", other),
        }
    }

    #[test]
    fn read_registers_double_insufficient_regs() {
        let cfg = double_config(ByteOrder::BigEndian);
        let regs = [0x3FF0u16, 0x0000]; // only 2, need 4
        let result = read_registers_to_mapped(&cfg, &regs);
        assert!(result.is_err());
    }

    // --- write_mapped_to_registers for Float/Double ---

    #[test]
    fn write_float_big_endian() {
        let cfg = float_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(result, vec![0x3F80, 0x0000]);
    }

    #[test]
    fn write_float_little_endian() {
        let cfg = float_config(ByteOrder::LittleEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(result, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn write_double_big_endian() {
        let cfg = double_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(result, vec![0x3FF0, 0x0000, 0x0000, 0x0000]);
    }

    #[test]
    fn write_double_little_endian() {
        let cfg = double_config(ByteOrder::LittleEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(result, vec![0x0000, 0x0000, 0x0000, 0x3FF0]);
    }

    // --- Float/Double round-trip through read/write mapped ---

    #[test]
    fn float_mapped_round_trip_all_byte_orders() {
        let val = 42.5f32;
        for bo in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = float_config(bo);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Float(val)).unwrap();
            assert_eq!(regs.len(), 2);
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Float(val), "round-trip failed with {:?}", bo);
        }
    }

    #[test]
    fn double_mapped_round_trip_all_byte_orders() {
        let val = std::f64::consts::PI;
        for bo in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = double_config(bo);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Double(val)).unwrap();
            assert_eq!(regs.len(), 4);
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Double(val), "round-trip failed with {:?}", bo);
        }
    }

    // --- Float/Double special values ---

    #[test]
    fn float_special_values_round_trip() {
        let cfg = float_config(ByteOrder::BigEndian);
        for val in [0.0f32, -0.0, f32::INFINITY, f32::NEG_INFINITY, f32::MIN, f32::MAX] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Float(val)).unwrap();
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Float(val));
        }
    }

    #[test]
    fn float_nan_mapped_round_trip() {
        let cfg = float_config(ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Float(f32::NAN)).unwrap();
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        match result {
            MappedValue::Float(v) => assert!(v.is_nan()),
            _ => panic!("expected Float"),
        }
    }

    #[test]
    fn double_special_values_round_trip() {
        let cfg = double_config(ByteOrder::BigEndian);
        for val in [0.0f64, -0.0, f64::INFINITY, f64::NEG_INFINITY, f64::MIN, f64::MAX] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Double(val)).unwrap();
            let result = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(result, MappedValue::Double(val));
        }
    }

    // --- Type mismatch: Float config with Double value, etc. ---

    #[test]
    fn write_float_type_mismatch() {
        let cfg = float_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Double(1.0));
        assert!(result.is_err());
        match result.unwrap_err() {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "Float");
            }
            other => panic!("expected TypeMismatch, got {:?}", other),
        }
    }

    #[test]
    fn write_double_type_mismatch() {
        let cfg = double_config(ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&cfg, &MappedValue::Float(1.0));
        assert!(result.is_err());
        match result.unwrap_err() {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "Double");
            }
            other => panic!("expected TypeMismatch, got {:?}", other),
        }
    }

    // --- Known IEEE 754 bit patterns ---

    #[test]
    fn f32_known_bit_pattern_pi() {
        // pi ≈ 3.14159274 as f32 = 0x40490FDB
        let val = std::f32::consts::PI;
        let regs = f32_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs[0], 0x4049);
        assert_eq!(regs[1], 0x0FDB);
        let decoded = registers_to_f32(&regs, ByteOrder::BigEndian);
        assert_eq!(decoded, val);
    }

    #[test]
    fn f64_known_bit_pattern_pi() {
        // pi = 0x400921FB54442D18
        let val = std::f64::consts::PI;
        let regs = f64_to_registers(val, ByteOrder::BigEndian);
        assert_eq!(regs[0], 0x4009);
        assert_eq!(regs[1], 0x21FB);
        assert_eq!(regs[2], 0x5444);
        assert_eq!(regs[3], 0x2D18);
        let decoded = registers_to_f64(&regs, ByteOrder::BigEndian);
        assert_eq!(decoded, val);
    }

    // ========================================================================
    // AC 9: deviceAddress as single source of truth — register range derivation
    // ========================================================================

    #[test]
    fn register_range_single_word() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig::default_for_word();
        let range = cfg.register_range(addr);

        assert_eq!(range.area, CanonicalAreaKind::DataWord);
        assert_eq!(range.start_index, 100);
        assert_eq!(range.word_count, 1);
        assert_eq!(range.end_index(), 101);
        assert!(range.bit_index.is_none());
        assert!(range.is_single());
    }

    #[test]
    fn register_range_multi_word_int32() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 50);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        let range = cfg.register_range(addr);

        assert_eq!(range.start_index, 50);
        assert_eq!(range.word_count, 2);
        assert_eq!(range.end_index(), 52);
        assert!(!range.is_single());
    }

    #[test]
    fn register_range_four_word_double() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 200);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Double,
            word_count: 4,
            byte_order: ByteOrder::LittleEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        };
        let range = cfg.register_range(addr);

        assert_eq!(range.start_index, 200);
        assert_eq!(range.end_index(), 204);
        assert_eq!(range.word_count, 4);
    }

    #[test]
    fn register_range_boolean_with_bit_index() {
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 10, 3);
        let cfg = OpcUaMappingConfig::default_for_bool();
        let range = cfg.register_range(addr);

        assert_eq!(range.area, CanonicalAreaKind::DataWord);
        assert_eq!(range.start_index, 10);
        assert_eq!(range.bit_index, Some(3));
        assert!(range.is_single());
    }

    #[test]
    fn register_range_addresses_word_span() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            ..Default::default()
        };
        let range = cfg.register_range(addr);
        let addrs = range.addresses();

        assert_eq!(addrs.len(), 2);
        assert_eq!(
            addrs[0],
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 100)
        );
        assert_eq!(
            addrs[1],
            CanonicalAddress::new(CanonicalAreaKind::DataWord, 101)
        );
    }

    #[test]
    fn register_range_addresses_bool_with_bit() {
        let addr = CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 5, 7);
        let cfg = OpcUaMappingConfig::default_for_bool();
        let range = cfg.register_range(addr);
        let addrs = range.addresses();

        assert_eq!(addrs.len(), 1);
        assert_eq!(
            addrs[0],
            CanonicalAddress::with_bit_index(CanonicalAreaKind::DataWord, 5, 7)
        );
    }

    #[test]
    fn register_range_addresses_four_word() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::RetentiveWord, 0);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int64,
            word_count: 4,
            ..Default::default()
        };
        let range = cfg.register_range(addr);
        let addrs = range.addresses();

        assert_eq!(addrs.len(), 4);
        for (i, a) in addrs.iter().enumerate() {
            assert_eq!(a.area, CanonicalAreaKind::RetentiveWord);
            assert_eq!(a.index, i as u32);
            assert!(a.bit_index.is_none());
        }
    }

    #[test]
    fn register_range_overlaps_same_area() {
        let r1 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let r2 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 101,
            word_count: 2,
            bit_index: None,
        };
        assert!(r1.overlaps(&r2));
        assert!(r2.overlaps(&r1));
    }

    #[test]
    fn register_range_no_overlap_adjacent() {
        let r1 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let r2 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 102,
            word_count: 2,
            bit_index: None,
        };
        assert!(!r1.overlaps(&r2));
        assert!(!r2.overlaps(&r1));
    }

    #[test]
    fn register_range_no_overlap_different_areas() {
        let r1 = RegisterRange {
            area: CanonicalAreaKind::DataWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        let r2 = RegisterRange {
            area: CanonicalAreaKind::RetentiveWord,
            start_index: 100,
            word_count: 2,
            bit_index: None,
        };
        assert!(!r1.overlaps(&r2));
    }

    #[test]
    fn register_range_validate_bounds_ok() {
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord, // default_size = 10000
            start_index: 9998,
            word_count: 2,
            bit_index: None,
        };
        assert!(range.validate_bounds().is_ok());
    }

    #[test]
    fn register_range_validate_bounds_exceed() {
        let range = RegisterRange {
            area: CanonicalAreaKind::DataWord, // default_size = 10000
            start_index: 9999,
            word_count: 2,
            bit_index: None,
        };
        assert!(range.validate_bounds().is_err());
    }

    #[test]
    fn validated_register_range_ok() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2,
            ..Default::default()
        };
        let range = cfg.validated_register_range(addr).unwrap();
        assert_eq!(range.start_index, 100);
        assert_eq!(range.end_index(), 102);
    }

    #[test]
    fn validated_register_range_rejects_bad_word_count() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::DataWord, 100);
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 1, // needs 2
            ..Default::default()
        };
        assert!(cfg.validated_register_range(addr).is_err());
    }

    #[test]
    fn validated_register_range_rejects_out_of_bounds() {
        let addr = CanonicalAddress::new(CanonicalAreaKind::IndexWord, 15); // default_size = 16
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Int32,
            word_count: 2, // 15+2=17 > 16
            ..Default::default()
        };
        assert!(cfg.validated_register_range(addr).is_err());
    }

    #[test]
    fn device_address_is_single_source_of_truth() {
        // The same mapping config applied to different deviceAddresses
        // produces different register ranges — proving deviceAddress is
        // the single source of truth for location.
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::Float,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };

        let addr_a = CanonicalAddress::new(CanonicalAreaKind::DataWord, 0);
        let addr_b = CanonicalAddress::new(CanonicalAreaKind::DataWord, 500);
        let addr_c = CanonicalAddress::new(CanonicalAreaKind::RetentiveWord, 0);

        let range_a = cfg.register_range(addr_a);
        let range_b = cfg.register_range(addr_b);
        let range_c = cfg.register_range(addr_c);

        // Same config, different addresses → different ranges
        assert_eq!(range_a.start_index, 0);
        assert_eq!(range_b.start_index, 500);
        assert_eq!(range_c.start_index, 0);

        // Area comes from deviceAddress, not from config
        assert_eq!(range_a.area, CanonicalAreaKind::DataWord);
        assert_eq!(range_c.area, CanonicalAreaKind::RetentiveWord);

        // word_count comes from config
        assert_eq!(range_a.word_count, 2);
        assert_eq!(range_b.word_count, 2);
        assert_eq!(range_c.word_count, 2);
    }

    #[test]
    fn register_range_preserves_bit_index_from_device_address() {
        // bit_index flows through from deviceAddress, not from config
        let addr =
            CanonicalAddress::with_bit_index(CanonicalAreaKind::InternalBit, 42, 5);
        let cfg = OpcUaMappingConfig::default_for_bool();
        let range = cfg.register_range(addr);

        assert_eq!(range.bit_index, Some(5));
        assert_eq!(range.start_index, 42);
        assert_eq!(range.area, CanonicalAreaKind::InternalBit);
    }
}


// ========================================================================
// Integer register mapping tests (Sub-AC 1 of AC 2) - in separate module
// ========================================================================
#[cfg(test)]
mod int_mapping_tests {
    use super::*;

    fn make_int_config(dt: OpcUaDataType, bo: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: dt,
            word_count: dt.default_word_count(),
            byte_order: bo,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    // --- Byte order helpers ---

    #[test]
    fn byte_order_big_endian_identity() {
        let regs = [0x1234u16, 0x5678];
        assert_eq!(
            ByteOrder::BigEndian.to_logical_order(&regs),
            vec![0x1234, 0x5678]
        );
        assert_eq!(
            ByteOrder::BigEndian.from_logical_order(&regs),
            vec![0x1234, 0x5678]
        );
    }

    #[test]
    fn byte_order_little_endian_reverses() {
        let regs = [0xAAAAu16, 0xBBBB];
        assert_eq!(
            ByteOrder::LittleEndian.to_logical_order(&regs),
            vec![0xBBBB, 0xAAAA]
        );
        assert_eq!(
            ByteOrder::LittleEndian.from_logical_order(&[0xBBBB, 0xAAAA]),
            vec![0xAAAA, 0xBBBB]
        );
    }

    #[test]
    fn byte_order_big_endian_word_swap_2regs() {
        let regs = [0x0001u16, 0x0002];
        assert_eq!(
            ByteOrder::BigEndianWordSwap.to_logical_order(&regs),
            vec![0x0002, 0x0001]
        );
    }

    #[test]
    fn byte_order_little_endian_word_swap_4regs() {
        let regs = [0x0001u16, 0x0002, 0x0003, 0x0004];
        let logical = ByteOrder::LittleEndianWordSwap.to_logical_order(&regs);
        assert_eq!(logical, vec![0x0004, 0x0003, 0x0002, 0x0001]);
    }

    #[test]
    fn byte_order_round_trip_all_orders() {
        let regs = [0x1111u16, 0x2222, 0x3333, 0x4444];
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let logical = order.to_logical_order(&regs);
            let back = order.from_logical_order(&logical);
            assert_eq!(back, regs.to_vec(), "round-trip failed for {:?}", order);
        }
    }

    // --- 8-bit read/write ---

    #[test]
    fn read_byte_from_register() {
        let cfg = make_int_config(OpcUaDataType::Byte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x00AB]).unwrap();
        assert_eq!(result, MappedValue::Byte(0xAB));
    }

    #[test]
    fn read_byte_ignores_high_byte() {
        let cfg = make_int_config(OpcUaDataType::Byte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xFF42]).unwrap();
        assert_eq!(result, MappedValue::Byte(0x42));
    }

    #[test]
    fn read_sbyte_positive() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x007F]).unwrap();
        assert_eq!(result, MappedValue::SByte(127));
    }

    #[test]
    fn read_sbyte_negative() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x0080]).unwrap();
        assert_eq!(result, MappedValue::SByte(-128));
    }

    #[test]
    fn read_sbyte_minus_one() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x00FF]).unwrap();
        assert_eq!(result, MappedValue::SByte(-1));
    }

    #[test]
    fn write_byte_to_register() {
        let cfg = make_int_config(OpcUaDataType::Byte, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Byte(0xAB)).unwrap();
        assert_eq!(regs, vec![0x00AB]);
    }

    #[test]
    fn write_sbyte_negative_to_register() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::SByte(-1)).unwrap();
        assert_eq!(regs, vec![0x00FF]);
    }

    #[test]
    fn sbyte_round_trip() {
        let cfg = make_int_config(OpcUaDataType::SByte, ByteOrder::BigEndian);
        for val in [-128i8, -1, 0, 1, 127] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::SByte(val)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(read_back, MappedValue::SByte(val));
        }
    }

    // --- 16-bit read/write ---

    #[test]
    fn read_uint16_passthrough() {
        let cfg = make_int_config(OpcUaDataType::UInt16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xBEEF]).unwrap();
        assert_eq!(result, MappedValue::UInt16(0xBEEF));
    }

    #[test]
    fn read_int16_positive() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x7FFF]).unwrap();
        assert_eq!(result, MappedValue::Int16(32767));
    }

    #[test]
    fn read_int16_negative() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xFFFF]).unwrap();
        assert_eq!(result, MappedValue::Int16(-1));
    }

    #[test]
    fn read_int16_min() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x8000]).unwrap();
        assert_eq!(result, MappedValue::Int16(-32768));
    }

    #[test]
    fn write_int16_negative() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Int16(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF]);
    }

    #[test]
    fn int16_round_trip() {
        let cfg = make_int_config(OpcUaDataType::Int16, ByteOrder::BigEndian);
        for val in [i16::MIN, -1, 0, 1, i16::MAX] {
            let regs = write_mapped_to_registers(&cfg, &MappedValue::Int16(val)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(read_back, MappedValue::Int16(val));
        }
    }

    // --- 32-bit read/write ---

    #[test]
    fn read_uint32_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x0001, 0x0002]).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x00010002));
    }

    #[test]
    fn read_uint32_little_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::LittleEndian);
        let result = read_registers_to_mapped(&cfg, &[0x0002, 0x0001]).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x00010002));
    }

    #[test]
    fn read_int32_negative_big_endian() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0xFFFF, 0xFFFF]).unwrap();
        assert_eq!(result, MappedValue::Int32(-1));
    }

    #[test]
    fn read_int32_min_value() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x8000, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Int32(i32::MIN));
    }

    #[test]
    fn write_uint32_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(0x12345678)).unwrap();
        assert_eq!(regs, vec![0x1234, 0x5678]);
    }

    #[test]
    fn write_uint32_little_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(0x12345678)).unwrap();
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    #[test]
    fn uint32_round_trip_all_byte_orders() {
        let value = 0xDEADBEEFu32;
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = make_int_config(OpcUaDataType::UInt32, order);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(value)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(
                read_back,
                MappedValue::UInt32(value),
                "failed for {:?}",
                order
            );
        }
    }

    #[test]
    fn int32_round_trip_all_byte_orders() {
        for val in [i32::MIN, -1, 0, 1, i32::MAX] {
            for order in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let cfg = make_int_config(OpcUaDataType::Int32, order);
                let regs = write_mapped_to_registers(&cfg, &MappedValue::Int32(val)).unwrap();
                let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
                assert_eq!(read_back, MappedValue::Int32(val));
            }
        }
    }

    // --- 64-bit read/write ---

    #[test]
    fn read_uint64_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0x0001, 0x0002, 0x0003, 0x0004]).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x0001000200030004u64));
    }

    #[test]
    fn read_uint64_little_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::LittleEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0x0004, 0x0003, 0x0002, 0x0001]).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x0001000200030004u64));
    }

    #[test]
    fn read_int64_negative() {
        let cfg = make_int_config(OpcUaDataType::Int64, ByteOrder::BigEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]).unwrap();
        assert_eq!(result, MappedValue::Int64(-1));
    }

    #[test]
    fn read_int64_min_value() {
        let cfg = make_int_config(OpcUaDataType::Int64, ByteOrder::BigEndian);
        let result =
            read_registers_to_mapped(&cfg, &[0x8000, 0x0000, 0x0000, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Int64(i64::MIN));
    }

    #[test]
    fn write_uint64_big_endian() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        let regs =
            write_mapped_to_registers(&cfg, &MappedValue::UInt64(0x0001000200030004)).unwrap();
        assert_eq!(regs, vec![0x0001, 0x0002, 0x0003, 0x0004]);
    }

    #[test]
    fn write_int64_negative() {
        let cfg = make_int_config(OpcUaDataType::Int64, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::Int64(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]);
    }

    #[test]
    fn uint64_round_trip_all_byte_orders() {
        let value = 0x123456789ABCDEF0u64;
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let cfg = make_int_config(OpcUaDataType::UInt64, order);
            let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt64(value)).unwrap();
            let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
            assert_eq!(
                read_back,
                MappedValue::UInt64(value),
                "failed for {:?}",
                order
            );
        }
    }

    #[test]
    fn int64_round_trip_all_byte_orders() {
        for val in [i64::MIN, -1, 0, 1, i64::MAX] {
            for order in [
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let cfg = make_int_config(OpcUaDataType::Int64, order);
                let regs = write_mapped_to_registers(&cfg, &MappedValue::Int64(val)).unwrap();
                let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
                assert_eq!(read_back, MappedValue::Int64(val));
            }
        }
    }

    // --- Error cases ---

    #[test]
    fn read_boolean_type_returns_error() {
        let cfg = make_int_config(OpcUaDataType::Boolean, ByteOrder::BigEndian);
        let err = read_registers_to_mapped(&cfg, &[0x0001]).unwrap_err();
        assert_eq!(err, MappingError::BooleanTypeMismatch);
    }

    #[test]
    fn read_insufficient_registers_32bit() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let err = read_registers_to_mapped(&cfg, &[0x0001]).unwrap_err();
        assert_eq!(
            err,
            MappingError::InsufficientRegisters {
                expected: 2,
                actual: 1,
            }
        );
    }

    #[test]
    fn read_insufficient_registers_64bit() {
        let cfg = make_int_config(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        let err = read_registers_to_mapped(&cfg, &[0x0001, 0x0002]).unwrap_err();
        assert_eq!(
            err,
            MappingError::InsufficientRegisters {
                expected: 4,
                actual: 2,
            }
        );
    }

    #[test]
    fn write_type_mismatch_returns_error() {
        let cfg = make_int_config(OpcUaDataType::Int32, ByteOrder::BigEndian);
        let err = write_mapped_to_registers(&cfg, &MappedValue::UInt16(42)).unwrap_err();
        match err {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "Int32");
            }
            other => panic!("expected TypeMismatch, got {:?}", other),
        }
    }

    #[test]
    fn write_boolean_type_returns_error() {
        let cfg = make_int_config(OpcUaDataType::Boolean, ByteOrder::BigEndian);
        let err = write_mapped_to_registers(&cfg, &MappedValue::Boolean(true)).unwrap_err();
        assert_eq!(err, MappingError::BooleanTypeMismatch);
    }

    // --- Bool convenience functions ---

    #[test]
    fn read_bool_mapped_values() {
        assert_eq!(read_bool_mapped(true), MappedValue::Boolean(true));
        assert_eq!(read_bool_mapped(false), MappedValue::Boolean(false));
    }

    #[test]
    fn write_bool_mapped_ok() {
        assert!(write_bool_mapped(&MappedValue::Boolean(true)).unwrap());
        assert!(!write_bool_mapped(&MappedValue::Boolean(false)).unwrap());
    }

    #[test]
    fn write_bool_mapped_type_mismatch() {
        let err = write_bool_mapped(&MappedValue::UInt16(42)).unwrap_err();
        assert_eq!(err, MappingError::BooleanTypeMismatch);
    }

    // --- Extra registers are ignored ---

    #[test]
    fn read_extra_registers_ignored() {
        let cfg = make_int_config(OpcUaDataType::UInt16, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x1234, 0x5678, 0x9ABC]).unwrap();
        assert_eq!(result, MappedValue::UInt16(0x1234));
    }

    // --- BigEndianWordSwap specific 32-bit test ---

    #[test]
    fn read_uint32_big_endian_word_swap() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap);
        let result = read_registers_to_mapped(&cfg, &[0x5678, 0x1234]).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn write_uint32_big_endian_word_swap() {
        let cfg = make_int_config(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&cfg, &MappedValue::UInt32(0x12345678)).unwrap();
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    // --- MappingError Display ---

    #[test]
    fn mapping_error_display_messages() {
        let e = MappingError::InsufficientRegisters {
            expected: 4,
            actual: 2,
        };
        assert_eq!(e.to_string(), "need 4 registers but got 2");

        let e = MappingError::BooleanTypeMismatch;
        assert!(e.to_string().contains("Boolean"));

        let e = MappingError::UnsupportedType(OpcUaDataType::Float);
        assert!(e.to_string().contains("Float"));
    }

    // --- Float/Double now supported (previously unsupported, updated for AC 2/3) ---

    #[test]
    fn read_float_supported() {
        let cfg = make_int_config(OpcUaDataType::Float, ByteOrder::BigEndian);
        let result = read_registers_to_mapped(&cfg, &[0x3F80, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Float(1.0));
    }

    #[test]
    fn read_double_supported() {
        let cfg = make_int_config(OpcUaDataType::Double, ByteOrder::BigEndian);
        // 1.0f64 = 0x3FF0_0000_0000_0000
        let result = read_registers_to_mapped(&cfg, &[0x3FF0, 0x0000, 0x0000, 0x0000]).unwrap();
        assert_eq!(result, MappedValue::Double(1.0));
    }
}

// ========================================================================
// AC 10: OpcUaMappingConfig serialized to/from project data JSON
// ========================================================================
#[cfg(test)]
mod byte_order_read_tests {
    use super::*;

    fn cfg(dt: OpcUaDataType, bo: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: dt,
            word_count: dt.default_word_count(),
            byte_order: bo,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        }
    }

    // -- Same registers, different byte orders produce different values --

    #[test]
    fn same_registers_different_byte_order_uint32() {
        let regs = [0x0001u16, 0x0002];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::UInt32(0x0001_0002));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(le, MappedValue::UInt32(0x0002_0001));

        let bews = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(bews, MappedValue::UInt32(0x0002_0001));

        let lews = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(lews, MappedValue::UInt32(0x0001_0002));

        assert_ne!(be, le);
    }

    #[test]
    fn same_registers_different_byte_order_int32() {
        let regs = [0xFFFFu16, 0xFFFE];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int32, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::Int32(-2));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int32, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(le, MappedValue::Int32(-65537));
    }

    #[test]
    fn same_registers_different_byte_order_uint64() {
        let regs = [0x0001u16, 0x0002, 0x0003, 0x0004];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::UInt64(0x0001_0002_0003_0004));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(le, MappedValue::UInt64(0x0004_0003_0002_0001));

        assert_ne!(be, le);
    }

    #[test]
    fn same_registers_different_byte_order_float() {
        let regs = [0x3F80u16, 0x0000];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::Float(1.0));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_ne!(le, MappedValue::Float(1.0));
    }

    #[test]
    fn same_registers_different_byte_order_double() {
        let regs = [0x3FF0u16, 0x0000, 0x0000, 0x0000];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::BigEndian), &regs,
        ).unwrap();
        assert_eq!(be, MappedValue::Double(1.0));

        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_ne!(le, MappedValue::Double(1.0));
    }

    // -- BigEndianWordSwap (BA-DC pattern) --

    #[test]
    fn big_endian_word_swap_uint32_known_value() {
        let regs = [0x5678u16, 0x1234];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn big_endian_word_swap_int32_negative() {
        let regs = [0xFFFFu16, 0xFFFF];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int32, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Int32(-1));
    }

    #[test]
    fn big_endian_word_swap_uint64_known_value() {
        let regs = [0x2222u16, 0x1111, 0x4444, 0x3333];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x1111222233334444));
    }

    #[test]
    fn big_endian_word_swap_float_pi() {
        let regs = [0x0FDBu16, 0x4049];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Float(std::f32::consts::PI));
    }

    #[test]
    fn big_endian_word_swap_double_pi() {
        let regs = [0x21FBu16, 0x4009, 0x2D18, 0x5444];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Double(std::f64::consts::PI));
    }

    // -- LittleEndianWordSwap (CD-AB pattern) --

    #[test]
    fn little_endian_word_swap_uint32_known_value() {
        let regs = [0x1234u16, 0x5678];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn little_endian_word_swap_uint64_known_value() {
        let regs = [0x3333u16, 0x4444, 0x1111, 0x2222];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x1111222233334444));
    }

    // -- LittleEndian specific tests --

    #[test]
    fn little_endian_uint32_known_value() {
        let regs = [0x5678u16, 0x1234];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt32(0x12345678));
    }

    #[test]
    fn little_endian_uint64_known_value() {
        let regs = [0x4444u16, 0x3333, 0x2222, 0x1111];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::UInt64(0x1111222233334444));
    }

    #[test]
    fn little_endian_float_pi() {
        let regs = [0x0FDBu16, 0x4049];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Float, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Float(std::f32::consts::PI));
    }

    #[test]
    fn little_endian_double_pi() {
        let regs = [0x2D18u16, 0x5444, 0x21FB, 0x4009];
        let result = read_registers_to_mapped(
            &cfg(OpcUaDataType::Double, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        assert_eq!(result, MappedValue::Double(std::f64::consts::PI));
    }

    // -- Single-register types unaffected by byte order --

    #[test]
    fn single_register_types_unaffected_by_byte_order() {
        let all_orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];
        let reg = [0xABCDu16];

        for order in all_orders {
            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::UInt16, order), &reg).unwrap();
            assert_eq!(result, MappedValue::UInt16(0xABCD),
                "UInt16 unaffected by {:?}", order);

            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::Int16, order), &reg).unwrap();
            assert_eq!(result, MappedValue::Int16(0xABCDu16 as i16),
                "Int16 unaffected by {:?}", order);

            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::Byte, order), &reg).unwrap();
            assert_eq!(result, MappedValue::Byte(0xCD),
                "Byte unaffected by {:?}", order);

            let result =
                read_registers_to_mapped(&cfg(OpcUaDataType::SByte, order), &reg).unwrap();
            assert_eq!(result, MappedValue::SByte(0xCDu8 as i8),
                "SByte unaffected by {:?}", order);
        }
    }

    // -- Per-tag: two tags with different byte orders on same data --

    #[test]
    fn per_tag_byte_order_two_tags_same_registers() {
        let regs = [0xAAAAu16, 0xBBBB];

        let tag_a_cfg = cfg(OpcUaDataType::UInt32, ByteOrder::BigEndian);
        let tag_b_cfg = cfg(OpcUaDataType::UInt32, ByteOrder::LittleEndian);

        let val_a = read_registers_to_mapped(&tag_a_cfg, &regs).unwrap();
        let val_b = read_registers_to_mapped(&tag_b_cfg, &regs).unwrap();

        assert_eq!(val_a, MappedValue::UInt32(0xAAAABBBB));
        assert_eq!(val_b, MappedValue::UInt32(0xBBBBAAAA));
        assert_ne!(val_a, val_b);
    }

    #[test]
    fn per_tag_byte_order_four_tags_int64() {
        let regs = [0x0011u16, 0x0022, 0x0033, 0x0044];

        let be = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::BigEndian), &regs,
        ).unwrap();
        let le = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::LittleEndian), &regs,
        ).unwrap();
        let bews = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::BigEndianWordSwap), &regs,
        ).unwrap();
        let lews = read_registers_to_mapped(
            &cfg(OpcUaDataType::Int64, ByteOrder::LittleEndianWordSwap), &regs,
        ).unwrap();

        let values = [&be, &le, &bews, &lews];
        for i in 0..values.len() {
            for j in (i + 1)..values.len() {
                assert_ne!(values[i], values[j],
                    "byte orders {} and {} should differ", i, j);
            }
        }
    }

    // -- Round-trip: write then read with each byte order --

    #[test]
    fn round_trip_all_byte_orders_all_multi_register_types() {
        let orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];

        for order in orders {
            let c = cfg(OpcUaDataType::Int32, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Int32(-123456)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Int32(-123456), "Int32 {:?}", order);

            let c = cfg(OpcUaDataType::UInt32, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt32(0xDEADBEEF)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::UInt32(0xDEADBEEF), "UInt32 {:?}", order);

            let c = cfg(OpcUaDataType::Int64, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Int64(-9876543210)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Int64(-9876543210), "Int64 {:?}", order);

            let c = cfg(OpcUaDataType::UInt64, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt64(0x123456789ABCDEF0)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::UInt64(0x123456789ABCDEF0), "UInt64 {:?}", order);

            let c = cfg(OpcUaDataType::Float, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Float(42.5)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Float(42.5), "Float {:?}", order);

            let c = cfg(OpcUaDataType::Double, order);
            let regs = write_mapped_to_registers(&c, &MappedValue::Double(std::f64::consts::E)).unwrap();
            let read = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read, MappedValue::Double(std::f64::consts::E), "Double {:?}", order);
        }
    }

    // -- Verify to_logical_order correctness --

    #[test]
    fn to_logical_order_big_endian_is_identity() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(ByteOrder::BigEndian.to_logical_order(&regs), regs.to_vec());
    }

    #[test]
    fn to_logical_order_little_endian_reverses() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(
            ByteOrder::LittleEndian.to_logical_order(&regs),
            vec![0xDDDD, 0xCCCC, 0xBBBB, 0xAAAA]
        );
    }

    #[test]
    fn to_logical_order_big_endian_word_swap_swaps_pairs() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(
            ByteOrder::BigEndianWordSwap.to_logical_order(&regs),
            vec![0xBBBB, 0xAAAA, 0xDDDD, 0xCCCC]
        );
    }

    #[test]
    fn to_logical_order_little_endian_word_swap() {
        let regs = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        assert_eq!(
            ByteOrder::LittleEndianWordSwap.to_logical_order(&regs),
            vec![0xCCCC, 0xDDDD, 0xAAAA, 0xBBBB]
        );
    }

    // -- Boolean read unaffected by byte order --

    #[test]
    fn boolean_read_unaffected_by_byte_order() {
        assert_eq!(read_bool_mapped(true), MappedValue::Boolean(true));
        assert_eq!(read_bool_mapped(false), MappedValue::Boolean(false));
    }

    // -- Word swap equivalences for 2-register types --

    #[test]
    fn word_swap_equivalences_for_two_registers() {
        let regs = [0x1234u16, 0x5678];

        let bews = ByteOrder::BigEndianWordSwap.to_logical_order(&regs);
        let le = ByteOrder::LittleEndian.to_logical_order(&regs);
        assert_eq!(bews, le);

        let lews = ByteOrder::LittleEndianWordSwap.to_logical_order(&regs);
        let be = ByteOrder::BigEndian.to_logical_order(&regs);
        assert_eq!(lews, be);
    }

    // -- 4-register types: all byte orders produce distinct results --

    #[test]
    fn four_register_all_orders_distinct() {
        let regs = [0x0001u16, 0x0002, 0x0003, 0x0004];

        let be = ByteOrder::BigEndian.to_logical_order(&regs);
        let le = ByteOrder::LittleEndian.to_logical_order(&regs);
        let bews = ByteOrder::BigEndianWordSwap.to_logical_order(&regs);
        let lews = ByteOrder::LittleEndianWordSwap.to_logical_order(&regs);

        assert_eq!(be, vec![0x0001, 0x0002, 0x0003, 0x0004]);
        assert_eq!(le, vec![0x0004, 0x0003, 0x0002, 0x0001]);
        assert_eq!(bews, vec![0x0002, 0x0001, 0x0004, 0x0003]);
        assert_eq!(lews, vec![0x0003, 0x0004, 0x0001, 0x0002]);

        let all = [&be, &le, &bews, &lews];
        for i in 0..all.len() {
            for j in (i + 1)..all.len() {
                assert_ne!(all[i], all[j]);
            }
        }
    }

    // ========================================================================
    // Sub-AC 2 of AC 4: Per-tag byte order applied when packing typed
    //   values into U16 registers during write operations
    // ========================================================================

    // --- Explicit write register layout for all byte orders (32-bit) ---

    #[test]
    fn write_int32_all_byte_orders_exact_layout() {
        // 0x12345678 → logical [0x1234, 0x5678]
        let val = MappedValue::Int32(0x12345678);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::BigEndian);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x1234, 0x5678]);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::LittleEndian);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x5678, 0x1234]);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::BigEndianWordSwap);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x5678, 0x1234]);

        let c = cfg(OpcUaDataType::Int32, ByteOrder::LittleEndianWordSwap);
        assert_eq!(write_mapped_to_registers(&c, &val).unwrap(), vec![0x1234, 0x5678]);
    }

    // --- Explicit write register layout for all byte orders (64-bit) ---

    #[test]
    fn write_uint64_all_byte_orders_exact_layout() {
        // 0x0001000200030004 → logical [0x0001, 0x0002, 0x0003, 0x0004]
        let val = MappedValue::UInt64(0x0001000200030004u64);

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0001, 0x0002, 0x0003, 0x0004]
        );

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0004, 0x0003, 0x0002, 0x0001]
        );

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::BigEndianWordSwap);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0002, 0x0001, 0x0004, 0x0003]
        );

        let c = cfg(OpcUaDataType::UInt64, ByteOrder::LittleEndianWordSwap);
        assert_eq!(
            write_mapped_to_registers(&c, &val).unwrap(),
            vec![0x0003, 0x0004, 0x0001, 0x0002]
        );
    }

    #[test]
    fn write_int64_all_byte_orders_exact_layout() {
        // -1i64 = 0xFFFFFFFFFFFFFFFF → logical [0xFFFF; 4]
        // All byte orders produce the same result for uniform words
        let val = MappedValue::Int64(-1);
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Int64, order);
            assert_eq!(
                write_mapped_to_registers(&c, &val).unwrap(),
                vec![0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF],
                "Int64(-1) should be all 0xFFFF regardless of {:?}",
                order
            );
        }

        // Non-uniform value: 0x0A0B0C0D0E0F1011
        let val2 = MappedValue::Int64(0x0A0B0C0D0E0F1011);
        let c = cfg(OpcUaDataType::Int64, ByteOrder::LittleEndianWordSwap);
        assert_eq!(
            write_mapped_to_registers(&c, &val2).unwrap(),
            vec![0x0E0F, 0x1011, 0x0A0B, 0x0C0D]
        );
    }

    // --- Explicit write register layout for Float with word-swap ---

    #[test]
    fn write_float_big_endian_word_swap() {
        // 1.0f32 = 0x3F800000 → logical [0x3F80, 0x0000]
        // BigEndianWordSwap swaps pairs → [0x0000, 0x3F80]
        let c = cfg(OpcUaDataType::Float, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn write_float_little_endian_word_swap() {
        // 1.0f32 → logical [0x3F80, 0x0000]
        // LittleEndianWordSwap for 2 regs = identity (same as BigEndian)
        let c = cfg(OpcUaDataType::Float, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x3F80, 0x0000]);
    }

    // --- Explicit write register layout for Double with word-swap ---

    #[test]
    fn write_double_big_endian_word_swap() {
        // 1.0f64 = 0x3FF0000000000000 → logical [0x3FF0, 0x0000, 0x0000, 0x0000]
        // BigEndianWordSwap swaps pairs → [0x0000, 0x3FF0, 0x0000, 0x0000]
        let c = cfg(OpcUaDataType::Double, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3FF0, 0x0000, 0x0000]);
    }

    #[test]
    fn write_double_little_endian_word_swap() {
        // 1.0f64 → logical [0x3FF0, 0x0000, 0x0000, 0x0000]
        // LittleEndianWordSwap: reverse → [0x0000, 0x0000, 0x0000, 0x3FF0]
        //   then swap pairs → [0x0000, 0x0000, 0x3FF0, 0x0000]
        let c = cfg(OpcUaDataType::Double, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x0000, 0x3FF0, 0x0000]);
    }

    // --- from_logical_order explicit tests for 4-register values ---

    #[test]
    fn from_logical_order_big_endian_word_swap_4regs() {
        let logical = [0x0001u16, 0x0002, 0x0003, 0x0004];
        assert_eq!(
            ByteOrder::BigEndianWordSwap.from_logical_order(&logical),
            vec![0x0002, 0x0001, 0x0004, 0x0003]
        );
    }

    #[test]
    fn from_logical_order_little_endian_word_swap_4regs() {
        let logical = [0x0001u16, 0x0002, 0x0003, 0x0004];
        // from_logical_order for LEWS: reverse → [4,3,2,1], swap pairs → [3,4,1,2]
        assert_eq!(
            ByteOrder::LittleEndianWordSwap.from_logical_order(&logical),
            vec![0x0003, 0x0004, 0x0001, 0x0002]
        );
    }

    #[test]
    fn from_logical_order_round_trip_is_inverse_of_to_logical_order() {
        let address_order = [0xAAAAu16, 0xBBBB, 0xCCCC, 0xDDDD];
        for order in [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let logical = order.to_logical_order(&address_order);
            let back = order.from_logical_order(&logical);
            assert_eq!(
                back, address_order.to_vec(),
                "from_logical_order should invert to_logical_order for {:?}",
                order
            );
        }
    }

    // --- Write then read round-trip for all multi-register types × all byte orders ---

    #[test]
    fn write_read_round_trip_all_types_all_byte_orders() {
        let orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];

        for order in orders {
            // Int32
            let c = cfg(OpcUaDataType::Int32, order);
            let v = MappedValue::Int32(-987654);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 2);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Int32 {:?}", order);

            // UInt32
            let c = cfg(OpcUaDataType::UInt32, order);
            let v = MappedValue::UInt32(0xCAFEBABE);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 2);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "UInt32 {:?}", order);

            // Int64
            let c = cfg(OpcUaDataType::Int64, order);
            let v = MappedValue::Int64(i64::MIN + 42);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 4);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Int64 {:?}", order);

            // UInt64
            let c = cfg(OpcUaDataType::UInt64, order);
            let v = MappedValue::UInt64(0xFEDCBA9876543210);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 4);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "UInt64 {:?}", order);

            // Float
            let c = cfg(OpcUaDataType::Float, order);
            let v = MappedValue::Float(-273.15);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 2);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Float {:?}", order);

            // Double
            let c = cfg(OpcUaDataType::Double, order);
            let v = MappedValue::Double(std::f64::consts::TAU);
            let regs = write_mapped_to_registers(&c, &v).unwrap();
            assert_eq!(regs.len(), 4);
            assert_eq!(read_registers_to_mapped(&c, &regs).unwrap(), v, "Double {:?}", order);
        }
    }

    // --- Verify different byte orders produce different register layouts for writes ---

    #[test]
    fn write_different_byte_orders_produce_different_registers_4word() {
        let val = MappedValue::UInt64(0x0A0B0C0D0E0F1011);
        let orders = [
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ];
        let results: Vec<Vec<u16>> = orders
            .iter()
            .map(|&o| {
                let c = cfg(OpcUaDataType::UInt64, o);
                write_mapped_to_registers(&c, &val).unwrap()
            })
            .collect();

        // All 4 byte orders should produce distinct register layouts for 4-word types
        for i in 0..results.len() {
            for j in (i + 1)..results.len() {
                assert_ne!(
                    results[i], results[j],
                    "byte orders {:?} and {:?} should produce different write layouts",
                    orders[i], orders[j]
                );
            }
        }
    }

    // ========================================================================
    // AC 5: String type supports user-specified max register count
    //        (maxStringLength field)
    // ========================================================================

    #[test]
    fn ac5_string_max_string_length_defaults_to_none() {
        let cfg = StringMappingConfig::default();
        assert_eq!(cfg.max_string_length, None);
    }

    #[test]
    fn ac5_validation_accepts_word_count_within_limit() {
        let cfg = StringMappingConfig {
            max_string_length: Some(10),
            ..Default::default()
        };
        assert!(cfg.validate(10).is_ok());
        assert!(cfg.validate(5).is_ok());
        assert!(cfg.validate(1).is_ok());
    }

    #[test]
    fn ac5_validation_rejects_word_count_exceeding_limit() {
        let cfg = StringMappingConfig {
            max_string_length: Some(4),
            ..Default::default()
        };
        let err = cfg.validate(5).unwrap_err();
        assert!(err.contains("exceeds maxStringLength"));
    }

    #[test]
    fn ac5_validation_rejects_zero_max_string_length() {
        let cfg = StringMappingConfig {
            max_string_length: Some(0),
            ..Default::default()
        };
        let err = cfg.validate(1).unwrap_err();
        assert!(err.contains("maxStringLength must be > 0"));
    }

    #[test]
    fn ac5_none_imposes_no_extra_constraint() {
        let cfg = StringMappingConfig {
            max_string_length: None,
            ..Default::default()
        };
        assert!(cfg.validate(1).is_ok());
        assert!(cfg.validate(100).is_ok());
        assert!(cfg.validate(u16::MAX).is_ok());
    }

    #[test]
    fn ac5_effective_word_count_clamped() {
        let cfg = StringMappingConfig {
            max_string_length: Some(8),
            ..Default::default()
        };
        assert_eq!(cfg.effective_word_count(4), 4);
        assert_eq!(cfg.effective_word_count(8), 8);
        assert_eq!(cfg.effective_word_count(16), 8);
    }

    #[test]
    fn ac5_effective_word_count_no_max() {
        let cfg = StringMappingConfig {
            max_string_length: None,
            ..Default::default()
        };
        assert_eq!(cfg.effective_word_count(4), 4);
        assert_eq!(cfg.effective_word_count(100), 100);
    }

    #[test]
    fn ac5_string_with_max_length_constructor() {
        let cfg = OpcUaMappingConfig::string_with_max_length(8, 16);
        assert_eq!(cfg.opcua_data_type, OpcUaDataType::String);
        assert_eq!(cfg.word_count, 8);
        let sc = cfg.string_config.as_ref().unwrap();
        assert_eq!(sc.max_string_length, Some(16));
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn ac5_opcua_mapping_validate_delegates_to_string_config() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 20,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig {
                max_string_length: Some(10),
                ..Default::default()
            }),
        };
        let err = cfg.validate().unwrap_err();
        assert!(err.contains("exceeds maxStringLength"));
    }

    #[test]
    fn ac5_serde_camel_case_field_names() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 8);
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(json.contains("\"stringConfig\""));
        assert!(json.contains("\"maxStringLength\""));
    }

    #[test]
    fn ac5_serde_round_trip_with_max_string_length() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 10,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: Some("Device name".to_string()),
            string_config: Some(StringMappingConfig {
                encoding: StringEncoding::Ascii,
                max_byte_length: Some(16),
                null_terminated: true,
                max_string_length: Some(10),
            }),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        let de: OpcUaMappingConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(cfg, de);
    }

    #[test]
    fn ac5_string_config_none_omitted() {
        let cfg = OpcUaMappingConfig::default_for_word();
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("stringConfig"));
    }

    #[test]
    fn ac5_max_string_length_none_omitted() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 4,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig::default()),
        };
        let json = serde_json::to_string(&cfg).unwrap();
        assert!(!json.contains("maxStringLength"));
    }

    #[test]
    fn ac5_read_string_with_max_string_length() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 4);
        let regs = [0x4865u16, 0x6C6C, 0x6F00, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::String("Hello".to_string()));
    }

    #[test]
    fn ac5_write_string_with_max_string_length() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 8);
        let value = MappedValue::String("Hi".to_string());
        let regs = write_mapped_to_registers(&cfg, &value).unwrap();
        assert_eq!(regs.len(), 4);
        assert_eq!(regs[0], 0x4869);
        assert_eq!(regs[1], 0x0000);
    }

    #[test]
    fn ac5_string_round_trip_with_max_string_length() {
        let cfg = OpcUaMappingConfig::string_with_max_length(8, 16);
        let original = "Test123";
        let value = MappedValue::String(original.to_string());
        let regs = write_mapped_to_registers(&cfg, &value).unwrap();
        assert_eq!(regs.len(), 8);
        let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(read_back, MappedValue::String(original.to_string()));
    }

    #[test]
    fn ac5_string_insufficient_registers_rejected() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 4);
        let regs = [0x4100u16, 0x0000];
        let err = read_registers_to_mapped(&cfg, &regs).unwrap_err();
        match err {
            MappingError::InsufficientRegisters { expected, actual } => {
                assert_eq!(expected, 4);
                assert_eq!(actual, 2);
            }
            _ => panic!("unexpected error: {:?}", err),
        }
    }

    #[test]
    fn ac5_string_write_type_mismatch() {
        let cfg = OpcUaMappingConfig::string_with_max_length(4, 4);
        let value = MappedValue::UInt16(42);
        let err = write_mapped_to_registers(&cfg, &value).unwrap_err();
        match err {
            MappingError::TypeMismatch { type_name, .. } => {
                assert_eq!(type_name, "String");
            }
            _ => panic!("unexpected error: {:?}", err),
        }
    }

    #[test]
    fn ac5_string_utf16_with_max_string_length() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 4,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: Some(StringMappingConfig {
                encoding: StringEncoding::Utf16,
                max_string_length: Some(4),
                null_terminated: true,
                max_byte_length: None,
            }),
        };
        assert!(cfg.validate().is_ok());

        let value = MappedValue::String("Hi".to_string());
        let regs = write_mapped_to_registers(&cfg, &value).unwrap();
        assert_eq!(regs[0], 0x0048);
        assert_eq!(regs[1], 0x0069);

        let read_back = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(read_back, MappedValue::String("Hi".to_string()));
    }

    #[test]
    fn ac5_both_max_byte_and_max_string_length() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 8,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: Some(StringMappingConfig {
                encoding: StringEncoding::Utf8,
                max_byte_length: Some(10),
                null_terminated: true,
                max_string_length: Some(8),
            }),
        };
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn ac5_string_no_config_defaults_work() {
        let cfg = OpcUaMappingConfig {
            opcua_data_type: OpcUaDataType::String,
            word_count: 2,
            byte_order: ByteOrder::BigEndian,
            access_level: MappingAccessLevel::ReadOnly,
            description: None,
            string_config: None,
        };
        assert!(cfg.validate().is_ok());

        let regs = [0x4142u16, 0x0000];
        let result = read_registers_to_mapped(&cfg, &regs).unwrap();
        assert_eq!(result, MappedValue::String("AB".to_string()));
    }
}

// ---------------------------------------------------------------------------
// Sub-AC 3 of AC 4: Decomposition tests — MappedValue → U16 registers
// with all byte order configurations
// ---------------------------------------------------------------------------

#[cfg(test)]
mod decomposition_tests {
    use super::*;

    /// Helper to create a config for a given data type, word count, and byte order.
    fn cfg(dt: OpcUaDataType, wc: u16, bo: ByteOrder) -> OpcUaMappingConfig {
        OpcUaMappingConfig {
            opcua_data_type: dt,
            word_count: wc,
            byte_order: bo,
            access_level: MappingAccessLevel::ReadWrite,
            description: None,
            string_config: None,
        }
    }

    // -----------------------------------------------------------------------
    // 8-bit types: SByte / Byte — single register, byte order irrelevant
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_sbyte_positive() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::SByte(42)).unwrap();
        assert_eq!(regs, vec![42u16]);
    }

    #[test]
    fn decompose_sbyte_negative() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::SByte(-1)).unwrap();
        // -1i8 as u8 = 0xFF, as u16 = 0x00FF
        assert_eq!(regs, vec![0x00FFu16]);
    }

    #[test]
    fn decompose_sbyte_min_max() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        let min_regs = write_mapped_to_registers(&c, &MappedValue::SByte(i8::MIN)).unwrap();
        assert_eq!(min_regs, vec![0x0080u16]); // -128 as u8 = 0x80
        let max_regs = write_mapped_to_registers(&c, &MappedValue::SByte(i8::MAX)).unwrap();
        assert_eq!(max_regs, vec![0x007Fu16]); // 127
    }

    #[test]
    fn decompose_byte_zero_and_max() {
        let c = cfg(OpcUaDataType::Byte, 1, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Byte(0)).unwrap(),
            vec![0u16]
        );
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Byte(255)).unwrap(),
            vec![255u16]
        );
    }

    // -----------------------------------------------------------------------
    // 16-bit types: Int16 / UInt16 — single register, byte order irrelevant
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_int16_positive_and_negative() {
        let c = cfg(OpcUaDataType::Int16, 1, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Int16(1234)).unwrap(),
            vec![1234u16]
        );
        // -1i16 as u16 = 0xFFFF
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::Int16(-1)).unwrap(),
            vec![0xFFFFu16]
        );
    }

    #[test]
    fn decompose_uint16_boundary() {
        let c = cfg(OpcUaDataType::UInt16, 1, ByteOrder::BigEndian);
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::UInt16(0)).unwrap(),
            vec![0u16]
        );
        assert_eq!(
            write_mapped_to_registers(&c, &MappedValue::UInt16(0xFFFF)).unwrap(),
            vec![0xFFFFu16]
        );
    }

    // -----------------------------------------------------------------------
    // 32-bit integers: Int32 / UInt32 — 2 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    /// Test value: 0x12345678 → logical order [0x1234, 0x5678]
    const TEST_I32: i32 = 0x12345678_i32;
    const TEST_U32: u32 = 0x12345678_u32;

    #[test]
    fn decompose_int32_big_endian() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // BigEndian: address order = logical order → [0x1234, 0x5678]
        assert_eq!(regs, vec![0x1234, 0x5678]);
    }

    #[test]
    fn decompose_int32_little_endian() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // LittleEndian: reversed → [0x5678, 0x1234]
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    #[test]
    fn decompose_int32_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // BigEndianWordSwap: swap pairs → [0x5678, 0x1234]
        assert_eq!(regs, vec![0x5678, 0x1234]);
    }

    #[test]
    fn decompose_int32_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(TEST_I32)).unwrap();
        // LittleEndianWordSwap: reverse then swap pairs → [0x1234, 0x5678]
        assert_eq!(regs, vec![0x1234, 0x5678]);
    }

    #[test]
    fn decompose_uint32_all_byte_orders() {
        let orders_and_expected: &[(ByteOrder, Vec<u16>)] = &[
            (ByteOrder::BigEndian, vec![0x1234, 0x5678]),
            (ByteOrder::LittleEndian, vec![0x5678, 0x1234]),
            (ByteOrder::BigEndianWordSwap, vec![0x5678, 0x1234]),
            (ByteOrder::LittleEndianWordSwap, vec![0x1234, 0x5678]),
        ];
        for (bo, expected) in orders_and_expected {
            let c = cfg(OpcUaDataType::UInt32, 2, *bo);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt32(TEST_U32)).unwrap();
            assert_eq!(regs, *expected, "UInt32 with {:?}", bo);
        }
    }

    #[test]
    fn decompose_int32_negative_value() {
        // -1 → 0xFFFFFFFF → logical [0xFFFF, 0xFFFF]
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF, 0xFFFF]);
    }

    #[test]
    fn decompose_int32_min_value() {
        // i32::MIN = 0x80000000 → logical [0x8000, 0x0000]
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int32(i32::MIN)).unwrap();
        assert_eq!(regs, vec![0x8000, 0x0000]);
    }

    // -----------------------------------------------------------------------
    // 64-bit integers: Int64 / UInt64 — 4 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    /// Test value: 0x0011_2233_4455_6677
    /// Logical order: [0x0011, 0x2233, 0x4455, 0x6677]
    const TEST_I64: i64 = 0x0011_2233_4455_6677_i64;
    const TEST_U64: u64 = 0x0011_2233_4455_6677_u64;

    #[test]
    fn decompose_int64_big_endian() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        assert_eq!(regs, vec![0x0011, 0x2233, 0x4455, 0x6677]);
    }

    #[test]
    fn decompose_int64_little_endian() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        // Reversed: [0x6677, 0x4455, 0x2233, 0x0011]
        assert_eq!(regs, vec![0x6677, 0x4455, 0x2233, 0x0011]);
    }

    #[test]
    fn decompose_int64_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        // Swap pairs: [0x2233, 0x0011, 0x6677, 0x4455]
        assert_eq!(regs, vec![0x2233, 0x0011, 0x6677, 0x4455]);
    }

    #[test]
    fn decompose_int64_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(TEST_I64)).unwrap();
        // Reverse then swap pairs: [0x4455, 0x6677, 0x0011, 0x2233]
        assert_eq!(regs, vec![0x4455, 0x6677, 0x0011, 0x2233]);
    }

    #[test]
    fn decompose_uint64_all_byte_orders() {
        let orders_and_expected: &[(ByteOrder, Vec<u16>)] = &[
            (ByteOrder::BigEndian, vec![0x0011, 0x2233, 0x4455, 0x6677]),
            (ByteOrder::LittleEndian, vec![0x6677, 0x4455, 0x2233, 0x0011]),
            (ByteOrder::BigEndianWordSwap, vec![0x2233, 0x0011, 0x6677, 0x4455]),
            (ByteOrder::LittleEndianWordSwap, vec![0x4455, 0x6677, 0x0011, 0x2233]),
        ];
        for (bo, expected) in orders_and_expected {
            let c = cfg(OpcUaDataType::UInt64, 4, *bo);
            let regs = write_mapped_to_registers(&c, &MappedValue::UInt64(TEST_U64)).unwrap();
            assert_eq!(regs, *expected, "UInt64 with {:?}", bo);
        }
    }

    #[test]
    fn decompose_int64_negative_one() {
        let c = cfg(OpcUaDataType::Int64, 4, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Int64(-1)).unwrap();
        assert_eq!(regs, vec![0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF]);
    }

    // -----------------------------------------------------------------------
    // Float (IEEE 754 single) — 2 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_float_big_endian() {
        // 1.0f32 = 0x3F800000 → logical [0x3F80, 0x0000]
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x3F80, 0x0000]);
    }

    #[test]
    fn decompose_float_little_endian() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn decompose_float_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x3F80]);
    }

    #[test]
    fn decompose_float_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(1.0)).unwrap();
        assert_eq!(regs, vec![0x3F80, 0x0000]);
    }

    #[test]
    fn decompose_float_known_value() {
        // 12345.6789 ≈ 0x4640E6B7 → logical [0x4640, 0xE6B7]
        let val: f32 = 12345.6789;
        let bits = val.to_bits();
        let hi = (bits >> 16) as u16;
        let lo = bits as u16;

        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(val)).unwrap();
        assert_eq!(regs, vec![hi, lo]);
    }

    #[test]
    fn decompose_float_negative_infinity() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Float(f32::NEG_INFINITY)).unwrap();
        let bits = f32::NEG_INFINITY.to_bits();
        assert_eq!(regs, vec![(bits >> 16) as u16, bits as u16]);
    }

    // -----------------------------------------------------------------------
    // Double (IEEE 754 double) — 4 registers, all 4 byte orders
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_double_big_endian() {
        // 1.0f64 = 0x3FF0000000000000 → logical [0x3FF0, 0x0000, 0x0000, 0x0000]
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x3FF0, 0x0000, 0x0000, 0x0000]);
    }

    #[test]
    fn decompose_double_little_endian() {
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::LittleEndian);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        assert_eq!(regs, vec![0x0000, 0x0000, 0x0000, 0x3FF0]);
    }

    #[test]
    fn decompose_double_big_endian_word_swap() {
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::BigEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        // Swap pairs: [0x0000, 0x3FF0, 0x0000, 0x0000]
        assert_eq!(regs, vec![0x0000, 0x3FF0, 0x0000, 0x0000]);
    }

    #[test]
    fn decompose_double_little_endian_word_swap() {
        let c = cfg(OpcUaDataType::Double, 4, ByteOrder::LittleEndianWordSwap);
        let regs = write_mapped_to_registers(&c, &MappedValue::Double(1.0)).unwrap();
        // Reverse [0x0000, 0x0000, 0x0000, 0x3FF0] then swap pairs: [0x0000, 0x0000, 0x3FF0, 0x0000]
        assert_eq!(regs, vec![0x0000, 0x0000, 0x3FF0, 0x0000]);
    }

    #[test]
    fn decompose_double_all_byte_orders() {
        // π ≈ 3.141592653589793 → 0x400921FB54442D18
        let val = std::f64::consts::PI;
        let bits = val.to_bits();
        let logical = [
            (bits >> 48) as u16,
            (bits >> 32) as u16,
            (bits >> 16) as u16,
            bits as u16,
        ];

        let orders_and_expected: Vec<(ByteOrder, Vec<u16>)> = vec![
            (ByteOrder::BigEndian, logical.to_vec()),
            (ByteOrder::LittleEndian, {
                let mut v = logical.to_vec();
                v.reverse();
                v
            }),
            (ByteOrder::BigEndianWordSwap, vec![logical[1], logical[0], logical[3], logical[2]]),
            (ByteOrder::LittleEndianWordSwap, {
                // reverse then swap pairs
                let mut v = logical.to_vec();
                v.reverse();
                for chunk in v.chunks_exact_mut(2) {
                    chunk.swap(0, 1);
                }
                v
            }),
        ];

        for (bo, expected) in &orders_and_expected {
            let c = cfg(OpcUaDataType::Double, 4, *bo);
            let regs = write_mapped_to_registers(&c, &MappedValue::Double(val)).unwrap();
            assert_eq!(regs, *expected, "Double(π) with {:?}", bo);
        }
    }

    // -----------------------------------------------------------------------
    // Boolean — should error (must use write_bool_mapped instead)
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_boolean_returns_error() {
        let c = cfg(OpcUaDataType::Boolean, 1, ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&c, &MappedValue::Boolean(true));
        assert!(matches!(result, Err(MappingError::BooleanTypeMismatch)));
    }

    // -----------------------------------------------------------------------
    // Type mismatch — wrong MappedValue variant for config type
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_type_mismatch_int32_with_uint32_value() {
        let c = cfg(OpcUaDataType::Int32, 2, ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&c, &MappedValue::UInt32(42));
        assert!(matches!(result, Err(MappingError::TypeMismatch { .. })));
    }

    #[test]
    fn decompose_type_mismatch_float_with_double_value() {
        let c = cfg(OpcUaDataType::Float, 2, ByteOrder::BigEndian);
        let result = write_mapped_to_registers(&c, &MappedValue::Double(1.0));
        assert!(matches!(result, Err(MappingError::TypeMismatch { .. })));
    }

    // -----------------------------------------------------------------------
    // Round-trip: decompose then reassemble preserves value for all byte orders
    // -----------------------------------------------------------------------

    #[test]
    fn roundtrip_int32_all_byte_orders() {
        let value = MappedValue::Int32(0x7ABCDEF0_u32 as i32);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Int32, 2, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "Int32 roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_uint64_all_byte_orders() {
        let value = MappedValue::UInt64(0xDEADBEEF_CAFEBABE);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::UInt64, 4, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "UInt64 roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_float_all_byte_orders() {
        let value = MappedValue::Float(-273.15);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Float, 2, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "Float roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_double_all_byte_orders() {
        let value = MappedValue::Double(std::f64::consts::E);
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Double, 4, *bo);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "Double roundtrip with {:?}", bo);
        }
    }

    #[test]
    fn roundtrip_uint16_single_register() {
        let value = MappedValue::UInt16(0xABCD);
        let c = cfg(OpcUaDataType::UInt16, 1, ByteOrder::BigEndian);
        let regs = write_mapped_to_registers(&c, &value).unwrap();
        assert_eq!(regs, vec![0xABCD]);
        let read_back = read_registers_to_mapped(&c, &regs).unwrap();
        assert_eq!(read_back, value);
    }

    #[test]
    fn roundtrip_sbyte_all_values_preserve() {
        let c = cfg(OpcUaDataType::SByte, 1, ByteOrder::BigEndian);
        for v in [i8::MIN, -1, 0, 1, i8::MAX] {
            let value = MappedValue::SByte(v);
            let regs = write_mapped_to_registers(&c, &value).unwrap();
            let read_back = read_registers_to_mapped(&c, &regs).unwrap();
            assert_eq!(read_back, value, "SByte roundtrip for {}", v);
        }
    }

    // -----------------------------------------------------------------------
    // Verify different byte orders produce distinct register layouts
    // -----------------------------------------------------------------------

    #[test]
    fn byte_orders_produce_distinct_layouts_for_uint32() {
        let c_be = cfg(OpcUaDataType::UInt32, 2, ByteOrder::BigEndian);
        let c_le = cfg(OpcUaDataType::UInt32, 2, ByteOrder::LittleEndian);
        let val = MappedValue::UInt32(0xAAAA_BBBBu32);

        let regs_be = write_mapped_to_registers(&c_be, &val).unwrap();
        let regs_le = write_mapped_to_registers(&c_le, &val).unwrap();

        // BE: [0xAAAA, 0xBBBB], LE: [0xBBBB, 0xAAAA]
        assert_ne!(regs_be, regs_le, "BE and LE should produce different register layouts");
        assert_eq!(regs_be, vec![0xAAAA, 0xBBBB]);
        assert_eq!(regs_le, vec![0xBBBB, 0xAAAA]);
    }

    #[test]
    fn byte_orders_produce_distinct_layouts_for_int64() {
        let val = MappedValue::Int64(0x1111_2222_3333_4444_i64);
        let mut all_regs: Vec<Vec<u16>> = Vec::new();
        for bo in &[
            ByteOrder::BigEndian,
            ByteOrder::LittleEndian,
            ByteOrder::BigEndianWordSwap,
            ByteOrder::LittleEndianWordSwap,
        ] {
            let c = cfg(OpcUaDataType::Int64, 4, *bo);
            let regs = write_mapped_to_registers(&c, &val).unwrap();
            all_regs.push(regs);
        }
        // All 4 byte orders should produce distinct register layouts
        for i in 0..all_regs.len() {
            for j in (i + 1)..all_regs.len() {
                assert_ne!(
                    all_regs[i], all_regs[j],
                    "Byte orders {} and {} should produce different layouts",
                    i, j
                );
            }
        }
    }

    // -----------------------------------------------------------------------
    // Edge cases: zero values
    // -----------------------------------------------------------------------

    #[test]
    fn decompose_zero_values_all_types() {
        // Zero produces all-zero registers regardless of byte order
        let test_cases: Vec<(OpcUaDataType, u16, MappedValue, usize)> = vec![
            (OpcUaDataType::SByte, 1, MappedValue::SByte(0), 1),
            (OpcUaDataType::Byte, 1, MappedValue::Byte(0), 1),
            (OpcUaDataType::Int16, 1, MappedValue::Int16(0), 1),
            (OpcUaDataType::UInt16, 1, MappedValue::UInt16(0), 1),
            (OpcUaDataType::Int32, 2, MappedValue::Int32(0), 2),
            (OpcUaDataType::UInt32, 2, MappedValue::UInt32(0), 2),
            (OpcUaDataType::Int64, 4, MappedValue::Int64(0), 4),
            (OpcUaDataType::UInt64, 4, MappedValue::UInt64(0), 4),
            (OpcUaDataType::Float, 2, MappedValue::Float(0.0), 2),
            (OpcUaDataType::Double, 4, MappedValue::Double(0.0), 4),
        ];

        for (dt, wc, val, expected_len) in &test_cases {
            for bo in &[
                ByteOrder::BigEndian,
                ByteOrder::LittleEndian,
                ByteOrder::BigEndianWordSwap,
                ByteOrder::LittleEndianWordSwap,
            ] {
                let c = cfg(*dt, *wc, *bo);
                let regs = write_mapped_to_registers(&c, val).unwrap();
                assert_eq!(regs.len(), *expected_len, "{:?} register count", dt);
                assert!(
                    regs.iter().all(|&r| r == 0),
                    "Zero {:?} with {:?} should produce all-zero registers, got {:?}",
                    dt,
                    bo,
                    regs
                );
            }
        }
    }
}
