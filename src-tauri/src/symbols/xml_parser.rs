//! XML parser for ModOne Symbol Definition format.
//!
//! Parses `ms:SymbolDefinition` XML files (ModOne Symbol Schema 1.0) into
//! [`SymbolDefinition`] structs.
//!
//! The expected XML format follows the AutomationML/CAEX-inspired schema:
//! ```xml
//! <ms:SymbolDefinition xmlns:ms="http://modone.io/schema/symbol/1.0"
//!   id="custom:my-sensor" name="My Sensor" version="1.0.0"
//!   domain="circuit" canonicalType="sensor">
//!   ...
//! </ms:SymbolDefinition>
//! ```

use std::collections::HashMap;

use quick_xml::events::Event;
use quick_xml::Reader;

use super::types::{
    ArcPrimitive, CirclePrimitive, EdgePosition, GraphicPrimitive, PinElectricalType,
    PinFunctionalRole, PinOrientation, PinPosition, PinShape, PolylinePrimitive, RectPrimitive,
    SymbolDefinition, SymbolPin, SymbolProperty, SymbolUnit, TextPrimitive,
};
use crate::error::{ModOneError, ModOneResult};

// ============================================================================
// Public API
// ============================================================================

/// Parse a ModOne XML symbol definition string into a [`SymbolDefinition`].
///
/// Accepts the full `ms:SymbolDefinition` XML format.  Unknown elements are
/// silently skipped so the parser is forward-compatible with future schema
/// extensions.
pub fn parse_symbol_xml(xml_content: &str) -> ModOneResult<SymbolDefinition> {
    let mut reader = Reader::from_str(xml_content);
    reader.config_mut().trim_text(true);

    // Find the root SymbolDefinition element
    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "SymbolDefinition" {
                    let attrs = collect_attrs_from_elem(e);
                    return parse_symbol_definition_body(&mut reader, attrs);
                }
            }
            Ok(Event::Eof) => {
                return Err(ModOneError::Parse(
                    "No <SymbolDefinition> element found in XML".to_string(),
                ));
            }
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Extract the local name (without namespace prefix) from a raw element name.
fn elem_local_name(raw: &[u8]) -> String {
    let s = std::str::from_utf8(raw).unwrap_or("");
    // strip "ns:" prefix if present
    if let Some(pos) = s.rfind(':') {
        s[pos + 1..].to_string()
    } else {
        s.to_string()
    }
}

/// Collect all attributes from an element into an owned HashMap.
/// Attribute values are unescaped (e.g. `&amp;` → `&`).
fn collect_attrs_from_elem(start: &quick_xml::events::BytesStart<'_>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for attr in start.attributes().flatten() {
        let key = elem_local_name(attr.key.local_name().as_ref());
        // unescape_value handles XML entities; fall back to raw bytes on error
        let val = attr
            .unescape_value()
            .map(|v| v.into_owned())
            .unwrap_or_else(|_| {
                std::str::from_utf8(attr.value.as_ref())
                    .unwrap_or("")
                    .to_string()
            });
        map.insert(key, val);
    }
    map
}

fn map_xml_err(e: quick_xml::Error) -> ModOneError {
    ModOneError::Parse(format!("XML parse error: {}", e))
}

fn attr_f64(attrs: &HashMap<String, String>, key: &str) -> Option<f64> {
    attrs.get(key)?.parse().ok()
}

fn attr_u32(attrs: &HashMap<String, String>, key: &str) -> Option<u32> {
    attrs.get(key)?.parse().ok()
}

fn attr_bool(attrs: &HashMap<String, String>, key: &str) -> Option<bool> {
    attrs.get(key).map(|v| matches!(v.as_str(), "true" | "1" | "yes"))
}

fn parse_electrical_type(s: &str) -> PinElectricalType {
    match s.to_lowercase().as_str() {
        "output" => PinElectricalType::Output,
        "bidirectional" => PinElectricalType::Bidirectional,
        "power" | "power_in" | "power_out" => PinElectricalType::Power,
        "passive" => PinElectricalType::Passive,
        _ => PinElectricalType::Input, // default
    }
}

fn parse_pin_shape(s: &str) -> PinShape {
    match s.to_lowercase().as_str() {
        "inverted" => PinShape::Inverted,
        "clock" => PinShape::Clock,
        _ => PinShape::Line, // default
    }
}

fn parse_orientation(s: &str) -> PinOrientation {
    match s.to_lowercase().as_str() {
        "left" => PinOrientation::Left,
        "up" => PinOrientation::Up,
        "down" => PinOrientation::Down,
        _ => PinOrientation::Right, // default
    }
}

fn parse_functional_role(s: &str) -> PinFunctionalRole {
    match s.to_lowercase().as_str() {
        "plc_input" => PinFunctionalRole::PlcInput,
        "plc_output" => PinFunctionalRole::PlcOutput,
        "communication" => PinFunctionalRole::Communication,
        _ => PinFunctionalRole::General, // default
    }
}

fn parse_edge_position(s: &str) -> EdgePosition {
    match s.to_lowercase().as_str() {
        "top" => EdgePosition::Top,
        "bottom" => EdgePosition::Bottom,
        "right" => EdgePosition::Right,
        _ => EdgePosition::Left, // default
    }
}

fn parse_prop_value(text: &str, prop_type: &str) -> serde_json::Value {
    match prop_type {
        "number" => text
            .parse::<f64>()
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null),
        "boolean" => match text.to_lowercase().as_str() {
            "true" | "1" | "yes" => serde_json::Value::Bool(true),
            _ => serde_json::Value::Bool(false),
        },
        _ => serde_json::Value::String(text.to_string()),
    }
}

// ============================================================================
// Core parsing — all functions take `&mut Reader<&[u8]>` so they can call
// `read_event()` without borrow conflicts.
// ============================================================================

/// Parse the body of a <SymbolDefinition> element.
/// Precondition: the Start("SymbolDefinition") event has already been consumed.
fn parse_symbol_definition_body(
    reader: &mut Reader<&[u8]>,
    attrs: HashMap<String, String>,
) -> ModOneResult<SymbolDefinition> {
    let id = attrs
        .get("id")
        .cloned()
        .unwrap_or_else(|| "unknown".to_string());
    let name = attrs
        .get("name")
        .cloned()
        .unwrap_or_else(|| id.clone());
    let version = attrs
        .get("version")
        .cloned()
        .unwrap_or_else(|| "1.0.0".to_string());

    let now = chrono::Utc::now().to_rfc3339();

    let mut description: Option<String> = None;
    let mut category = "custom".to_string();
    let mut author: Option<String> = None;
    let mut created_at = now.clone();
    let mut updated_at = now;
    let mut width: f64 = 80.0;
    let mut height: f64 = 80.0;
    let mut ports: Vec<SymbolPin> = Vec::new();
    let mut graphics: Vec<GraphicPrimitive> = Vec::new();
    let mut units: Option<Vec<SymbolUnit>> = None;
    let mut properties: Vec<SymbolProperty> = Vec::new();
    let mut iec_section: Option<String> = None;
    let mut iec_category: Option<String> = None;
    let mut ref_designator: Option<String> = None;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                let child_attrs = collect_attrs_from_elem(e);
                match local.as_str() {
                    "Description" => {
                        description = Some(read_text_content(reader)?);
                    }
                    "Category" => {
                        category = read_text_content(reader)?;
                    }
                    "Author" => {
                        author = Some(read_text_content(reader)?);
                    }
                    "CreatedAt" => {
                        created_at = read_text_content(reader)?;
                    }
                    "UpdatedAt" => {
                        updated_at = read_text_content(reader)?;
                    }
                    "Ports" => {
                        ports = parse_ports_section(reader)?;
                    }
                    "Graphics" => {
                        graphics = parse_graphics_section(reader, "Graphics")?;
                    }
                    "Units" => {
                        units = Some(parse_units_section(reader)?);
                    }
                    "Properties" => {
                        properties = parse_properties_section(reader)?;
                    }
                    "StandardsRef" => {
                        iec_section = child_attrs.get("iecSection").cloned();
                        iec_category = child_attrs.get("iecCategory").cloned();
                        ref_designator = child_attrs.get("refDesignator").cloned();
                        // Has no children to consume — skip to End("StandardsRef")
                        skip_to_end_tag(reader, "StandardsRef")?;
                    }
                    // Skip: Behavior, VisualStates, Animations, and any future elements
                    _ => {
                        skip_to_end_tag(reader, &local)?;
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                let child_attrs = collect_attrs_from_elem(e);
                match local.as_str() {
                    "Layout" => {
                        width = attr_f64(&child_attrs, "width").unwrap_or(80.0);
                        height = attr_f64(&child_attrs, "height").unwrap_or(80.0);
                    }
                    "StandardsRef" => {
                        iec_section = child_attrs.get("iecSection").cloned();
                        iec_category = child_attrs.get("iecCategory").cloned();
                        ref_designator = child_attrs.get("refDesignator").cloned();
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "SymbolDefinition" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }

    Ok(SymbolDefinition {
        id,
        name,
        version,
        description,
        category,
        author,
        created_at,
        updated_at,
        width,
        height,
        graphics,
        pins: ports,
        units,
        properties,
        extends_symbol: None,
        spice: None,
        iec_section,
        iec_category,
        ref_designator,
        pin_numbers_hidden: None,
        pin_names_hidden: None,
        pin_name_offset: None,
        exclude_from_sim: None,
    })
}

/// Read text content until the next End event, returning the trimmed text.
fn read_text_content(reader: &mut Reader<&[u8]>) -> ModOneResult<String> {
    let mut text = String::new();
    loop {
        match reader.read_event() {
            Ok(Event::Text(ref e)) => {
                // Symbol text fields (names, values, descriptions) are plain
                // ASCII/UTF-8 without XML entities in practice.
                let s = std::str::from_utf8(e.as_ref())
                    .map_err(|e| ModOneError::Parse(format!("Invalid UTF-8 in text: {}", e)))?;
                text.push_str(s);
            }
            Ok(Event::End(_)) | Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(text.trim().to_string())
}

/// Skip all events until the matching End tag for the given element name.
/// Properly handles nested elements with the same name.
fn skip_to_end_tag(reader: &mut Reader<&[u8]>, tag: &str) -> ModOneResult<()> {
    let mut depth = 1usize;
    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == tag {
                    depth += 1;
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == tag {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(())
}

// ============================================================================
// Port / Pin parsing
// ============================================================================

/// Parse all <Port> elements inside a <Ports> section.
/// Precondition: Start("Ports") has been consumed.
fn parse_ports_section(reader: &mut Reader<&[u8]>) -> ModOneResult<Vec<SymbolPin>> {
    let mut pins = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Empty(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Port" {
                    let a = collect_attrs_from_elem(e);
                    if let Some(pin) = parse_port_from_attrs(&a) {
                        pins.push(pin);
                    }
                }
            }
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Port" {
                    let a = collect_attrs_from_elem(e);
                    if let Some(pin) = parse_port_from_attrs(&a) {
                        pins.push(pin);
                    }
                    // Consume any children of Port (unlikely but safe)
                    skip_to_end_tag(reader, "Port")?;
                } else {
                    skip_to_end_tag(reader, &local)?;
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Ports" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(pins)
}

fn parse_port_from_attrs(attrs: &HashMap<String, String>) -> Option<SymbolPin> {
    let id = attrs.get("id")?.clone();
    let name = attrs
        .get("name")
        .cloned()
        .unwrap_or_else(|| id.clone());
    let number = attrs
        .get("number")
        .cloned()
        .unwrap_or_else(|| id.clone());

    let pin_type = parse_electrical_type(
        attrs.get("electricalType").map(|s| s.as_str()).unwrap_or("input"),
    );
    let shape = parse_pin_shape(attrs.get("shape").map(|s| s.as_str()).unwrap_or("line"));
    let orientation = parse_orientation(
        attrs
            .get("orientation")
            .map(|s| s.as_str())
            .unwrap_or("right"),
    );

    let x: f64 = attrs.get("x").and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let y: f64 = attrs.get("y").and_then(|v| v.parse().ok()).unwrap_or(0.0);
    let length: f64 = attrs
        .get("length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);
    let hidden = attr_bool(attrs, "hidden");
    let description = attrs.get("description").cloned();
    let group = attrs.get("group").cloned();
    let locked = attr_bool(attrs, "locked");
    let color = attrs.get("color").cloned();
    let label_offset = match (attr_f64(attrs, "labelOffsetX"), attr_f64(attrs, "labelOffsetY")) {
        (Some(lx), Some(ly)) => Some(PinPosition { x: lx, y: ly }),
        _ => None,
    };

    let functional_role = attrs.get("functionalRole").and_then(|s| match s.as_str() {
        "general" => Some(PinFunctionalRole::General),
        "plc_input" => Some(PinFunctionalRole::PlcInput),
        "plc_output" => Some(PinFunctionalRole::PlcOutput),
        "communication" => Some(PinFunctionalRole::Communication),
        _ => None,
    });
    let sort_order = attrs.get("sortOrder").and_then(|v| v.parse::<u32>().ok());
    let name_visible = attr_bool(attrs, "nameVisible");
    let number_visible = attr_bool(attrs, "numberVisible");
    let max_connections = attrs.get("maxConnections").and_then(|v| v.parse::<u32>().ok());
    let edge_position = attrs.get("edgePosition").and_then(|s| match s.as_str() {
        "top" => Some(EdgePosition::Top),
        "bottom" => Some(EdgePosition::Bottom),
        "left" => Some(EdgePosition::Left),
        "right" => Some(EdgePosition::Right),
        _ => None,
    });
    let edge_offset = attr_f64(attrs, "edgeOffset");

    Some(SymbolPin {
        id,
        name,
        number,
        pin_type,
        shape,
        position: PinPosition { x, y },
        orientation,
        length,
        hidden,
        functional_role,
        sort_order,
        name_visible,
        number_visible,
        max_connections,
        edge_position,
        edge_offset,
        description,
        group,
        locked,
        color,
        label_offset,
    })
}

// ============================================================================
// Graphics parsing
// ============================================================================

/// Parse all graphic primitive elements inside a container (Graphics, etc.).
/// Precondition: Start(container_tag) has been consumed.
fn parse_graphics_section(
    reader: &mut Reader<&[u8]>,
    container_tag: &str,
) -> ModOneResult<Vec<GraphicPrimitive>> {
    let mut prims = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Empty(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                let attrs = collect_attrs_from_elem(e);
                match local.as_str() {
                    "Rect" => prims.push(parse_rect(&attrs)),
                    "Circle" => prims.push(parse_circle(&attrs)),
                    "Arc" => prims.push(parse_arc(&attrs)),
                    _ => {}
                }
            }
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                let attrs = collect_attrs_from_elem(e);
                match local.as_str() {
                    "Polyline" => {
                        let p = parse_polyline_body(reader, attrs)?;
                        prims.push(p);
                    }
                    "Text" => {
                        let t = parse_text_body(reader, attrs)?;
                        prims.push(t);
                    }
                    _ => {
                        skip_to_end_tag(reader, &local)?;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == container_tag {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(prims)
}

fn parse_rect(attrs: &HashMap<String, String>) -> GraphicPrimitive {
    GraphicPrimitive::Rect(RectPrimitive {
        x: attr_f64(attrs, "x").unwrap_or(0.0),
        y: attr_f64(attrs, "y").unwrap_or(0.0),
        width: attr_f64(attrs, "width").unwrap_or(40.0),
        height: attr_f64(attrs, "height").unwrap_or(40.0),
        stroke: attrs
            .get("stroke")
            .cloned()
            .unwrap_or_else(|| "#888888".to_string()),
        fill: attrs
            .get("fill")
            .cloned()
            .unwrap_or_else(|| "transparent".to_string()),
        stroke_width: attr_f64(attrs, "strokeWidth").unwrap_or(2.0),
    })
}

fn parse_circle(attrs: &HashMap<String, String>) -> GraphicPrimitive {
    GraphicPrimitive::Circle(CirclePrimitive {
        cx: attr_f64(attrs, "cx").unwrap_or(0.0),
        cy: attr_f64(attrs, "cy").unwrap_or(0.0),
        r: attr_f64(attrs, "r").unwrap_or(10.0),
        stroke: attrs
            .get("stroke")
            .cloned()
            .unwrap_or_else(|| "#888888".to_string()),
        fill: attrs
            .get("fill")
            .cloned()
            .unwrap_or_else(|| "transparent".to_string()),
        stroke_width: attr_f64(attrs, "strokeWidth").unwrap_or(2.0),
    })
}

fn parse_arc(attrs: &HashMap<String, String>) -> GraphicPrimitive {
    GraphicPrimitive::Arc(ArcPrimitive {
        cx: attr_f64(attrs, "cx").unwrap_or(0.0),
        cy: attr_f64(attrs, "cy").unwrap_or(0.0),
        r: attr_f64(attrs, "r").unwrap_or(10.0),
        start_angle: attr_f64(attrs, "startAngle").unwrap_or(0.0),
        end_angle: attr_f64(attrs, "endAngle").unwrap_or(360.0),
        stroke: attrs
            .get("stroke")
            .cloned()
            .unwrap_or_else(|| "#888888".to_string()),
        fill: attrs
            .get("fill")
            .cloned()
            .unwrap_or_else(|| "transparent".to_string()),
        stroke_width: attr_f64(attrs, "strokeWidth").unwrap_or(2.0),
    })
}

/// Parse body of a <Polyline> element (reads <Point> children, then </Polyline>).
/// Precondition: Start("Polyline") has been consumed and `attrs` collected.
fn parse_polyline_body(
    reader: &mut Reader<&[u8]>,
    attrs: HashMap<String, String>,
) -> ModOneResult<GraphicPrimitive> {
    let stroke = attrs
        .get("stroke")
        .cloned()
        .unwrap_or_else(|| "#888888".to_string());
    let fill = attrs
        .get("fill")
        .cloned()
        .unwrap_or_else(|| "none".to_string());
    let stroke_width: f64 = attr_f64(&attrs, "strokeWidth").unwrap_or(2.0);

    let mut points: Vec<PinPosition> = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Empty(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Point" {
                    let pa = collect_attrs_from_elem(e);
                    let x: f64 = attr_f64(&pa, "x").unwrap_or(0.0);
                    let y: f64 = attr_f64(&pa, "y").unwrap_or(0.0);
                    points.push(PinPosition { x, y });
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Polyline" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }

    Ok(GraphicPrimitive::Polyline(PolylinePrimitive {
        points,
        stroke,
        fill,
        stroke_width,
    }))
}

/// Parse body of a <Text> element (reads text content, then </Text>).
/// Precondition: Start("Text") has been consumed and `attrs` collected.
fn parse_text_body(
    reader: &mut Reader<&[u8]>,
    attrs: HashMap<String, String>,
) -> ModOneResult<GraphicPrimitive> {
    let x: f64 = attr_f64(&attrs, "x").unwrap_or(0.0);
    let y: f64 = attr_f64(&attrs, "y").unwrap_or(0.0);
    let font_size: f64 = attr_f64(&attrs, "fontSize").unwrap_or(12.0);
    let font_family = attrs
        .get("fontFamily")
        .cloned()
        .unwrap_or_else(|| "Arial".to_string());
    let fill = attrs
        .get("fill")
        .cloned()
        .unwrap_or_else(|| "#000000".to_string());
    let anchor = attrs.get("anchor").cloned();

    let text = read_text_content(reader)?;

    Ok(GraphicPrimitive::Text(TextPrimitive {
        x,
        y,
        text,
        font_size,
        font_family,
        fill,
        anchor,
    }))
}

// ============================================================================
// Units parsing
// ============================================================================

/// Parse all <Unit> elements inside a <Units> section.
/// Precondition: Start("Units") has been consumed.
fn parse_units_section(reader: &mut Reader<&[u8]>) -> ModOneResult<Vec<SymbolUnit>> {
    let mut units = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Unit" {
                    let a = collect_attrs_from_elem(e);
                    let unit = parse_unit_body(reader, a)?;
                    units.push(unit);
                } else {
                    skip_to_end_tag(reader, &local)?;
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Units" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(units)
}

/// Parse body of a <Unit> element.
/// Precondition: Start("Unit") has been consumed and attrs collected.
fn parse_unit_body(
    reader: &mut Reader<&[u8]>,
    attrs: HashMap<String, String>,
) -> ModOneResult<SymbolUnit> {
    let unit_id: u32 = attrs.get("unitId").and_then(|v| v.parse().ok()).unwrap_or(1);
    let name = attrs
        .get("name")
        .cloned()
        .unwrap_or_else(|| format!("Unit {}", unit_id));

    let mut graphics = Vec::new();
    let mut pins = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                match local.as_str() {
                    "Graphics" => {
                        graphics = parse_graphics_section(reader, "Graphics")?;
                    }
                    "Ports" => {
                        pins = parse_ports_section(reader)?;
                    }
                    _ => {
                        skip_to_end_tag(reader, &local)?;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Unit" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }

    Ok(SymbolUnit {
        unit_id,
        name,
        graphics,
        pins,
    })
}

// ============================================================================
// Properties parsing
// ============================================================================

/// Parse all <Property> elements inside a <Properties> section.
/// Precondition: Start("Properties") has been consumed.
fn parse_properties_section(reader: &mut Reader<&[u8]>) -> ModOneResult<Vec<SymbolProperty>> {
    let mut props = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Property" {
                    let a = collect_attrs_from_elem(e);
                    let prop = parse_property_body(reader, a)?;
                    props.push(prop);
                } else {
                    skip_to_end_tag(reader, &local)?;
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Properties" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(props)
}

/// Parse body of a <Property> element.
/// Precondition: Start("Property") has been consumed and attrs collected.
fn parse_property_body(
    reader: &mut Reader<&[u8]>,
    attrs: HashMap<String, String>,
) -> ModOneResult<SymbolProperty> {
    let key = attrs.get("key").cloned().unwrap_or_default();
    let prop_type = attrs
        .get("type")
        .cloned()
        .unwrap_or_else(|| "string".to_string());
    let editor_type = attrs.get("editorType").cloned();
    let visible = attr_bool(&attrs, "visible");

    let mut default_value: serde_json::Value = serde_json::Value::Null;
    let mut options: Option<Vec<String>> = None;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                match local.as_str() {
                    "DefaultValue" => {
                        let text = read_text_content(reader)?;
                        default_value = parse_prop_value(&text, &prop_type);
                    }
                    "Options" => {
                        options = Some(parse_options_section(reader)?);
                    }
                    "Description" => {
                        let _ = read_text_content(reader)?; // informational, skip
                    }
                    _ => {
                        skip_to_end_tag(reader, &local)?;
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Property" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }

    Ok(SymbolProperty {
        key,
        value: default_value,
        prop_type,
        visible,
        editor_type,
        options,
    })
}

/// Parse all <Option> text values inside an <Options> element.
/// Precondition: Start("Options") has been consumed.
fn parse_options_section(reader: &mut Reader<&[u8]>) -> ModOneResult<Vec<String>> {
    let mut opts = Vec::new();
    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Option" {
                    opts.push(read_text_content(reader)?);
                } else {
                    skip_to_end_tag(reader, &local)?;
                }
            }
            Ok(Event::End(ref e)) => {
                let local = elem_local_name(e.name().as_ref());
                if local == "Options" {
                    break;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(map_xml_err(e)),
            _ => {}
        }
    }
    Ok(opts)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL_XML: &str = r##"<?xml version="1.0" encoding="UTF-8"?>
<ms:SymbolDefinition
  xmlns:ms="http://modone.io/schema/symbol/1.0"
  id="test:sensor"
  name="Test Sensor"
  version="1.0.0">
  <ms:Description>A minimal test sensor</ms:Description>
  <ms:Category>sensor</ms:Category>
  <ms:Author>Test</ms:Author>
  <ms:Layout width="60" height="60" unit="px"/>
  <ms:Ports>
    <ms:Port id="in" name="IN" number="1"
             electricalType="input" shape="line" orientation="left"
             x="0" y="30" length="0"/>
    <ms:Port id="out" name="OUT" number="2"
             electricalType="output" shape="line" orientation="right"
             x="60" y="30" length="0"/>
  </ms:Ports>
  <ms:Graphics>
    <ms:Rect x="10" y="10" width="40" height="40"
             stroke="#888888" fill="transparent" strokeWidth="2"/>
    <ms:Text x="30" y="35" fontSize="12" fontFamily="Arial"
             fill="#888888" anchor="middle">S</ms:Text>
  </ms:Graphics>
  <ms:Properties>
    <ms:Property key="label" type="string" editorType="text" visible="true">
      <ms:DefaultValue>S1</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="threshold" type="number" editorType="number" visible="true">
      <ms:DefaultValue>50</ms:DefaultValue>
    </ms:Property>
    <ms:Property key="active" type="boolean" editorType="checkbox" visible="true">
      <ms:DefaultValue>false</ms:DefaultValue>
    </ms:Property>
  </ms:Properties>
</ms:SymbolDefinition>
"##;

    #[test]
    fn test_parse_minimal_symbol() {
        let sym = parse_symbol_xml(MINIMAL_XML).expect("should parse");
        assert_eq!(sym.id, "test:sensor");
        assert_eq!(sym.name, "Test Sensor");
        assert_eq!(sym.version, "1.0.0");
        assert_eq!(sym.category, "sensor");
        assert_eq!(sym.description.as_deref(), Some("A minimal test sensor"));
        assert_eq!(sym.author.as_deref(), Some("Test"));
        assert_eq!(sym.width, 60.0);
        assert_eq!(sym.height, 60.0);
    }

    #[test]
    fn test_parse_ports() {
        let sym = parse_symbol_xml(MINIMAL_XML).expect("should parse");
        assert_eq!(sym.pins.len(), 2);

        let pin_in = &sym.pins[0];
        assert_eq!(pin_in.id, "in");
        assert_eq!(pin_in.name, "IN");
        assert_eq!(pin_in.position.x, 0.0);
        assert_eq!(pin_in.position.y, 30.0);

        let pin_out = &sym.pins[1];
        assert_eq!(pin_out.id, "out");
        assert_eq!(pin_out.position.x, 60.0);
    }

    #[test]
    fn test_parse_graphics() {
        let sym = parse_symbol_xml(MINIMAL_XML).expect("should parse");
        assert_eq!(sym.graphics.len(), 2);
        assert!(matches!(sym.graphics[0], GraphicPrimitive::Rect(_)));
        assert!(matches!(sym.graphics[1], GraphicPrimitive::Text(_)));
    }

    #[test]
    fn test_parse_properties() {
        let sym = parse_symbol_xml(MINIMAL_XML).expect("should parse");
        assert_eq!(sym.properties.len(), 3);

        let label_prop = &sym.properties[0];
        assert_eq!(label_prop.key, "label");
        assert_eq!(label_prop.prop_type, "string");
        assert_eq!(label_prop.value, serde_json::Value::String("S1".to_string()));

        let threshold_prop = &sym.properties[1];
        assert_eq!(threshold_prop.key, "threshold");
        assert_eq!(threshold_prop.prop_type, "number");
        assert_eq!(threshold_prop.value, serde_json::json!(50.0));

        let active_prop = &sym.properties[2];
        assert_eq!(active_prop.key, "active");
        assert_eq!(active_prop.prop_type, "boolean");
        assert_eq!(active_prop.value, serde_json::Value::Bool(false));
    }

    #[test]
    fn test_parse_polyline() {
        let xml = r##"<ms:SymbolDefinition
            xmlns:ms="http://modone.io/schema/symbol/1.0"
            id="test:poly" name="Poly" version="1.0.0">
            <ms:Layout width="80" height="80" unit="px"/>
            <ms:Ports/>
            <ms:Graphics>
                <ms:Polyline stroke="#ff0000" fill="none" strokeWidth="3">
                    <ms:Point x="0" y="0"/>
                    <ms:Point x="40" y="40"/>
                    <ms:Point x="80" y="0"/>
                </ms:Polyline>
            </ms:Graphics>
        </ms:SymbolDefinition>"##;

        let sym = parse_symbol_xml(xml).expect("should parse");
        assert_eq!(sym.graphics.len(), 1);
        if let GraphicPrimitive::Polyline(ref p) = sym.graphics[0] {
            assert_eq!(p.points.len(), 3);
            assert_eq!(p.stroke, "#ff0000");
            assert_eq!(p.stroke_width, 3.0);
            assert_eq!(p.points[1].x, 40.0);
        } else {
            panic!("expected Polyline");
        }
    }

    #[test]
    fn test_parse_units() {
        let xml = r##"<ms:SymbolDefinition
            xmlns:ms="http://modone.io/schema/symbol/1.0"
            id="test:multi" name="Multi" version="1.0.0">
            <ms:Layout width="80" height="80" unit="px"/>
            <ms:Ports/>
            <ms:Graphics/>
            <ms:Units>
                <ms:Unit unitId="1" name="Coil">
                    <ms:Graphics>
                        <ms:Rect x="0" y="0" width="20" height="20"
                                 stroke="#888" fill="none" strokeWidth="1"/>
                    </ms:Graphics>
                    <ms:Ports>
                        <ms:Port id="a1" name="A1" number="A1"
                                 electricalType="input" shape="line" orientation="up"
                                 x="10" y="0" length="0"/>
                    </ms:Ports>
                </ms:Unit>
                <ms:Unit unitId="2" name="Contact">
                    <ms:Graphics/>
                    <ms:Ports>
                        <ms:Port id="com" name="COM" number="11"
                                 electricalType="input" shape="line" orientation="left"
                                 x="0" y="10" length="0"/>
                    </ms:Ports>
                </ms:Unit>
            </ms:Units>
        </ms:SymbolDefinition>"##;

        let sym = parse_symbol_xml(xml).expect("should parse");
        let units = sym.units.expect("should have units");
        assert_eq!(units.len(), 2);
        assert_eq!(units[0].unit_id, 1);
        assert_eq!(units[0].name, "Coil");
        assert_eq!(units[0].pins.len(), 1);
        assert_eq!(units[0].graphics.len(), 1);
        assert_eq!(units[1].unit_id, 2);
        assert_eq!(units[1].pins.len(), 1);
    }

    #[test]
    fn test_missing_root_element() {
        let xml = r#"<?xml version="1.0"?><root><child/></root>"#;
        let result = parse_symbol_xml(xml);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("SymbolDefinition"));
    }
}
