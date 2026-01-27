/**
 * Type exports for ModOne
 */

export * from './panel';
export * from './tab';
export * from './dnd';
export * from './layout';

// Project types (excluding Parity which conflicts with settings)
export type {
  PlcManufacturer,
  ProjectSettings,
  PlcSettings,
  ModbusTcpSettings,
  ModbusRtuSettings,
  ModbusSettings,
  MemoryMapSettings,
  AutoSaveSettings,
  ProjectConfig,
  CanvasData,
  ScenarioData,
  MemorySnapshot,
  ProjectData,
  ProjectInfo,
  ProjectStatus,
  RecentProject,
} from './project';
export { DEFAULT_AUTO_SAVE_SETTINGS, DEFAULT_PROJECT_CONFIG } from './project';
// Re-export project's Parity as ProjectParity to avoid conflict
export type { Parity as ProjectParity } from './project';

// Settings types
export * from './settings';

// Modbus types
export * from './modbus';

// Error types
export * from './error';
