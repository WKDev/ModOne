/**
 * Scenario Service
 *
 * Frontend service for Tauri scenario file operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Scenario, ScenarioEvent } from '../types/scenario';

/**
 * Load a scenario from a JSON file
 */
export async function loadScenario(path: string): Promise<Scenario> {
  return await invoke<Scenario>('scenario_load', { path });
}

/**
 * Save a scenario to a JSON file
 */
export async function saveScenario(path: string, scenario: Scenario): Promise<void> {
  await invoke('scenario_save', { path, scenario });
}

/**
 * Import scenario events from a CSV file
 */
export async function importScenarioCSV(path: string): Promise<ScenarioEvent[]> {
  return await invoke<ScenarioEvent[]>('scenario_import_csv', { path });
}

/**
 * Export scenario events to a CSV file
 */
export async function exportScenarioCSV(path: string, events: ScenarioEvent[]): Promise<void> {
  await invoke('scenario_export_csv', { path, events });
}

/**
 * Create a new empty scenario file
 */
export async function createScenario(path: string, name: string): Promise<Scenario> {
  return await invoke<Scenario>('scenario_create', { path, name });
}

/**
 * List scenario files in a directory
 */
export async function listScenarios(directory: string): Promise<string[]> {
  return await invoke<string[]>('scenario_list', { directory });
}

/**
 * Delete a scenario file
 */
export async function deleteScenario(path: string): Promise<void> {
  await invoke('scenario_delete', { path });
}

/**
 * Check if a scenario file exists
 */
export async function scenarioExists(path: string): Promise<boolean> {
  return await invoke<boolean>('scenario_exists', { path });
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
