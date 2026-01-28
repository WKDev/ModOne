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

// Full project configuration (matches config.yml schema)
export interface ProjectConfig {
  version: string;
  project: ProjectSettings;
  plc: PlcSettings;
  modbus: ModbusSettings;
  memory_map: MemoryMapSettings;
  auto_save?: AutoSaveSettings;
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
};
