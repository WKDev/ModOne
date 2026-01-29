//! Timer Manager Module
//!
//! Manages TON (On-Delay), TOF (Off-Delay), and TMR (Accumulating) timers
//! for the OneSim simulation engine. Provides thread-safe timer state
//! management with proper timing logic.

use parking_lot::RwLock;
use std::collections::HashMap;

use super::types::{SimTimeBase, SimTimerType, TimerState};

// ============================================================================
// Timer Runtime State
// ============================================================================

/// Internal runtime state for a timer
#[derive(Debug, Clone)]
struct TimerRuntime {
    /// Timer type (TON, TOF, TMR)
    timer_type: SimTimerType,
    /// Preset value in time base units
    preset: u32,
    /// Time base for preset
    time_base: SimTimeBase,
    /// Whether timer input is enabled
    enabled: bool,
    /// Done bit (output contact)
    done: bool,
    /// Elapsed time in milliseconds
    elapsed_ms: u64,
    /// Previous input state (for edge detection)
    last_input: bool,
}

impl TimerRuntime {
    /// Create a new timer runtime
    fn new(timer_type: SimTimerType, preset: u32, time_base: SimTimeBase) -> Self {
        Self {
            timer_type,
            preset,
            time_base,
            enabled: false,
            done: false,
            elapsed_ms: 0,
            last_input: false,
        }
    }

    /// Get preset time in milliseconds
    fn preset_ms(&self) -> u64 {
        self.preset as u64 * self.time_base.to_ms() as u64
    }

    /// Convert elapsed time to time base units for display
    fn elapsed_units(&self) -> u32 {
        let base_ms = self.time_base.to_ms() as u64;
        if base_ms == 0 {
            return 0;
        }
        (self.elapsed_ms / base_ms) as u32
    }
}

// ============================================================================
// Timer Manager
// ============================================================================

/// Timer Manager for handling PLC timer instructions
///
/// Manages runtime state for TON, TOF, and TMR timers with proper
/// timing logic and edge detection.
pub struct TimerManager {
    /// Timer runtime states indexed by address
    timers: RwLock<HashMap<u16, TimerRuntime>>,
}

impl TimerManager {
    /// Create a new TimerManager
    pub fn new() -> Self {
        Self {
            timers: RwLock::new(HashMap::new()),
        }
    }

    /// Update a timer with current input condition
    ///
    /// Returns (contact_state, current_value_in_units)
    ///
    /// # Arguments
    /// * `address` - Timer address (T0000 = 0)
    /// * `timer_type` - Type of timer (TON, TOF, TMR)
    /// * `input` - Current input condition (power flow to timer)
    /// * `preset` - Preset value in time base units
    /// * `time_base` - Time base for preset
    ///
    /// # Timer Logic
    ///
    /// **TON (On-Delay Timer):**
    /// - Starts timing when input becomes true
    /// - Contact (done) becomes true when elapsed >= preset
    /// - Resets immediately when input becomes false
    ///
    /// **TOF (Off-Delay Timer):**
    /// - Contact (done) becomes true immediately when input is true
    /// - When input goes false, starts timing
    /// - Contact becomes false after preset time elapses
    ///
    /// **TMR (Accumulating/Retentive Timer):**
    /// - Accumulates time while input is true
    /// - Does NOT reset when input becomes false
    /// - Only resets via explicit reset() call
    /// - Contact (done) becomes true when elapsed >= preset
    pub fn update(
        &self,
        address: u16,
        timer_type: SimTimerType,
        input: bool,
        preset: u32,
        time_base: SimTimeBase,
    ) -> (bool, u32) {
        let mut timers = self.timers.write();

        // Get or create timer
        let timer = timers
            .entry(address)
            .or_insert_with(|| TimerRuntime::new(timer_type, preset, time_base));

        // Update timer configuration if changed
        timer.timer_type = timer_type;
        timer.preset = preset;
        timer.time_base = time_base;

        let preset_ms = timer.preset_ms();

        match timer_type {
            SimTimerType::Ton => {
                // TON: On-Delay Timer
                if input {
                    timer.enabled = true;
                    // Don't increment here - tick() handles time
                    if timer.elapsed_ms >= preset_ms {
                        timer.done = true;
                    }
                } else {
                    // Reset when input goes false
                    timer.enabled = false;
                    timer.done = false;
                    timer.elapsed_ms = 0;
                }
            }
            SimTimerType::Tof => {
                // TOF: Off-Delay Timer
                if input {
                    // Input true: done immediately, reset timer
                    timer.done = true;
                    timer.enabled = false;
                    timer.elapsed_ms = 0;
                } else if timer.last_input && !input {
                    // Falling edge: start timing
                    timer.enabled = true;
                } else if timer.enabled {
                    // Timing in progress
                    if timer.elapsed_ms >= preset_ms {
                        timer.done = false;
                        timer.enabled = false;
                    }
                }
            }
            SimTimerType::Tmr => {
                // TMR: Accumulating/Retentive Timer
                if input {
                    timer.enabled = true;
                    if timer.elapsed_ms >= preset_ms {
                        timer.done = true;
                    }
                } else {
                    // TMR does NOT reset when input goes false
                    timer.enabled = false;
                    // done stays as is, elapsed stays as is
                }
            }
        }

        timer.last_input = input;

        (timer.done, timer.elapsed_units())
    }

    /// Update all timers by adding delta time
    ///
    /// Call this method each scan cycle with the elapsed time since
    /// the last scan. Only enabled timers will accumulate time.
    ///
    /// # Arguments
    /// * `delta_ms` - Elapsed time since last tick in milliseconds
    pub fn tick(&self, delta_ms: u32) {
        let mut timers = self.timers.write();

        for timer in timers.values_mut() {
            if timer.enabled {
                timer.elapsed_ms = timer.elapsed_ms.saturating_add(delta_ms as u64);

                // Check for done condition after incrementing
                let preset_ms = timer.preset_ms();
                if timer.elapsed_ms >= preset_ms {
                    match timer.timer_type {
                        SimTimerType::Ton | SimTimerType::Tmr => {
                            timer.done = true;
                            // Cap elapsed at preset for display
                            timer.elapsed_ms = timer.elapsed_ms.min(preset_ms);
                        }
                        SimTimerType::Tof => {
                            // TOF done goes false when time expires
                            timer.done = false;
                            timer.enabled = false;
                        }
                    }
                }
            }
        }
    }

    /// Get timer state for monitoring/UI display
    ///
    /// Returns None if the timer hasn't been created yet.
    pub fn get_state(&self, address: u16) -> Option<TimerState> {
        let timers = self.timers.read();
        timers.get(&address).map(|t| TimerState {
            enabled: t.enabled,
            done: t.done,
            elapsed: t.elapsed_ms,
            preset: t.preset,
            time_base: t.time_base,
            timer_type: t.timer_type,
        })
    }

    /// Get all timer states for monitoring
    pub fn get_all_states(&self) -> HashMap<u16, TimerState> {
        let timers = self.timers.read();
        timers
            .iter()
            .map(|(addr, t)| {
                (
                    *addr,
                    TimerState {
                        enabled: t.enabled,
                        done: t.done,
                        elapsed: t.elapsed_ms,
                        preset: t.preset,
                        time_base: t.time_base,
                        timer_type: t.timer_type,
                    },
                )
            })
            .collect()
    }

    /// Reset a specific timer
    ///
    /// Clears elapsed time, enabled, and done states.
    /// This is used for TMR timers which don't auto-reset.
    pub fn reset(&self, address: u16) {
        let mut timers = self.timers.write();
        if let Some(timer) = timers.get_mut(&address) {
            timer.elapsed_ms = 0;
            timer.done = false;
            timer.enabled = false;
        }
    }

    /// Clear all timers
    ///
    /// Removes all timer runtime states.
    pub fn clear(&self) {
        self.timers.write().clear();
    }
}

impl Default for TimerManager {
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
    fn test_ton_timer_basic() {
        let manager = TimerManager::new();

        // Start timer with input true
        let (done, _) = manager.update(0, SimTimerType::Ton, true, 100, SimTimeBase::Ms);
        assert!(!done, "TON should not be done initially");

        // Tick for 50ms
        manager.tick(50);
        let state = manager.get_state(0).unwrap();
        assert!(!state.done, "TON should not be done at 50ms");
        assert_eq!(state.elapsed, 50);

        // Tick for another 60ms (total 110ms > 100ms preset)
        manager.tick(60);
        let state = manager.get_state(0).unwrap();
        assert!(state.done, "TON should be done at 110ms");
    }

    #[test]
    fn test_ton_timer_reset_on_input_false() {
        let manager = TimerManager::new();

        // Start timer
        manager.update(0, SimTimerType::Ton, true, 100, SimTimeBase::Ms);
        manager.tick(50);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.elapsed, 50);

        // Input goes false - should reset
        manager.update(0, SimTimerType::Ton, false, 100, SimTimeBase::Ms);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.elapsed, 0, "TON should reset when input goes false");
        assert!(!state.done);
    }

    #[test]
    fn test_tof_timer_immediate_on() {
        let manager = TimerManager::new();

        // Input true - done immediately
        let (done, _) = manager.update(0, SimTimerType::Tof, true, 100, SimTimeBase::Ms);
        assert!(done, "TOF should be done immediately when input is true");
    }

    #[test]
    fn test_tof_timer_delay_off() {
        let manager = TimerManager::new();

        // Input true
        manager.update(0, SimTimerType::Tof, true, 100, SimTimeBase::Ms);

        // Input goes false - start timing
        let (done, _) = manager.update(0, SimTimerType::Tof, false, 100, SimTimeBase::Ms);
        assert!(done, "TOF should still be done when input just went false");

        // Tick for 50ms
        manager.tick(50);
        let state = manager.get_state(0).unwrap();
        assert!(state.done, "TOF should still be done at 50ms");

        // Tick for another 60ms (total 110ms > 100ms preset)
        manager.tick(60);
        let state = manager.get_state(0).unwrap();
        assert!(!state.done, "TOF should be off after preset time");
    }

    #[test]
    fn test_tmr_accumulating() {
        let manager = TimerManager::new();

        // Input true, accumulate 30ms
        manager.update(0, SimTimerType::Tmr, true, 100, SimTimeBase::Ms);
        manager.tick(30);

        // Input false - should NOT reset
        manager.update(0, SimTimerType::Tmr, false, 100, SimTimeBase::Ms);
        let state = manager.get_state(0).unwrap();
        assert_eq!(state.elapsed, 30, "TMR should retain elapsed time");

        // Input true again, continue accumulating
        manager.update(0, SimTimerType::Tmr, true, 100, SimTimeBase::Ms);
        manager.tick(80);

        let state = manager.get_state(0).unwrap();
        assert!(state.done, "TMR should be done after accumulating 110ms");
    }

    #[test]
    fn test_tmr_explicit_reset() {
        let manager = TimerManager::new();

        // Accumulate some time
        manager.update(0, SimTimerType::Tmr, true, 100, SimTimeBase::Ms);
        manager.tick(50);

        // Explicit reset
        manager.reset(0);

        let state = manager.get_state(0).unwrap();
        assert_eq!(state.elapsed, 0, "TMR should reset with explicit reset()");
        assert!(!state.done);
    }

    #[test]
    fn test_time_base_conversion() {
        let manager = TimerManager::new();

        // 10 units * 100ms time base = 1000ms
        manager.update(0, SimTimerType::Ton, true, 10, SimTimeBase::Ms100);
        manager.tick(500);

        let state = manager.get_state(0).unwrap();
        assert!(!state.done, "Should not be done at 500ms with 1000ms preset");

        manager.tick(600);
        let state = manager.get_state(0).unwrap();
        assert!(state.done, "Should be done at 1100ms");
    }

    #[test]
    fn test_multiple_timers() {
        let manager = TimerManager::new();

        manager.update(0, SimTimerType::Ton, true, 100, SimTimeBase::Ms);
        manager.update(1, SimTimerType::Tof, true, 200, SimTimeBase::Ms);
        manager.update(2, SimTimerType::Tmr, true, 300, SimTimeBase::Ms);

        manager.tick(150);

        let state0 = manager.get_state(0).unwrap();
        let state1 = manager.get_state(1).unwrap();
        let state2 = manager.get_state(2).unwrap();

        assert!(state0.done, "Timer 0 (TON) should be done at 150ms");
        assert!(state1.done, "Timer 1 (TOF) should be done (input is true)");
        assert!(!state2.done, "Timer 2 (TMR) should not be done at 150ms");
    }

    #[test]
    fn test_clear_timers() {
        let manager = TimerManager::new();

        manager.update(0, SimTimerType::Ton, true, 100, SimTimeBase::Ms);
        manager.update(1, SimTimerType::Tof, true, 200, SimTimeBase::Ms);

        manager.clear();

        assert!(manager.get_state(0).is_none());
        assert!(manager.get_state(1).is_none());
    }

    #[test]
    fn test_get_all_states() {
        let manager = TimerManager::new();

        manager.update(0, SimTimerType::Ton, true, 100, SimTimeBase::Ms);
        manager.update(5, SimTimerType::Tof, true, 200, SimTimeBase::Ms);

        let all_states = manager.get_all_states();
        assert_eq!(all_states.len(), 2);
        assert!(all_states.contains_key(&0));
        assert!(all_states.contains_key(&5));
    }
}
