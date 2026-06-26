// OPC UA 연산 전용 에러 타입 (전송/구현 비결합)

/// Errors specific to OPC UA operations.
#[derive(Debug, thiserror::Error)]
pub enum OpcUaError {
    #[error("OPC UA server error: {0}")]
    Server(String),
    #[error("OPC UA configuration error: {0}")]
    Config(String),
    #[error("OPC UA address space error: {0}")]
    AddressSpace(String),
    #[error("OPC UA node not found: {0}")]
    NodeNotFound(String),
}
