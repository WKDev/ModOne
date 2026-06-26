// 모든 벤더 프로파일이 공유하는 PLC 하드웨어 모델 타입 (rack/module/주소창)

use serde::{Deserialize, Serialize};

/// PLC manufacturer enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcManufacturer {
    LS,
    Mitsubishi,
    Siemens,
}

impl Default for PlcManufacturer {
    fn default() -> Self {
        Self::LS
    }
}

impl std::fmt::Display for PlcManufacturer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PlcManufacturer::LS => write!(f, "LS"),
            PlcManufacturer::Mitsubishi => write!(f, "Mitsubishi"),
            PlcManufacturer::Siemens => write!(f, "Siemens"),
        }
    }
}

impl std::str::FromStr for PlcManufacturer {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "ls" => Ok(PlcManufacturer::LS),
            "mitsubishi" => Ok(PlcManufacturer::Mitsubishi),
            "siemens" => Ok(PlcManufacturer::Siemens),
            _ => Err(format!("Unknown PLC manufacturer: {}", s)),
        }
    }
}

/// PLC configuration settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcSettings {
    /// PLC manufacturer
    pub manufacturer: PlcManufacturer,

    /// PLC model name
    pub model: String,

    /// Scan time in milliseconds
    pub scan_time_ms: u32,

    /// Hardware topology for rack/base/module oriented PLC families.
    #[serde(default)]
    pub hardware_topology: PlcHardwareTopology,
}

impl Default for PlcSettings {
    fn default() -> Self {
        Self {
            manufacturer: PlcManufacturer::default(),
            model: String::new(),
            scan_time_ms: 10,
            hardware_topology: PlcHardwareTopology::default(),
        }
    }
}

/// Generic PLC hardware topology shared across vendor profiles.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PlcHardwareTopology {
    /// Rack/base definitions in installation order.
    #[serde(default)]
    pub racks: Vec<PlcRackTopology>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcRackTopology {
    /// Stable rack/base identifier within the project.
    pub rack_id: String,
    /// Rack role in the hardware layout.
    #[serde(default)]
    pub rack_kind: PlcRackKind,
    /// Installed modules on this rack/base.
    #[serde(default)]
    pub modules: Vec<PlcHardwareModule>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcRackKind {
    MainBase,
    ExpansionBase,
    RemoteBase,
}

impl Default for PlcRackKind {
    fn default() -> Self {
        Self::MainBase
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcHardwareModule {
    /// Slot number within the rack/base.
    pub slot: u16,
    /// Hardware role.
    pub module_kind: PlcModuleKind,
    /// Vendor model identifier.
    #[serde(default)]
    pub model: String,
    /// Optional channel/point count for the module.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_count: Option<u16>,
    /// Address windows exposed by this module in vendor notation.
    #[serde(default)]
    pub address_windows: Vec<PlcAddressWindow>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcModuleKind {
    Power,
    Cpu,
    DigitalInput,
    DigitalOutput,
    DigitalIo,
    AnalogInput,
    AnalogOutput,
    AnalogIo,
    Communication,
    Special,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlcAddressWindow {
    /// Vendor family name such as `P`, `X`, `Y`, or `D`.
    pub family: String,
    /// Start index within the family.
    pub start: u32,
    /// Number of points/words in the window.
    pub count: u32,
    /// Optional I/O direction for ambiguous vendor families.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub io_direction: Option<PlcIoDirection>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlcIoDirection {
    Input,
    Output,
    Bidirectional,
}
