// PLC Manufacturer types
export type PlcManufacturer = 'LS' | 'Mitsubishi' | 'Siemens';

// Serial parity settings
export type Parity = 'None' | 'Even' | 'Odd';

// Project metadata settings
export interface ProjectSettings {
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// PLC configuration settings
export interface PlcSettings {
  manufacturer: PlcManufacturer;
  model: string;
  scan_time_ms: number;
  hardware_topology: PlcHardwareTopology;
}

export type PlcRackKind = 'MainBase' | 'ExpansionBase' | 'RemoteBase';
export type PlcModuleKind =
  | 'Power'
  | 'Cpu'
  | 'DigitalInput'
  | 'DigitalOutput'
  | 'DigitalIo'
  | 'AnalogInput'
  | 'AnalogOutput'
  | 'AnalogIo'
  | 'Communication'
  | 'Special';
export type PlcIoDirection = 'Input' | 'Output' | 'Bidirectional';

export interface PlcAddressWindow {
  family: string;
  start: number;
  count: number;
  io_direction?: PlcIoDirection;
}

export interface PlcHardwareModule {
  slot: number;
  module_kind: PlcModuleKind;
  model: string;
  point_count?: number;
  address_windows: PlcAddressWindow[];
}

export interface PlcRackTopology {
  rack_id: string;
  rack_kind: PlcRackKind;
  modules: PlcHardwareModule[];
}

export interface PlcHardwareTopology {
  racks: PlcRackTopology[];
}

// Modbus TCP server settings
export interface ModbusTcpSettings {
  enabled: boolean;
  port: number;
  unit_id: number;
}

// Modbus RTU settings
export interface ModbusRtuSettings {
  enabled: boolean;
  com_port: string;
  baud_rate: number;
  parity: Parity;
  stop_bits: number;
}

// Modbus communication settings
export interface ModbusSettings {
  tcp: ModbusTcpSettings;
  rtu: ModbusRtuSettings;
  simulation: ModbusServerSimulationSettings;
  exposure: ModbusExposureSettings;
}

export type ModbusSimulationTransport = 'Tcp' | 'Rtu' | 'TcpAscii' | 'RtuAscii';
export type ModbusExposureMode = 'Recommended' | 'LegacyWide' | 'Custom';
export type ModbusExposureAddressSpace =
  | 'Coil'
  | 'DiscreteInput'
  | 'HoldingRegister'
  | 'InputRegister';

export interface ModbusServerSimulationSettings {
  enabled: boolean;
  transport: ModbusSimulationTransport;
  address: string;
  com_port: string;
  unit_id: number;
  baud_rate: number;
  parity: Parity;
  stop_bits: number;
  coil_start_address: number;
  word_start_address: number;
}

export interface ModbusExposureRule {
  family: string;
  address_space: ModbusExposureAddressSpace;
  offset: number;
  count: number;
}

export interface ModbusExposureSettings {
  mode: ModbusExposureMode;
  rules: ModbusExposureRule[];
}

// Memory map configuration settings
export interface MemoryMapSettings {
  coil_start: number;
  coil_count: number;
  discrete_input_start: number;
  discrete_input_count: number;
  holding_register_start: number;
  holding_register_count: number;
  input_register_start: number;
  input_register_count: number;
}

// Auto-save configuration settings
export interface AutoSaveSettings {
  enabled: boolean;
  interval_secs: number;
  backup_count: number;
}

// Canvas grid and interaction settings
export interface CanvasSettings {
  grid_size: number;
  snap_to_grid: boolean;
  show_grid: boolean;
  grid_style: 'dots' | 'lines';
  grid_unit?: 'mil' | 'mm';
}

// Directory configuration for v2.0 folder-based projects
export interface DirectoryConfig {
  canvas: string;
  ladder: string;
  scenario: string;
  sheets: string;
}

// Full project configuration (matches config.yml schema)
export interface ProjectConfig {
  version: string;
  project: ProjectSettings;
  plc: PlcSettings;
  modbus: ModbusSettings;
  memory_map: MemoryMapSettings;
  auto_save?: AutoSaveSettings;
  canvas?: CanvasSettings;
  network?: NetworkSettings;
  opcua?: OpcUaSettings;
  /** Active sheet file name (relative to sheets/ directory) */
  sheet?: string;
  directories?: DirectoryConfig;
  /** IDs of tags pinned to the watch list in the Tag Browser */
  watched_tag_ids?: string[];
}

export interface NetworkSettings {
  /** IP address the simulated PLC uses on the network. Null means bind to 127.0.0.1 */
  plc_ip: string | null;
  /** Network interface name for IP alias assignment */
  interface_name: string | null;
  /** Subnet mask (e.g., "255.255.255.0") */
  subnet_mask: string | null;
}

export type OpcUaSecurityPolicy =
  | 'None'
  | 'Basic128Rsa15'
  | 'Basic256'
  | 'Basic256Sha256'
  | 'Aes128Sha256RsaOaep'
  | 'Aes256Sha256RsPss';

/** Info about a single security policy, returned by the backend */
export interface SecurityPolicyInfo {
  id: OpcUaSecurityPolicy;
  displayName: string;
  policyUri: string;
  requiresEncryption: boolean;
  messageSecurityMode: string;
  enabled: boolean;
}

export interface OpcUaSettings {
  /** Whether the OPC UA server is enabled during simulation */
  enabled: boolean;
  /** TCP port (default 4840) */
  port: number;
  /** Server display name */
  server_name: string;
  /** Optional username for user/password authentication */
  username?: string | null;
  /** Optional password for user/password authentication */
  password?: string | null;
  /** Enabled security policies */
  security_policies?: OpcUaSecurityPolicy[];
  /** Whether anonymous (unauthenticated) client connections are allowed */
  allow_anonymous?: boolean;
}

export interface OpcUaStatus {
  running: boolean;
  port: number;
  endpoint: string;
  endpointPath: string;
  sessionCount: number;
  sessionCountSupported: boolean;
  certificateFingerprint?: string | null;
  certificateValidTo?: string | null;
  featureEnabled: boolean;
  /** Security policies currently advertised by the running server */
  activeSecurityPolicies?: OpcUaSecurityPolicy[];
  /** Whether the running server allows anonymous connections */
  allowAnonymous?: boolean;
}

/** Detailed information about an active OPC UA client session (Prosys-style). */
export interface OpcUaSessionInfo {
  /** Unique identifier for this session (opaque string) */
  sessionId: string;
  /** Client application name / session name as reported during session creation */
  clientName: string;
  /** Client application description (product URI, application URI) */
  clientDescription: string;
  /** Remote IP address of the connected client */
  clientIp: string;
  /** Server endpoint URI this session connected to */
  serverUri: string;
  /** Security policy URI active on this session's channel */
  securityPolicy: string;
  /** Message security mode ("None", "Sign", "SignAndEncrypt") */
  securityMode: string;
  /** ISO 8601 timestamp when the session was created */
  connectedAt: string;
  /** ISO 8601 timestamp of last observed activity */
  lastContactTime: string;
  /** Secure channel identifier for this session's transport channel */
  secureChannelId: string;
  /** Session lifecycle state: "Created", "Activated", or "Closing" */
  state: string;
  /** Number of active subscriptions on this session */
  subscriptionCount: number;
}

// Placeholder types (to be fully implemented in later units)
export interface CanvasData {
  data?: unknown;
}

export interface ScenarioData {
  data?: unknown;
}

export interface MemorySnapshot {
  data?: unknown;
}

type DeepPartial<T> = {
  [K in keyof T]?: NonNullable<T[K]> extends Array<infer U>
    ? U[]
    : NonNullable<T[K]> extends object
      ? DeepPartial<NonNullable<T[K]>>
      : T[K];
};

export type ProjectConfigPatch = DeepPartial<ProjectConfig>;

// Project data returned from Tauri backend (matches Rust ProjectData)
export interface ProjectData {
  config: ProjectConfig;
  canvas_data?: CanvasData;
  scenario_data?: ScenarioData;
  memory_snapshot?: MemorySnapshot;
  is_modified: boolean;
}

// Project info returned after creating a project (matches Rust ProjectInfo)
export interface ProjectInfo {
  name: string;
  path: string;
  created_at: string;
}

// Current project status (matches Rust ProjectStatus)
export interface ProjectStatus {
  is_open: boolean;
  is_modified: boolean;
  name?: string;
  path?: string;
}

// Recent project entry for quick access (matches Rust RecentProject)
export interface RecentProject {
  name: string;
  path: string;
  last_opened: string;
}

// Default auto-save settings
export const DEFAULT_AUTO_SAVE_SETTINGS: AutoSaveSettings = {
  enabled: true,
  interval_secs: 300, // 5 minutes
  backup_count: 3,
};

// Default configuration values
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  version: '1.0',
  project: {
    name: '',
    description: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  plc: {
    manufacturer: 'LS',
    model: '',
    scan_time_ms: 10,
    hardware_topology: {
      racks: [],
    },
  },
  modbus: {
    tcp: {
      enabled: true,
      port: 502,
      unit_id: 1,
    },
    rtu: {
      enabled: false,
      com_port: '',
      baud_rate: 9600,
      parity: 'None',
      stop_bits: 1,
    },
    simulation: {
      enabled: false,
      transport: 'Tcp',
      address: '127.0.0.1:502',
      com_port: '',
      unit_id: 1,
      baud_rate: 9600,
      parity: 'None',
      stop_bits: 1,
      coil_start_address: 0,
      word_start_address: 0,
    },
    exposure: {
      mode: 'Recommended',
      rules: [],
    },
  },
  memory_map: {
    coil_start: 0,
    coil_count: 1000,
    discrete_input_start: 0,
    discrete_input_count: 1000,
    holding_register_start: 0,
    holding_register_count: 1000,
    input_register_start: 0,
    input_register_count: 1000,
  },
  auto_save: DEFAULT_AUTO_SAVE_SETTINGS,
  canvas: {
    grid_size: 5,
    grid_unit: 'mm',
    snap_to_grid: true,
    show_grid: true,
    grid_style: 'dots',
  },
  network: {
    plc_ip: null,
    interface_name: null,
    subnet_mask: null,
  },
  opcua: {
    enabled: false,
    port: 4840,
    server_name: 'ModOne PLC Simulator',
    username: '',
    password: '',
    security_policies: ['Basic256Sha256'],
    allow_anonymous: false,
  },
};
