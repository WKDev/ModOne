// Custom React hooks
export { useAutoSave } from './useAutoSave';
export { useErrorHandler, default as UseErrorHandler } from './useErrorHandler';
export { useKeyboardShortcuts, default as UseKeyboardShortcuts } from './useKeyboardShortcuts';
export { useModbus, default as UseModbus } from './useModbus';
export {
  useModbusMemory,
  useModbusCoils,
  useModbusDiscreteInputs,
  useModbusHoldingRegisters,
  useModbusInputRegisters,
  default as UseModbusMemory,
} from './useModbusMemory';
export {
  useMonitoring,
  default as UseMonitoring,
  type UseMonitoringResult,
  type MonitoringConnectionStatus,
  type MonitoringUpdatePayload,
  type DeviceStateUpdate,
  type TimerStateUpdate,
  type CounterStateUpdate,
} from './useMonitoring';
export {
  useElementMonitoring,
  useWireMonitoring,
  default as UseElementMonitoring,
  type UseElementMonitoringResult,
} from './useElementMonitoring';
export {
  useCanvasSync,
  default as UseCanvasSync,
  type PlcBlockType,
  type PlcBlockMapping,
  type PlcOutputUpdate,
  type PlcOutputsEvent,
  type PlcInputChange,
  type CanvasSyncStatus,
  type MappingSummary,
  type UseCanvasSyncOptions,
  type UseCanvasSyncResult,
} from './useCanvasSync';
export { useOpenProjectDialog, default as UseOpenProjectDialog } from './useOpenProjectDialog';
export { useProject, default as UseProject } from './useProject';
export { useTranslation, useLanguage } from './useTranslation';
export type { SupportedLanguage } from './useTranslation';
export {
  useSimulation,
  default as UseSimulation,
  type UseSimulationResult,
  type SimulationConfig,
  type DeviceChangeEvent,
} from './useSimulation';
export { useFileOpen, default as UseFileOpen } from './useFileOpen';
export {
  useTabClose,
  default as UseTabClose,
  type PendingTabClose,
  type UseTabCloseResult,
} from './useTabClose';
export {
  useWindowClose,
  default as UseWindowClose,
  type UseWindowCloseResult,
} from './useWindowClose';
