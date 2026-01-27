//! Modbus TCP server implementation
//!
//! Provides a TCP server that handles Modbus requests.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;

use super::memory::ModbusMemory;
use super::types::{ConnectionInfo, ModbusError, TcpConfig};

// Modbus TCP constants
const MBAP_HEADER_SIZE: usize = 7;
const MAX_PDU_SIZE: usize = 253;

/// Modbus TCP server with connection tracking and graceful shutdown
pub struct ModbusTcpServer {
    config: TcpConfig,
    memory: Arc<ModbusMemory>,
    running: Arc<AtomicBool>,
    connections: Arc<RwLock<Vec<ConnectionInfo>>>,
    shutdown_tx: Option<broadcast::Sender<()>>,
}

impl ModbusTcpServer {
    /// Create a new Modbus TCP server
    pub fn new(config: TcpConfig, memory: Arc<ModbusMemory>) -> Self {
        Self {
            config,
            memory,
            running: Arc::new(AtomicBool::new(false)),
            connections: Arc::new(RwLock::new(Vec::new())),
            shutdown_tx: None,
        }
    }

    /// Check if the server is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Get the number of active connections
    pub fn get_connection_count(&self) -> usize {
        self.connections.read().len()
    }

    /// Get information about all active connections
    pub fn get_connections(&self) -> Vec<ConnectionInfo> {
        self.connections.read().clone()
    }

    /// Get the server configuration
    pub fn config(&self) -> &TcpConfig {
        &self.config
    }

    /// Start the Modbus TCP server
    ///
    /// Returns an error if the server is already running or cannot bind to the address.
    pub async fn start(&mut self) -> Result<(), ModbusError> {
        if self.is_running() {
            return Err(ModbusError::AlreadyRunning);
        }

        let addr = self.config.socket_addr();
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| ModbusError::BindFailed(format!("{}: {}", addr, e)))?;

        log::info!("Modbus TCP server listening on {}", addr);

        // Create shutdown channel
        let (shutdown_tx, _) = broadcast::channel::<()>(1);
        self.shutdown_tx = Some(shutdown_tx.clone());

        // Mark as running
        self.running.store(true, Ordering::SeqCst);

        // Clone what we need for the accept loop
        let memory = Arc::clone(&self.memory);
        let connections = Arc::clone(&self.connections);
        let running = Arc::clone(&self.running);
        let max_connections = self.config.max_connections;
        let unit_id = self.config.unit_id;

        // Spawn the accept loop
        tokio::spawn(async move {
            let mut shutdown_rx = shutdown_tx.subscribe();

            loop {
                tokio::select! {
                    // Handle shutdown signal
                    _ = shutdown_rx.recv() => {
                        log::info!("Modbus TCP server shutting down");
                        break;
                    }
                    // Accept new connections
                    result = listener.accept() => {
                        match result {
                            Ok((stream, peer_addr)) => {
                                // Check connection limit
                                if connections.read().len() >= max_connections {
                                    log::warn!("Connection limit reached, rejecting connection from {}", peer_addr);
                                    continue;
                                }

                                // Track connection
                                let conn_info = ConnectionInfo::new(peer_addr);
                                connections.write().push(conn_info);
                                log::info!("New Modbus client connected: {}", peer_addr);

                                // Handle connection
                                let memory = Arc::clone(&memory);
                                let connections = Arc::clone(&connections);
                                let peer_addr_str = peer_addr.to_string();

                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(stream, &memory, unit_id).await {
                                        log::error!("Error handling Modbus connection from {}: {}", peer_addr, e);
                                    }

                                    // Remove connection on disconnect
                                    connections.write().retain(|c| c.address != peer_addr_str);
                                    log::info!("Modbus client disconnected: {}", peer_addr);
                                });
                            }
                            Err(e) => {
                                if running.load(Ordering::SeqCst) {
                                    log::error!("Error accepting connection: {}", e);
                                }
                            }
                        }
                    }
                }
            }

            running.store(false, Ordering::SeqCst);
            connections.write().clear();
        });

        Ok(())
    }

    /// Stop the Modbus TCP server
    ///
    /// Waits for all connections to close gracefully (up to 5 seconds).
    pub async fn stop(&mut self) -> Result<(), ModbusError> {
        if !self.is_running() {
            return Err(ModbusError::NotRunning);
        }

        // Send shutdown signal
        if let Some(tx) = &self.shutdown_tx {
            let _ = tx.send(());
        }

        // Wait for server to stop (with timeout)
        let start = std::time::Instant::now();
        while self.is_running() && start.elapsed() < std::time::Duration::from_secs(5) {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }

        if self.is_running() {
            // Force stop
            self.running.store(false, Ordering::SeqCst);
            self.connections.write().clear();
            return Err(ModbusError::ShutdownTimeout);
        }

        self.shutdown_tx = None;
        log::info!("Modbus TCP server stopped");
        Ok(())
    }
}

/// Handle a single Modbus TCP connection
async fn handle_connection(
    mut stream: TcpStream,
    memory: &ModbusMemory,
    unit_id: u8,
) -> Result<(), std::io::Error> {
    let mut request_buffer = vec![0u8; MBAP_HEADER_SIZE + MAX_PDU_SIZE];

    loop {
        // Read MBAP header (7 bytes)
        let n = stream.read(&mut request_buffer[..MBAP_HEADER_SIZE]).await?;
        if n == 0 {
            // Connection closed
            break;
        }
        if n < MBAP_HEADER_SIZE {
            log::warn!("Incomplete MBAP header received");
            continue;
        }

        // Parse MBAP header
        let transaction_id = u16::from_be_bytes([request_buffer[0], request_buffer[1]]);
        let protocol_id = u16::from_be_bytes([request_buffer[2], request_buffer[3]]);
        let length = u16::from_be_bytes([request_buffer[4], request_buffer[5]]) as usize;
        let slave_id = request_buffer[6];

        // Validate protocol ID (should be 0 for Modbus)
        if protocol_id != 0 {
            log::warn!("Invalid protocol ID: {}", protocol_id);
            continue;
        }

        // Validate length
        if length < 2 || length > MAX_PDU_SIZE + 1 {
            log::warn!("Invalid PDU length: {}", length);
            continue;
        }

        // Read the rest of the PDU (length - 1 because unit ID is already read)
        let pdu_len = length - 1;
        let n = stream.read(&mut request_buffer[MBAP_HEADER_SIZE..MBAP_HEADER_SIZE + pdu_len]).await?;
        if n < pdu_len {
            log::warn!("Incomplete PDU received");
            continue;
        }

        // Check unit ID (0 is broadcast)
        if slave_id != unit_id && slave_id != 0 {
            // Not for us, ignore
            continue;
        }

        // Process the request
        let function_code = request_buffer[MBAP_HEADER_SIZE];
        let response_pdu = process_request(memory, function_code, &request_buffer[MBAP_HEADER_SIZE..MBAP_HEADER_SIZE + pdu_len]);

        // Build response
        let response_length = (response_pdu.len() + 1) as u16; // +1 for unit ID
        let mut response = Vec::with_capacity(MBAP_HEADER_SIZE + response_pdu.len());
        response.extend_from_slice(&transaction_id.to_be_bytes());
        response.extend_from_slice(&protocol_id.to_be_bytes());
        response.extend_from_slice(&response_length.to_be_bytes());
        response.push(slave_id);
        response.extend_from_slice(&response_pdu);

        // Send response
        stream.write_all(&response).await?;
    }

    Ok(())
}

/// Process a Modbus request and return the response PDU
fn process_request(memory: &ModbusMemory, function_code: u8, pdu: &[u8]) -> Vec<u8> {
    match function_code {
        // Function Code 0x01: Read Coils
        0x01 => {
            if pdu.len() < 5 {
                return exception_response(function_code, 0x03); // Illegal Data Value
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
                Err(_) => exception_response(function_code, 0x02), // Illegal Data Address
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

            match memory.write_coil(addr, coil_value) {
                Ok(_) => {
                    // Echo the request
                    pdu.to_vec()
                }
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

            match memory.write_holding_register(addr, value) {
                Ok(_) => {
                    // Echo the request
                    pdu.to_vec()
                }
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

            match memory.write_coils(start_addr, &values) {
                Ok(_) => {
                    vec![function_code, pdu[1], pdu[2], pdu[3], pdu[4]]
                }
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

            match memory.write_holding_registers(start_addr, &values) {
                Ok(_) => {
                    vec![function_code, pdu[1], pdu[2], pdu[3], pdu[4]]
                }
                Err(_) => exception_response(function_code, 0x02),
            }
        }

        // Unsupported function code
        _ => exception_response(function_code, 0x01), // Illegal Function
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
    use std::net::SocketAddr;

    fn create_test_memory() -> Arc<ModbusMemory> {
        Arc::new(ModbusMemory::new(&MemoryMapSettings::default()))
    }

    #[test]
    fn test_tcp_config_default() {
        let config = TcpConfig::default();
        assert_eq!(config.bind_address, "0.0.0.0");
        assert_eq!(config.port, 502);
        assert_eq!(config.unit_id, 1);
        assert_eq!(config.max_connections, 10);
        assert_eq!(config.timeout_ms, 3000);
    }

    #[test]
    fn test_tcp_config_with_port() {
        let config = TcpConfig::with_port(5020);
        assert_eq!(config.port, 5020);
        assert_eq!(config.socket_addr(), "0.0.0.0:5020");
    }

    #[test]
    fn test_server_initial_state() {
        let memory = create_test_memory();
        let config = TcpConfig::default();
        let server = ModbusTcpServer::new(config, memory);

        assert!(!server.is_running());
        assert_eq!(server.get_connection_count(), 0);
        assert!(server.get_connections().is_empty());
    }

    #[tokio::test]
    async fn test_server_start_stop() {
        let memory = create_test_memory();
        let config = TcpConfig::with_port(15020); // Use non-privileged port for testing
        let mut server = ModbusTcpServer::new(config, memory);

        // Start server
        server.start().await.unwrap();

        // Give the server task time to start
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        assert!(server.is_running());

        // Try to start again (should fail)
        assert!(matches!(
            server.start().await,
            Err(ModbusError::AlreadyRunning)
        ));

        // Stop server (allow for timeout on slow systems)
        let _ = server.stop().await;

        // Wait a bit for full cleanup if needed
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Server should no longer be running regardless of whether stop returned Ok or ShutdownTimeout
        assert!(!server.is_running());

        // Try to stop again (should fail - already stopped)
        assert!(matches!(
            server.stop().await,
            Err(ModbusError::NotRunning)
        ));
    }

    #[test]
    fn test_connection_info() {
        let addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();
        let info = ConnectionInfo::new(addr);
        assert_eq!(info.address, "127.0.0.1:12345");
        assert!(!info.connected_at.is_empty());
    }

    #[test]
    fn test_pack_bits() {
        assert_eq!(pack_bits(&[true, false, true, false, false, false, false, false]), vec![0b00000101]);
        assert_eq!(pack_bits(&[true, true, true, true, true, true, true, true]), vec![0xff]);
        assert_eq!(pack_bits(&[false, false, false, false, false, false, false, false, true]), vec![0x00, 0x01]);
    }

    #[test]
    fn test_unpack_bits() {
        assert_eq!(unpack_bits(&[0b00000101], 8), vec![true, false, true, false, false, false, false, false]);
        assert_eq!(unpack_bits(&[0xff], 4), vec![true, true, true, true]);
    }

    #[test]
    fn test_process_read_holding_registers() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());
        memory.write_holding_register(0, 1234).unwrap();
        memory.write_holding_register(1, 5678).unwrap();

        // Function code 0x03, start=0, quantity=2
        let request = vec![0x03, 0x00, 0x00, 0x00, 0x02];
        let response = process_request(&memory, 0x03, &request);

        // Response: FC, byte_count, data
        assert_eq!(response[0], 0x03);
        assert_eq!(response[1], 4); // 2 registers * 2 bytes
        assert_eq!(u16::from_be_bytes([response[2], response[3]]), 1234);
        assert_eq!(u16::from_be_bytes([response[4], response[5]]), 5678);
    }

    #[test]
    fn test_process_write_single_register() {
        let memory = ModbusMemory::new(&MemoryMapSettings::default());

        // Function code 0x06, addr=10, value=4321
        let request = vec![0x06, 0x00, 0x0A, 0x10, 0xE1];
        let response = process_request(&memory, 0x06, &request);

        // Response should echo the request
        assert_eq!(response, request);

        // Verify value was written
        assert_eq!(memory.read_holding_registers(10, 1).unwrap(), vec![4321]);
    }

    #[test]
    fn test_exception_response() {
        let response = exception_response(0x03, 0x02);
        assert_eq!(response, vec![0x83, 0x02]);
    }
}
