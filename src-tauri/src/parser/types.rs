//! OneParser Type Definitions
//!
//! Rust types matching the frontend TypeScript OneParser types for
//! parsing LS PLC ladder logic programs from XG5000 CSV export.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Device Types
// ============================================================================

/// LS PLC Bit Device Types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BitDeviceType {
    /// P - Output relay
    P,
    /// M - Internal relay
    M,
    /// K - Keep relay
    K,
    /// F - Special relay
    F,
    /// T - Timer contact
    T,
    /// C - Counter contact
    C,
}

/// LS PLC Word Device Types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WordDeviceType {
    /// D - Data register
    D,
    /// R - Retentive data register
    R,
    /// Z - Index register
    Z,
    /// N - Constant register
    N,
}

/// All device types (union of bit and word devices)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DeviceType {
    Bit(BitDeviceType),
    Word(WordDeviceType),
}

impl DeviceType {
    /// Check if this is a bit device
    pub fn is_bit_device(&self) -> bool {
        matches!(self, DeviceType::Bit(_))
    }

    /// Check if this is a word device
    pub fn is_word_device(&self) -> bool {
        matches!(self, DeviceType::Word(_))
    }

    /// Get the device letter
    pub fn as_str(&self) -> &'static str {
        match self {
            DeviceType::Bit(b) => match b {
                BitDeviceType::P => "P",
                BitDeviceType::M => "M",
                BitDeviceType::K => "K",
                BitDeviceType::F => "F",
                BitDeviceType::T => "T",
                BitDeviceType::C => "C",
            },
            DeviceType::Word(w) => match w {
                WordDeviceType::D => "D",
                WordDeviceType::R => "R",
                WordDeviceType::Z => "Z",
                WordDeviceType::N => "N",
            },
        }
    }

    /// Parse a device type from a string
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "P" => Some(DeviceType::Bit(BitDeviceType::P)),
            "M" => Some(DeviceType::Bit(BitDeviceType::M)),
            "K" => Some(DeviceType::Bit(BitDeviceType::K)),
            "F" => Some(DeviceType::Bit(BitDeviceType::F)),
            "T" => Some(DeviceType::Bit(BitDeviceType::T)),
            "C" => Some(DeviceType::Bit(BitDeviceType::C)),
            "D" => Some(DeviceType::Word(WordDeviceType::D)),
            "R" => Some(DeviceType::Word(WordDeviceType::R)),
            "Z" => Some(DeviceType::Word(WordDeviceType::Z)),
            "N" => Some(DeviceType::Word(WordDeviceType::N)),
            _ => None,
        }
    }
}

/// Device address with optional bit index
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAddress {
    /// Device type (P, M, K, F, T, C, D, R, Z, N)
    pub device: DeviceType,
    /// Address number (e.g., 0, 100, 1000)
    pub address: u32,
    /// Optional bit index for bit access on word devices (e.g., D0000.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bit_index: Option<u8>,
    /// Optional index register for indexed addressing (e.g., D[Z0])
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_register: Option<u8>,
}

impl DeviceAddress {
    /// Create a new device address
    pub fn new(device: DeviceType, address: u32) -> Self {
        Self {
            device,
            address,
            bit_index: None,
            index_register: None,
        }
    }

    /// Create a bit device address
    pub fn bit(device: BitDeviceType, address: u32) -> Self {
        Self::new(DeviceType::Bit(device), address)
    }

    /// Create a word device address
    pub fn word(device: WordDeviceType, address: u32) -> Self {
        Self::new(DeviceType::Word(device), address)
    }

    /// Create a word device address with bit index
    pub fn word_bit(device: WordDeviceType, address: u32, bit_index: u8) -> Self {
        Self {
            device: DeviceType::Word(device),
            address,
            bit_index: Some(bit_index),
            index_register: None,
        }
    }

    /// Format the address as a string
    pub fn format(&self) -> String {
        let mut result = format!("{}{:04}", self.device.as_str(), self.address);

        if let Some(bit) = self.bit_index {
            result.push_str(&format!(".{}", bit));
        }

        if let Some(idx) = self.index_register {
            result.push_str(&format!("[Z{}]", idx));
        }

        result
    }
}

// ============================================================================
// Instruction Types
// ============================================================================

/// Contact instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ContactInstructionType {
    Load,
    #[serde(rename = "LOADN")]
    LoadN,
    #[serde(rename = "LOADP")]
    LoadP,
    #[serde(rename = "LOADF")]
    LoadF,
    And,
    #[serde(rename = "ANDN")]
    AndN,
    #[serde(rename = "ANDP")]
    AndP,
    #[serde(rename = "ANDF")]
    AndF,
    Or,
    #[serde(rename = "ORN")]
    OrN,
    #[serde(rename = "ORP")]
    OrP,
    #[serde(rename = "ORF")]
    OrF,
}

/// Block instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum BlockInstructionType {
    #[serde(rename = "ANDB")]
    AndB,
    #[serde(rename = "ORB")]
    OrB,
}

/// Output instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum OutputInstructionType {
    Out,
    #[serde(rename = "OUTN")]
    OutN,
    Set,
    Rst,
}

/// Timer instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum TimerInstructionType {
    Ton,
    Tof,
    Tmr,
}

/// Counter instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum CounterInstructionType {
    Ctu,
    Ctd,
    Ctud,
}

/// Comparison instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComparisonInstructionType {
    #[serde(rename = "LD=")]
    LdEq,
    #[serde(rename = "LD>")]
    LdGt,
    #[serde(rename = "LD<")]
    LdLt,
    #[serde(rename = "LD>=")]
    LdGe,
    #[serde(rename = "LD<=")]
    LdLe,
    #[serde(rename = "LD<>")]
    LdNe,
    #[serde(rename = "AND=")]
    AndEq,
    #[serde(rename = "AND>")]
    AndGt,
    #[serde(rename = "AND<")]
    AndLt,
    #[serde(rename = "AND>=")]
    AndGe,
    #[serde(rename = "AND<=")]
    AndLe,
    #[serde(rename = "AND<>")]
    AndNe,
    #[serde(rename = "OR=")]
    OrEq,
    #[serde(rename = "OR>")]
    OrGt,
    #[serde(rename = "OR<")]
    OrLt,
    #[serde(rename = "OR>=")]
    OrGe,
    #[serde(rename = "OR<=")]
    OrLe,
    #[serde(rename = "OR<>")]
    OrNe,
}

/// Math instruction types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum MathInstructionType {
    Add,
    Sub,
    Mul,
    Div,
    Mov,
}

// ============================================================================
// CSV Row Types
// ============================================================================

/// Raw CSV row from XG5000 export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvRow {
    /// Row number in CSV
    pub no: u32,
    /// Network/Rung number (step)
    pub step: u32,
    /// Instruction mnemonic
    pub instruction: String,
    /// First operand (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand1: Option<String>,
    /// Second operand (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand2: Option<String>,
    /// Third operand (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operand3: Option<String>,
    /// Comment (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

// ============================================================================
// AST Node Types
// ============================================================================

/// Time base for timer operations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeBase {
    /// Milliseconds
    Ms,
    /// Seconds
    S,
}

/// Grid position for visualization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct GridPosition {
    /// Row index (0-based)
    pub row: i32,
    /// Column index (0-based)
    pub col: i32,
}

impl Default for GridPosition {
    fn default() -> Self {
        Self { row: 0, col: 0 }
    }
}

/// Comparison operator
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComparisonOperator {
    #[serde(rename = "=")]
    Eq,
    #[serde(rename = ">")]
    Gt,
    #[serde(rename = "<")]
    Lt,
    #[serde(rename = ">=")]
    Ge,
    #[serde(rename = "<=")]
    Le,
    #[serde(rename = "<>")]
    Ne,
}

/// Math operator
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum MathOperator {
    Add,
    Sub,
    Mul,
    Div,
    Mov,
}

/// Operand value (either device address or immediate number)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OperandValue {
    /// Device address reference
    Address(DeviceAddress),
    /// Immediate numeric value
    Immediate(i64),
}

impl OperandValue {
    /// Check if this is a device address
    pub fn is_address(&self) -> bool {
        matches!(self, OperandValue::Address(_))
    }

    /// Check if this is an immediate value
    pub fn is_immediate(&self) -> bool {
        matches!(self, OperandValue::Immediate(_))
    }
}

/// Ladder node types (discriminated union)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LadderNode {
    /// Normally open contact
    ContactNo {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Normally closed contact
    ContactNc {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Positive transition contact
    ContactP {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Negative transition contact
    ContactN {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Output coil
    CoilOut {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Set coil (latch)
    CoilSet {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Reset coil (unlatch)
    CoilRst {
        id: String,
        address: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Timer On Delay
    TimerTon {
        id: String,
        address: DeviceAddress,
        preset: u32,
        #[serde(rename = "timeBase")]
        time_base: TimeBase,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Timer Off Delay
    TimerTof {
        id: String,
        address: DeviceAddress,
        preset: u32,
        #[serde(rename = "timeBase")]
        time_base: TimeBase,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Accumulating Timer
    TimerTmr {
        id: String,
        address: DeviceAddress,
        preset: u32,
        #[serde(rename = "timeBase")]
        time_base: TimeBase,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Count Up counter
    CounterCtu {
        id: String,
        address: DeviceAddress,
        preset: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Count Down counter
    CounterCtd {
        id: String,
        address: DeviceAddress,
        preset: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Count Up/Down counter
    CounterCtud {
        id: String,
        address: DeviceAddress,
        preset: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Comparison operation
    Comparison {
        id: String,
        operator: ComparisonOperator,
        operand1: OperandValue,
        operand2: OperandValue,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Math operation
    Math {
        id: String,
        operator: MathOperator,
        operand1: OperandValue,
        #[serde(skip_serializing_if = "Option::is_none")]
        operand2: Option<OperandValue>,
        destination: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Move operation
    Move {
        id: String,
        operator: MathOperator,
        operand1: OperandValue,
        destination: DeviceAddress,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Series connection block
    BlockSeries {
        id: String,
        children: Vec<LadderNode>,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
    /// Parallel connection block
    BlockParallel {
        id: String,
        children: Vec<LadderNode>,
        #[serde(skip_serializing_if = "Option::is_none")]
        comment: Option<String>,
        #[serde(rename = "gridPosition")]
        grid_position: GridPosition,
    },
}

impl LadderNode {
    /// Get the node ID
    pub fn id(&self) -> &str {
        match self {
            LadderNode::ContactNo { id, .. }
            | LadderNode::ContactNc { id, .. }
            | LadderNode::ContactP { id, .. }
            | LadderNode::ContactN { id, .. }
            | LadderNode::CoilOut { id, .. }
            | LadderNode::CoilSet { id, .. }
            | LadderNode::CoilRst { id, .. }
            | LadderNode::TimerTon { id, .. }
            | LadderNode::TimerTof { id, .. }
            | LadderNode::TimerTmr { id, .. }
            | LadderNode::CounterCtu { id, .. }
            | LadderNode::CounterCtd { id, .. }
            | LadderNode::CounterCtud { id, .. }
            | LadderNode::Comparison { id, .. }
            | LadderNode::Math { id, .. }
            | LadderNode::Move { id, .. }
            | LadderNode::BlockSeries { id, .. }
            | LadderNode::BlockParallel { id, .. } => id,
        }
    }

    /// Check if this is a contact node
    pub fn is_contact(&self) -> bool {
        matches!(
            self,
            LadderNode::ContactNo { .. }
                | LadderNode::ContactNc { .. }
                | LadderNode::ContactP { .. }
                | LadderNode::ContactN { .. }
        )
    }

    /// Check if this is a coil node
    pub fn is_coil(&self) -> bool {
        matches!(
            self,
            LadderNode::CoilOut { .. } | LadderNode::CoilSet { .. } | LadderNode::CoilRst { .. }
        )
    }

    /// Check if this is a timer node
    pub fn is_timer(&self) -> bool {
        matches!(
            self,
            LadderNode::TimerTon { .. } | LadderNode::TimerTof { .. } | LadderNode::TimerTmr { .. }
        )
    }

    /// Check if this is a counter node
    pub fn is_counter(&self) -> bool {
        matches!(
            self,
            LadderNode::CounterCtu { .. }
                | LadderNode::CounterCtd { .. }
                | LadderNode::CounterCtud { .. }
        )
    }

    /// Check if this is a block node
    pub fn is_block(&self) -> bool {
        matches!(
            self,
            LadderNode::BlockSeries { .. } | LadderNode::BlockParallel { .. }
        )
    }
}

// ============================================================================
// Program Structure
// ============================================================================

/// Ladder network (single rung)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LadderNetwork {
    /// Unique identifier
    pub id: String,
    /// Rung number (step from CSV)
    pub step: u32,
    /// Nodes in this network
    pub nodes: Vec<LadderNode>,
    /// Network comment (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

/// Data type for symbol entries
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum DataType {
    Bool,
    Int,
    Word,
    #[serde(rename = "DWORD")]
    DWord,
    Real,
}

/// Symbol table entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolEntry {
    /// Device address
    pub address: DeviceAddress,
    /// Symbol name (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
    /// Comment/description (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    /// Data type (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_type: Option<DataType>,
}

/// Program metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramMetadata {
    /// Program name
    pub name: String,
    /// Description (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Author (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    /// Creation timestamp (ISO 8601, optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    /// Last modified timestamp (ISO 8601, optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<String>,
    /// Version (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// PLC model (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plc_model: Option<String>,
}

impl Default for ProgramMetadata {
    fn default() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            name: "Untitled Program".to_string(),
            description: None,
            author: None,
            created_at: Some(now.clone()),
            modified_at: Some(now),
            version: Some("1.0.0".to_string()),
            plc_model: None,
        }
    }
}

/// Complete ladder program
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LadderProgram {
    /// Program metadata
    pub metadata: ProgramMetadata,
    /// Ladder networks (rungs)
    pub networks: Vec<LadderNetwork>,
    /// Symbol table (key is formatted device address)
    pub symbol_table: HashMap<String, SymbolEntry>,
}

impl Default for LadderProgram {
    fn default() -> Self {
        Self {
            metadata: ProgramMetadata::default(),
            networks: Vec::new(),
            symbol_table: HashMap::new(),
        }
    }
}

// ============================================================================
// Modbus Mapping Types
// ============================================================================

/// Modbus address type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModbusAddressType {
    /// Coil (read/write bit)
    Coil,
    /// Discrete input (read-only bit)
    Discrete,
    /// Holding register (read/write word)
    Holding,
    /// Input register (read-only word)
    Input,
}

/// Modbus address
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModbusAddress {
    /// Modbus memory type
    #[serde(rename = "type")]
    pub address_type: ModbusAddressType,
    /// Modbus address number
    pub address: u16,
}

/// Device to Modbus mapping rule
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingRule {
    /// PLC device type
    pub device: DeviceType,
    /// Modbus memory type to map to
    pub modbus_type: ModbusAddressType,
    /// Address offset for mapping
    pub offset: u16,
}

impl MappingRule {
    /// Get default mapping rules for LS PLC devices
    pub fn defaults() -> Vec<Self> {
        vec![
            // Bit devices to coils
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::P),
                modbus_type: ModbusAddressType::Coil,
                offset: 0,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::M),
                modbus_type: ModbusAddressType::Coil,
                offset: 1000,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::K),
                modbus_type: ModbusAddressType::Discrete,
                offset: 0,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::F),
                modbus_type: ModbusAddressType::Discrete,
                offset: 1000,
            },
            // Timer/Counter bits
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::T),
                modbus_type: ModbusAddressType::Coil,
                offset: 2000,
            },
            MappingRule {
                device: DeviceType::Bit(BitDeviceType::C),
                modbus_type: ModbusAddressType::Coil,
                offset: 3000,
            },
            // Word devices to holding registers
            MappingRule {
                device: DeviceType::Word(WordDeviceType::D),
                modbus_type: ModbusAddressType::Holding,
                offset: 0,
            },
            MappingRule {
                device: DeviceType::Word(WordDeviceType::R),
                modbus_type: ModbusAddressType::Holding,
                offset: 10000,
            },
            MappingRule {
                device: DeviceType::Word(WordDeviceType::Z),
                modbus_type: ModbusAddressType::Input,
                offset: 0,
            },
            MappingRule {
                device: DeviceType::Word(WordDeviceType::N),
                modbus_type: ModbusAddressType::Input,
                offset: 100,
            },
        ]
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_address_serialization() {
        let addr = DeviceAddress::bit(BitDeviceType::M, 100);
        let json = serde_json::to_string(&addr).unwrap();
        let parsed: DeviceAddress = serde_json::from_str(&json).unwrap();
        assert_eq!(addr, parsed);
    }

    #[test]
    fn test_device_address_format() {
        let addr = DeviceAddress::word_bit(WordDeviceType::D, 100, 5);
        assert_eq!(addr.format(), "D0100.5");
    }

    #[test]
    fn test_ladder_node_serialization() {
        let node = LadderNode::ContactNo {
            id: "test-id".to_string(),
            address: DeviceAddress::bit(BitDeviceType::M, 0),
            comment: Some("Test contact".to_string()),
            grid_position: GridPosition { row: 0, col: 0 },
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"type\":\"contact_no\""));

        let parsed: LadderNode = serde_json::from_str(&json).unwrap();
        assert!(parsed.is_contact());
    }

    #[test]
    fn test_ladder_program_default() {
        let program = LadderProgram::default();
        assert_eq!(program.metadata.name, "Untitled Program");
        assert!(program.networks.is_empty());
    }

    #[test]
    fn test_mapping_rule_defaults() {
        let rules = MappingRule::defaults();
        assert_eq!(rules.len(), 10);
    }
}
