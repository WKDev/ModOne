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
import { registerLadderCommands } from './ladderCommands';
import { registerSettingsCommands } from './settingsCommands';
import { registerHelpCommands } from './helpCommands';

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
  registerLadderCommands();
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
  registerLadderCommands,
  registerSettingsCommands,
  registerHelpCommands,
};
