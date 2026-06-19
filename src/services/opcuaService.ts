/**
 * OPC UA Service - Tauri Command Wrappers
 *
 * Provides type-safe wrappers around Tauri backend commands
 * for OPC UA server control and status monitoring.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import type { OpcUaSecurityPolicy, OpcUaSessionInfo, OpcUaStatus, SecurityPolicyInfo } from '../types/project';

export interface OpcUaStartConfig {
  bind_address?: string;
  port: number;
  server_name: string;
  pki_dir?: string;
  certificate_path?: string;
  private_key_path?: string;
  username?: string | null;
  password?: string | null;
  /** Security policies to enable for the server endpoints. When empty, defaults are used. */
  security_policies?: OpcUaSecurityPolicy[];
  /** Whether anonymous (unauthenticated) client connections are allowed. */
  allow_anonymous?: boolean;
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

  /**
   * Restart the OPC UA server atomically (stop → start) to apply pending settings.
   * The server re-reads all project configuration, security policies, user accounts,
   * and address space definitions on restart.
   * @param config - Server configuration (same shape as startServer)
   */
  async restartServer(config: OpcUaStartConfig): Promise<OpcUaStatus> {
    try {
      return await invoke<OpcUaStatus>('opcua_restart_server', { config });
    } catch (error) {
      toast.error('OPC UA 서버 재시작 실패', {
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
  // Session Monitoring
  // ============================================================================

  /**
   * Get detailed information about all active OPC UA client sessions
   */
  async getSessions(): Promise<OpcUaSessionInfo[]> {
    try {
      return await invoke<OpcUaSessionInfo[]>('opcua_get_sessions');
    } catch (error) {
      // Silently return empty array for polling — no toast on failure
      console.warn('Failed to fetch OPC UA sessions:', error);
      return [];
    }
  },

  // ============================================================================
  // Security Policies
  // ============================================================================

  /**
   * Get all available security policies with their enabled state
   */
  async getSecurityPolicies(): Promise<SecurityPolicyInfo[]> {
    try {
      return await invoke<SecurityPolicyInfo[]>('opcua_get_security_policies');
    } catch (error) {
      toast.error('보안 정책 조회 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Set the enabled security policies for the OPC UA server
   * @param policies - Array of security policy identifiers to enable
   * @returns Updated policy list with new enabled states
   */
  async setSecurityPolicies(policies: OpcUaSecurityPolicy[]): Promise<SecurityPolicyInfo[]> {
    try {
      return await invoke<SecurityPolicyInfo[]>('opcua_set_security_policies', { policies });
    } catch (error) {
      toast.error('보안 정책 저장 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  // ============================================================================
  // Anonymous Access
  // ============================================================================

  /**
   * Get the current anonymous access setting from the project configuration
   */
  async getAnonymousAccess(): Promise<boolean> {
    try {
      return await invoke<boolean>('opcua_get_anonymous_access');
    } catch (error) {
      toast.error('익명 접속 설정 조회 실패', {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Set the anonymous access toggle in the project configuration.
   * Server must be restarted for the change to take effect.
   * @param allow - Whether to allow anonymous connections
   * @returns The new allow_anonymous value
   */
  async setAnonymousAccess(allow: boolean): Promise<boolean> {
    try {
      return await invoke<boolean>('opcua_set_anonymous_access', { allow });
    } catch (error) {
      toast.error('익명 접속 설정 저장 실패', {
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

  // ============================================================================
  // User Account Management
  // ============================================================================

  /**
   * List all OPC UA user accounts (no password hashes returned)
   */
  async listUsers(): Promise<UserAccountInfo[]> {
    return await invoke<UserAccountInfo[]>('opcua_list_user_accounts');
  },

  /**
   * Create a new OPC UA user account
   */
  async createUser(request: CreateUserRequest): Promise<UserAccountInfo> {
    return await invoke<UserAccountInfo>('opcua_add_user_account', { request });
  },

  /**
   * Update an existing OPC UA user account
   */
  async updateUser(request: UpdateUserRequest): Promise<UserAccountInfo> {
    return await invoke<UserAccountInfo>('opcua_update_user_account', { request });
  },

  /**
   * Delete an OPC UA user account
   */
  async deleteUser(username: string): Promise<void> {
    return await invoke<void>('opcua_remove_user_account', { username });
  },

  // ============================================================================
  // Audit Log
  // ============================================================================

  /**
   * Query audit log entries with optional filters and pagination.
   */
  async queryAuditLog(query: AuditLogQuery = {}): Promise<AuditLogResult> {
    return await invoke<AuditLogResult>('opcua_query_audit_log', { query });
  },

  /**
   * Clear all audit log entries.
   */
  async clearAuditLog(): Promise<void> {
    return await invoke<void>('opcua_clear_audit_log');
  },

  /**
   * Enforce audit log retention policy.
   * @returns Number of entries deleted.
   */
  async enforceAuditRetention(): Promise<number> {
    return await invoke<number>('opcua_enforce_audit_retention');
  },

  /**
   * Get total audit log entry count.
   */
  async getAuditLogCount(): Promise<number> {
    return await invoke<number>('opcua_get_audit_log_count');
  },

  /**
   * Get the current audit log retention period in days.
   */
  async getAuditRetentionDays(): Promise<number> {
    return await invoke<number>('opcua_get_audit_retention_days');
  },

  /**
   * Set the audit log retention period in days (minimum 1).
   * Immediately enforces the new retention policy.
   * @param days - Number of days to retain audit log entries.
   * @returns Number of entries deleted by the new policy.
   */
  async setAuditRetentionDays(days: number): Promise<number> {
    return await invoke<number>('opcua_set_audit_retention_days', { days });
  },
};

// ============================================================================
// User Account Types
// ============================================================================

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserAccountInfo {
  username: string;
  role: UserRole;
  enabled: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  username: string;
  password?: string | null;
  role?: UserRole | null;
  enabled?: boolean | null;
}

// ============================================================================
// Audit Log Types
// ============================================================================

/** Broad category of auditable OPC UA events (snake_case to match Rust serde). */
export type AuditEventCategory =
  | 'server_lifecycle'
  | 'session'
  | 'authentication'
  | 'configuration'
  | 'security';

/** All possible values for {@link AuditEventCategory}. */
export const AUDIT_EVENT_CATEGORIES: readonly AuditEventCategory[] = [
  'server_lifecycle',
  'session',
  'authentication',
  'configuration',
  'security',
] as const;

/** Fine-grained event type within a category (snake_case to match Rust serde). */
export type AuditEventType =
  | 'server_start'
  | 'server_stop'
  | 'client_connect'
  | 'client_disconnect'
  | 'auth_success'
  | 'auth_failure'
  | 'config_change'
  | 'security_event'
  | 'other';

/** All possible values for {@link AuditEventType}. */
export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = [
  'server_start',
  'server_stop',
  'client_connect',
  'client_disconnect',
  'auth_success',
  'auth_failure',
  'config_change',
  'security_event',
  'other',
] as const;

/** Human-readable labels for event types (for UI display). */
export const AUDIT_EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  server_start: 'Server Start',
  server_stop: 'Server Stop',
  client_connect: 'Client Connect',
  client_disconnect: 'Client Disconnect',
  auth_success: 'Auth Success',
  auth_failure: 'Auth Failure',
  config_change: 'Config Change',
  security_event: 'Security Event',
  other: 'Other',
};

/** Human-readable labels for event categories (for UI display). */
export const AUDIT_EVENT_CATEGORY_LABELS: Record<AuditEventCategory, string> = {
  server_lifecycle: 'Server Lifecycle',
  session: 'Session',
  authentication: 'Authentication',
  configuration: 'Configuration',
  security: 'Security',
};

export type AuditSeverity = 'info' | 'warning' | 'error';

/** All possible values for {@link AuditSeverity}. */
export const AUDIT_SEVERITIES: readonly AuditSeverity[] = [
  'info',
  'warning',
  'error',
] as const;

/** Client identity / network context captured at event time (camelCase from Rust serde). */
export interface AuditClientInfo {
  /** Client IP address (if available). */
  ipAddress?: string | null;
  /** OPC UA session ID (if applicable). */
  sessionId?: string | null;
  /** Authenticated username (if applicable). */
  username?: string | null;
  /** OPC UA application URI of the client. */
  applicationUri?: string | null;
}

/** A single audit log entry as returned by the backend (camelCase from Rust serde). */
export interface AuditLogEntry {
  /** Auto-increment row id. */
  id: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Event category. */
  category: AuditEventCategory;
  /** Specific event type (e.g. server_start, auth_failure). */
  eventType?: AuditEventType | null;
  /** Severity level. */
  severity: AuditSeverity;
  /** Short human-readable event description. */
  message: string;
  /** Optional additional detail / JSON. */
  detail?: string | null;
  /** Source that generated the event (e.g. "server", "auth"). */
  source?: string | null;
  /** Client identity context at event time. */
  clientInfo?: AuditClientInfo | null;
}

/** Query parameters for filtering audit log entries (camelCase, sent to Rust backend). */
export interface AuditLogQuery {
  /** Filter by category. */
  category?: AuditEventCategory;
  /** Filter by specific event type. */
  eventType?: AuditEventType;
  /** Filter by minimum severity. */
  severity?: AuditSeverity;
  /** Filter entries after this ISO-8601 timestamp. */
  from?: string;
  /** Filter entries before this ISO-8601 timestamp. */
  to?: string;
  /** Free-text search in message, detail, and client_info fields. */
  search?: string;
  /** Maximum number of entries to return (default 200). */
  limit?: number;
  /** Offset for pagination (default 0). */
  offset?: number;
}

/** Result of an audit log query with pagination metadata. */
export interface AuditLogResult {
  /** Matching entries (paginated). */
  entries: AuditLogEntry[];
  /** Total number of matching entries (before pagination). */
  totalCount: number;
}

export default opcuaService;
