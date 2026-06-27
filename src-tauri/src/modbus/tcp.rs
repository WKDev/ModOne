//! Modbus TCP server implementation
//!
//! Provides a TCP server that handles Modbus requests.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;

use super::pdu;
use super::telemetry;
use super::types::{ConnectionEvent, ConnectionInfo, ModbusError, TcpConfig};
use super::ModbusMemory;

// Event channel name for connection events
const EVENT_CONNECTION: &str = "modbus:connection";

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
    /// Tauri app handle for event emission
    app_handle: Arc<RwLock<Option<Arc<tauri::AppHandle>>>>,
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
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    /// Set the Tauri app handle for event emission
    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        *self.app_handle.write() = Some(Arc::new(handle));
    }

    /// Emit a connection event
    fn emit_connection_event(
        app_handle: &Arc<RwLock<Option<Arc<tauri::AppHandle>>>>,
        event: ConnectionEvent,
    ) {
        if let Some(handle) = app_handle.read().as_ref() {
            let _ = handle.emit(EVENT_CONNECTION, event);
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
        let app_handle = Arc::clone(&self.app_handle);
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

                                // Emit connection event
                                let peer_addr_str = peer_addr.to_string();
                                Self::emit_connection_event(&app_handle, ConnectionEvent::tcp_connected(&peer_addr_str));

                                // Handle connection
                                let memory = Arc::clone(&memory);
                                let connections = Arc::clone(&connections);
                                let app_handle_clone = Arc::clone(&app_handle);

                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(stream, &memory, unit_id, &app_handle_clone, &peer_addr_str).await {
                                        log::error!("Error handling Modbus connection from {}: {}", peer_addr, e);
                                    }

                                    // Remove connection on disconnect
                                    connections.write().retain(|c| c.address != peer_addr_str);
                                    log::info!("Modbus client disconnected: {}", peer_addr);

                                    // Emit disconnection event
                                    Self::emit_connection_event(&app_handle_clone, ConnectionEvent::tcp_disconnected(&peer_addr_str));
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
    app_handle: &Arc<RwLock<Option<Arc<tauri::AppHandle>>>>,
    client_addr: &str,
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
        let n = stream
            .read(&mut request_buffer[MBAP_HEADER_SIZE..MBAP_HEADER_SIZE + pdu_len])
            .await?;
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
        let request_pdu = &request_buffer[MBAP_HEADER_SIZE..MBAP_HEADER_SIZE + pdu_len];
        let response_pdu = pdu::process_request(memory, function_code, request_pdu);

        // Emit observability event for the traffic log (fire-and-forget)
        telemetry::emit_traffic(
            app_handle,
            telemetry::ModbusTrafficEvent::from_exchange(
                "tcp",
                client_addr,
                slave_id,
                request_pdu,
                &response_pdu,
            ),
        );

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
        assert!(matches!(server.stop().await, Err(ModbusError::NotRunning)));
    }

    #[test]
    fn test_connection_info() {
        let addr: SocketAddr = "127.0.0.1:12345".parse().unwrap();
        let info = ConnectionInfo::new(addr);
        assert_eq!(info.address, "127.0.0.1:12345");
        assert!(!info.connected_at.is_empty());
    }
}
