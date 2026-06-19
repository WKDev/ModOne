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
  PlcHardwareTopology,
  PlcRackTopology,
  PlcHardwareModule,
  PlcAddressWindow,
  PlcRackKind,
  PlcModuleKind,
  PlcIoDirection,
  ProjectSettings,
  PlcSettings,
  ModbusTcpSettings,
  ModbusRtuSettings,
  ModbusServerSimulationSettings,
  ModbusSimulationTransport,
  ModbusExposureSettings,
  ModbusExposureRule,
  ModbusExposureMode,
  ModbusExposureAddressSpace,
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

// Symbol types (custom symbol infrastructure)
export * from './symbol';

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

// Tag types (imported directly from './tags' to avoid naming conflicts with onesim)
export type {
  TagTypedValue,
  TagValueChangedEvent,
  TagValue,
} from './tags';
export { TAG_EVENTS } from './tags';
// TagDefinition from tags.ts is the DTO variant; use as TagDefinitionDto if needed
export type { TagDefinition as TagDefinitionDto } from './tags';

// IFTTT Action Block Core Infrastructure
// Trigger-action binding data model, execution engine interfaces,
// and XML/CAEX schema types (IEC 62714 / AutomationML inspired)
export type {
  // Domain
  BlockDomain,
  // Conditions
  ConditionType,
  Condition,
  // Actions
  ActionType,
  Action,
  // Rules
  ConditionLogic,
  IftttRule,
  // Terminal roles (CAEX MappingObject)
  TerminalRoleMapping,
  // Behavior binding (CAEX SupportedRoleClass)
  BehaviorTemplateId,
  InteractionMode,
  BehaviorBinding,
  // Action block (top-level IFTTT unit)
  ActionBlock,
  // Simulation context (read-only world snapshot)
  SimulationContext,
  // Mutation effects (collected side-effects)
  StateMutation,
  PropertyMutation,
  PortMutation,
  RegisterWrite,
  BitWrite,
  TimerCommand,
  CounterCommand,
  EmittedEvent,
  MutationEffect,
  // Evaluation results
  RuleEvaluationResult,
  BlockEvaluationResult,
  // Engine interface
  IIftttActionEngine,
  // XML serialisation raw types
  RawBehaviorXml,
  RawRuleXml,
  RawConditionXml,
  RawActionXml,
} from './ifttt';
export {
  // Domain validation sets
  CIRCUIT_ONLY_CONDITIONS,
  PLC_ONLY_CONDITIONS,
  CIRCUIT_ONLY_ACTIONS,
  PLC_ONLY_ACTIONS,
  // Domain validation helpers
  isConditionAllowedInDomain,
  isActionAllowedInDomain,
  // Factory helpers
  createEmptyMutationEffect,
  mergeMutationEffects,
} from './ifttt';

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
