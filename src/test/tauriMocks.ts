/**
 * Tauri Mocking Test Utilities
 *
 * Provides mocks for Tauri Window API and invoke commands for unit/integration testing.
 */

import { vi } from 'vitest';
import type { Bounds } from '../types/window';

// ============================================================================
// Types
// ============================================================================

/** Mock window state */
export interface MockWindowState {
  label: string;
  isVisible: boolean;
  isMaximized: boolean;
  isMinimized: boolean;
  isFocused: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

/** Mock invoke response configuration */
export interface MockInvokeConfig {
  [command: string]: unknown | ((args: Record<string, unknown>) => unknown);
}

/** Mock monitor info */
export interface MockMonitor {
  name: string | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

// ============================================================================
// State Management
// ============================================================================

/** Registry of mock windows */
const mockWindows = new Map<string, MockWindowState>();

/** Mock invoke responses */
let invokeResponses: MockInvokeConfig = {};

/** Mock monitors */
let mockMonitors: MockMonitor[] = [
  {
    name: 'Primary',
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  },
];

/** Current mock window (for getCurrent) */
let currentWindowLabel = 'main';

// ============================================================================
// Mock Window Class
// ============================================================================

/**
 * Mock implementation of Tauri Window class
 */
export class MockWindow {
  label: string;

  constructor(label: string) {
    this.label = label;

    // Initialize state if not exists
    if (!mockWindows.has(label)) {
      mockWindows.set(label, {
        label,
        isVisible: true,
        isMaximized: false,
        isMinimized: false,
        isFocused: false,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        scaleFactor: 1,
      });
    }
  }

  private getState(): MockWindowState {
    return (
      mockWindows.get(this.label) || {
        label: this.label,
        isVisible: true,
        isMaximized: false,
        isMinimized: false,
        isFocused: false,
        position: { x: 100, y: 100 },
        size: { width: 800, height: 600 },
        scaleFactor: 1,
      }
    );
  }

  private updateState(updates: Partial<MockWindowState>): void {
    const current = this.getState();
    mockWindows.set(this.label, { ...current, ...updates });
  }

  // Window creation
  static async new(_label: string, _options?: Record<string, unknown>): Promise<MockWindow> {
    return new MockWindow(_label);
  }

  static getCurrent(): MockWindow {
    return new MockWindow(currentWindowLabel);
  }

  static getByLabel(label: string): MockWindow | null {
    return mockWindows.has(label) ? new MockWindow(label) : null;
  }

  // Lifecycle
  async close(): Promise<void> {
    mockWindows.delete(this.label);
  }

  async destroy(): Promise<void> {
    mockWindows.delete(this.label);
  }

  // Visibility
  async show(): Promise<void> {
    this.updateState({ isVisible: true });
  }

  async hide(): Promise<void> {
    this.updateState({ isVisible: false });
  }

  async isVisible(): Promise<boolean> {
    return this.getState().isVisible;
  }

  // Focus
  async setFocus(): Promise<void> {
    // Clear focus from other windows
    for (const [label, state] of mockWindows) {
      if (label !== this.label) {
        mockWindows.set(label, { ...state, isFocused: false });
      }
    }
    this.updateState({ isFocused: true });
  }

  async isFocused(): Promise<boolean> {
    return this.getState().isFocused;
  }

  // Minimize/Maximize
  async minimize(): Promise<void> {
    this.updateState({ isMinimized: true });
  }

  async unminimize(): Promise<void> {
    this.updateState({ isMinimized: false });
  }

  async isMinimized(): Promise<boolean> {
    return this.getState().isMinimized;
  }

  async maximize(): Promise<void> {
    this.updateState({ isMaximized: true });
  }

  async unmaximize(): Promise<void> {
    this.updateState({ isMaximized: false });
  }

  async isMaximized(): Promise<boolean> {
    return this.getState().isMaximized;
  }

  async toggleMaximize(): Promise<void> {
    const current = this.getState();
    this.updateState({ isMaximized: !current.isMaximized });
  }

  // Position
  async setPosition(x: number, y: number): Promise<void>;
  async setPosition(position: { x: number; y: number }): Promise<void>;
  async setPosition(xOrPosition: number | { x: number; y: number }, y?: number): Promise<void> {
    if (typeof xOrPosition === 'object') {
      this.updateState({ position: xOrPosition });
    } else {
      this.updateState({ position: { x: xOrPosition, y: y! } });
    }
  }

  async innerPosition(): Promise<{ x: number; y: number }> {
    return this.getState().position;
  }

  async outerPosition(): Promise<{ x: number; y: number }> {
    return this.getState().position;
  }

  // Size
  async setSize(width: number, height: number): Promise<void>;
  async setSize(size: { width: number; height: number }): Promise<void>;
  async setSize(widthOrSize: number | { width: number; height: number }, height?: number): Promise<void> {
    if (typeof widthOrSize === 'object') {
      this.updateState({ size: widthOrSize });
    } else {
      this.updateState({ size: { width: widthOrSize, height: height! } });
    }
  }

  async innerSize(): Promise<{ width: number; height: number }> {
    return this.getState().size;
  }

  async outerSize(): Promise<{ width: number; height: number }> {
    return this.getState().size;
  }

  async setMinSize(_size: { width: number; height: number }): Promise<void> {
    // No-op for mocks
  }

  async setMaxSize(_size: { width: number; height: number }): Promise<void> {
    // No-op for mocks
  }

  // Center
  async center(): Promise<void> {
    const monitor = mockMonitors[0];
    const size = this.getState().size;
    this.updateState({
      position: {
        x: monitor.position.x + (monitor.size.width - size.width) / 2,
        y: monitor.position.y + (monitor.size.height - size.height) / 2,
      },
    });
  }

  // Scale factor
  async scaleFactor(): Promise<number> {
    return this.getState().scaleFactor;
  }

  // Title
  async setTitle(_title: string): Promise<void> {
    // No-op for mocks
  }

  // Decorations
  async setDecorations(_decorations: boolean): Promise<void> {
    // No-op for mocks
  }

  // Resizable
  async setResizable(_resizable: boolean): Promise<void> {
    // No-op for mocks
  }

  // Always on top
  async setAlwaysOnTop(_alwaysOnTop: boolean): Promise<void> {
    // No-op for mocks
  }
}

// ============================================================================
// Mock Invoke
// ============================================================================

/**
 * Mock implementation of Tauri invoke function
 */
export async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const handler = invokeResponses[cmd];

  if (handler === undefined) {
    throw new Error(`Unhandled invoke command: ${cmd}`);
  }

  if (typeof handler === 'function') {
    return handler(args || {}) as T;
  }

  return handler as T;
}

// ============================================================================
// Mock availableMonitors
// ============================================================================

/**
 * Mock implementation of availableMonitors
 */
export async function mockAvailableMonitors(): Promise<MockMonitor[]> {
  return [...mockMonitors];
}

/**
 * Mock implementation of currentMonitor
 */
export async function mockCurrentMonitor(): Promise<MockMonitor | null> {
  return mockMonitors[0] || null;
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Configure mock invoke responses
 */
export function mockInvokeResponse(config: MockInvokeConfig): void {
  invokeResponses = { ...invokeResponses, ...config };
}

/**
 * Set a single mock invoke response
 */
export function setMockInvokeResponse(
  command: string,
  response: unknown | ((args: Record<string, unknown>) => unknown)
): void {
  invokeResponses[command] = response;
}

/**
 * Configure mock monitors
 */
export function setMockMonitors(monitors: MockMonitor[]): void {
  mockMonitors = monitors;
}

/**
 * Add a mock window
 */
export function addMockWindow(label: string, state?: Partial<MockWindowState>): MockWindow {
  const defaultState: MockWindowState = {
    label,
    isVisible: true,
    isMaximized: false,
    isMinimized: false,
    isFocused: false,
    position: { x: 100, y: 100 },
    size: { width: 800, height: 600 },
    scaleFactor: 1,
    ...state,
  };
  mockWindows.set(label, defaultState);
  return new MockWindow(label);
}

/**
 * Get a mock window's state
 */
export function getMockWindowState(label: string): MockWindowState | undefined {
  return mockWindows.get(label);
}

/**
 * Set the current window label
 */
export function setCurrentWindow(label: string): void {
  currentWindowLabel = label;
}

/**
 * Get all mock windows
 */
export function getAllMockWindows(): Map<string, MockWindowState> {
  return new Map(mockWindows);
}

/**
 * Reset all Tauri mocks to initial state
 */
export function resetTauriMocks(): void {
  mockWindows.clear();
  invokeResponses = {};
  mockMonitors = [
    {
      name: 'Primary',
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      scaleFactor: 1,
    },
  ];
  currentWindowLabel = 'main';
}

// ============================================================================
// Vitest Module Mock Setup
// ============================================================================

/**
 * Setup Tauri mocks for Vitest.
 * Call this in your test setup or beforeEach.
 */
export function setupTauriMocks(): void {
  // Mock @tauri-apps/api/window
  vi.mock('@tauri-apps/api/window', () => ({
    Window: MockWindow,
    availableMonitors: mockAvailableMonitors,
    currentMonitor: mockCurrentMonitor,
  }));

  // Mock @tauri-apps/api/core
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke,
  }));
}

/**
 * Create common floating window invoke responses
 */
export function setupFloatingWindowMocks(): void {
  mockInvokeResponse({
    create_floating_window: (args: Record<string, unknown>) => {
      const { panel_id, bounds } = args as { panel_id: string; bounds: Bounds };
      const windowId = `floating-${panel_id}`;
      addMockWindow(windowId, {
        position: { x: bounds.x, y: bounds.y },
        size: { width: bounds.width, height: bounds.height },
      });
      return windowId;
    },
    close_floating_window: (args: Record<string, unknown>) => {
      const { window_id } = args as { window_id: string };
      mockWindows.delete(window_id);
      return null;
    },
    list_floating_windows: () => {
      return Array.from(mockWindows.keys())
        .filter((label) => label.startsWith('floating-'))
        .map((label) => {
          const state = mockWindows.get(label)!;
          return {
            windowId: label,
            bounds: {
              x: state.position.x,
              y: state.position.y,
              width: state.size.width,
              height: state.size.height,
            },
          };
        });
    },
  });
}
