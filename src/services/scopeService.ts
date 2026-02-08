/**
 * Scope Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for oscilloscope functionality and scope-simulation integration.
 */

import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Display data for a single scope channel
 */
export interface ChannelDisplayData {
  index: number;
  points: [number, number][];
  min: number;
  max: number;
  average: number;
}

/**
 * Complete scope display data for frontend rendering
 */
export interface ScopeDisplayData {
  channels: ChannelDisplayData[];
  triggered: boolean;
  triggerPosition: number;
  timePerDiv: number;
}

/**
 * Trigger mode for the scope
 */
export type TriggerMode = 'auto' | 'normal' | 'single';

/**
 * Trigger edge detection type
 */
export type TriggerEdge = 'rising' | 'falling';

/**
 * Scope run mode
 */
export type RunMode = 'run' | 'stop';

/**
 * Scope settings configuration
 */
export interface ScopeSettings {
  timeBase: number;
  triggerMode: TriggerMode;
  triggerChannel: number;
  triggerLevel: number;
  triggerEdge: TriggerEdge;
  runMode: RunMode;
}

/**
 * Mapping between a scope channel and a device address
 */
export interface ScopeChannelMapping {
  /** Scope block ID */
  scopeId: string;
  /** Channel index (0-based) */
  channel: number;
  /** Device type (M, P, K, D, etc.) */
  deviceType: string;
  /** Device address number */
  address: number;
  /** Voltage scale factor */
  scale: number;
  /** Voltage offset */
  offset: number;
  /** Whether this channel is enabled */
  enabled: boolean;
  /** Optional label for display */
  label?: string;
}

/**
 * Result of sampling all scope channels
 */
export interface ScopeSampleResult {
  samplesAdded: number;
  channelsSkipped: number;
  errors: string[];
}

// ============================================================================
// Scope Service
// ============================================================================

/**
 * Service for oscilloscope operations and scope-simulation integration.
 */
export const scopeService = {
  // ==========================================================================
  // Scope Lifecycle
  // ==========================================================================

  /**
   * Create a new scope engine instance.
   *
   * @param scopeId - Unique identifier for the scope (typically block ID)
   * @param channels - Number of input channels (1-4 typical)
   * @param bufferSize - Optional buffer size (default: 1000 samples)
   * @param sampleRate - Optional sample rate in Hz (default: 1000)
   */
  async create(
    scopeId: string,
    channels: number,
    bufferSize?: number,
    sampleRate?: number
  ): Promise<void> {
    await invoke('scope_create', {
      scopeId,
      channels,
      bufferSize,
      sampleRate,
    });
  },

  /**
   * Delete a scope instance.
   *
   * @param scopeId - The scope identifier
   */
  async delete(scopeId: string): Promise<void> {
    await invoke('scope_delete', { scopeId });
  },

  /**
   * Check if a scope exists.
   *
   * @param scopeId - The scope identifier
   * @returns true if scope exists
   */
  async exists(scopeId: string): Promise<boolean> {
    return await invoke<boolean>('scope_exists', { scopeId });
  },

  /**
   * List all active scope IDs.
   *
   * @returns Array of scope IDs
   */
  async list(): Promise<string[]> {
    return await invoke<string[]>('scope_list');
  },

  // ==========================================================================
  // Scope Control
  // ==========================================================================

  /**
   * Start or stop scope capture.
   *
   * @param scopeId - The scope identifier
   * @param run - true to run, false to stop
   */
  async runStop(scopeId: string, run: boolean): Promise<void> {
    await invoke('scope_run_stop', { scopeId, run });
  },

  /**
   * Reset a scope, clearing all buffers and trigger state.
   *
   * @param scopeId - The scope identifier
   */
  async reset(scopeId: string): Promise<void> {
    await invoke('scope_reset', { scopeId });
  },

  /**
   * Re-arm the trigger for a scope.
   *
   * @param scopeId - The scope identifier
   */
  async armTrigger(scopeId: string): Promise<void> {
    await invoke('scope_arm_trigger', { scopeId });
  },

  /**
   * Update scope settings.
   *
   * @param scopeId - The scope identifier
   * @param settings - New scope settings
   */
  async updateSettings(scopeId: string, settings: ScopeSettings): Promise<void> {
    await invoke('scope_update_settings', { scopeId, settings });
  },

  // ==========================================================================
  // Data Access
  // ==========================================================================

  /**
   * Get display data from a scope for rendering.
   *
   * @param scopeId - The scope identifier
   * @returns ScopeDisplayData with channel points, statistics, and trigger info
   */
  async getData(scopeId: string): Promise<ScopeDisplayData> {
    return await invoke<ScopeDisplayData>('scope_get_data', { scopeId });
  },

  /**
   * Add a voltage sample to a scope channel.
   *
   * @param scopeId - The scope identifier
   * @param channel - Channel index (0-based)
   * @param voltage - Voltage value to add
   */
  async addSample(scopeId: string, channel: number, voltage: number): Promise<void> {
    await invoke('scope_add_sample', { scopeId, channel, voltage });
  },

  /**
   * Add multiple voltage samples to a scope (batch operation).
   *
   * @param scopeId - The scope identifier
   * @param samples - Array of [channel, voltage] tuples
   */
  async addSamples(scopeId: string, samples: [number, number][]): Promise<void> {
    await invoke('scope_add_samples', { scopeId, samples });
  },

  // ==========================================================================
  // Scope-Simulation Integration
  // ==========================================================================

  /**
   * Register a scope channel mapping to link a device address to a scope channel.
   *
   * @param mapping - The channel mapping configuration
   */
  async registerMapping(mapping: ScopeChannelMapping): Promise<void> {
    await invoke('scope_register_mapping', { mapping });
  },

  /**
   * Register multiple scope channel mappings at once.
   *
   * @param mappings - Array of channel mapping configurations
   */
  async registerMappings(mappings: ScopeChannelMapping[]): Promise<void> {
    await invoke('scope_register_mappings', { newMappings: mappings });
  },

  /**
   * Remove a scope channel mapping.
   *
   * @param scopeId - The scope identifier
   * @param channel - The channel index to remove mapping for
   */
  async removeMapping(scopeId: string, channel: number): Promise<void> {
    await invoke('scope_remove_mapping', { scopeId, channel });
  },

  /**
   * Clear all mappings for a specific scope.
   *
   * @param scopeId - The scope identifier
   * @returns Number of mappings removed
   */
  async clearMappings(scopeId: string): Promise<number> {
    return await invoke<number>('scope_clear_mappings', { scopeId });
  },

  /**
   * Get all channel mappings for a scope.
   *
   * @param scopeId - Optional scope ID (returns all if not specified)
   * @returns Array of channel mappings
   */
  async getMappings(scopeId?: string): Promise<ScopeChannelMapping[]> {
    return await invoke<ScopeChannelMapping[]>('scope_get_mappings', { scopeId });
  },

  /**
   * Sample all registered scope channels from simulation memory.
   *
   * This should be called each simulation scan cycle to update scope displays
   * with current device values.
   *
   * @returns ScopeSampleResult with count of samples added and any errors
   */
  async tick(): Promise<ScopeSampleResult> {
    return await invoke<ScopeSampleResult>('scope_tick');
  },

  /**
   * Read a single device value as voltage without adding to scope.
   *
   * Useful for getting current value for display or debugging.
   *
   * @param deviceType - Device type (M, P, K, D, etc.)
   * @param address - Device address number
   * @param scale - Optional voltage scale
   * @param offset - Optional voltage offset
   * @returns Voltage value
   */
  async readDeviceVoltage(
    deviceType: string,
    address: number,
    scale?: number,
    offset?: number
  ): Promise<number> {
    return await invoke<number>('scope_read_device_voltage', {
      deviceType,
      address,
      scale,
      offset,
    });
  },

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Create a mapping for a bit device (M, P, K, F, T, C).
   *
   * For bit devices, the voltage will be:
   * - `scale` volts when the bit is true (default: 5V)
   * - `0` volts when the bit is false
   *
   * @param scopeId - The scope identifier
   * @param channel - Channel index (0-based)
   * @param deviceType - Device type (M, P, K, F, T, C)
   * @param address - Device address number
   * @param options - Optional settings (scale, offset, enabled, label)
   */
  createBitMapping(
    scopeId: string,
    channel: number,
    deviceType: string,
    address: number,
    options?: {
      scale?: number;
      offset?: number;
      enabled?: boolean;
      label?: string;
    }
  ): ScopeChannelMapping {
    return {
      scopeId,
      channel,
      deviceType: deviceType.toUpperCase(),
      address,
      scale: options?.scale ?? 5.0, // 5V logic high by default
      offset: options?.offset ?? 0.0,
      enabled: options?.enabled ?? true,
      label: options?.label,
    };
  },

  /**
   * Create a mapping for a word device (D, R, Z, N, TD, CD).
   *
   * For word devices, the voltage will be: value * scale + offset
   *
   * @param scopeId - The scope identifier
   * @param channel - Channel index (0-based)
   * @param deviceType - Device type (D, R, Z, N, TD, CD)
   * @param address - Device address number
   * @param options - Optional settings (scale, offset, enabled, label)
   */
  createWordMapping(
    scopeId: string,
    channel: number,
    deviceType: string,
    address: number,
    options?: {
      scale?: number;
      offset?: number;
      enabled?: boolean;
      label?: string;
    }
  ): ScopeChannelMapping {
    return {
      scopeId,
      channel,
      deviceType: deviceType.toUpperCase(),
      address,
      scale: options?.scale ?? 0.001, // 1mV per unit by default
      offset: options?.offset ?? 0.0,
      enabled: options?.enabled ?? true,
      label: options?.label,
    };
  },
};

export default scopeService;
