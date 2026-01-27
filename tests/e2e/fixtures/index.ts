/**
 * Test fixtures for E2E testing
 */

import mockConfig from './mock-config.json' with { type: 'json' };
import testMemoryValues from './test-memory-values.json' with { type: 'json' };
import expectedLayouts from './expected-layouts.json' with { type: 'json' };

export { mockConfig, testMemoryValues, expectedLayouts };

/**
 * Test project names for consistent test data
 */
export const testProjectNames = {
  basic: 'TestProject',
  withSpaces: 'Test Project With Spaces',
  unicode: 'テストプロジェクト',
  long: 'A'.repeat(50) + 'Project',
} as const;

/**
 * Invalid project names for error testing
 */
export const invalidProjectNames = {
  empty: '',
  onlySpaces: '   ',
  invalidChars: 'Project<>|:"?*',
} as const;

/**
 * Default test ports
 */
export const testPorts = {
  modbusTcp: 5020, // Non-standard port to avoid conflicts
  modbusRtu: 'COM99', // Non-existent port for testing
} as const;

/**
 * Test timeouts
 */
export const testTimeouts = {
  short: 1000,
  medium: 5000,
  long: 15000,
  veryLong: 30000,
} as const;

/**
 * Keyboard shortcuts used in tests
 */
export const shortcuts = {
  save: 'Control+s',
  saveAs: 'Control+Shift+s',
  newProject: 'Control+n',
  openProject: 'Control+o',
  toggleSidebar: 'Control+b',
  undo: 'Control+z',
  redo: 'Control+y',
  startSimulation: 'F5',
  stopSimulation: 'Shift+F5',
  pauseSimulation: 'F6',
  stepSimulation: 'F10',
} as const;

/**
 * Helper to get a default project configuration with overrides
 */
export function createTestConfig(overrides: Record<string, unknown> = {}) {
  return {
    ...mockConfig,
    ...overrides,
    project: {
      ...mockConfig.project,
      ...(overrides.project as Record<string, unknown> || {}),
    },
  };
}

/**
 * PLC configurations for testing different manufacturers
 */
export const plcConfigurations = {
  lsElectric: {
    manufacturer: 'LS' as const,
    model: 'XGK-CPUHN',
    scan_time_ms: 10,
  },
  mitsubishi: {
    manufacturer: 'Mitsubishi' as const,
    model: 'FX5U',
    scan_time_ms: 20,
  },
  siemens: {
    manufacturer: 'Siemens' as const,
    model: 'S7-1200',
    scan_time_ms: 10,
  },
} as const;
