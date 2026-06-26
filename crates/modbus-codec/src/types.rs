// Modbus 메모리 값/에러 타입과 변경 이벤트 + 전송 비의존 이벤트 싱크 trait
//!
//! 전송(소켓/Tauri)에 의존하지 않는 modbus 데이터 모델 타입. 변경 이벤트는
//! `MemoryEventSink` trait 을 통해 native 셸로 흘려보낸다(wasm 순수성 유지).

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Modbus 메모리 연산 중 발생할 수 있는 에러.
#[derive(Error, Debug)]
pub enum MemoryError {
    #[error("Address out of range: {address} (valid: {start}-{end})")]
    AddressOutOfRange { address: u16, start: u16, end: u16 },

    #[error(
        "Count exceeds available range: requested {count} from {address}, available {available}"
    )]
    CountExceedsRange {
        address: u16,
        count: u16,
        available: u16,
    },

    #[error("Invalid count: {count} (must be > 0)")]
    InvalidCount { count: u16 },

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("CSV parse error at line {line}: {message}")]
    CsvParseError { line: usize, message: String },
}

/// Modbus 메모리 맵 크기 설정.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMapSettings {
    /// Starting address for coils.
    pub coil_start: u16,
    /// Number of coils (read/write bits, function codes 0x01, 0x05, 0x0F)
    pub coil_count: u16,

    /// Starting address for discrete inputs.
    pub discrete_input_start: u16,
    /// Number of discrete inputs (read-only bits, function code 0x02)
    pub discrete_input_count: u16,

    /// Starting address for holding registers.
    pub holding_register_start: u16,
    /// Number of holding registers (read/write 16-bit, function codes 0x03, 0x06, 0x10)
    pub holding_register_count: u16,

    /// Starting address for input registers.
    pub input_register_start: u16,
    /// Number of input registers (read-only 16-bit, function code 0x04)
    pub input_register_count: u16,
}

impl Default for MemoryMapSettings {
    fn default() -> Self {
        Self {
            coil_start: 0,
            coil_count: 10000,
            discrete_input_start: 0,
            discrete_input_count: 10000,
            holding_register_start: 0,
            holding_register_count: 10000,
            input_register_start: 0,
            input_register_count: 10000,
        }
    }
}

impl MemoryMapSettings {
    /// Create settings with maximum 16-bit address space
    pub fn max() -> Self {
        Self {
            coil_start: 0,
            coil_count: 65535,
            discrete_input_start: 0,
            discrete_input_count: 65535,
            holding_register_start: 0,
            holding_register_count: 65535,
            input_register_start: 0,
            input_register_count: 65535,
        }
    }

    /// Create settings with minimum sizes (1 element each)
    pub fn min() -> Self {
        Self {
            coil_start: 0,
            coil_count: 1,
            discrete_input_start: 0,
            discrete_input_count: 1,
            holding_register_start: 0,
            holding_register_count: 1,
            input_register_start: 0,
            input_register_count: 1,
        }
    }
}

/// CSV export/import 용 메모리 타입 식별자.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryType {
    Coil,
    DiscreteInput,
    HoldingRegister,
    InputRegister,
}

impl MemoryType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryType::Coil => "coil",
            MemoryType::DiscreteInput => "discrete",
            MemoryType::HoldingRegister => "holding",
            MemoryType::InputRegister => "input",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "coil" => Some(MemoryType::Coil),
            "discrete" => Some(MemoryType::DiscreteInput),
            "holding" => Some(MemoryType::HoldingRegister),
            "input" => Some(MemoryType::InputRegister),
            _ => None,
        }
    }
}

/// 메모리 한 칸이 바뀌었을 때의 변경 이벤트(직렬화되어 프런트엔드로 전달).
#[derive(Debug, Clone, Serialize)]
pub struct MemoryChangeEvent {
    /// Type of memory: "coil", "discrete", "holding", or "input"
    pub register_type: String,
    /// Address that changed
    pub address: u16,
    /// Previous value (bool for coils/discrete, u16 for registers)
    pub old_value: serde_json::Value,
    /// New value (bool for coils/discrete, u16 for registers)
    pub new_value: serde_json::Value,
    /// Source of the change: "internal", "external", or "simulation"
    pub source: String,
}

impl MemoryChangeEvent {
    /// Create a coil change event
    pub fn coil(address: u16, old_value: bool, new_value: bool, source: &str) -> Self {
        Self {
            register_type: "coil".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }

    /// Create a discrete input change event
    pub fn discrete(address: u16, old_value: bool, new_value: bool, source: &str) -> Self {
        Self {
            register_type: "discrete".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }

    /// Create a holding register change event
    pub fn holding(address: u16, old_value: u16, new_value: u16, source: &str) -> Self {
        Self {
            register_type: "holding".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }

    /// Create an input register change event
    pub fn input(address: u16, old_value: u16, new_value: u16, source: &str) -> Self {
        Self {
            register_type: "input".to_string(),
            address,
            old_value: serde_json::json!(old_value),
            new_value: serde_json::json!(new_value),
            source: source.to_string(),
        }
    }
}

/// 배치 연산으로 여러 칸이 바뀌었을 때의 묶음 이벤트.
#[derive(Debug, Clone, Serialize)]
pub struct MemoryBatchChangeEvent {
    /// All changes in the batch
    pub changes: Vec<MemoryChangeEvent>,
}

/// 메모리 변경의 출처.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeSource {
    /// Change from internal API (Tauri commands)
    Internal,
    /// Change from external Modbus client
    External,
    /// Change from simulation engine
    Simulation,
}

impl ChangeSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChangeSource::Internal => "internal",
            ChangeSource::External => "external",
            ChangeSource::Simulation => "simulation",
        }
    }
}

/// 메모리 변경 이벤트를 외부(native 셸)로 흘려보내는 싱크.
///
/// codec 은 전송을 모른다. native 셸이 이 trait 을 구현해 Tauri/WebSocket 등으로
/// 이벤트를 내보낸다. wasm tier 에서는 구현을 주입하지 않거나 no-op 을 쓴다.
pub trait MemoryEventSink: Send + Sync {
    fn emit_change(&self, event: &MemoryChangeEvent);
    fn emit_batch(&self, event: &MemoryBatchChangeEvent);
}

impl<T: MemoryEventSink + ?Sized> MemoryEventSink for Arc<T> {
    fn emit_change(&self, event: &MemoryChangeEvent) {
        (**self).emit_change(event);
    }
    fn emit_batch(&self, event: &MemoryBatchChangeEvent) {
        (**self).emit_batch(event);
    }
}
