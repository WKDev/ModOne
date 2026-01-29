/**
 * OneSim Type Definitions
 *
 * TypeScript types for the PLC simulation engine (OneSim).
 */

// ============================================================================
// Simulation Status Types
// ============================================================================

/** Simulation running status */
export type SimStatus = 'stopped' | 'running' | 'paused' | 'error';

/** Step execution type */
export type StepType = 'network' | 'scan';

/** Breakpoint types */
export type BreakpointType = 'network' | 'device' | 'condition' | 'scanCount';

// ============================================================================
// Timing & Stats Types
// ============================================================================

/** Scan timing information */
export interface ScanTiming {
  /** Current scan duration in milliseconds */
  current: number;
  /** Average scan duration in milliseconds */
  average: number;
  /** Minimum scan duration in milliseconds */
  min: number;
  /** Maximum scan duration in milliseconds */
  max: number;
}

/** Simulation statistics */
export interface SimStats {
  /** Total scan count */
  scanCount: number;
  /** Current network ID being executed */
  currentNetworkId: number | null;
  /** Scan timing information */
  timing: ScanTiming;
  /** Whether watchdog has triggered */
  watchdogTriggered: boolean;
}

// ============================================================================
// Breakpoint Types
// ============================================================================

/** Breakpoint hit information */
export interface BreakpointHit {
  /** Type of breakpoint that was hit */
  type: 'network' | 'device' | 'condition' | 'scanCount';
  /** Breakpoint ID */
  breakpointId: string;
  /** Network ID (for network breakpoints) */
  networkId?: number;
  /** Device address (for device breakpoints) */
  address?: string;
  /** Old value (for device breakpoints) */
  oldValue?: unknown;
  /** New value (for device breakpoints) */
  newValue?: unknown;
  /** Condition expression (for condition breakpoints) */
  condition?: string;
  /** Scan count (for scan count breakpoints) */
  scanCount?: number;
}

/** Breakpoint definition */
export interface Breakpoint {
  /** Unique breakpoint ID */
  id: string;
  /** Breakpoint type */
  breakpointType: BreakpointType;
  /** Whether breakpoint is enabled */
  enabled: boolean;
  /** Network ID (for network breakpoints) */
  networkId?: number;
  /** Device address (for device breakpoints) */
  deviceAddress?: string;
  /** Condition expression (for condition breakpoints) */
  condition?: string;
  /** Target scan count (for scan count breakpoints) */
  scanCount?: number;
  /** Hit count */
  hitCount: number;
}

// ============================================================================
// Watch Variable Types
// ============================================================================

/** Value history entry */
export interface ValueHistoryEntry {
  /** Value at this point */
  value: unknown;
  /** Timestamp in epoch milliseconds */
  timestamp: number;
}

/** Watch variable information */
export interface WatchVariable {
  /** Device address */
  address: string;
  /** Current value */
  currentValue: unknown;
  /** Previous value */
  previousValue: unknown;
  /** Number of times value has changed */
  changeCount: number;
  /** Last change timestamp in epoch milliseconds */
  lastChangeTime: number;
  /** Value history (newest first) */
  history: ValueHistoryEntry[];
}

// ============================================================================
// Step Result Types
// ============================================================================

/** Result of a step operation */
export interface StepResult {
  /** Whether the step completed successfully */
  success: boolean;
  /** The step type that was executed */
  stepType: StepType;
  /** Network ID that was executed (for network step) */
  networkId?: number;
  /** Current scan count after step */
  scanCount: number;
  /** Breakpoint hit during step (if any) */
  breakpointHit?: BreakpointHit;
}

// ============================================================================
// Debugger State Types
// ============================================================================

/** Complete debugger state */
export interface DebuggerState {
  /** Whether step mode is enabled */
  stepMode: boolean;
  /** Current step type */
  stepType: StepType;
  /** Current pause state (null if not paused) */
  pausedAt: BreakpointHit | null;
  /** All breakpoints */
  breakpoints: Breakpoint[];
  /** All watch variables */
  watches: WatchVariable[];
}

// ============================================================================
// Simulation State Types
// ============================================================================

/** Complete simulation state for the UI */
export interface SimState {
  /** Simulation status */
  status: SimStatus;
  /** Simulation statistics */
  stats: SimStats;
  /** Debugger state */
  debugger: DebuggerState;
}

// ============================================================================
// Event Payload Types
// ============================================================================

/** Simulation status update event payload */
export interface SimStatusUpdatePayload {
  /** Current status */
  status: SimStatus;
  /** Updated stats */
  stats: SimStats;
}

/** Breakpoint hit event payload */
export interface BreakpointHitPayload {
  /** Breakpoint hit information */
  hit: BreakpointHit;
}

/** Scan complete event payload */
export interface ScanCompletePayload {
  /** Scan count */
  scanCount: number;
  /** Scan duration in milliseconds */
  duration: number;
}
