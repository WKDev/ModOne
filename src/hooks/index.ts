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
export { useOpenProjectDialog, default as UseOpenProjectDialog } from './useOpenProjectDialog';
export { useProject, default as UseProject } from './useProject';
export { useTranslation, useLanguage } from './useTranslation';
export type { SupportedLanguage } from './useTranslation';
