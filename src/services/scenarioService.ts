/**
 * Scenario Service
 *
 * Frontend service for Tauri scenario file operations.
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import type { Scenario, ScenarioEvent } from '../types/scenario';

/**
 * Load a scenario from a JSON file
 */
export async function loadScenario(path: string): Promise<Scenario> {
  try {
    return await invoke<Scenario>('scenario_load', { path });
  } catch (error) {
    toast.error('Failed to load scenario', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Save a scenario to a JSON file
 */
export async function saveScenario(path: string, scenario: Scenario): Promise<void> {
  try {
    await invoke('scenario_save', { path, scenario });
  } catch (error) {
    toast.error('Failed to save scenario', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Import scenario events from a CSV file
 */
export async function importScenarioCSV(path: string): Promise<ScenarioEvent[]> {
  try {
    return await invoke<ScenarioEvent[]>('scenario_import_csv', { path });
  } catch (error) {
    toast.error('Failed to import scenario CSV', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Export scenario events to a CSV file
 */
export async function exportScenarioCSV(path: string, events: ScenarioEvent[]): Promise<void> {
  try {
    await invoke('scenario_export_csv', { path, events });
  } catch (error) {
    toast.error('Failed to export scenario CSV', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Create a new empty scenario file
 */
export async function createScenario(path: string, name: string): Promise<Scenario> {
  try {
    return await invoke<Scenario>('scenario_create', { path, name });
  } catch (error) {
    toast.error('Failed to create scenario', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * List scenario files in a directory
 */
export async function listScenarios(directory: string): Promise<string[]> {
  try {
    return await invoke<string[]>('scenario_list', { directory });
  } catch (error) {
    toast.error('Failed to list scenarios', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Delete a scenario file
 */
export async function deleteScenario(path: string): Promise<void> {
  try {
    await invoke('scenario_delete', { path });
  } catch (error) {
    toast.error('Failed to delete scenario', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check if a scenario file exists
 */
export async function scenarioExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('scenario_exists', { path });
  } catch (error) {
    toast.error('Failed to check scenario existence', {
      description: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Scenario service object with all methods
 */
export const scenarioService = {
  load: loadScenario,
  save: saveScenario,
  importCSV: importScenarioCSV,
  exportCSV: exportScenarioCSV,
  create: createScenario,
  list: listScenarios,
  delete: deleteScenario,
  exists: scenarioExists,
};

export default scenarioService;
