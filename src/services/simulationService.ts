/**
 * Simulation Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for simulation control. It also synchronizes the simulation status
 * with the layoutStore.
 */

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useLayoutStore } from '../stores/layoutStore';

/**
 * Simulation service for interacting with the Tauri backend
 * and keeping UI state synchronized.
 */
export const simulationService = {
  /**
   * Start the simulation
   * Calls sim_run and updates layoutStore to 'running'
   */
  async start(): Promise<void> {
    try {
      await invoke('sim_run');
      useLayoutStore.getState().setSimulationStatus('running');
    } catch (error) {
      toast.error('Failed to start simulation', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Stop the simulation
   * Calls sim_stop and updates layoutStore to 'stopped'
   */
  async stop(): Promise<void> {
    try {
      await invoke('sim_stop');
      useLayoutStore.getState().setSimulationStatus('stopped');
    } catch (error) {
      toast.error('Failed to stop simulation', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Pause the simulation
   * Calls sim_pause and updates layoutStore to 'paused'
   */
  async pause(): Promise<void> {
    try {
      await invoke('sim_pause');
      useLayoutStore.getState().setSimulationStatus('paused');
    } catch (error) {
      toast.error('Failed to pause simulation', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Resume the simulation from paused state
   * Calls sim_resume and updates layoutStore to 'running'
   */
  async resume(): Promise<void> {
    try {
      await invoke('sim_resume');
      useLayoutStore.getState().setSimulationStatus('running');
    } catch (error) {
      toast.error('Failed to resume simulation', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Execute a single scan cycle
   * Calls sim_step (only valid when paused)
   */
  async step(): Promise<void> {
    try {
      await invoke('sim_step');
    } catch (error) {
      toast.error('Failed to step simulation', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Reset the simulation to initial state
   * Calls sim_reset and updates layoutStore to 'stopped'
   */
  async reset(): Promise<void> {
    try {
      await invoke('sim_reset');
      useLayoutStore.getState().setSimulationStatus('stopped');
    } catch (error) {
      toast.error('Failed to reset simulation', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Load a ladder program for simulation
   * Must be called before start() to provide the program to execute
   */
  async loadProgram(program: unknown): Promise<void> {
    try {
      await invoke('sim_load_program', { program });
    } catch (error) {
      toast.error('Failed to load simulation program', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Get the current simulation status from the store
   */
  getStatus() {
    return useLayoutStore.getState().simulationStatus;
  },

  /**
   * Check if simulation is running
   */
  isRunning() {
    return this.getStatus() === 'running';
  },

  /**
   * Check if simulation is paused
   */
  isPaused() {
    return this.getStatus() === 'paused';
  },

  /**
   * Check if simulation is stopped
   */
  isStopped() {
    return this.getStatus() === 'stopped';
  },
};

export default simulationService;
