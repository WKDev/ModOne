/**
 * Ladder Editor Utilities
 *
 * Utility functions for ladder diagram editing and rendering.
 */

// Wire generation utilities
export {
  generateWires,
  generateVerticalWire,
  getConnectionPoints,
  validateConnection,
  getWireTypeForConnection,
  calculateWirePath,
  type PortType,
  type PortPosition,
  type ConnectionPoint,
} from './wireGenerator';

// Grid conversion utilities (AST to Grid)
export {
  convertNodeToGrid,
  convertNetworkToGrid,
  convertToEditorNetwork,
  convertMultipleNetworks,
  flattenNodes,
  getNodeStats,
  type ConversionResult,
  type ConversionOptions,
} from './gridConverter';

// Validation utilities
export {
  validateDeviceAddress,
  validateDeviceAddressForType,
  validateTimerPreset,
  validateCounterPreset,
  validateCompareValue,
  validateLabel,
  formatValidationError,
  collectValidationErrors,
  type ValidationResult,
} from './validation';
