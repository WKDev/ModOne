//! Canvas Module
//!
//! Provides simulation engines for canvas-based components like oscilloscopes,
//! function generators, and other virtual instruments.

pub mod scope;
pub mod scope_sync;

pub use scope::*;
pub use scope_sync::*;
