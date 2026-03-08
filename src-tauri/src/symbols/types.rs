//! Rust types mirroring the TypeScript symbol type system in `src/types/symbol.ts`.
//!
//! All types use `#[serde(rename_all = "camelCase")]` to ensure JSON round-trip
//! compatibility with the TypeScript interfaces.

use serde::{Deserialize, Serialize};

// ============================================================================
// Pin Types (PLC-Optimized)
// ============================================================================

/// Electrical type of a pin (5 types only)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PinElectricalType {
    Input,
    Output,
    Bidirectional,
    Power,
    Passive,
}

/// Visual shape of a pin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PinShape {
    Line,
    Inverted,
    Clock,
}

/// Pin orientation on symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PinOrientation {
    Right,
    Left,
    Up,
    Down,
}

/// 2D position used for pin positions and polyline points
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinPosition {
    pub x: f64,
    pub y: f64,
}

/// A pin on a symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolPin {
    /// Unique identifier for this pin
    pub id: String,
    /// Display name of the pin
    pub name: String,
    /// Pin number (e.g., "1", "A1")
    pub number: String,
    /// Electrical type
    #[serde(rename = "type")]
    pub pin_type: PinElectricalType,
    /// Visual shape
    pub shape: PinShape,
    /// Position relative to symbol origin
    pub position: PinPosition,
    /// Pin orientation
    pub orientation: PinOrientation,
    /// Pin line length in pixels
    pub length: f64,
    /// Whether pin is hidden from display
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
}

// ============================================================================
// Graphic Primitives
// ============================================================================

/// Rectangle primitive
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RectPrimitive {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub stroke: String,
    pub fill: String,
    pub stroke_width: f64,
}

/// Circle primitive
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CirclePrimitive {
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
    pub stroke: String,
    pub fill: String,
    pub stroke_width: f64,
}

/// Polyline primitive
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolylinePrimitive {
    pub points: Vec<PinPosition>,
    pub stroke: String,
    pub fill: String,
    pub stroke_width: f64,
}

/// Arc primitive
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArcPrimitive {
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
    pub start_angle: f64,
    pub end_angle: f64,
    pub stroke: String,
    pub fill: String,
    pub stroke_width: f64,
}

/// Text primitive
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextPrimitive {
    pub x: f64,
    pub y: f64,
    pub text: String,
    pub font_size: f64,
    pub font_family: String,
    pub fill: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor: Option<String>,
}

/// Union of all graphic primitives, discriminated by the `kind` field
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GraphicPrimitive {
    Rect(RectPrimitive),
    Circle(CirclePrimitive),
    Polyline(PolylinePrimitive),
    Arc(ArcPrimitive),
    Text(TextPrimitive),
}

// ============================================================================
// Symbol Units (Multi-Unit Support)
// ============================================================================

/// A unit within a symbol (for multi-unit components)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolUnit {
    /// Unit identifier (1-based)
    pub unit_id: u32,
    /// Unit name (e.g., "A", "B", "Unit 1")
    pub name: String,
    /// Graphics for this unit
    pub graphics: Vec<GraphicPrimitive>,
    /// Pins for this unit
    pub pins: Vec<SymbolPin>,
}

// ============================================================================
// Symbol Properties
// ============================================================================

/// A property that can be set on a symbol instance
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolProperty {
    /// Property key (e.g., "voltage", "color")
    pub key: String,
    /// Default value (string | number | boolean in TS → serde_json::Value)
    pub value: serde_json::Value,
    /// Property type: "string" | "number" | "boolean" | "enum"
    #[serde(rename = "type")]
    pub prop_type: String,
    /// Whether property is visible in UI
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visible: Option<bool>,
    /// Editor widget type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor_type: Option<String>,
    /// Options for enum/select types
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

// ============================================================================
// Symbol Definition
// ============================================================================

/// Complete symbol definition — mirrors TypeScript `SymbolDefinition`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolDefinition {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Semantic version
    pub version: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Category (e.g., "relay", "switch", "sensor")
    pub category: String,
    /// Author name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    /// Creation timestamp (ISO 8601)
    pub created_at: String,
    /// Last modification timestamp (ISO 8601)
    pub updated_at: String,
    /// Symbol width in pixels
    pub width: f64,
    /// Symbol height in pixels
    pub height: f64,
    /// Graphics for the symbol
    pub graphics: Vec<GraphicPrimitive>,
    /// Pins on the symbol
    pub pins: Vec<SymbolPin>,
    /// Optional multi-unit definitions
    #[serde(skip_serializing_if = "Option::is_none")]
    pub units: Option<Vec<SymbolUnit>>,
    /// Configurable properties
    pub properties: Vec<SymbolProperty>,
    // === v2 fields (all optional for backward compat) ===
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extends_symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spice: Option<SpiceModelRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iec_section: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iec_category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ref_designator: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pin_numbers_hidden: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pin_names_hidden: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pin_name_offset: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclude_from_sim: Option<bool>,
}

// ============================================================================
// Symbol Summary (for listings)
// ============================================================================

/// Scope of a symbol library — mirrors TypeScript `LibraryScope`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LibraryScope {
    Project,
    Global,
}

/// Summary of a symbol for listings — mirrors TypeScript `SymbolSummary`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolSummary {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Semantic version
    pub version: String,
    /// Category
    pub category: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Library scope
    pub scope: LibraryScope,
    /// Last modification timestamp (ISO 8601)
    pub updated_at: String,
}

// ============================================================================
// V2 Pin Types (KiCad-compatible)
// ============================================================================

/// Electrical type of a pin — 12 KiCad-compatible variants (v2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PinElectricalTypeV2 {
    Input,
    Output,
    Bidirectional,
    TriState,
    Passive,
    PowerIn,
    PowerOut,
    OpenCollector,
    OpenEmitter,
    Free,
    Unspecified,
    NoConnect,
}

/// Functional role of a pin for PLC usage (v2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PinFunctionalRole {
    General,
    PlcInput,
    PlcOutput,
    Communication,
}

/// Visual shape of a pin — 9 KiCad-compatible variants (v2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PinShapeV2 {
    Line,
    Inverted,
    Clock,
    InvertedClock,
    InputLow,
    ClockLow,
    OutputLow,
    EdgeClockHigh,
    NonLogic,
}

/// A pin on a symbol — v2 with extended KiCad-compatible fields
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolPinV2 {
    pub id: String,
    pub name: String,
    pub number: String,
    pub electrical_type: PinElectricalTypeV2,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub functional_role: Option<PinFunctionalRole>,
    pub shape: PinShapeV2,
    pub position: PinPosition,
    pub orientation: PinOrientation,
    pub length: f64,
    pub sort_order: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name_visible: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_visible: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
}

// ============================================================================
// V2 SPICE Model Types
// ============================================================================

/// Maps a pin number to a SPICE node (v2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpicePinMapping {
    pub pin_number: String,
    pub spice_node: String,
}

/// SPICE model reference attached to a symbol (v2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpiceModelRef {
    pub device: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub library: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub pin_mapping: Vec<SpicePinMapping>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<std::collections::HashMap<String, serde_json::Value>>,
}
