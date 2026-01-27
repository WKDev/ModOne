//! Modbus RTU server implementation
//!
//! Provides a serial port server that handles Modbus RTU requests.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_serial::{DataBits, Parity, SerialPortBuilderExt, SerialStream, StopBits};

use super::memory::ModbusMemory;
use super::types::{ChangeSource, ConnectionEvent, ModbusError};

// Event channel name for connection events
const EVENT_CONNECTION: &str = "modbus:connection";

/// Information about an available serial port
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    /// Port name (e.g., "COM1" on Windows, "/dev/ttyUSB0" on Linux)
    pub name: String,
    /// Port type (USB, Bluetooth, PCI, Unknown)
    pub port_type: String,
    /// Optional description (e.g., manufacturer and product info for USB)
    pub description: Option<String>,
}

/// Parity configuration for serial port
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RtuParity {
    #[default]
    None,
    Odd,
    Even,
}

impl From<RtuParity> for Parity {
    fn from(p: RtuParity) -> Self {
        match p {
            RtuParity::None => Parity::None,
            RtuParity::Odd => Parity::Odd,
            RtuParity::Even => Parity::Even,
        }
    }
}

/// Stop bits configuration for serial port
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RtuStopBits {
    #[default]
    One,
    Two,
}

impl From<RtuStopBits> for StopBits {
    fn from(s: RtuStopBits) -> Self {
        match s {
            RtuStopBits::One => StopBits::One,
            RtuStopBits::Two => StopBits::Two,
        }
    }
}

/// Data bits configuration for serial port
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RtuDataBits {
    Seven,
    #[default]
    Eight,
}

impl From<RtuDataBits> for DataBits {
    fn from(d: RtuDataBits) -> Self {
        match d {
            RtuDataBits::Seven => DataBits::Seven,
            RtuDataBits::Eight => DataBits::Eight,
        }
    }
}

/// Configuration for Modbus RTU server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RtuConfig {
    /// Serial port name (e.g., "COM1" on Windows)
    pub com_port: String,
    /// Baud rate (e.g., 9600, 19200, 38400, 57600, 115200)
    pub baud_rate: u32,
    /// Parity setting
    pub parity: RtuParity,
    /// Stop bits setting
    pub stop_bits: RtuStopBits,
    /// Data bits setting
    pub data_bits: RtuDataBits,
    /// Modbus unit ID (slave address)
    pub unit_id: u8,
}

impl Default for RtuConfig {
    fn default() -> Self {
        Self {
            com_port: String::new(),
            baud_rate: 9600,
            parity: RtuParity::None,
            stop_bits: RtuStopBits::One,
            data_bits: RtuDataBits::Eight,
            unit_id: 1,
        }
    }
}

impl RtuConfig {
    /// Create a new RtuConfig with specified port and baud rate
    pub fn new(com_port: String, baud_rate: u32) -> Self {
        Self {
            com_port,
            baud_rate,
            ..Default::default()
        }
    }

    /// Calculate the inter-frame delay (3.5 character times) in microseconds
    pub fn inter_frame_delay_us(&self) -> u64 {
        // Character time = (start bit + data bits + parity bit + stop bits) / baud rate
        // For 8N1: 10 bits per character
        let bits_per_char = 1 + match self.data_bits {
            RtuDataBits::Seven => 7,
            RtuDataBits::Eight => 8,
        } + match self.parity {
            RtuParity::None => 0,
            _ => 1,
        } + match self.stop_bits {
            RtuStopBits::One => 1,
            RtuStopBits::Two => 2,
        };

        // Inter-frame delay is 3.5 character times
        // But minimum is 1.75ms (1750us) for baud rates > 19200
        let char_time_us = (bits_per_char as u64 * 1_000_000) / self.baud_rate as u64;
        let t35 = char_time_us * 35 / 10; // 3.5 character times

        // Minimum 1.75ms for high baud rates
        t35.max(1750)
    }
}

/// Modbus RTU server with serial port communication
pub struct ModbusRtuServer {
    config: RtuConfig,
    memory: Arc<ModbusMemory>,
    running: Arc<AtomicBool>,
    port: Arc<Mutex<Option<SerialStream>>>,
    task_handle: Option<tokio::task::JoinHandle<()>>,
    /// Tauri app handle for event emission
    app_handle: Arc<RwLock<Option<Arc<tauri::AppHandle>>>>,
}

impl ModbusRtuServer {
    /// Create a new Modbus RTU server
    pub fn new(config: RtuConfig, memory: Arc<ModbusMemory>) -> Self {
        Self {
            config,
            memory,
            running: Arc::new(AtomicBool::new(false)),
            port: Arc::new(Mutex::new(None)),
            task_handle: None,
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Set the Tauri app handle for event emission
    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.write() = Some(Arc::new(handle));
    }

    /// Emit a connection event
    fn emit_connection_event(app_handle: &Arc<RwLock<Option<Arc<tauri::AppHandle>>>>, event: ConnectionEvent) {
        if let Some(handle) = app_handle.read().as_ref() {
            let _ = handle.emit(EVENT_CONNECTION, event);
        }
    }

    /// Check if the server is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Get the server configuration
    pub fn config(&self) -> &RtuConfig {
        &self.config
    }

    /// Start the Modbus RTU server
    pub async fn start(&mut self) -> Result<(), ModbusError> {
        if self.is_running() {
            return Err(ModbusError::AlreadyRunning);
        }

        // Open the serial port
        let builder = tokio_serial::new(&self.config.com_port, self.config.baud_rate)
            .parity(self.config.parity.into())
            .stop_bits(self.config.stop_bits.into())
            .data_bits(self.config.data_bits.into());

        let stream = builder
            .open_native_async()
            .map_err(|e| ModbusError::BindFailed(format!("{}: {}", self.config.com_port, e)))?;

        log::info!(
            "Modbus RTU server started on {} at {} baud",
            self.config.com_port,
            self.config.baud_rate
        );

        // Store the stream
        *self.port.lock().await = Some(stream);

        // Mark as running
        self.running.store(true, Ordering::SeqCst);

        // Emit connected event
        Self::emit_connection_event(&self.app_handle, ConnectionEvent::rtu_connected(&self.config.com_port));

        // Clone what we need for the RTU loop
        let memory = Arc::clone(&self.memory);
        let running = Arc::clone(&self.running);
        let port = Arc::clone(&self.port);
        let unit_id = self.config.unit_id;
        let inter_frame_delay = std::time::Duration::from_micros(self.config.inter_frame_delay_us());

        // Spawn the RTU loop
        self.task_handle = Some(tokio::spawn(async move {
            rtu_loop(port, memory, running, unit_id, inter_frame_delay).await;
        }));

        Ok(())
    }

    /// Stop the Modbus RTU server
    pub async fn stop(&mut self) -> Result<(), ModbusError> {
        if !self.is_running() {
            return Err(ModbusError::NotRunning);
        }

        let port_name = self.config.com_port.clone();

        // Signal stop
        self.running.store(false, Ordering::SeqCst);

        // Abort the task if running
        if let Some(handle) = self.task_handle.take() {
            handle.abort();
            let _ = handle.await;
        }

        // Close the port
        *self.port.lock().await = None;

        // Emit disconnected event
        Self::emit_connection_event(&self.app_handle, ConnectionEvent::rtu_disconnected(&port_name));

        log::info!("Modbus RTU server stopped");
        Ok(())
    }
}

/// List available serial ports on the system
pub fn list_available_ports() -> Result<Vec<PortInfo>, std::io::Error> {
    let ports = serialport::available_ports()?;

    Ok(ports
        .into_iter()
        .map(|p| {
            let (port_type, description) = match &p.port_type {
                serialport::SerialPortType::UsbPort(info) => {
                    let desc = format!(
                        "{} {}",
                        info.manufacturer.as_deref().unwrap_or(""),
                        info.product.as_deref().unwrap_or("")
                    )
                    .trim()
                    .to_string();
                    (
                        "USB".to_string(),
                        if desc.is_empty() { None } else { Some(desc) },
                    )
                }
                serialport::SerialPortType::BluetoothPort => ("Bluetooth".to_string(), None),
                serialport::SerialPortType::PciPort => ("PCI".to_string(), None),
                serialport::SerialPortType::Unknown => ("Unknown".to_string(), None),
            };

            PortInfo {
                name: p.port_name,
                port_type,
                description,
            }
        })
        .collect())
}

/// Calculate Modbus CRC-16
///
/// Uses the standard Modbus polynomial 0xA001 (reflected form of 0x8005).
fn calculate_crc(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;

    for byte in data {
        crc ^= *byte as u16;
        for _ in 0..8 {
            if crc & 0x0001 != 0 {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }

    crc
}

/// Validate a Modbus RTU frame (check CRC)
fn validate_frame(frame: &[u8]) -> bool {
    if frame.len() < 4 {
        return false; // Minimum: unit_id + function_code + crc(2)
    }

    let data_len = frame.len() - 2;
    let received_crc = u16::from_le_bytes([frame[data_len], frame[data_len + 1]]);
    let calculated_crc = calculate_crc(&frame[..data_len]);

    received_crc == calculated_crc
}

/// Build a Modbus RTU response frame with CRC
fn build_response_frame(unit_id: u8, response_pdu: &[u8]) -> Vec<u8> {
    let mut frame = Vec::with_capacity(response_pdu.len() + 3);
    frame.push(unit_id);
    frame.extend_from_slice(response_pdu);

    let crc = calculate_crc(&frame);
    frame.extend_from_slice(&crc.to_le_bytes());

    frame
}

/// The main RTU communication loop
async fn rtu_loop(
    port: Arc<Mutex<Option<SerialStream>>>,
    memory: Arc<ModbusMemory>,
    running: Arc<AtomicBool>,
    unit_id: u8,
    inter_frame_delay: std::time::Duration,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut buffer = [0u8; 256];
    let mut frame_buffer = Vec::with_capacity(256);

    while running.load(Ordering::SeqCst) {
        // Get access to the port and perform read
        let read_result = {
            let mut port_guard = port.lock().await;
            if let Some(ref mut stream) = *port_guard {
                // Use a shorter timeout for responsiveness
                match tokio::time::timeout(inter_frame_delay, stream.read(&mut buffer)).await {
                    Ok(Ok(n)) => Some(Ok(n)),
                    Ok(Err(e)) => Some(Err(e)),
                    Err(_) => None, // Timeout - frame complete
                }
            } else {
                // Port closed, exit loop
                break;
            }
        };

        match read_result {
            Some(Ok(n)) if n > 0 => {
                frame_buffer.extend_from_slice(&buffer[..n]);
            }
            Some(Ok(_)) => {
                // Zero bytes read (shouldn't happen with timeout)
            }
            Some(Err(e)) => {
                log::error!("Serial read error: {}", e);
                frame_buffer.clear();
                // Continue and try to recover
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
            None => {
                // Timeout - process frame if we have data
                if frame_buffer.len() >= 4 && validate_frame(&frame_buffer) {
                    // Check if this frame is addressed to us
                    if frame_buffer[0] == unit_id || frame_buffer[0] == 0 {
                        // Extract function code and data
                        let function_code = frame_buffer[1];
                        let pdu_end = frame_buffer.len() - 2; // Exclude CRC
                        let request_pdu = &frame_buffer[1..pdu_end];

                        // Process the request
                        let response_pdu = process_rtu_request(&memory, function_code, request_pdu);

                        // Build and send response (only if not broadcast)
                        if frame_buffer[0] != 0 {
                            let response_frame = build_response_frame(unit_id, &response_pdu);

                            let mut port_guard = port.lock().await;
                            if let Some(ref mut stream) = *port_guard {
                                if let Err(e) = stream.write_all(&response_frame).await {
                                    log::error!("Serial write error: {}", e);
                                }
                            }
                        }
                    }
                } else if !frame_buffer.is_empty() {
                    log::debug!(
                        "Invalid frame (len={}, valid={})",
                        frame_buffer.len(),
                        if frame_buffer.len() >= 4 {
                            validate_frame(&frame_buffer)
                        } else {
                            false
                        }
                    );
                }

                frame_buffer.clear();
            }
        }
    }

    log::info!("RTU loop exited");
}

/// Process a Modbus RTU request and return the response PDU
///
/// The request_pdu includes the function code as the first byte.
fn process_rtu_request(memory: &ModbusMemory, function_code: u8, pdu: &[u8]) -> Vec<u8> {
    // Reuse the same logic as TCP - the PDU format is identical
    match function_code {
        // Function Code 0x01: Read Coils
        0x01 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_coils(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() + 7) / 8;
                    let mut response = vec![function_code, byte_count as u8];
                    response.extend(pack_bits(&values));
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x02: Read Discrete Inputs
        0x02 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_discrete_inputs(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() + 7) / 8;
                    let mut response = vec![function_code, byte_count as u8];
                    response.extend(pack_bits(&values));
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x03: Read Holding Registers
        0x03 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_holding_registers(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() * 2) as u8;
                    let mut response = vec![function_code, byte_count];
                    for value in values {
                        response.extend_from_slice(&value.to_be_bytes());
                    }
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x04: Read Input Registers
        0x04 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.read_input_registers(start_addr, quantity) {
                Ok(values) => {
                    let byte_count = (values.len() * 2) as u8;
                    let mut response = vec![function_code, byte_count];
                    for value in values {
                        response.extend_from_slice(&value.to_be_bytes());
                    }
                    response
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x05: Write Single Coil
        0x05 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let value = u16::from_be_bytes([pdu[3], pdu[4]]);
            let coil_value = value == 0xFF00;

            match memory.write_coil_with_source(addr, coil_value, ChangeSource::External) {
                Ok(_) => pdu.to_vec(),
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x06: Write Single Register
        0x06 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03);
            }
            let addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let value = u16::from_be_bytes([pdu[3], pdu[4]]);

            match memory.write_holding_register_with_source(addr, value, ChangeSource::External) {
                Ok(_) => pdu.to_vec(),
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x0F: Write Multiple Coils
        0x0F => {
            if pdu.len() < 6 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);
            let byte_count = pdu[5] as usize;

            if pdu.len() < 6 + byte_count {
                return exception_response(function_code, 0x03);
            }

            let values = unpack_bits(&pdu[6..6 + byte_count], quantity as usize);

            match memory.write_coils_with_source(start_addr, &values, ChangeSource::External) {
                Ok(_) => vec![function_code, pdu[1], pdu[2], pdu[3], pdu[4]],
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Function Code 0x10: Write Multiple Registers
        0x10 => {
            if pdu.len() < 6 {
                return exception_response(function_code, 0x03);
            }
            let start_addr = u16::from_be_bytes([pdu[1], pdu[2]]);
            let quantity = u16::from_be_bytes([pdu[3], pdu[4]]);
            let byte_count = pdu[5] as usize;

            if pdu.len() < 6 + byte_count || byte_count != (quantity as usize) * 2 {
                return exception_response(function_code, 0x03);
            }

            let values: Vec<u16> = (0..quantity as usize)
                .map(|i| u16::from_be_bytes([pdu[6 + i * 2], pdu[7 + i * 2]]))
                .collect();

            match memory.write_holding_registers_with_source(start_addr, &values, ChangeSource::External) {
                Ok(_) => vec![function_code, pdu[1], pdu[2], pdu[3], pdu[4]],
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Unsupported function code
        _ => exception_response(function_code, 0x01),
    }
}

/// Create a Modbus exception response
fn exception_response(function_code: u8, exception_code: u8) -> Vec<u8> {
    vec![function_code | 0x80, exception_code]
}

/// Pack boolean values into bytes (LSB first within each byte)
fn pack_bits(values: &[bool]) -> Vec<u8> {
    let byte_count = (values.len() + 7) / 8;
    let mut bytes = vec![0u8; byte_count];

    for (i, &value) in values.iter().enumerate() {
        if value {
            bytes[i / 8] |= 1 << (i % 8);
        }
    }

    bytes
}

/// Unpack bytes into boolean values (LSB first within each byte)
fn unpack_bits(bytes: &[u8], count: usize) -> Vec<bool> {
    let mut values = Vec::with_capacity(count);

    for i in 0..count {
        let byte_idx = i / 8;
        let bit_idx = i % 8;
        if byte_idx < bytes.len() {
            values.push((bytes[byte_idx] >> bit_idx) & 1 == 1);
        } else {
            values.push(false);
        }
    }

    values
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modbus::types::MemoryMapSettings;

    #[test]
    fn test_calculate_crc() {
        // Test vector from Modbus specification
        // Query: 01 03 00 00 00 0A -> CRC: C5 CD
        let data = [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = calculate_crc(&data);
        assert_eq!(crc, 0xCDC5); // Note: little-endian in frame, so bytes are swapped
    }

    #[test]
    fn test_validate_frame() {
        // Valid frame with correct CRC
        let mut frame = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
        let crc = calculate_crc(&frame);
        frame.extend_from_slice(&crc.to_le_bytes());
        assert!(validate_frame(&frame));

        // Invalid frame with wrong CRC
        let bad_frame = vec![0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0x00, 0x00];
        assert!(!validate_frame(&bad_frame));

        // Too short frame
        let short_frame = vec![0x01, 0x03, 0x00];
        assert!(!validate_frame(&short_frame));
    }

    #[test]
    fn test_build_response_frame() {
        let response_pdu = vec![0x03, 0x02, 0x00, 0x05];
        let frame = build_response_frame(0x01, &response_pdu);

        // Should be: unit_id + pdu + crc(2)
        assert_eq!(frame.len(), 1 + 4 + 2);
        assert_eq!(frame[0], 0x01); // Unit ID

        // Verify CRC is correct
        assert!(validate_frame(&frame));
    }

    #[test]
    fn test_rtu_config_default() {
        let config = RtuConfig::default();
        assert!(config.com_port.is_empty());
        assert_eq!(config.baud_rate, 9600);
        assert_eq!(config.parity, RtuParity::None);
        assert_eq!(config.stop_bits, RtuStopBits::One);
        assert_eq!(config.data_bits, RtuDataBits::Eight);
        assert_eq!(config.unit_id, 1);
    }

    #[test]
    fn test_inter_frame_delay() {
        // At 9600 baud with 8N1, character time is ~1.04ms
        // 3.5 char times = ~3.65ms, but minimum is 1.75ms
        let config = RtuConfig::new("COM1".to_string(), 9600);
        let delay = config.inter_frame_delay_us();
        assert!(delay >= 1750); // Minimum 1.75ms

        // At 115200 baud, the calculated 3.5 char time is very small
        // so it should use the 1.75ms minimum
        let fast_config = RtuConfig::new("COM1".to_string(), 115200);
        let fast_delay = fast_config.inter_frame_delay_us();
        assert_eq!(fast_delay, 1750); // Should be minimum
    }

    #[test]
    fn test_server_initial_state() {
        let memory = Arc::new(ModbusMemory::new(&MemoryMapSettings::default()));
        let config = RtuConfig::new("COM1".to_string(), 9600);
        let server = ModbusRtuServer::new(config, memory);

        assert!(!server.is_running());
    }

    #[test]
    fn test_process_read_holding_registers() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());
        memory.write_holding_register(0, 1234).unwrap();
        memory.write_holding_register(1, 5678).unwrap();

        // Function code 0x03, start=0, quantity=2
        let request = vec![0x03, 0x00, 0x00, 0x00, 0x02];
        let response = process_rtu_request(&memory, 0x03, &request);

        assert_eq!(response[0], 0x03);
        assert_eq!(response[1], 4); // 2 registers * 2 bytes
        assert_eq!(u16::from_be_bytes([response[2], response[3]]), 1234);
        assert_eq!(u16::from_be_bytes([response[4], response[5]]), 5678);
    }

    #[test]
    fn test_pack_unpack_bits() {
        let values = vec![true, false, true, false, false, false, false, false];
        let packed = pack_bits(&values);
        assert_eq!(packed, vec![0b00000101]);

        let unpacked = unpack_bits(&packed, 8);
        assert_eq!(unpacked, values);
    }
}
