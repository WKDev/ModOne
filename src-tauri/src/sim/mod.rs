//! OneSim Module
//!
//! PLC simulation engine for LS Electric PLCs.

pub mod memory;
pub mod types;

pub use memory::{DeviceMemory, SimMemoryError, SimMemoryResult};
pub use types::*;
