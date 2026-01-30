/**
 * Simulation Service - Tauri Command Wrappers
 *
 * This service provides type-safe wrappers around Tauri backend commands
 * for simulation control. It also synchronizes the simulation status
 * with the layoutStore.
 */

import { invoke } from '@tauri-apps/api/core';
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
    await invoke('sim_run');
    useLayoutStore.getState().setSimulationStatus('running');
  },

  /**
   * Stop the simulation
   * Calls sim_stop and updates layoutStore to 'stopped'
   */
  async stop(): Promise<void> {
    await invoke('sim_stop');
    useLayoutStore.getState().setSimulationStatus('stopped');
  },

  /**
   * Pause the simulation
   * Calls sim_pause and updates layoutStore to 'paused'
   */
  async pause(): Promise<void> {
    await invoke('sim_pause');
    useLayoutStore.getState().setSimulationStatus('paused');
  },

  /**
   * Resume the simulation from paused state
   * Calls sim_resume and updates layoutStore to 'running'
   */
  async resume(): Promise<void> {
    await invoke('sim_resume');
    useLayoutStore.getState().setSimulationStatus('running');
  },

  /**
   * Execute a single scan cycle
   * Calls sim_step (only valid when paused)
   */
  async step(): Promise<void> {
    await invoke('sim_step');
  },

  /**
   * Reset the simulation to initial state
   * Calls sim_reset and updates layoutStore to 'stopped'
   */
  async reset(): Promise<void> {
    await invoke('sim_reset');
    useLayoutStore.getState().setSimulationStatus('stopped');
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
