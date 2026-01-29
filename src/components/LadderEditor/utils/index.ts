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
