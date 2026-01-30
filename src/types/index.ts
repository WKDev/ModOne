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

// Scenario types
export * from './scenario';

// Error types
export * from './error';

// Ladder types (includes re-exports from OneParser)
export * from './ladder';

// OneSim types
export * from './onesim';

// Window types
export type {
  Bounds,
  FloatingWindowState,
  FloatingWindowInfo,
  WindowRegistryState,
  WindowBounds,
  CreateFloatingWindowOptions,
  WindowCreatedEvent,
  WindowClosedEvent,
  WindowMovedEvent,
  WindowResizedEvent,
  WindowFocusedEvent,
} from './window';

export {
  DEFAULT_FLOATING_WINDOW_SIZE,
  MIN_FLOATING_WINDOW_SIZE,
  FLOATING_WINDOW_CASCADE_OFFSET,
} from './window';

// Document types (Multi-Document Editing)
export type {
  DocumentType,
  DocumentStatus,
  DocumentMeta,
  HistorySnapshot,
  CanvasHistoryData,
  CanvasDocumentData,
  CanvasDocumentState,
  LadderHistoryData,
  LadderDocumentData,
  LadderDocumentState,
  ScenarioHistoryData,
  ScenarioDocumentData,
  ScenarioDocumentState,
  DocumentState,
  DocumentActions,
  DocumentInfo,
  SerializableLadderNetwork,
} from './document';

export {
  isCanvasDocument,
  isLadderDocument,
  isScenarioDocument,
  DEFAULT_CANVAS_DATA,
  DEFAULT_LADDER_DATA,
  DEFAULT_SCENARIO_DATA,
  generateDocumentId,
  createDocumentMeta,
  createEmptyCanvasDocument,
  createEmptyLadderDocument,
  createEmptyScenarioDocument,
  getDocumentInfo,
} from './document';
