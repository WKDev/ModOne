/**
 * Command Registration
 *
 * Exports functions to register all application commands
 * for the command palette.
 */

import { registerFileCommands } from './fileCommands';
import { registerEditCommands } from './editCommands';
import { registerViewCommands } from './viewCommands';
import { registerSimulationCommands } from './simulationCommands';
import { registerScenarioCommands } from './scenarioCommands';
import { registerModbusCommands } from './modbusCommands';
import { registerLadderCommands } from './ladderCommands';
import { registerSettingsCommands } from './settingsCommands';
import { registerHelpCommands } from './helpCommands';
import { registerCanvasCommands } from './canvasCommands';
import { registerDebugCommands } from './debugCommands';

// Track whether commands have been registered
let commandsRegistered = false;

/**
 * Register all application commands with the command registry.
 * This function is idempotent - it will only register commands once.
 */
export function registerAllCommands(): void {
  if (commandsRegistered) {
    return;
  }

  // Register all command categories
  registerFileCommands();
  registerEditCommands();
  registerViewCommands();
  registerSimulationCommands();
  registerScenarioCommands();
  registerModbusCommands();
  registerLadderCommands();
  registerCanvasCommands();
  registerDebugCommands();
  registerSettingsCommands();
  registerHelpCommands();

  commandsRegistered = true;
}

/**
 * Reset the command registration state.
 * Primarily for testing purposes.
 */
export function resetCommandRegistration(): void {
  commandsRegistered = false;
}

// Re-export individual registration functions for granular use
export {
  registerFileCommands,
  registerEditCommands,
  registerViewCommands,
  registerSimulationCommands,
  registerScenarioCommands,
  registerModbusCommands,
  registerLadderCommands,
  registerCanvasCommands,
  registerDebugCommands,
  registerSettingsCommands,
  registerHelpCommands,
};
