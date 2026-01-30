/**
 * Simulation Commands
 *
 * Commands for simulation control: start, stop, pause, step.
 */

import { Play, Square, Pause, SkipForward, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { commandRegistry } from '../commandRegistry';
import type { Command } from '../types';

// Simple state check (will be replaced with actual store integration)
let simRunning = false;
let simPaused = false;

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
      when: () => !simRunning,
      execute: async () => {
        try {
          await invoke('sim_run');
          simRunning = true;
          simPaused = false;
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
      when: () => simRunning || simPaused,
      execute: async () => {
        try {
          await invoke('sim_stop');
          simRunning = false;
          simPaused = false;
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
      when: () => simRunning && !simPaused,
      execute: async () => {
        try {
          await invoke('sim_pause');
          simPaused = true;
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
      when: () => simPaused,
      execute: async () => {
        try {
          await invoke('sim_resume');
          simPaused = false;
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
      when: () => simPaused,
      execute: async () => {
        try {
          await invoke('sim_step');
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
          await invoke('sim_reset');
          simRunning = false;
          simPaused = false;
        } catch (error) {
          console.error('Failed to reset simulation:', error);
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
