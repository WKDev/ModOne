//! Program Executor Module
//!
//! Evaluates ladder logic AST nodes for the OneSim simulation engine.
//! Handles contacts, coils, blocks, timers, counters, comparisons, and math operations.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;

use super::counter::CounterManager;
use super::memory::{DeviceMemory, SimMemoryError};
use super::timer::TimerManager;
use super::types::{SimBitDeviceType, SimCounterType, SimTimeBase, SimTimerType, SimWordDeviceType};

// ============================================================================
// Error Types
// ============================================================================

/// Execution error types
#[derive(Debug, Error)]
pub enum ExecutionError {
    /// Memory operation error
    #[error("Memory error: {0}")]
    Memory(#[from] SimMemoryError),

    /// Invalid device address
    #[error("Invalid device address: {0}")]
    InvalidAddress(String),

    /// Division by zero
    #[error("Division by zero")]
    DivisionByZero,

    /// Unsupported node type
    #[error("Unsupported node type: {0}")]
    UnsupportedNodeType(String),
}

/// Result type for execution operations
pub type ExecutionResult<T> = Result<T, ExecutionError>;

// ============================================================================
// AST Node Types (for executor input)
// ============================================================================

/// Node types for ladder logic execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    // Contacts
    ContactNo,
    ContactNc,
    ContactP,
    ContactN,

    // Coils
    CoilOut,
    CoilSet,
    CoilRst,

    // Blocks
    BlockSeries,
    BlockParallel,

    // Timers
    TimerTon,
    TimerTof,
    TimerTmr,

    // Counters
    CounterCtu,
    CounterCtd,
    CounterCtud,

    // Comparisons
    CompareEq,
    CompareNe,
    CompareLt,
    CompareLe,
    CompareGt,
    CompareGe,

    // Math operations
    MathAdd,
    MathSub,
    MathMul,
    MathDiv,
    MathMod,
    MathMov,
}

/// Device address parsed from string
#[derive(Debug, Clone)]
pub struct DeviceAddress {
    /// Device type character (P, M, K, F, T, C, D, R, Z, N)
    pub device: char,
    /// Address number
    pub address: u16,
    /// Optional bit index for word bit access
    pub bit_index: Option<u8>,
}

impl DeviceAddress {
    /// Parse device address from string (e.g., "M0000", "D100.5")
    pub fn parse(s: &str) -> Option<Self> {
        let s = s.trim().to_uppercase();
        if s.is_empty() {
            return None;
        }

        let device = s.chars().next()?;
        if !matches!(device, 'P' | 'M' | 'K' | 'F' | 'T' | 'C' | 'D' | 'R' | 'Z' | 'N') {
            return None;
        }

        let rest = &s[1..];

        // Check for bit index (e.g., D100.5)
        if let Some(dot_pos) = rest.find('.') {
            let addr_str = &rest[..dot_pos];
            let bit_str = &rest[dot_pos + 1..];

            let address = addr_str.parse().ok()?;
            let bit_index: u8 = bit_str.parse().ok()?;
            if bit_index > 15 {
                return None;
            }

            Some(DeviceAddress {
                device,
                address,
                bit_index: Some(bit_index),
            })
        } else {
            let address = rest.parse().ok()?;
            Some(DeviceAddress {
                device,
                address,
                bit_index: None,
            })
        }
    }

    /// Format as string
    pub fn to_string(&self) -> String {
        match self.bit_index {
            Some(bit) => format!("{}{}.{}", self.device, self.address, bit),
            None => format!("{}{}", self.device, self.address),
        }
    }

    /// Check if this is a bit device
    pub fn is_bit_device(&self) -> bool {
        matches!(self.device, 'P' | 'M' | 'K' | 'F' | 'T' | 'C')
    }

    /// Check if this is a word device
    pub fn is_word_device(&self) -> bool {
        matches!(self.device, 'D' | 'R' | 'Z' | 'N')
    }

    /// Get as bit device type
    pub fn as_bit_device(&self) -> Option<SimBitDeviceType> {
        match self.device {
            'P' => Some(SimBitDeviceType::P),
            'M' => Some(SimBitDeviceType::M),
            'K' => Some(SimBitDeviceType::K),
            'F' => Some(SimBitDeviceType::F),
            'T' => Some(SimBitDeviceType::T),
            'C' => Some(SimBitDeviceType::C),
            _ => None,
        }
    }

    /// Get as word device type
    pub fn as_word_device(&self) -> Option<SimWordDeviceType> {
        match self.device {
            'D' => Some(SimWordDeviceType::D),
            'R' => Some(SimWordDeviceType::R),
            'Z' => Some(SimWordDeviceType::Z),
            'N' => Some(SimWordDeviceType::N),
            _ => None,
        }
    }
}

/// Ladder node for execution
#[derive(Debug, Clone)]
pub struct LadderNode {
    /// Node type
    pub node_type: NodeType,
    /// Device address (for contacts, coils, etc.)
    pub address: Option<String>,
    /// Child nodes (for block nodes)
    pub children: Vec<LadderNode>,
    /// Timer/counter preset value
    pub preset: Option<u32>,
    /// Timer time base
    pub time_base: Option<SimTimeBase>,
    /// Comparison/math operands
    pub operand1: Option<String>,
    pub operand2: Option<String>,
    /// Destination for math operations
    pub destination: Option<String>,
}

impl LadderNode {
    /// Create a new contact node
    pub fn contact(node_type: NodeType, address: &str) -> Self {
        Self {
            node_type,
            address: Some(address.to_string()),
            children: Vec::new(),
            preset: None,
            time_base: None,
            operand1: None,
            operand2: None,
            destination: None,
        }
    }

    /// Create a new coil node
    pub fn coil(node_type: NodeType, address: &str) -> Self {
        Self {
            node_type,
            address: Some(address.to_string()),
            children: Vec::new(),
            preset: None,
            time_base: None,
            operand1: None,
            operand2: None,
            destination: None,
        }
    }

    /// Create a series block
    pub fn series(children: Vec<LadderNode>) -> Self {
        Self {
            node_type: NodeType::BlockSeries,
            address: None,
            children,
            preset: None,
            time_base: None,
            operand1: None,
            operand2: None,
            destination: None,
        }
    }

    /// Create a parallel block
    pub fn parallel(children: Vec<LadderNode>) -> Self {
        Self {
            node_type: NodeType::BlockParallel,
            address: None,
            children,
            preset: None,
            time_base: None,
            operand1: None,
            operand2: None,
            destination: None,
        }
    }

    /// Create a timer node
    pub fn timer(node_type: NodeType, address: &str, preset: u32, time_base: SimTimeBase) -> Self {
        Self {
            node_type,
            address: Some(address.to_string()),
            children: Vec::new(),
            preset: Some(preset),
            time_base: Some(time_base),
            operand1: None,
            operand2: None,
            destination: None,
        }
    }

    /// Create a counter node
    pub fn counter(node_type: NodeType, address: &str, preset: u32) -> Self {
        Self {
            node_type,
            address: Some(address.to_string()),
            children: Vec::new(),
            preset: Some(preset),
            time_base: None,
            operand1: None,
            operand2: None,
            destination: None,
        }
    }

    /// Create a comparison node
    pub fn compare(node_type: NodeType, operand1: &str, operand2: &str) -> Self {
        Self {
            node_type,
            address: None,
            children: Vec::new(),
            preset: None,
            time_base: None,
            operand1: Some(operand1.to_string()),
            operand2: Some(operand2.to_string()),
            destination: None,
        }
    }

    /// Create a math operation node
    pub fn math(
        node_type: NodeType,
        operand1: &str,
        operand2: &str,
        destination: &str,
    ) -> Self {
        Self {
            node_type,
            address: None,
            children: Vec::new(),
            preset: None,
            time_base: None,
            operand1: Some(operand1.to_string()),
            operand2: Some(operand2.to_string()),
            destination: Some(destination.to_string()),
        }
    }
}

/// Ladder network for execution
#[derive(Debug, Clone)]
pub struct LadderNetwork {
    /// Network ID
    pub id: u32,
    /// Root nodes in this network
    pub nodes: Vec<LadderNode>,
    /// Comment (optional)
    pub comment: Option<String>,
}

/// Ladder program for execution
#[derive(Debug, Clone)]
pub struct LadderProgram {
    /// Program name
    pub name: String,
    /// Networks (rungs)
    pub networks: Vec<LadderNetwork>,
}

// ============================================================================
// Execution Results
// ============================================================================

/// Result of executing a single network
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkExecutionResult {
    /// Network ID
    pub network_id: u32,
    /// Execution time in microseconds
    pub execution_time_us: u64,
    /// Whether execution was successful
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
}

/// Result of executing a full program
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramExecutionResult {
    /// Results for each network
    pub network_results: Vec<NetworkExecutionResult>,
    /// Total execution time in microseconds
    pub total_time_us: u64,
    /// Whether all networks executed successfully
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
}

// ============================================================================
// Program Executor
// ============================================================================

/// Program Executor for ladder logic AST evaluation
///
/// Evaluates ladder nodes and manages power flow through the logic.
pub struct ProgramExecutor {
    /// Device memory
    memory: Arc<DeviceMemory>,
    /// Timer manager
    timer_mgr: Arc<TimerManager>,
    /// Counter manager
    counter_mgr: Arc<CounterManager>,
    /// Last execution scan count
    scan_count: RwLock<u64>,
}

impl ProgramExecutor {
    /// Create a new ProgramExecutor
    pub fn new(
        memory: Arc<DeviceMemory>,
        timer_mgr: Arc<TimerManager>,
        counter_mgr: Arc<CounterManager>,
    ) -> Self {
        Self {
            memory,
            timer_mgr,
            counter_mgr,
            scan_count: RwLock::new(0),
        }
    }

    /// Execute a full ladder program
    pub fn execute_program(&self, program: &LadderProgram) -> ProgramExecutionResult {
        let start = Instant::now();
        let mut network_results = Vec::with_capacity(program.networks.len());
        let mut all_success = true;
        let mut first_error: Option<String> = None;

        for network in &program.networks {
            let result = self.execute_network(network);
            if !result.success && first_error.is_none() {
                first_error = result.error.clone();
                all_success = false;
            }
            network_results.push(result);
        }

        // Increment scan count
        *self.scan_count.write() += 1;

        ProgramExecutionResult {
            network_results,
            total_time_us: start.elapsed().as_micros() as u64,
            success: all_success,
            error: first_error,
        }
    }

    /// Execute a single network
    pub fn execute_network(&self, network: &LadderNetwork) -> NetworkExecutionResult {
        let start = Instant::now();

        for node in &network.nodes {
            // Evaluate input condition
            let power_flow = match self.evaluate_node(node) {
                Ok(result) => result,
                Err(e) => {
                    return NetworkExecutionResult {
                        network_id: network.id,
                        execution_time_us: start.elapsed().as_micros() as u64,
                        success: false,
                        error: Some(e.to_string()),
                    };
                }
            };

            // Execute output if applicable
            if let Err(e) = self.execute_output(node, power_flow) {
                return NetworkExecutionResult {
                    network_id: network.id,
                    execution_time_us: start.elapsed().as_micros() as u64,
                    success: false,
                    error: Some(e.to_string()),
                };
            }
        }

        NetworkExecutionResult {
            network_id: network.id,
            execution_time_us: start.elapsed().as_micros() as u64,
            success: true,
            error: None,
        }
    }

    /// Evaluate a ladder node and return power flow state
    pub fn evaluate_node(&self, node: &LadderNode) -> ExecutionResult<bool> {
        match node.node_type {
            // Contacts
            NodeType::ContactNo => {
                let addr = self.parse_address(&node.address)?;
                self.read_device_bool(&addr)
            }
            NodeType::ContactNc => {
                let addr = self.parse_address(&node.address)?;
                Ok(!self.read_device_bool(&addr)?)
            }
            NodeType::ContactP => {
                let addr = self.parse_address(&node.address)?;
                let current = self.read_device_bool(&addr)?;
                let addr_str = addr.to_string();
                let result = self.memory.detect_rising_edge(&addr_str, current);
                self.memory.update_previous(&addr_str, current);
                Ok(result)
            }
            NodeType::ContactN => {
                let addr = self.parse_address(&node.address)?;
                let current = self.read_device_bool(&addr)?;
                let addr_str = addr.to_string();
                let result = self.memory.detect_falling_edge(&addr_str, current);
                self.memory.update_previous(&addr_str, current);
                Ok(result)
            }

            // Blocks
            NodeType::BlockSeries => {
                // AND logic - all children must be true
                for child in &node.children {
                    if !self.evaluate_node(child)? {
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            NodeType::BlockParallel => {
                // OR logic - any child true
                for child in &node.children {
                    if self.evaluate_node(child)? {
                        return Ok(true);
                    }
                }
                Ok(false)
            }

            // Comparisons
            NodeType::CompareEq => self.compare(node, |a, b| a == b),
            NodeType::CompareNe => self.compare(node, |a, b| a != b),
            NodeType::CompareLt => self.compare(node, |a, b| a < b),
            NodeType::CompareLe => self.compare(node, |a, b| a <= b),
            NodeType::CompareGt => self.compare(node, |a, b| a > b),
            NodeType::CompareGe => self.compare(node, |a, b| a >= b),

            // Timers - read done bit
            NodeType::TimerTon | NodeType::TimerTof | NodeType::TimerTmr => {
                let addr = self.parse_address(&node.address)?;
                if addr.device == 'T' {
                    if let Some(state) = self.timer_mgr.get_state(addr.address) {
                        return Ok(state.done);
                    }
                }
                Ok(false)
            }

            // Counters - read done bit
            NodeType::CounterCtu | NodeType::CounterCtd | NodeType::CounterCtud => {
                let addr = self.parse_address(&node.address)?;
                if addr.device == 'C' {
                    if let Some(state) = self.counter_mgr.get_state(addr.address) {
                        return Ok(state.done);
                    }
                }
                Ok(false)
            }

            // Outputs don't contribute to power flow
            NodeType::CoilOut | NodeType::CoilSet | NodeType::CoilRst => Ok(false),

            // Math operations don't contribute to power flow
            NodeType::MathAdd
            | NodeType::MathSub
            | NodeType::MathMul
            | NodeType::MathDiv
            | NodeType::MathMod
            | NodeType::MathMov => Ok(false),
        }
    }

    /// Execute output operations
    pub fn execute_output(&self, node: &LadderNode, input: bool) -> ExecutionResult<()> {
        match node.node_type {
            // Coils
            NodeType::CoilOut => {
                let addr = self.parse_address(&node.address)?;
                self.write_device_bool(&addr, input)?;
            }
            NodeType::CoilSet => {
                if input {
                    let addr = self.parse_address(&node.address)?;
                    self.write_device_bool(&addr, true)?;
                }
            }
            NodeType::CoilRst => {
                if input {
                    let addr = self.parse_address(&node.address)?;
                    self.write_device_bool(&addr, false)?;
                }
            }

            // Timers
            NodeType::TimerTon => {
                self.execute_timer(node, input, SimTimerType::Ton)?;
            }
            NodeType::TimerTof => {
                self.execute_timer(node, input, SimTimerType::Tof)?;
            }
            NodeType::TimerTmr => {
                self.execute_timer(node, input, SimTimerType::Tmr)?;
            }

            // Counters
            NodeType::CounterCtu => {
                self.execute_counter(node, input, SimCounterType::Ctu)?;
            }
            NodeType::CounterCtd => {
                self.execute_counter(node, input, SimCounterType::Ctd)?;
            }
            NodeType::CounterCtud => {
                self.execute_counter(node, input, SimCounterType::Ctud)?;
            }

            // Math operations (only execute when input is true)
            NodeType::MathAdd => {
                if input {
                    self.execute_math(node, |a, b| a.wrapping_add(b))?;
                }
            }
            NodeType::MathSub => {
                if input {
                    self.execute_math(node, |a, b| a.wrapping_sub(b))?;
                }
            }
            NodeType::MathMul => {
                if input {
                    self.execute_math(node, |a, b| a.wrapping_mul(b))?;
                }
            }
            NodeType::MathDiv => {
                if input {
                    self.execute_math_div(node)?;
                }
            }
            NodeType::MathMod => {
                if input {
                    self.execute_math_mod(node)?;
                }
            }
            NodeType::MathMov => {
                if input {
                    self.execute_move(node)?;
                }
            }

            // Execute child nodes for blocks
            NodeType::BlockSeries | NodeType::BlockParallel => {
                for child in &node.children {
                    let child_input = self.evaluate_node(child)?;
                    self.execute_output(child, child_input)?;
                }
            }

            // Contacts don't have output actions
            _ => {}
        }

        Ok(())
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /// Parse address option to DeviceAddress
    fn parse_address(&self, address: &Option<String>) -> ExecutionResult<DeviceAddress> {
        let addr_str = address
            .as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing address".to_string()))?;

        DeviceAddress::parse(addr_str)
            .ok_or_else(|| ExecutionError::InvalidAddress(addr_str.clone()))
    }

    /// Read bool value from device
    fn read_device_bool(&self, addr: &DeviceAddress) -> ExecutionResult<bool> {
        if addr.is_bit_device() {
            let device = addr.as_bit_device().unwrap();
            Ok(self.memory.read_bit(device, addr.address)?)
        } else if let Some(bit_idx) = addr.bit_index {
            let device = addr.as_word_device().unwrap();
            Ok(self.memory.read_word_bit(device, addr.address, bit_idx)?)
        } else {
            // Word device without bit index - read as bool (non-zero = true)
            let device = addr.as_word_device().unwrap();
            Ok(self.memory.read_word(device, addr.address)? != 0)
        }
    }

    /// Write bool value to device
    fn write_device_bool(&self, addr: &DeviceAddress, value: bool) -> ExecutionResult<()> {
        if addr.is_bit_device() {
            let device = addr.as_bit_device().unwrap();
            Ok(self.memory.write_bit(device, addr.address, value)?)
        } else if let Some(bit_idx) = addr.bit_index {
            let device = addr.as_word_device().unwrap();
            Ok(self.memory.write_word_bit(device, addr.address, bit_idx, value)?)
        } else {
            // Word device without bit index
            let device = addr.as_word_device().unwrap();
            Ok(self.memory.write_word(device, addr.address, if value { 1 } else { 0 })?)
        }
    }

    /// Read word value from device or parse as constant
    fn read_operand(&self, operand: &str) -> ExecutionResult<i32> {
        // Try to parse as constant first
        if let Ok(value) = operand.parse::<i32>() {
            return Ok(value);
        }

        // Parse as device address
        let addr = DeviceAddress::parse(operand)
            .ok_or_else(|| ExecutionError::InvalidAddress(operand.to_string()))?;

        if addr.is_word_device() {
            let device = addr.as_word_device().unwrap();
            Ok(self.memory.read_word(device, addr.address)? as i16 as i32)
        } else {
            // Bit device - return 0 or 1
            let device = addr.as_bit_device().unwrap();
            Ok(if self.memory.read_bit(device, addr.address)? { 1 } else { 0 })
        }
    }

    /// Compare two operands
    fn compare<F>(&self, node: &LadderNode, op: F) -> ExecutionResult<bool>
    where
        F: Fn(i32, i32) -> bool,
    {
        let op1_str = node.operand1.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand1".to_string()))?;
        let op2_str = node.operand2.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand2".to_string()))?;

        let op1 = self.read_operand(op1_str)?;
        let op2 = self.read_operand(op2_str)?;

        Ok(op(op1, op2))
    }

    /// Execute timer operation
    fn execute_timer(
        &self,
        node: &LadderNode,
        input: bool,
        timer_type: SimTimerType,
    ) -> ExecutionResult<()> {
        let addr = self.parse_address(&node.address)?;
        if addr.device != 'T' {
            return Err(ExecutionError::InvalidAddress(format!(
                "Timer must use T device, got {}",
                addr.device
            )));
        }

        let preset = node.preset.unwrap_or(1000);
        let time_base = node.time_base.unwrap_or(SimTimeBase::Ms);

        let (done, _elapsed) = self.timer_mgr.update(
            addr.address,
            timer_type,
            input,
            preset,
            time_base,
        );

        // Update T contact
        let _ = self.memory.write_bit_internal(SimBitDeviceType::T, addr.address, done);

        Ok(())
    }

    /// Execute counter operation
    fn execute_counter(
        &self,
        node: &LadderNode,
        input: bool,
        counter_type: SimCounterType,
    ) -> ExecutionResult<()> {
        let addr = self.parse_address(&node.address)?;
        if addr.device != 'C' {
            return Err(ExecutionError::InvalidAddress(format!(
                "Counter must use C device, got {}",
                addr.device
            )));
        }

        let preset = node.preset.unwrap_or(10) as i32;

        let done = self.counter_mgr.update(
            addr.address,
            counter_type,
            input,
            None, // down_input for CTUD - could be passed via node.operand1 in future
            preset,
        );

        // Update C contact
        let _ = self.memory.write_bit_internal(SimBitDeviceType::C, addr.address, done);

        Ok(())
    }

    /// Execute math operation
    fn execute_math<F>(&self, node: &LadderNode, op: F) -> ExecutionResult<()>
    where
        F: Fn(i32, i32) -> i32,
    {
        let op1_str = node.operand1.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand1".to_string()))?;
        let op2_str = node.operand2.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand2".to_string()))?;
        let dest_str = node.destination.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing destination".to_string()))?;

        let op1 = self.read_operand(op1_str)?;
        let op2 = self.read_operand(op2_str)?;
        let result = op(op1, op2);

        let dest = DeviceAddress::parse(dest_str)
            .ok_or_else(|| ExecutionError::InvalidAddress(dest_str.clone()))?;

        if dest.is_word_device() {
            let device = dest.as_word_device().unwrap();
            self.memory.write_word(device, dest.address, result as u16)?;
        }

        Ok(())
    }

    /// Execute division with zero check
    fn execute_math_div(&self, node: &LadderNode) -> ExecutionResult<()> {
        let op1_str = node.operand1.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand1".to_string()))?;
        let op2_str = node.operand2.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand2".to_string()))?;
        let dest_str = node.destination.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing destination".to_string()))?;

        let op1 = self.read_operand(op1_str)?;
        let op2 = self.read_operand(op2_str)?;

        if op2 == 0 {
            // Division by zero - keep destination unchanged
            return Ok(());
        }

        let result = op1 / op2;

        let dest = DeviceAddress::parse(dest_str)
            .ok_or_else(|| ExecutionError::InvalidAddress(dest_str.clone()))?;

        if dest.is_word_device() {
            let device = dest.as_word_device().unwrap();
            self.memory.write_word(device, dest.address, result as u16)?;
        }

        Ok(())
    }

    /// Execute modulo with zero check
    fn execute_math_mod(&self, node: &LadderNode) -> ExecutionResult<()> {
        let op1_str = node.operand1.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand1".to_string()))?;
        let op2_str = node.operand2.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand2".to_string()))?;
        let dest_str = node.destination.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing destination".to_string()))?;

        let op1 = self.read_operand(op1_str)?;
        let op2 = self.read_operand(op2_str)?;

        if op2 == 0 {
            return Ok(());
        }

        let result = op1 % op2;

        let dest = DeviceAddress::parse(dest_str)
            .ok_or_else(|| ExecutionError::InvalidAddress(dest_str.clone()))?;

        if dest.is_word_device() {
            let device = dest.as_word_device().unwrap();
            self.memory.write_word(device, dest.address, result as u16)?;
        }

        Ok(())
    }

    /// Execute move operation
    fn execute_move(&self, node: &LadderNode) -> ExecutionResult<()> {
        let op1_str = node.operand1.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing operand1 (source)".to_string()))?;
        let dest_str = node.destination.as_ref()
            .ok_or_else(|| ExecutionError::InvalidAddress("Missing destination".to_string()))?;

        let value = self.read_operand(op1_str)?;

        let dest = DeviceAddress::parse(dest_str)
            .ok_or_else(|| ExecutionError::InvalidAddress(dest_str.clone()))?;

        if dest.is_word_device() {
            let device = dest.as_word_device().unwrap();
            self.memory.write_word(device, dest.address, value as u16)?;
        }

        Ok(())
    }

    /// Get current scan count
    pub fn scan_count(&self) -> u64 {
        *self.scan_count.read()
    }

    /// Reset scan count
    pub fn reset_scan_count(&self) {
        *self.scan_count.write() = 0;
    }
}

impl Default for ProgramExecutor {
    fn default() -> Self {
        Self::new(
            Arc::new(DeviceMemory::new()),
            Arc::new(TimerManager::new()),
            Arc::new(CounterManager::new()),
        )
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_executor() -> (ProgramExecutor, Arc<DeviceMemory>, Arc<TimerManager>, Arc<CounterManager>) {
        let memory = Arc::new(DeviceMemory::new());
        let timer_mgr = Arc::new(TimerManager::new());
        let counter_mgr = Arc::new(CounterManager::new());
        let executor = ProgramExecutor::new(
            Arc::clone(&memory),
            Arc::clone(&timer_mgr),
            Arc::clone(&counter_mgr),
        );
        (executor, memory, timer_mgr, counter_mgr)
    }

    #[test]
    fn test_device_address_parse() {
        let addr = DeviceAddress::parse("M0000").unwrap();
        assert_eq!(addr.device, 'M');
        assert_eq!(addr.address, 0);
        assert!(addr.bit_index.is_none());

        let addr = DeviceAddress::parse("D100.5").unwrap();
        assert_eq!(addr.device, 'D');
        assert_eq!(addr.address, 100);
        assert_eq!(addr.bit_index, Some(5));
    }

    #[test]
    fn test_contact_no() {
        let (executor, memory, _, _) = create_executor();

        // M0 is false
        let node = LadderNode::contact(NodeType::ContactNo, "M0");
        assert!(!executor.evaluate_node(&node).unwrap());

        // Set M0 true
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_contact_nc() {
        let (executor, memory, _, _) = create_executor();

        // M0 is false, NC returns true
        let node = LadderNode::contact(NodeType::ContactNc, "M0");
        assert!(executor.evaluate_node(&node).unwrap());

        // Set M0 true, NC returns false
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        assert!(!executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_contact_p_rising_edge() {
        let (executor, memory, _, _) = create_executor();

        let node = LadderNode::contact(NodeType::ContactP, "M0");

        // First scan with false - no edge
        assert!(!executor.evaluate_node(&node).unwrap());

        // Set M0 true - rising edge
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());

        // Second scan with true - no edge
        assert!(!executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_contact_n_falling_edge() {
        let (executor, memory, _, _) = create_executor();

        let node = LadderNode::contact(NodeType::ContactN, "M0");

        // Set M0 true first
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        executor.evaluate_node(&node).unwrap(); // Update previous state

        // Set M0 false - falling edge
        memory.write_bit(SimBitDeviceType::M, 0, false).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());

        // Second scan with false - no edge
        assert!(!executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_block_series() {
        let (executor, memory, _, _) = create_executor();

        let node = LadderNode::series(vec![
            LadderNode::contact(NodeType::ContactNo, "M0"),
            LadderNode::contact(NodeType::ContactNo, "M1"),
        ]);

        // Both false - series is false
        assert!(!executor.evaluate_node(&node).unwrap());

        // M0 true, M1 false - still false
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        assert!(!executor.evaluate_node(&node).unwrap());

        // Both true - series is true
        memory.write_bit(SimBitDeviceType::M, 1, true).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_block_parallel() {
        let (executor, memory, _, _) = create_executor();

        let node = LadderNode::parallel(vec![
            LadderNode::contact(NodeType::ContactNo, "M0"),
            LadderNode::contact(NodeType::ContactNo, "M1"),
        ]);

        // Both false - parallel is false
        assert!(!executor.evaluate_node(&node).unwrap());

        // M0 true, M1 false - parallel is true
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());

        // Both true - still true
        memory.write_bit(SimBitDeviceType::M, 1, true).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_coil_out() {
        let (executor, memory, _, _) = create_executor();

        let node = LadderNode::coil(NodeType::CoilOut, "P0");

        // Execute with true input
        executor.execute_output(&node, true).unwrap();
        assert!(memory.read_bit(SimBitDeviceType::P, 0).unwrap());

        // Execute with false input
        executor.execute_output(&node, false).unwrap();
        assert!(!memory.read_bit(SimBitDeviceType::P, 0).unwrap());
    }

    #[test]
    fn test_coil_set_latch() {
        let (executor, memory, _, _) = create_executor();

        let node = LadderNode::coil(NodeType::CoilSet, "P0");

        // Execute with true input - latches on
        executor.execute_output(&node, true).unwrap();
        assert!(memory.read_bit(SimBitDeviceType::P, 0).unwrap());

        // Execute with false input - stays latched
        executor.execute_output(&node, false).unwrap();
        assert!(memory.read_bit(SimBitDeviceType::P, 0).unwrap());
    }

    #[test]
    fn test_coil_rst_unlatch() {
        let (executor, memory, _, _) = create_executor();

        // Set P0 true first
        memory.write_bit(SimBitDeviceType::P, 0, true).unwrap();

        let node = LadderNode::coil(NodeType::CoilRst, "P0");

        // Execute with false input - stays on
        executor.execute_output(&node, false).unwrap();
        assert!(memory.read_bit(SimBitDeviceType::P, 0).unwrap());

        // Execute with true input - unlatches
        executor.execute_output(&node, true).unwrap();
        assert!(!memory.read_bit(SimBitDeviceType::P, 0).unwrap());
    }

    #[test]
    fn test_compare_operations() {
        let (executor, memory, _, _) = create_executor();

        // Set D0 = 10, D1 = 5
        memory.write_word(SimWordDeviceType::D, 0, 10).unwrap();
        memory.write_word(SimWordDeviceType::D, 1, 5).unwrap();

        let eq = LadderNode::compare(NodeType::CompareEq, "D0", "D1");
        assert!(!executor.evaluate_node(&eq).unwrap());

        let gt = LadderNode::compare(NodeType::CompareGt, "D0", "D1");
        assert!(executor.evaluate_node(&gt).unwrap());

        let lt = LadderNode::compare(NodeType::CompareLt, "D0", "D1");
        assert!(!executor.evaluate_node(&lt).unwrap());

        // Compare with constant
        let eq_const = LadderNode::compare(NodeType::CompareEq, "D0", "10");
        assert!(executor.evaluate_node(&eq_const).unwrap());
    }

    #[test]
    fn test_math_add() {
        let (executor, memory, _, _) = create_executor();

        memory.write_word(SimWordDeviceType::D, 0, 10).unwrap();
        memory.write_word(SimWordDeviceType::D, 1, 5).unwrap();

        let node = LadderNode::math(NodeType::MathAdd, "D0", "D1", "D2");
        executor.execute_output(&node, true).unwrap();

        assert_eq!(memory.read_word(SimWordDeviceType::D, 2).unwrap(), 15);
    }

    #[test]
    fn test_math_sub() {
        let (executor, memory, _, _) = create_executor();

        memory.write_word(SimWordDeviceType::D, 0, 10).unwrap();
        memory.write_word(SimWordDeviceType::D, 1, 3).unwrap();

        let node = LadderNode::math(NodeType::MathSub, "D0", "D1", "D2");
        executor.execute_output(&node, true).unwrap();

        assert_eq!(memory.read_word(SimWordDeviceType::D, 2).unwrap(), 7);
    }

    #[test]
    fn test_math_div_by_zero() {
        let (executor, memory, _, _) = create_executor();

        memory.write_word(SimWordDeviceType::D, 0, 10).unwrap();
        memory.write_word(SimWordDeviceType::D, 1, 0).unwrap();
        memory.write_word(SimWordDeviceType::D, 2, 999).unwrap();

        let node = LadderNode::math(NodeType::MathDiv, "D0", "D1", "D2");
        // Should not panic, just keep destination unchanged
        executor.execute_output(&node, true).unwrap();

        assert_eq!(memory.read_word(SimWordDeviceType::D, 2).unwrap(), 999);
    }

    #[test]
    fn test_math_mov() {
        let (executor, memory, _, _) = create_executor();

        memory.write_word(SimWordDeviceType::D, 0, 42).unwrap();

        let mut node = LadderNode::math(NodeType::MathMov, "D0", "0", "D1");
        node.operand2 = None; // MOV doesn't need operand2

        executor.execute_output(&node, true).unwrap();

        assert_eq!(memory.read_word(SimWordDeviceType::D, 1).unwrap(), 42);
    }

    #[test]
    fn test_math_only_executes_on_true_input() {
        let (executor, memory, _, _) = create_executor();

        memory.write_word(SimWordDeviceType::D, 0, 10).unwrap();
        memory.write_word(SimWordDeviceType::D, 1, 5).unwrap();
        memory.write_word(SimWordDeviceType::D, 2, 0).unwrap();

        let node = LadderNode::math(NodeType::MathAdd, "D0", "D1", "D2");

        // Execute with false input - should not change D2
        executor.execute_output(&node, false).unwrap();
        assert_eq!(memory.read_word(SimWordDeviceType::D, 2).unwrap(), 0);

        // Execute with true input - should update D2
        executor.execute_output(&node, true).unwrap();
        assert_eq!(memory.read_word(SimWordDeviceType::D, 2).unwrap(), 15);
    }

    #[test]
    fn test_nested_blocks() {
        let (executor, memory, _, _) = create_executor();

        // Series containing parallel: (M0 AND (M1 OR M2))
        let node = LadderNode::series(vec![
            LadderNode::contact(NodeType::ContactNo, "M0"),
            LadderNode::parallel(vec![
                LadderNode::contact(NodeType::ContactNo, "M1"),
                LadderNode::contact(NodeType::ContactNo, "M2"),
            ]),
        ]);

        // All false - false
        assert!(!executor.evaluate_node(&node).unwrap());

        // M0=true, M1/M2=false - false
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        assert!(!executor.evaluate_node(&node).unwrap());

        // M0=true, M1=true - true
        memory.write_bit(SimBitDeviceType::M, 1, true).unwrap();
        assert!(executor.evaluate_node(&node).unwrap());
    }

    #[test]
    fn test_program_execution() {
        let (executor, memory, _, _) = create_executor();

        let program = LadderProgram {
            name: "Test".to_string(),
            networks: vec![
                LadderNetwork {
                    id: 0,
                    nodes: vec![LadderNode::series(vec![
                        LadderNode::contact(NodeType::ContactNo, "M0"),
                        LadderNode::coil(NodeType::CoilOut, "P0"),
                    ])],
                    comment: None,
                },
            ],
        };

        // M0 false - P0 should stay false
        let result = executor.execute_program(&program);
        assert!(result.success);
        assert!(!memory.read_bit(SimBitDeviceType::P, 0).unwrap());

        // M0 true - P0 should become true
        memory.write_bit(SimBitDeviceType::M, 0, true).unwrap();
        let result = executor.execute_program(&program);
        assert!(result.success);
        assert!(memory.read_bit(SimBitDeviceType::P, 0).unwrap());
    }

    #[test]
    fn test_scan_count() {
        let executor = ProgramExecutor::default();

        assert_eq!(executor.scan_count(), 0);

        let program = LadderProgram {
            name: "Test".to_string(),
            networks: vec![],
        };

        executor.execute_program(&program);
        assert_eq!(executor.scan_count(), 1);

        executor.execute_program(&program);
        assert_eq!(executor.scan_count(), 2);

        executor.reset_scan_count();
        assert_eq!(executor.scan_count(), 0);
    }
}
