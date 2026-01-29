//! Parser Commands
//!
//! Tauri commands for CSV parsing, address mapping, and ladder logic operations.

use crate::error::ModOneError;
use crate::parser::csv_reader::{self, CsvRow};
use crate::parser::modbus_mapper::{self, ModbusMapper};
use crate::parser::types::{DeviceAddress, DeviceType, LadderProgram, ModbusAddress};
use std::fs;
use std::path::Path;

/// Parse a CSV file from disk
#[tauri::command]
pub async fn parser_parse_csv_file(path: String) -> Result<Vec<CsvRow>, ModOneError> {
    // Run in blocking thread to avoid blocking async runtime
    tokio::task::spawn_blocking(move || {
        csv_reader::parse_csv_file(&path).map_err(|e| ModOneError::Parse(e.to_string()))
    })
    .await
    .map_err(|e| ModOneError::Internal(e.to_string()))?
}

/// Parse CSV content from string
#[tauri::command]
pub fn parser_parse_csv_content(content: String) -> Result<Vec<CsvRow>, ModOneError> {
    csv_reader::parse_csv_content(&content).map_err(|e| ModOneError::Parse(e.to_string()))
}

/// Parse CSV content and group by step/network
#[tauri::command]
pub fn parser_parse_csv_grouped(
    content: String,
) -> Result<std::collections::HashMap<u32, Vec<CsvRow>>, ModOneError> {
    csv_reader::parse_csv_grouped(&content).map_err(|e| ModOneError::Parse(e.to_string()))
}

/// Map a device address string to Modbus address
#[tauri::command]
pub fn parser_map_address_to_modbus(
    device_address: String,
) -> Result<Option<ModbusAddress>, ModOneError> {
    // Parse the device address string
    let addr = parse_device_address_string(&device_address)?;

    let mapper = ModbusMapper::new();
    Ok(mapper.map_to_modbus(&addr))
}

/// Map a Modbus address back to device address(es)
#[tauri::command]
pub fn parser_map_modbus_to_address(
    modbus_address: ModbusAddress,
) -> Result<Vec<String>, ModOneError> {
    let mapper = ModbusMapper::new();
    let addresses = mapper.map_from_modbus(&modbus_address);
    Ok(addresses.into_iter().map(|a| a.format()).collect())
}

/// Check if a device address is read-only
#[tauri::command]
pub fn parser_is_read_only(device_address: String) -> Result<bool, ModOneError> {
    let addr = parse_device_address_string(&device_address)?;
    let mapper = ModbusMapper::new();
    Ok(mapper.is_read_only(&addr))
}

/// Format a Modbus address for display
#[tauri::command]
pub fn parser_format_modbus_address(modbus_address: ModbusAddress) -> String {
    modbus_mapper::format_modbus_address(&modbus_address)
}

/// Parse a Modbus address string
#[tauri::command]
pub fn parser_parse_modbus_address(address_str: String) -> Option<ModbusAddress> {
    modbus_mapper::parse_modbus_address(&address_str)
}

/// Save a ladder program to a JSON file
#[tauri::command]
pub async fn parser_save_program(path: String, program: LadderProgram) -> Result<(), ModOneError> {
    tokio::task::spawn_blocking(move || -> Result<(), ModOneError> {
        let json = serde_json::to_string_pretty(&program)
            .map_err(|e| ModOneError::Internal(e.to_string()))?;
        fs::write(&path, json).map_err(|e| ModOneError::IoError(e.to_string()))?;
        Ok(())
    })
    .await
    .map_err(|e| ModOneError::Internal(e.to_string()))?
}

/// Load a ladder program from a JSON file
#[tauri::command]
pub async fn parser_load_program(path: String) -> Result<LadderProgram, ModOneError> {
    tokio::task::spawn_blocking(move || -> Result<LadderProgram, ModOneError> {
        let content =
            fs::read_to_string(&path).map_err(|e| ModOneError::IoError(e.to_string()))?;
        let program: LadderProgram =
            serde_json::from_str(&content).map_err(|e| ModOneError::Parse(e.to_string()))?;
        Ok(program)
    })
    .await
    .map_err(|e| ModOneError::Internal(e.to_string()))?
}

/// Check if a program file exists
#[tauri::command]
pub fn parser_program_exists(path: String) -> bool {
    Path::new(&path).exists()
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Parse a device address string like "M0000", "D0100.5", etc.
fn parse_device_address_string(s: &str) -> Result<DeviceAddress, ModOneError> {
    let s = s.trim().to_uppercase();

    if s.is_empty() {
        return Err(ModOneError::Parse("Empty device address".to_string()));
    }

    // Match device type (first character)
    let device_char = s.chars().next().unwrap();
    let device_type = DeviceType::from_str(&device_char.to_string())
        .ok_or_else(|| ModOneError::Parse(format!("Invalid device type: {}", device_char)))?;

    // Find the end of the address number
    let remaining = &s[1..];

    // Check for bit index (.N)
    let (address_str, bit_index) = if let Some(dot_pos) = remaining.find('.') {
        let addr_part = &remaining[..dot_pos];
        let bit_part = &remaining[dot_pos + 1..];

        // Handle indexed addressing in bit part
        let bit_str = if let Some(bracket_pos) = bit_part.find('[') {
            &bit_part[..bracket_pos]
        } else {
            bit_part
        };

        let bit_idx: u8 = bit_str
            .parse()
            .map_err(|_| ModOneError::Parse(format!("Invalid bit index: {}", bit_str)))?;

        if bit_idx > 15 {
            return Err(ModOneError::Parse(format!(
                "Bit index out of range: {}",
                bit_idx
            )));
        }

        (addr_part, Some(bit_idx))
    } else {
        // Check for indexed addressing without bit index
        let addr_str = if let Some(bracket_pos) = remaining.find('[') {
            &remaining[..bracket_pos]
        } else {
            remaining
        };
        (addr_str, None)
    };

    // Parse address number
    let address: u32 = address_str
        .parse()
        .map_err(|_| ModOneError::Parse(format!("Invalid address number: {}", address_str)))?;

    // Check for index register [Zn]
    let index_register = if let Some(bracket_pos) = s.find('[') {
        let end_pos = s.find(']').ok_or_else(|| {
            ModOneError::Parse("Missing closing bracket in indexed address".to_string())
        })?;
        let index_str = &s[bracket_pos + 1..end_pos];

        if !index_str.starts_with('Z') && !index_str.starts_with('z') {
            return Err(ModOneError::Parse(format!(
                "Invalid index register: {}",
                index_str
            )));
        }

        let idx: u8 = index_str[1..]
            .parse()
            .map_err(|_| ModOneError::Parse(format!("Invalid index register: {}", index_str)))?;

        Some(idx)
    } else {
        None
    };

    Ok(DeviceAddress {
        device: device_type,
        address,
        bit_index,
        index_register,
    })
}
