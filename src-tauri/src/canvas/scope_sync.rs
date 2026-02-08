//! Scope Synchronization Module
//!
//! Provides synchronization between scope engines and the circuit/PLC simulation.
//! Routes device memory values to scope channels for oscilloscope-like visualization.

use serde::{Deserialize, Serialize};

// ============================================================================
// Scope Channel Mapping
// ============================================================================

/// Maps a scope channel to a device address in simulation memory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeChannelMapping {
    /// Scope block ID
    pub scope_id: String,
    /// Channel index (0-based)
    pub channel: usize,
    /// Device type (M, P, K, D, etc.)
    pub device_type: String,
    /// Device address number
    pub address: u16,
    /// Voltage scale factor (device value * scale = voltage)
    /// For bit devices: true=scale, false=0
    /// For word devices: value * scale
    #[serde(default = "default_scale")]
    pub scale: f32,
    /// Voltage offset
    #[serde(default)]
    pub offset: f32,
    /// Whether this channel is enabled
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// Optional label for display
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

fn default_scale() -> f32 {
    1.0
}

fn default_enabled() -> bool {
    true
}

impl ScopeChannelMapping {
    /// Create a new bit device mapping (e.g., M0, P5)
    ///
    /// For bit devices, the voltage will be:
    /// - `scale` volts when the bit is true
    /// - `0` volts when the bit is false
    pub fn new_bit(
        scope_id: impl Into<String>,
        channel: usize,
        device_type: impl Into<String>,
        address: u16,
    ) -> Self {
        Self {
            scope_id: scope_id.into(),
            channel,
            device_type: device_type.into(),
            address,
            scale: 5.0, // Default 5V for logic high
            offset: 0.0,
            enabled: true,
            label: None,
        }
    }

    /// Create a new word device mapping (e.g., D100, R50)
    ///
    /// For word devices, the voltage will be:
    /// `value * scale + offset`
    pub fn new_word(
        scope_id: impl Into<String>,
        channel: usize,
        device_type: impl Into<String>,
        address: u16,
    ) -> Self {
        Self {
            scope_id: scope_id.into(),
            channel,
            device_type: device_type.into(),
            address,
            scale: 0.001, // Default: 1mV per unit (0-65535 = 0-65.535V)
            offset: 0.0,
            enabled: true,
            label: None,
        }
    }

    /// Set the voltage scale
    pub fn with_scale(mut self, scale: f32) -> Self {
        self.scale = scale;
        self
    }

    /// Set the voltage offset
    pub fn with_offset(mut self, offset: f32) -> Self {
        self.offset = offset;
        self
    }

    /// Set the enabled state
    pub fn with_enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
        self
    }

    /// Set the label
    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
}

/// Result of sampling all scope channels
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeSampleResult {
    /// Number of samples added
    pub samples_added: usize,
    /// Number of channels skipped (disabled or error)
    pub channels_skipped: usize,
    /// Any errors encountered
    pub errors: Vec<String>,
}

impl Default for ScopeSampleResult {
    fn default() -> Self {
        Self {
            samples_added: 0,
            channels_skipped: 0,
            errors: Vec::new(),
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bit_mapping_creation() {
        let mapping = ScopeChannelMapping::new_bit("scope1", 0, "M", 10);

        assert_eq!(mapping.scope_id, "scope1");
        assert_eq!(mapping.channel, 0);
        assert_eq!(mapping.device_type, "M");
        assert_eq!(mapping.address, 10);
        assert_eq!(mapping.scale, 5.0);
        assert!(mapping.enabled);
    }

    #[test]
    fn test_word_mapping_creation() {
        let mapping = ScopeChannelMapping::new_word("scope1", 1, "D", 100)
            .with_scale(0.01)
            .with_offset(-10.0)
            .with_label("Temperature");

        assert_eq!(mapping.scope_id, "scope1");
        assert_eq!(mapping.channel, 1);
        assert_eq!(mapping.device_type, "D");
        assert_eq!(mapping.address, 100);
        assert_eq!(mapping.scale, 0.01);
        assert_eq!(mapping.offset, -10.0);
        assert_eq!(mapping.label, Some("Temperature".to_string()));
    }

    #[test]
    fn test_mapping_disabled() {
        let mapping = ScopeChannelMapping::new_bit("scope1", 0, "P", 0).with_enabled(false);

        assert!(!mapping.enabled);
    }
}
