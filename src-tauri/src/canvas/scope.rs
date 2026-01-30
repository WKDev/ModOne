//! Scope Simulation Engine
//!
//! Provides an oscilloscope-like simulation engine for capturing and buffering
//! voltage samples with trigger detection.

use std::collections::VecDeque;
use serde::{Deserialize, Serialize};

// ============================================================================
// Enums
// ============================================================================

/// Scope trigger mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TriggerMode {
    /// Auto mode - continuous display regardless of trigger
    Auto,
    /// Normal mode - waits for trigger condition
    Normal,
    /// Single mode - captures once then stops
    Single,
}

impl Default for TriggerMode {
    fn default() -> Self {
        TriggerMode::Auto
    }
}

/// Trigger edge type for edge detection
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TriggerEdge {
    /// Rising edge - triggers when signal crosses level from below
    Rising,
    /// Falling edge - triggers when signal crosses level from above
    Falling,
}

impl Default for TriggerEdge {
    fn default() -> Self {
        TriggerEdge::Rising
    }
}

/// Scope run mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RunMode {
    /// Running - capturing samples
    Run,
    /// Stopped - not capturing
    Stop,
}

impl Default for RunMode {
    fn default() -> Self {
        RunMode::Run
    }
}

// ============================================================================
// Settings
// ============================================================================

/// Scope settings configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeSettings {
    /// Time base in ms per division
    pub time_base: f32,
    /// Trigger mode (Auto, Normal, Single)
    pub trigger_mode: TriggerMode,
    /// Channel index to trigger on
    pub trigger_channel: usize,
    /// Trigger level voltage
    pub trigger_level: f32,
    /// Trigger edge type (Rising or Falling)
    pub trigger_edge: TriggerEdge,
    /// Run mode (Run or Stop)
    pub run_mode: RunMode,
}

impl Default for ScopeSettings {
    fn default() -> Self {
        Self {
            time_base: 1.0,
            trigger_mode: TriggerMode::Auto,
            trigger_channel: 0,
            trigger_level: 0.0,
            trigger_edge: TriggerEdge::Rising,
            run_mode: RunMode::Run,
        }
    }
}

// ============================================================================
// Internal Buffers
// ============================================================================

/// Per-channel sample buffer
struct ChannelBuffer {
    /// Ring buffer of voltage samples
    samples: VecDeque<f32>,
    /// Previous sample for edge detection
    previous_sample: f32,
}

impl Default for ChannelBuffer {
    fn default() -> Self {
        Self {
            samples: VecDeque::new(),
            previous_sample: 0.0,
        }
    }
}

impl ChannelBuffer {
    fn new() -> Self {
        Self::default()
    }
}

/// Trigger state machine
struct TriggerState {
    /// Whether trigger is armed and waiting
    armed: bool,
    /// Whether trigger condition was met
    triggered: bool,
    /// Sample index where trigger occurred
    trigger_index: usize,
    /// Holdoff time remaining in ms
    hold_off_remaining: f32,
}

impl Default for TriggerState {
    fn default() -> Self {
        Self {
            armed: true,
            triggered: false,
            trigger_index: 0,
            hold_off_remaining: 0.0,
        }
    }
}

// ============================================================================
// Display Data
// ============================================================================

/// Data for a single channel to display on frontend
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelDisplayData {
    /// Channel index
    pub index: usize,
    /// Normalized sample points (x: 0-1 time, y: voltage)
    pub points: Vec<(f32, f32)>,
    /// Minimum voltage in buffer
    pub min: f32,
    /// Maximum voltage in buffer
    pub max: f32,
    /// Average voltage in buffer
    pub average: f32,
}

/// Complete scope display data for frontend
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeDisplayData {
    /// Channel data
    pub channels: Vec<ChannelDisplayData>,
    /// Whether trigger condition was met
    pub triggered: bool,
    /// Trigger position as normalized value (0-1)
    pub trigger_position: f32,
    /// Time per division in ms
    pub time_per_div: f32,
}

// ============================================================================
// Scope Engine
// ============================================================================

/// Scope simulation engine
///
/// Captures voltage samples into ring buffers with trigger detection
/// for oscilloscope-like functionality.
pub struct ScopeEngine {
    /// Per-channel sample buffers
    channels: Vec<ChannelBuffer>,
    /// Scope settings
    settings: ScopeSettings,
    /// Sample rate in samples per second
    sample_rate: u32,
    /// Maximum buffer size per channel
    buffer_size: usize,
    /// Trigger state machine
    trigger_state: TriggerState,
}

impl ScopeEngine {
    /// Create a new scope engine
    ///
    /// # Arguments
    /// * `channel_count` - Number of channels to create
    /// * `buffer_size` - Maximum samples per channel
    /// * `sample_rate` - Sample rate in samples per second
    pub fn new(channel_count: usize, buffer_size: usize, sample_rate: u32) -> Self {
        let channels = (0..channel_count).map(|_| ChannelBuffer::new()).collect();

        Self {
            channels,
            settings: ScopeSettings::default(),
            sample_rate,
            buffer_size,
            trigger_state: TriggerState::default(),
        }
    }

    /// Add a voltage sample to a specific channel
    ///
    /// Manages ring buffer size and checks trigger conditions.
    pub fn add_sample(&mut self, channel: usize, voltage: f32) {
        if channel >= self.channels.len() {
            return;
        }

        // Only capture if running
        if self.settings.run_mode != RunMode::Run {
            return;
        }

        // Read previous sample before mutating (for trigger detection)
        let previous_sample = self.channels[channel].previous_sample;

        let buf = &mut self.channels[channel];

        // Maintain ring buffer size
        if buf.samples.len() >= self.buffer_size {
            buf.samples.pop_front();
        }
        buf.samples.push_back(voltage);
        buf.previous_sample = voltage;

        // Check trigger condition on trigger channel
        if channel == self.settings.trigger_channel {
            self.check_trigger(voltage, previous_sample);
        }
    }

    /// Check trigger condition based on current settings
    fn check_trigger(&mut self, voltage: f32, prev: f32) {
        if !self.trigger_state.armed {
            return;
        }

        let level = self.settings.trigger_level;

        let triggered = match self.settings.trigger_edge {
            TriggerEdge::Rising => prev < level && voltage >= level,
            TriggerEdge::Falling => prev > level && voltage <= level,
        };

        if triggered {
            self.trigger_state.triggered = true;
            self.trigger_state.trigger_index = self.channels[0].samples.len().saturating_sub(1);

            // Single mode stops after trigger
            if self.settings.trigger_mode == TriggerMode::Single {
                self.settings.run_mode = RunMode::Stop;
            }

            // Disarm trigger until re-armed (for Normal mode)
            if self.settings.trigger_mode == TriggerMode::Normal {
                self.trigger_state.armed = false;
            }
        }
    }

    /// Get display data for the frontend
    ///
    /// Returns normalized sample points and statistics for each channel.
    pub fn get_display_data(&self) -> ScopeDisplayData {
        let channels = self
            .channels
            .iter()
            .enumerate()
            .map(|(i, ch)| {
                let len = ch.samples.len();

                // Calculate normalized points (x: 0-1, y: voltage)
                let points: Vec<(f32, f32)> = ch
                    .samples
                    .iter()
                    .enumerate()
                    .map(|(x, &y)| (x as f32 / self.buffer_size.max(1) as f32, y))
                    .collect();

                // Calculate statistics
                let (min, max, sum) = ch.samples.iter().fold(
                    (f32::INFINITY, f32::NEG_INFINITY, 0.0f32),
                    |(min, max, sum), &v| (min.min(v), max.max(v), sum + v),
                );

                let average = if len > 0 { sum / len as f32 } else { 0.0 };

                ChannelDisplayData {
                    index: i,
                    points,
                    min: if min == f32::INFINITY { 0.0 } else { min },
                    max: if max == f32::NEG_INFINITY { 0.0 } else { max },
                    average,
                }
            })
            .collect();

        ScopeDisplayData {
            channels,
            triggered: self.trigger_state.triggered,
            trigger_position: self.trigger_state.trigger_index as f32
                / self.buffer_size.max(1) as f32,
            time_per_div: self.settings.time_base,
        }
    }

    /// Update scope settings
    pub fn update_settings(&mut self, settings: ScopeSettings) {
        self.settings = settings;
    }

    /// Get current settings
    pub fn get_settings(&self) -> &ScopeSettings {
        &self.settings
    }

    /// Reset all buffers and trigger state
    pub fn reset(&mut self) {
        for channel in &mut self.channels {
            channel.samples.clear();
            channel.previous_sample = 0.0;
        }
        self.trigger_state = TriggerState::default();
    }

    /// Re-arm the trigger for another capture
    pub fn arm_trigger(&mut self) {
        self.trigger_state.armed = true;
        self.trigger_state.triggered = false;
        self.trigger_state.trigger_index = 0;
    }

    /// Start or resume capture
    pub fn run(&mut self) {
        self.settings.run_mode = RunMode::Run;
        self.arm_trigger();
    }

    /// Stop capture
    pub fn stop(&mut self) {
        self.settings.run_mode = RunMode::Stop;
    }

    /// Get the sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Get the buffer size
    pub fn buffer_size(&self) -> usize {
        self.buffer_size
    }

    /// Get number of channels
    pub fn channel_count(&self) -> usize {
        self.channels.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_engine() {
        let engine = ScopeEngine::new(4, 1000, 10000);
        assert_eq!(engine.channel_count(), 4);
        assert_eq!(engine.buffer_size(), 1000);
        assert_eq!(engine.sample_rate(), 10000);
    }

    #[test]
    fn test_sample_buffer_size() {
        let mut engine = ScopeEngine::new(1, 10, 1000);

        // Add 15 samples to a buffer of size 10
        for i in 0..15 {
            engine.add_sample(0, i as f32);
        }

        let data = engine.get_display_data();
        // Should only have 10 samples (buffer size limit)
        assert_eq!(data.channels[0].points.len(), 10);
    }

    #[test]
    fn test_rising_edge_trigger() {
        let mut engine = ScopeEngine::new(1, 100, 1000);
        engine.settings.trigger_level = 0.5;
        engine.settings.trigger_edge = TriggerEdge::Rising;
        engine.settings.trigger_mode = TriggerMode::Normal;

        // Add samples below trigger level
        engine.add_sample(0, 0.0);
        engine.add_sample(0, 0.3);
        assert!(!engine.trigger_state.triggered);

        // Cross trigger level from below
        engine.add_sample(0, 0.6);
        assert!(engine.trigger_state.triggered);
    }

    #[test]
    fn test_falling_edge_trigger() {
        let mut engine = ScopeEngine::new(1, 100, 1000);
        engine.settings.trigger_level = 0.5;
        engine.settings.trigger_edge = TriggerEdge::Falling;
        engine.settings.trigger_mode = TriggerMode::Normal;

        // Add samples above trigger level
        engine.add_sample(0, 1.0);
        engine.add_sample(0, 0.7);
        assert!(!engine.trigger_state.triggered);

        // Cross trigger level from above
        engine.add_sample(0, 0.4);
        assert!(engine.trigger_state.triggered);
    }

    #[test]
    fn test_single_mode_stops() {
        let mut engine = ScopeEngine::new(1, 100, 1000);
        engine.settings.trigger_level = 0.5;
        engine.settings.trigger_mode = TriggerMode::Single;

        engine.add_sample(0, 0.3);
        engine.add_sample(0, 0.7);

        assert!(engine.trigger_state.triggered);
        assert_eq!(engine.settings.run_mode, RunMode::Stop);
    }

    #[test]
    fn test_statistics_calculation() {
        let mut engine = ScopeEngine::new(1, 100, 1000);

        engine.add_sample(0, 1.0);
        engine.add_sample(0, 2.0);
        engine.add_sample(0, 3.0);
        engine.add_sample(0, 4.0);
        engine.add_sample(0, 5.0);

        let data = engine.get_display_data();
        let ch = &data.channels[0];

        assert_eq!(ch.min, 1.0);
        assert_eq!(ch.max, 5.0);
        assert_eq!(ch.average, 3.0);
    }

    #[test]
    fn test_reset() {
        let mut engine = ScopeEngine::new(1, 100, 1000);

        engine.add_sample(0, 1.0);
        engine.add_sample(0, 2.0);
        engine.trigger_state.triggered = true;

        engine.reset();

        let data = engine.get_display_data();
        assert_eq!(data.channels[0].points.len(), 0);
        assert!(!engine.trigger_state.triggered);
    }
}
