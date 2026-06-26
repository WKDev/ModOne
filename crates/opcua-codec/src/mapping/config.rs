// 태그별 OPC UA 매핑 설정(데이터 타입/워드 수/바이트 순서/문자열 설정)과 레지스터 범위 도출

use serde::{Deserialize, Serialize};

use modone_contract::CanonicalAddress;

use crate::mapping::{ByteOrder, MappingAccessLevel, OpcUaDataType, RegisterRange};

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

impl Default for OpcUaMappingConfig {
    /// Defaults to UInt16, wordCount=1, BigEndian, ReadOnly (same as `default_for_word`).
    fn default() -> Self {
        Self::default_for_word()
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
