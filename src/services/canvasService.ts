/**
 * Canvas Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for circuit file operations and integrates with the serialization utilities.
 */

import { invoke } from '@tauri-apps/api/core';
import type { CircuitState } from '../components/OneCanvas/types';
import {
  circuitToYaml,
  yamlToCircuit,
  createDefaultCircuit,
  CircuitValidationError,
} from '../components/OneCanvas/utils/serialization';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown by canvas service operations.
 */
export class CanvasServiceError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CanvasServiceError';
  }
}

// ============================================================================
// Canvas Service
// ============================================================================

/**
 * Service for circuit file operations.
 */
export const canvasService = {
  /**
   * Save a circuit to a file.
   *
   * @param path - Full path to the circuit file (.yaml)
   * @param state - Circuit state to save
   * @throws CanvasServiceError if save fails
   */
  async saveCircuit(path: string, state: CircuitState): Promise<void> {
    try {
      // Serialize to YAML
      const yamlContent = circuitToYaml(state);

      // Call Tauri command
      await invoke('canvas_save_circuit', { path, content: yamlContent });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CanvasServiceError(
        `Failed to save circuit: ${message}`,
        'saveCircuit',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Load a circuit from a file.
   *
   * @param path - Full path to the circuit file (.yaml)
   * @returns The loaded circuit state
   * @throws CanvasServiceError if load fails
   * @throws CircuitValidationError if the YAML is invalid
   */
  async loadCircuit(path: string): Promise<CircuitState> {
    try {
      // Call Tauri command
      const yamlContent = await invoke<string>('canvas_load_circuit', { path });

      // Parse YAML to circuit state
      return yamlToCircuit(yamlContent);
    } catch (error) {
      // Re-throw validation errors as-is
      if (error instanceof CircuitValidationError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CanvasServiceError(
        `Failed to load circuit: ${message}`,
        'loadCircuit',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Create a new circuit file with default content.
   *
   * @param name - Name for the new circuit
   * @param path - Full path where to save the circuit file
   * @throws CanvasServiceError if creation fails
   */
  async createCircuit(name: string, path: string): Promise<void> {
    try {
      await invoke('canvas_create_circuit', { name, path });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CanvasServiceError(
        `Failed to create circuit: ${message}`,
        'createCircuit',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * List all circuit files in a directory.
   *
   * @param dir - Directory path to search
   * @returns Array of circuit file paths
   */
  async listCircuits(dir: string): Promise<string[]> {
    try {
      return await invoke<string[]>('canvas_list_circuits', { dir });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CanvasServiceError(
        `Failed to list circuits: ${message}`,
        'listCircuits',
        dir,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Delete a circuit file.
   *
   * @param path - Full path to the circuit file to delete
   */
  async deleteCircuit(path: string): Promise<void> {
    try {
      await invoke('canvas_delete_circuit', { path });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CanvasServiceError(
        `Failed to delete circuit: ${message}`,
        'deleteCircuit',
        path,
        error instanceof Error ? error : undefined
      );
    }
  },

  /**
   * Check if a circuit file exists.
   *
   * @param path - Full path to check
   * @returns true if file exists, false otherwise
   */
  async circuitExists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('canvas_circuit_exists', { path });
    } catch {
      return false;
    }
  },

  /**
   * Create an empty circuit state in memory (without saving to file).
   *
   * @param name - Name for the circuit
   * @returns A new default circuit state
   */
  createEmptyCircuit(name: string): CircuitState {
    return createDefaultCircuit(name);
  },
};

export default canvasService;
