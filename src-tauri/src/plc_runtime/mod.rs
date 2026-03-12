//! Protocol-agnostic PLC runtime foundation.
//!
//! This module introduces the canonical memory model that future vendor
//! profiles, tags, and protocol adapters will build on.

pub mod event_bus;
pub mod memory;
pub mod types;

pub use event_bus::CanonicalMemoryBus;
pub use memory::{CanonicalMemory, CanonicalMemoryError, CanonicalMemorySnapshot};
pub use types::{
    CanonicalAccess, CanonicalAddress, CanonicalAreaKind, CanonicalMemoryBatchChange,
    CanonicalMemoryChange, CanonicalMemoryEvent, CanonicalValue, CanonicalWriteSource,
};
