/**
 * Debug Commands
 *
 * Commands for debugging: breakpoints, stepping, watch list management.
 * Provides debug controls for ladder logic and canvas simulation.
 */

import {
  Circle,
  CircleDot,
  Play,
  Pause,
  Square,
  SkipForward,
  StepForward,
  StepBack,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  XCircle,
} from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { simulationService } from '../../../services/simulationService';
import { useLayoutStore } from '../../../stores/layoutStore';
import type { Command } from '../types';

/**
 * Check if simulation is in a debuggable paused state.
 */
function isDebuggingPaused(): boolean {
  return useLayoutStore.getState().simulationStatus === 'paused';
}

/**
 * Check if simulation is running (can be paused).
 */
function isSimulationRunning(): boolean {
  return useLayoutStore.getState().simulationStatus === 'running';
}

/**
 * Check if simulation is active (running or paused).
 */
function isSimulationActive(): boolean {
  const status = useLayoutStore.getState().simulationStatus;
  return status === 'running' || status === 'paused';
}

/**
 * Register all debug-related commands.
 */
export function registerDebugCommands(): void {
  const commands: Command[] = [
    // ========================================================================
    // Breakpoint Commands
    // ========================================================================
    {
      id: 'debug.toggleBreakpoint',
      category: 'debug',
      label: 'Toggle Breakpoint',
      description: 'Toggle breakpoint at current element or line',
      icon: <CircleDot size={16} />,
      shortcut: 'F9',
      keywords: ['breakpoint', 'toggle', 'debug', 'stop'],
      execute: async () => {
        // TODO: Implement breakpoint toggle when breakpoint system is available
        console.debug('Toggle breakpoint - not yet implemented');
      },
    },
    {
      id: 'debug.clearAllBreakpoints',
      category: 'debug',
      label: 'Clear All Breakpoints',
      description: 'Remove all breakpoints from the program',
      icon: <XCircle size={16} />,
      shortcut: 'Ctrl+Shift+F9',
      keywords: ['breakpoint', 'clear', 'remove', 'all', 'debug'],
      execute: async () => {
        // TODO: Implement clear all breakpoints when breakpoint system is available
        console.debug('Clear all breakpoints - not yet implemented');
      },
    },
    {
      id: 'debug.enableAllBreakpoints',
      category: 'debug',
      label: 'Enable All Breakpoints',
      description: 'Enable all disabled breakpoints',
      icon: <Eye size={16} />,
      keywords: ['breakpoint', 'enable', 'activate', 'debug'],
      execute: async () => {
        // TODO: Implement enable all breakpoints when breakpoint system is available
        console.debug('Enable all breakpoints - not yet implemented');
      },
    },
    {
      id: 'debug.disableAllBreakpoints',
      category: 'debug',
      label: 'Disable All Breakpoints',
      description: 'Disable all breakpoints without removing them',
      icon: <EyeOff size={16} />,
      keywords: ['breakpoint', 'disable', 'deactivate', 'debug'],
      execute: async () => {
        // TODO: Implement disable all breakpoints when breakpoint system is available
        console.debug('Disable all breakpoints - not yet implemented');
      },
    },

    // ========================================================================
    // Execution Control Commands
    // ========================================================================
    {
      id: 'debug.continue',
      category: 'debug',
      label: 'Continue',
      description: 'Continue execution until next breakpoint',
      icon: <Play size={16} />,
      shortcut: 'F5',
      keywords: ['continue', 'run', 'resume', 'debug'],
      when: isDebuggingPaused,
      execute: async () => {
        try {
          await simulationService.resume();
        } catch (error) {
          console.error('Failed to continue:', error);
        }
      },
    },
    {
      id: 'debug.pause',
      category: 'debug',
      label: 'Pause',
      description: 'Pause execution at current position',
      icon: <Pause size={16} />,
      shortcut: 'F6',
      keywords: ['pause', 'break', 'stop', 'debug'],
      when: isSimulationRunning,
      execute: async () => {
        try {
          await simulationService.pause();
        } catch (error) {
          console.error('Failed to pause:', error);
        }
      },
    },
    {
      id: 'debug.stop',
      category: 'debug',
      label: 'Stop Debugging',
      description: 'Stop debugging and reset simulation',
      icon: <Square size={16} />,
      shortcut: 'Shift+F5',
      keywords: ['stop', 'end', 'terminate', 'debug'],
      when: isSimulationActive,
      execute: async () => {
        try {
          await simulationService.stop();
        } catch (error) {
          console.error('Failed to stop debugging:', error);
        }
      },
    },
    {
      id: 'debug.stepOver',
      category: 'debug',
      label: 'Step Over',
      description: 'Execute one instruction, stepping over function calls',
      icon: <SkipForward size={16} />,
      shortcut: 'F10',
      keywords: ['step', 'over', 'next', 'debug'],
      when: isDebuggingPaused,
      execute: async () => {
        try {
          await simulationService.step();
        } catch (error) {
          console.error('Failed to step over:', error);
        }
      },
    },
    {
      id: 'debug.stepInto',
      category: 'debug',
      label: 'Step Into',
      description: 'Step into function call',
      icon: <StepForward size={16} />,
      shortcut: 'F11',
      keywords: ['step', 'into', 'enter', 'debug'],
      when: isDebuggingPaused,
      execute: async () => {
        try {
          // For ladder logic, step into is same as step (no nested calls)
          await simulationService.step();
        } catch (error) {
          console.error('Failed to step into:', error);
        }
      },
    },
    {
      id: 'debug.stepOut',
      category: 'debug',
      label: 'Step Out',
      description: 'Step out of current function',
      icon: <StepBack size={16} />,
      shortcut: 'Shift+F11',
      keywords: ['step', 'out', 'return', 'debug'],
      when: isDebuggingPaused,
      execute: async () => {
        try {
          // For ladder logic, step out continues to end of rung
          await simulationService.resume();
        } catch (error) {
          console.error('Failed to step out:', error);
        }
      },
    },

    // ========================================================================
    // Watch List Commands
    // ========================================================================
    {
      id: 'debug.addWatch',
      category: 'debug',
      label: 'Add Watch Expression',
      description: 'Add a variable or expression to the watch list',
      icon: <Plus size={16} />,
      keywords: ['watch', 'add', 'variable', 'expression', 'debug'],
      execute: async () => {
        // TODO: Implement add watch when watch system is available
        // Could open a dialog to enter the expression
        console.debug('Add watch - not yet implemented');
      },
    },
    {
      id: 'debug.removeWatch',
      category: 'debug',
      label: 'Remove Watch',
      description: 'Remove selected watch expression',
      icon: <Trash2 size={16} />,
      keywords: ['watch', 'remove', 'delete', 'debug'],
      execute: async () => {
        // TODO: Implement remove watch when watch system is available
        console.debug('Remove watch - not yet implemented');
      },
    },
    {
      id: 'debug.clearWatches',
      category: 'debug',
      label: 'Clear All Watches',
      description: 'Remove all watch expressions',
      icon: <XCircle size={16} />,
      keywords: ['watch', 'clear', 'remove', 'all', 'debug'],
      execute: async () => {
        // TODO: Implement clear watches when watch system is available
        console.debug('Clear all watches - not yet implemented');
      },
    },

    // ========================================================================
    // Debug View Commands
    // ========================================================================
    {
      id: 'debug.showBreakpoints',
      category: 'debug',
      label: 'Show Breakpoints Panel',
      description: 'Open the breakpoints panel',
      icon: <Circle size={16} />,
      keywords: ['breakpoints', 'panel', 'view', 'debug'],
      execute: async () => {
        // TODO: Implement show breakpoints panel
        console.debug('Show breakpoints panel - not yet implemented');
      },
    },
    {
      id: 'debug.showWatchPanel',
      category: 'debug',
      label: 'Show Watch Panel',
      description: 'Open the watch expressions panel',
      icon: <Eye size={16} />,
      keywords: ['watch', 'panel', 'view', 'debug'],
      execute: async () => {
        // TODO: Implement show watch panel
        console.debug('Show watch panel - not yet implemented');
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
