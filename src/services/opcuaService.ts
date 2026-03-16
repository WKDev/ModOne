/**
 * OPC UA Service - Tauri Command Wrappers
 *
 * Provides type-safe wrappers around Tauri backend commands
 * for OPC UA server control and status monitoring.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { OpcUaStatus } from '../types/project';

export interface OpcUaStartConfig {
  bind_address?: string;
  port: number;
  server_name: string;
  pki_dir?: string;
  certificate_path?: string;
  private_key_path?: string;
  username?: string | null;
  password?: string | null;
}

/**
 * OPC UA service for interacting with the Tauri backend
 */
export const opcuaService = {
  // ============================================================================
  // Server Control
  // ============================================================================

  /**
   * Start the OPC UA server
   * @param config - Server configuration
   */
  async startServer(config: OpcUaStartConfig): Promise<OpcUaStatus> {
    try {
      return await invoke<OpcUaStatus>('opcua_start_server', { config });
    } catch (error) {
      toast.error('OPC UA 서버 시작 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Stop the OPC UA server
   */
  async stopServer(): Promise<void> {
    try {
      await invoke('opcua_stop_server');
    } catch (error) {
      toast.error('OPC UA 서버 중지 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ============================================================================
  // Status
  // ============================================================================

  /**
   * Get the current status of the OPC UA server
   */
  async getStatus(): Promise<OpcUaStatus> {
    try {
      return await invoke<OpcUaStatus>('opcua_get_status');
    } catch (error) {
      toast.error('OPC UA 상태 조회 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Listen for OPC UA status update events
   * @param callback - Called when status changes
   * @returns Unlisten function
   */
  async onStatusUpdate(callback: (status: OpcUaStatus) => void): Promise<UnlistenFn> {
    return listen<OpcUaStatus>('opcua:status-update', (event) => {
      callback(event.payload);
    });
  },
};

export default opcuaService;
