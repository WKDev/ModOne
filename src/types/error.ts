/**
 * Error types for ModOne
 *
 * TypeScript types that mirror the Rust ModOneError enum.
 * These types match the JSON serialization from the backend.
 */

// ============================================================================
// Error Type Discriminated Union
// ============================================================================

/** Project file not found */
export interface ProjectNotFoundError {
  type: 'ProjectNotFound';
  message: string;
}

/** Invalid or corrupted .mop project file */
export interface InvalidMopFileError {
  type: 'InvalidMopFile';
  message: string;
}

/** Configuration parsing error */
export interface ConfigError {
  type: 'ConfigError';
  message: string;
}

/** Configuration validation error with field information */
export interface ConfigValidationError {
  type: 'ConfigValidationError';
  message: {
    field: string;
    message: string;
  };
}

/** A project is already open */
export interface ProjectAlreadyOpenError {
  type: 'ProjectAlreadyOpen';
  message: string;
}

/** No project is currently open */
export interface NoProjectOpenError {
  type: 'NoProjectOpen';
  message: string;
}

/** Project has unsaved changes */
export interface UnsavedChangesError {
  type: 'UnsavedChanges';
  message: string;
}

/** General IO error */
export interface IoError {
  type: 'IoError';
  message: string;
}

/** File already exists */
export interface FileExistsError {
  type: 'FileExists';
  message: string;
}

/** Permission denied */
export interface PermissionDeniedError {
  type: 'PermissionDenied';
  message: string;
}

/** Backup file not found */
export interface BackupNotFoundError {
  type: 'BackupNotFound';
  message: string;
}

/** Recovery operation failed */
export interface RecoveryFailedError {
  type: 'RecoveryFailed';
  message: string;
}

/** Modbus server error */
export interface ModbusErrorType {
  type: 'ModbusError';
  message: string;
}

/** Memory access error */
export interface MemoryErrorType {
  type: 'MemoryError';
  message: string;
}

/** Internal error */
export interface InternalError {
  type: 'Internal';
  message: string;
}

/** Operation cancelled */
export interface CancelledError {
  type: 'Cancelled';
  message: string;
}

/** Operation timed out */
export interface TimeoutError {
  type: 'Timeout';
  message: string;
}

/**
 * Union of all possible ModOne errors
 */
export type ModOneError =
  | ProjectNotFoundError
  | InvalidMopFileError
  | ConfigError
  | ConfigValidationError
  | ProjectAlreadyOpenError
  | NoProjectOpenError
  | UnsavedChangesError
  | IoError
  | FileExistsError
  | PermissionDeniedError
  | BackupNotFoundError
  | RecoveryFailedError
  | ModbusErrorType
  | MemoryErrorType
  | InternalError
  | CancelledError
  | TimeoutError;

// ============================================================================
// Type Guards
// ============================================================================

/** Check if an error is a ModOneError */
export function isModOneError(error: unknown): error is ModOneError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error
  );
}

/** Check if error is a ConfigValidationError */
export function isConfigValidationError(
  error: ModOneError
): error is ConfigValidationError {
  return error.type === 'ConfigValidationError';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: ModOneError): boolean {
  return (
    error.type === 'IoError' ||
    error.type === 'PermissionDenied' ||
    error.type === 'ConfigValidationError' ||
    error.type === 'UnsavedChanges' ||
    error.type === 'Timeout'
  );
}

/**
 * Check if an error might have a backup available
 */
export function hasBackupOption(error: ModOneError): boolean {
  return error.type === 'InvalidMopFile';
}

/**
 * Get a user-friendly title for an error
 */
export function getErrorTitle(error: ModOneError): string {
  const titles: Record<ModOneError['type'], string> = {
    ProjectNotFound: 'Project Not Found',
    InvalidMopFile: 'Invalid Project File',
    ConfigError: 'Configuration Error',
    ConfigValidationError: 'Invalid Configuration',
    ProjectAlreadyOpen: 'Project Already Open',
    NoProjectOpen: 'No Project Open',
    UnsavedChanges: 'Unsaved Changes',
    IoError: 'File Error',
    FileExists: 'File Already Exists',
    PermissionDenied: 'Permission Denied',
    BackupNotFound: 'Backup Not Found',
    RecoveryFailed: 'Recovery Failed',
    ModbusError: 'Modbus Error',
    MemoryError: 'Memory Error',
    Internal: 'Internal Error',
    Cancelled: 'Cancelled',
    Timeout: 'Timeout',
  };
  return titles[error.type] || 'Error';
}

/**
 * Get the error message as a string
 */
export function getErrorMessage(error: ModOneError): string {
  if (error.type === 'ConfigValidationError') {
    const msg = error.message as { field: string; message: string };
    return `${msg.field}: ${msg.message}`;
  }
  return error.message as string;
}

/**
 * Parse a Tauri command error into a ModOneError
 * Tauri returns errors as strings, so we try to parse them
 */
export function parseError(error: unknown): ModOneError {
  // If it's already a ModOneError, return it
  if (isModOneError(error)) {
    return error;
  }

  // If it's a string, wrap it as an Internal error
  if (typeof error === 'string') {
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(error);
      if (isModOneError(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, use as message
    }
    return { type: 'Internal', message: error };
  }

  // If it's an Error object, use its message
  if (error instanceof Error) {
    return { type: 'Internal', message: error.message };
  }

  // Fallback
  return { type: 'Internal', message: 'An unknown error occurred' };
}
