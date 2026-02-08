/**
 * Scenario Commands
 *
 * Commands for scenario control: run, pause, resume, stop, file operations.
 * Uses Tauri invoke for backend integration and scenarioStore for state.
 */

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Play, Pause, Square, FilePlus, FolderOpen, Save, Download, Upload } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { scenarioService } from '../../../services/scenarioService';
import type { Command } from '../types';
import type { BackendScenario, BackendScenarioSettings } from '../../../types/scenario';

/**
 * Convert frontend scenario to backend format for Tauri invoke
 */
function toBackendScenario(): BackendScenario | null {
  const state = useScenarioStore.getState();
  const scenario = state.scenario;
  if (!scenario) return null;

  const settings: BackendScenarioSettings = {
    loopEnabled: scenario.settings.loop,
    loopCount: scenario.settings.loopCount,
    loopDelay: scenario.settings.loopDelay,
    autoStart: scenario.settings.autoStart,
  };

  return {
    metadata: scenario.metadata,
    settings,
    events: scenario.events,
  };
}

/**
 * Register all scenario-related commands.
 */
export function registerScenarioCommands(): void {
  const commands: Command[] = [
    // ========================================================================
    // File Operations
    // ========================================================================
    {
      id: 'scenario.new',
      category: 'scenario',
      label: 'New Scenario',
      description: 'Create a new empty scenario',
      icon: <FilePlus size={16} />,
      shortcut: 'Ctrl+Alt+N',
      keywords: ['new', 'create', 'scenario', 'empty'],
      execute: () => {
        useScenarioStore.getState().newScenario();
      },
    },
    {
      id: 'scenario.open',
      category: 'scenario',
      label: 'Open Scenario',
      description: 'Open a scenario file',
      icon: <FolderOpen size={16} />,
      shortcut: 'Ctrl+Alt+O',
      keywords: ['open', 'load', 'scenario', 'file'],
      execute: async () => {
        try {
          const selected = await open({
            title: 'Open Scenario',
            filters: [{ name: 'Scenario', extensions: ['json'] }],
            multiple: false,
          });
          if (selected) {
            const scenario = await scenarioService.load(selected as string);
            useScenarioStore.getState().loadScenario(scenario, selected as string);
          }
        } catch (error) {
          console.error('Failed to open scenario:', error);
        }
      },
    },
    {
      id: 'scenario.save',
      category: 'scenario',
      label: 'Save Scenario',
      description: 'Save the current scenario',
      icon: <Save size={16} />,
      shortcut: 'Ctrl+Alt+S',
      keywords: ['save', 'scenario', 'file'],
      execute: async () => {
        try {
          const state = useScenarioStore.getState();
          const scenario = state.scenario;
          if (!scenario) return;

          if (state.filePath) {
            await scenarioService.save(state.filePath, scenario);
            state.markClean();
          } else {
            // Trigger save as if no path exists
            const selected = await save({
              title: 'Save Scenario',
              filters: [{ name: 'Scenario', extensions: ['json'] }],
              defaultPath: `${scenario.metadata.name || 'scenario'}.json`,
            });
            if (selected) {
              await scenarioService.save(selected, scenario);
              state.setFilePath(selected);
              state.markClean();
            }
          }
        } catch (error) {
          console.error('Failed to save scenario:', error);
        }
      },
    },
    {
      id: 'scenario.saveAs',
      category: 'scenario',
      label: 'Save Scenario As...',
      description: 'Save the scenario to a new file',
      icon: <Save size={16} />,
      shortcut: 'Ctrl+Alt+Shift+S',
      keywords: ['save', 'as', 'scenario', 'file', 'export'],
      execute: async () => {
        try {
          const state = useScenarioStore.getState();
          const scenario = state.scenario;
          if (!scenario) return;

          const selected = await save({
            title: 'Save Scenario As',
            filters: [{ name: 'Scenario', extensions: ['json'] }],
            defaultPath: `${scenario.metadata.name || 'scenario'}.json`,
          });
          if (selected) {
            await scenarioService.save(selected, scenario);
            state.setFilePath(selected);
            state.markClean();
          }
        } catch (error) {
          console.error('Failed to save scenario:', error);
        }
      },
    },
    {
      id: 'scenario.importCsv',
      category: 'scenario',
      label: 'Import CSV',
      description: 'Import scenario events from a CSV file',
      icon: <Upload size={16} />,
      keywords: ['import', 'csv', 'scenario', 'events'],
      execute: async () => {
        try {
          const selected = await open({
            title: 'Import Scenario CSV',
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            multiple: false,
          });
          if (selected) {
            const events = await scenarioService.importCSV(selected as string);
            const store = useScenarioStore.getState();
            events.forEach((event) => store.addEvent(event));
          }
        } catch (error) {
          console.error('Failed to import CSV:', error);
        }
      },
    },
    {
      id: 'scenario.exportCsv',
      category: 'scenario',
      label: 'Export CSV',
      description: 'Export scenario events to a CSV file',
      icon: <Download size={16} />,
      keywords: ['export', 'csv', 'scenario', 'events'],
      execute: async () => {
        try {
          const state = useScenarioStore.getState();
          const scenario = state.scenario;
          if (!scenario) return;

          const selected = await save({
            title: 'Export Scenario CSV',
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            defaultPath: `${scenario.metadata.name || 'scenario'}.csv`,
          });
          if (selected) {
            await scenarioService.exportCSV(selected, scenario.events);
          }
        } catch (error) {
          console.error('Failed to export CSV:', error);
        }
      },
    },

    // ========================================================================
    // Execution Controls
    // ========================================================================
    {
      id: 'scenario.run',
      category: 'scenario',
      label: 'Run Scenario',
      description: 'Start scenario execution',
      icon: <Play size={16} />,
      shortcut: 'Ctrl+F5',
      keywords: ['run', 'start', 'execute', 'scenario', 'play'],
      when: () => {
        const status = useScenarioStore.getState().executionState.status;
        return status !== 'running';
      },
      execute: async () => {
        try {
          const backendScenario = toBackendScenario();
          if (!backendScenario) return;

          await invoke('scenario_run', { scenario: backendScenario });
          useScenarioStore.getState().setExecutionState({ status: 'running' });
        } catch (error) {
          console.error('Failed to run scenario:', error);
        }
      },
    },
    {
      id: 'scenario.pause',
      category: 'scenario',
      label: 'Pause Scenario',
      description: 'Pause scenario execution',
      icon: <Pause size={16} />,
      shortcut: 'Ctrl+F6',
      keywords: ['pause', 'scenario', 'freeze'],
      when: () => useScenarioStore.getState().executionState.status === 'running',
      execute: async () => {
        try {
          await invoke('scenario_pause');
          useScenarioStore.getState().setExecutionState({ status: 'paused' });
        } catch (error) {
          console.error('Failed to pause scenario:', error);
        }
      },
    },
    {
      id: 'scenario.resume',
      category: 'scenario',
      label: 'Resume Scenario',
      description: 'Resume paused scenario execution',
      icon: <Play size={16} />,
      shortcut: 'Ctrl+F6',
      keywords: ['resume', 'continue', 'scenario'],
      when: () => useScenarioStore.getState().executionState.status === 'paused',
      execute: async () => {
        try {
          await invoke('scenario_resume');
          useScenarioStore.getState().setExecutionState({ status: 'running' });
        } catch (error) {
          console.error('Failed to resume scenario:', error);
        }
      },
    },
    {
      id: 'scenario.stop',
      category: 'scenario',
      label: 'Stop Scenario',
      description: 'Stop scenario execution',
      icon: <Square size={16} />,
      shortcut: 'Ctrl+Shift+F5',
      keywords: ['stop', 'halt', 'end', 'scenario'],
      when: () => {
        const status = useScenarioStore.getState().executionState.status;
        return status === 'running' || status === 'paused';
      },
      execute: async () => {
        try {
          await invoke('scenario_stop');
          useScenarioStore.getState().resetExecution();
        } catch (error) {
          console.error('Failed to stop scenario:', error);
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
