/**
 * Logging Service
 *
 * Provides access to the error logging system through Tauri commands.
 */

import { invoke } from '@tauri-apps/api/core';

/** A single log entry from the error log */
export interface LogEntry {
  /** Timestamp when the error occurred */
  timestamp: string;
  /** Log level (error, warn, info) */
  level: string;
  /** Error type (matches ModOneError variant name) */
  error_type: string;
  /** Error message */
  message: string;
  /** Context describing what operation was being performed */
  context: string;
  /** Optional command name that triggered the error */
  command?: string;
}

/**
 * Get the path to the logs directory
 */
export async function getLogPath(): Promise<string> {
  return invoke<string>('get_log_path');
}

/**
 * Get recent error log entries
 * @param limit Maximum number of entries to return (default: 50)
 */
export async function getRecentErrors(limit?: number): Promise<LogEntry[]> {
  return invoke<LogEntry[]>('get_recent_errors', { limit });
}

/**
 * Clear all error log files
 */
export async function clearErrorLogs(): Promise<void> {
  return invoke<void>('clear_error_logs');
}

/**
 * Open the logs directory in the system file explorer
 */
export async function openLogsDirectory(): Promise<void> {
  return invoke<void>('open_logs_directory');
}

export const loggingService = {
  getLogPath,
  getRecentErrors,
  clearErrorLogs,
  openLogsDirectory,
};

export default loggingService;
