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
export { useOpenProjectDialog, default as UseOpenProjectDialog } from './useOpenProjectDialog';
export { useProject, default as UseProject } from './useProject';
export { useTranslation, useLanguage } from './useTranslation';
export type { SupportedLanguage } from './useTranslation';
