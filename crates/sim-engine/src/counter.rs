//! Counter Manager Module
//!
//! Manages CTU (Count Up), CTD (Count Down), and CTUD (Count Up/Down)
//! counters for the OneSim simulation engine. Provides thread-safe
//! counter state management with edge detection.

use parking_lot::RwLock;
use std::collections::HashMap;

use super::types::{CounterState, SimCounterType};

// ============================================================================
// Counter Runtime State
// ============================================================================

/// Internal runtime state for a counter
#[derive(Debug, Clone)]
struct CounterRuntime {
    /// Counter type (CTU, CTD, CTUD)
    counter_type: SimCounterType,
    /// Preset value
    preset: i32,
    /// Current count value
    current: i32,
    /// Done bit (output contact)
    done: bool,
    /// Previous count-up input state (for edge detection)
    prev_up: bool,
    /// Previous count-down input state (for CTUD)
    prev_down: bool,
    /// Previous reset input state (for edge detection)
    prev_reset: bool,
}

impl CounterRuntime {
    /// Create a new counter runtime
    fn new(counter_type: SimCounterType, preset: i32) -> Self {
        Self {
            counter_type,
            preset,
            current: 0,
            done: false,
            prev_up: false,
            prev_down: false,
            prev_reset: false,
        }
    }
}

// ============================================================================
// Counter Manager
// ============================================================================

/// Counter Manager for handling PLC counter instructions
///
/// Manages runtime state for CTU, CTD, and CTUD counters with proper
/// edge detection for count inputs.
pub struct CounterManager {
    /// Counter runtime states indexed by address
    counters: RwLock<HashMap<u16, CounterRuntime>>,
}

impl CounterManager {
    /// Create a new CounterManager
    pub fn new() -> Self {
        Self {
            counters: RwLock::new(HashMap::new()),
        }
    }

    /// Update a counter with current inputs
    ///
    /// Returns the done (contact) state.
    ///
    /// # Arguments
    /// * `address` - Counter address (C0000 = 0)
    /// * `counter_type` - Type of counter (CTU, CTD, CTUD)
    /// * `up_input` - Count up input (for CTU and CTUD)
    /// * `down_input` - Count down input (for CTD and CTUD, None for CTU)
    /// * `preset` - Preset value
    ///
    /// # Counter Logic
    ///
    /// **CTU (Count Up):**
    /// - Increments on rising edge of up_input
    /// - done = true when current >= preset
    /// - Current value caps at i32::MAX
    ///
    /// **CTD (Count Down):**
    /// - Decrements on rising edge of up_input (used as count input)
    /// - done = true when current <= 0
    /// - Current value caps at 0 (doesn't go negative)
    /// - Typically starts at preset value
    ///
    /// **CTUD (Count Up/Down):**
    /// - Increments on rising edge of up_input
    /// - Decrements on rising edge of down_input
    /// - done = true when current >= preset
    /// - Current can go negative
    pub fn update(
        &self,
        address: u16,
        counter_type: SimCounterType,
        up_input: bool,
        down_input: Option<bool>,
        preset: i32,
    ) -> bool {
        let mut counters = self.counters.write();

        // Get or create counter
        let counter = counters
            .entry(address)
            .or_insert_with(|| CounterRuntime::new(counter_type, preset));

        // Update counter configuration if changed
        counter.counter_type = counter_type;
        counter.preset = preset;

        match counter_type {
            SimCounterType::Ctu => {
                // CTU: Count Up
                // Detect rising edge on up_input
                if up_input && !counter.prev_up {
                    counter.current = counter.current.saturating_add(1);
                }
                counter.done = counter.current >= counter.preset;
            }
            SimCounterType::Ctd => {
                // CTD: Count Down
                // Uses up_input as the count input
                // Detect rising edge
                if up_input && !counter.prev_up {
                    if counter.current > 0 {
                        counter.current -= 1;
                    }
                }
                counter.done = counter.current <= 0;
            }
            SimCounterType::Ctud => {
                // CTUD: Count Up/Down
                // Detect rising edge on up_input
                if up_input && !counter.prev_up {
                    counter.current = counter.current.saturating_add(1);
                }
                // Detect rising edge on down_input
                if let Some(down) = down_input {
                    if down && !counter.prev_down {
                        counter.current = counter.current.saturating_sub(1);
                    }
                    counter.prev_down = down;
                }
                counter.done = counter.current >= counter.preset;
            }
        }

        counter.prev_up = up_input;

        counter.done
    }

    /// Update counter with reset input
    ///
    /// Call this after update() to handle reset logic.
    /// Reset on rising edge clears the counter.
    ///
    /// # Arguments
    /// * `address` - Counter address
    /// * `reset_input` - Reset input signal
    ///
    /// # Returns
    /// Returns true if the counter was reset.
    pub fn update_reset(&self, address: u16, reset_input: bool) -> bool {
        let mut counters = self.counters.write();

        if let Some(counter) = counters.get_mut(&address) {
            // Detect rising edge on reset
            if reset_input && !counter.prev_reset {
                counter.current = 0;
                counter.done = false;
                counter.prev_reset = reset_input;
                return true;
            }
            counter.prev_reset = reset_input;
        }

        false
    }

    /// Set counter to preset value
    ///
    /// Used for CTD counters which typically start at preset.
    pub fn set_to_preset(&self, address: u16) {
        let mut counters = self.counters.write();
        if let Some(counter) = counters.get_mut(&address) {
            counter.current = counter.preset;
            counter.done = false;
        }
    }

    /// Get counter state for monitoring/UI display
    ///
    /// Returns None if the counter hasn't been created yet.
    pub fn get_state(&self, address: u16) -> Option<CounterState> {
        let counters = self.counters.read();
        counters.get(&address).map(|c| CounterState {
            done: c.done,
            current_value: c.current,
            preset: c.preset,
            prev_up: c.prev_up,
            prev_down: Some(c.prev_down),
            prev_reset: Some(c.prev_reset),
            counter_type: c.counter_type,
        })
    }

    /// Get all counter states for monitoring
    pub fn get_all_states(&self) -> HashMap<u16, CounterState> {
        let counters = self.counters.read();
        counters
            .iter()
            .map(|(addr, c)| {
                (
                    *addr,
                    CounterState {
                        done: c.done,
                        current_value: c.current,
                        preset: c.preset,
                        prev_up: c.prev_up,
                        prev_down: Some(c.prev_down),
                        prev_reset: Some(c.prev_reset),
                        counter_type: c.counter_type,
                    },
                )
            })
            .collect()
    }

    /// Reset a specific counter
    ///
    /// Clears current value and done state.
    pub fn reset(&self, address: u16) {
        let mut counters = self.counters.write();
        if let Some(counter) = counters.get_mut(&address) {
            counter.current = 0;
            counter.done = false;
        }
    }

    /// Set counter value directly
    ///
    /// Used for simulation debugging or initialization.
    pub fn set_value(&self, address: u16, value: i32) {
        let mut counters = self.counters.write();
        if let Some(counter) = counters.get_mut(&address) {
            counter.current = value;
            // Update done based on counter type
            match counter.counter_type {
                SimCounterType::Ctu | SimCounterType::Ctud => {
                    counter.done = counter.current >= counter.preset;
                }
                SimCounterType::Ctd => {
                    counter.done = counter.current <= 0;
                }
            }
        }
    }

    /// Clear all counters
    ///
    /// Removes all counter runtime states.
    pub fn clear(&self) {
        self.counters.write().clear();
    }
}

impl Default for CounterManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ctu_count_on_rising_edge() {
        let manager = CounterManager::new();

        // First rising edge
        manager.update(0, SimCounterType::Ctu, true, None, 5);
        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 1);

        // Steady true - no count
        manager.update(0, SimCounterType::Ctu, true, None, 5);
        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 1, "Should not count on steady true");

        // Go false then true again - should count
        manager.update(0, SimCounterType::Ctu, false, None, 5);
        manager.update(0, SimCounterType::Ctu, true, None, 5);
        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 2);
    }

    #[test]
    fn test_ctu_done_at_preset() {
        let manager = CounterManager::new();

        // Count to preset (3)
        for _ in 0..3 {
            manager.update(0, SimCounterType::Ctu, true, None, 3);
            manager.update(0, SimCounterType::Ctu, false, None, 3);
        }

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 3);
        assert!(state.done, "CTU should be done when current >= preset");
    }

    #[test]
    fn test_ctd_count_down() {
        let manager = CounterManager::new();

        // Initialize counter to preset
        manager.update(0, SimCounterType::Ctd, false, None, 3);
        manager.set_to_preset(0);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 3);

        // Count down
        manager.update(0, SimCounterType::Ctd, true, None, 3);
        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 2);

        // Count down more
        manager.update(0, SimCounterType::Ctd, false, None, 3);
        manager.update(0, SimCounterType::Ctd, true, None, 3);
        manager.update(0, SimCounterType::Ctd, false, None, 3);
        manager.update(0, SimCounterType::Ctd, true, None, 3);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 0);
        assert!(state.done, "CTD should be done when current <= 0");
    }

    #[test]
    fn test_ctd_no_negative() {
        let manager = CounterManager::new();

        // Start at 0, try to count down
        manager.update(0, SimCounterType::Ctd, true, None, 5);
        manager.update(0, SimCounterType::Ctd, false, None, 5);
        manager.update(0, SimCounterType::Ctd, true, None, 5);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 0, "CTD should not go below 0");
    }

    #[test]
    fn test_ctud_up_and_down() {
        let manager = CounterManager::new();

        // Count up twice
        manager.update(0, SimCounterType::Ctud, true, Some(false), 5);
        manager.update(0, SimCounterType::Ctud, false, Some(false), 5);
        manager.update(0, SimCounterType::Ctud, true, Some(false), 5);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 2);

        // Count down once
        manager.update(0, SimCounterType::Ctud, false, Some(true), 5);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 1);

        // Count down again
        manager.update(0, SimCounterType::Ctud, false, Some(false), 5);
        manager.update(0, SimCounterType::Ctud, false, Some(true), 5);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 0);
    }

    #[test]
    fn test_ctud_simultaneous_edges() {
        let manager = CounterManager::new();

        // Both up and down rising edges simultaneously
        manager.update(0, SimCounterType::Ctud, true, Some(true), 5);

        let state = manager.get_state(0).unwrap();
        // Both should count, net effect is 0 (1 up, 1 down)
        assert_eq!(state.current_value, 0);
    }

    #[test]
    fn test_reset_on_rising_edge() {
        let manager = CounterManager::new();

        // Count up
        for _ in 0..3 {
            manager.update(0, SimCounterType::Ctu, true, None, 10);
            manager.update(0, SimCounterType::Ctu, false, None, 10);
        }

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 3);

        // Reset (rising edge)
        let was_reset = manager.update_reset(0, true);
        assert!(was_reset);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 0);
        assert!(!state.done);

        // Reset steady true - should not reset again
        let was_reset = manager.update_reset(0, true);
        assert!(!was_reset, "Should not reset on steady true");
    }

    #[test]
    fn test_explicit_reset() {
        let manager = CounterManager::new();

        // Count up
        manager.update(0, SimCounterType::Ctu, true, None, 5);
        manager.update(0, SimCounterType::Ctu, false, None, 5);
        manager.update(0, SimCounterType::Ctu, true, None, 5);

        // Explicit reset
        manager.reset(0);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 0);
        assert!(!state.done);
    }

    #[test]
    fn test_set_value() {
        let manager = CounterManager::new();

        // Create counter
        manager.update(0, SimCounterType::Ctu, false, None, 10);

        // Set value
        manager.set_value(0, 8);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, 8);
        assert!(!state.done, "8 < 10, should not be done");

        // Set value at preset
        manager.set_value(0, 10);
        let state = manager.get_state(0).unwrap();
        assert!(state.done, "10 >= 10, should be done");
    }

    #[test]
    fn test_multiple_counters() {
        let manager = CounterManager::new();

        manager.update(0, SimCounterType::Ctu, true, None, 5);
        manager.update(1, SimCounterType::Ctd, false, None, 3);
        manager.set_to_preset(1);
        manager.update(2, SimCounterType::Ctud, false, Some(false), 10);

        let all_states = manager.get_all_states();
        assert_eq!(all_states.len(), 3);

        assert_eq!(all_states.get(&0).unwrap().current_value, 1);
        assert_eq!(all_states.get(&1).unwrap().current_value, 3);
        assert_eq!(all_states.get(&2).unwrap().current_value, 0);
    }

    #[test]
    fn test_clear_counters() {
        let manager = CounterManager::new();

        manager.update(0, SimCounterType::Ctu, true, None, 5);
        manager.update(1, SimCounterType::Ctd, true, None, 3);

        manager.clear();

        assert!(manager.get_state(0).is_none());
        assert!(manager.get_state(1).is_none());
    }

    #[test]
    fn test_ctu_overflow_protection() {
        let manager = CounterManager::new();

        // Create counter and set to near max
        manager.update(0, SimCounterType::Ctu, false, None, i32::MAX);
        manager.set_value(0, i32::MAX - 1);

        // Try to increment
        manager.update(0, SimCounterType::Ctu, true, None, i32::MAX);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.current_value, i32::MAX, "Should saturate at MAX");
    }
}
