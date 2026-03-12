/**
 * Ladder Editor Utilities
 *
 * Utility functions for ladder diagram editing and rendering.
 */

// Wire generation utilities
export {
  // generateWires is deprecated (wire-as-element is the active pattern)
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

// Dual-grid utilities
export {
  DEFAULT_DUAL_GRID_CONFIG,
  buildDualGridTopology,
  isHalfStepCoordinate,
  isIntegerCoordinate,
  projectHorizontalSegmentToPixels,
  projectPointToPixels,
  projectVerticalLinkToPixels,
  resolveDualGridSelection,
  snapPointerToDualGrid,
  snapToComponentGrid,
  snapToVerticalLinkGrid,
  type ComponentCell,
  type DualGridConfig,
  type DualGridEdge,
  type DualGridIssue,
  type DualGridNode,
  type DualGridSelection,
  type DualGridTopology,
  type DualGridTopologyInput,
  type HorizontalSegment,
  type RowLinkState,
  type SelectableDualGridEntity,
  type SnapResult,
  type UnitPoint,
  type VerticalContinuityChain,
  type VerticalLink,
} from './dualGrid';
