/**
 * Simulation Commands
 *
 * Commands for simulation control: start, stop, pause, step.
 * Uses simulationService for Tauri backend integration and state management.
 */

import { Play, Square, Pause, SkipForward, RefreshCw } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { simulationService } from '../../../services/simulationService';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { Command } from '../types';

/**
 * Register all simulation-related commands.
 */
export function registerSimulationCommands(): void {
  const commands: Command[] = [
    {
      id: 'simulation.start',
      category: 'simulation',
      label: 'Start Simulation',
      description: 'Start the PLC simulation',
      icon: <Play size={16} />,
      shortcut: 'F5',
      keywords: ['run', 'start', 'execute', 'simulation'],
      when: () => useLayoutStore.getState().simulationStatus !== 'running',
      execute: async () => {
        try {
          await simulationService.start();
        } catch (error) {
          console.error('Failed to start simulation:', error);
        }
      },
    },
    {
      id: 'simulation.stop',
      category: 'simulation',
      label: 'Stop Simulation',
      description: 'Stop the PLC simulation',
      icon: <Square size={16} />,
      shortcut: 'Shift+F5',
      keywords: ['stop', 'halt', 'end', 'simulation'],
      when: () => useLayoutStore.getState().simulationStatus !== 'stopped',
      execute: async () => {
        try {
          await simulationService.stop();
        } catch (error) {
          console.error('Failed to stop simulation:', error);
        }
      },
    },
    {
      id: 'simulation.pause',
      category: 'simulation',
      label: 'Pause Simulation',
      description: 'Pause the running simulation',
      icon: <Pause size={16} />,
      shortcut: 'F6',
      keywords: ['pause', 'freeze', 'simulation'],
      when: () => useLayoutStore.getState().simulationStatus === 'running',
      execute: async () => {
        try {
          await simulationService.pause();
        } catch (error) {
          console.error('Failed to pause simulation:', error);
        }
      },
    },
    {
      id: 'simulation.resume',
      category: 'simulation',
      label: 'Resume Simulation',
      description: 'Resume the paused simulation',
      icon: <Play size={16} />,
      shortcut: 'F6',
      keywords: ['resume', 'continue', 'simulation'],
      when: () => useLayoutStore.getState().simulationStatus === 'paused',
      execute: async () => {
        try {
          await simulationService.resume();
        } catch (error) {
          console.error('Failed to resume simulation:', error);
        }
      },
    },
    {
      id: 'simulation.step',
      category: 'simulation',
      label: 'Step',
      description: 'Execute one scan cycle',
      icon: <SkipForward size={16} />,
      shortcut: 'F10',
      keywords: ['step', 'single', 'cycle', 'scan'],
      when: () => useLayoutStore.getState().simulationStatus === 'paused',
      execute: async () => {
        try {
          await simulationService.step();
        } catch (error) {
          console.error('Failed to step simulation:', error);
        }
      },
    },
    {
      id: 'simulation.reset',
      category: 'simulation',
      label: 'Reset Simulation',
      description: 'Reset simulation to initial state',
      icon: <RefreshCw size={16} />,
      shortcut: 'Ctrl+Shift+F5',
      keywords: ['reset', 'clear', 'restart'],
      execute: async () => {
        try {
          await simulationService.reset();
        } catch (error) {
          console.error('Failed to reset simulation:', error);
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
