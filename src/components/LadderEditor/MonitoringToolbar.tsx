/**
 * MonitoringToolbar Component
 *
 * Toolbar for controlling ladder diagram monitoring mode.
 * Provides start/stop monitoring controls and connection status display.
 */

import { useCallback, useState } from 'react';
import { Play, Square, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMonitoring, type MonitoringConnectionStatus } from '../../hooks/useMonitoring';

export interface MonitoringToolbarProps {
  /** Optional class name */
  className?: string;
  /** Whether toolbar is compact (icon-only mode) */
  compact?: boolean;
  /** Callback when monitoring state changes */
  onMonitoringChange?: (isMonitoring: boolean) => void;
}

/**
 * Get status color based on connection status
 */
function getStatusColor(status: MonitoringConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'text-green-500';
    case 'connecting':
      return 'text-yellow-500';
    case 'error':
      return 'text-red-500';
    case 'disconnected':
    default:
      return 'text-neutral-500';
  }
}

/**
 * Get status text based on connection status
 */
function getStatusText(status: MonitoringConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return 'Error';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

/**
 * MonitoringToolbar - Controls for ladder diagram monitoring mode
 */
export function MonitoringToolbar({
  className,
  compact = false,
  onMonitoringChange,
}: MonitoringToolbarProps) {
  const {
    isMonitoring,
    connectionStatus,
    error,
    startMonitoring,
    stopMonitoring,
  } = useMonitoring();

  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle start monitoring click
   */
  const handleStartMonitoring = useCallback(async () => {
    setIsLoading(true);
    try {
      await startMonitoring();
      onMonitoringChange?.(true);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startMonitoring, onMonitoringChange]);

  /**
   * Handle stop monitoring click
   */
  const handleStopMonitoring = useCallback(async () => {
    setIsLoading(true);
    try {
      await stopMonitoring();
      onMonitoringChange?.(false);
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
    } finally {
      setIsLoading(false);
    }
  }, [stopMonitoring, onMonitoringChange]);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1',
        'border-b border-neutral-700 bg-neutral-800',
        className
      )}
    >
      {/* Monitoring Toggle Button */}
      {isMonitoring ? (
        <button
          onClick={handleStopMonitoring}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded',
            'bg-red-600 hover:bg-red-700 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150'
          )}
          title="Stop Monitoring"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          {!compact && <span className="text-sm font-medium">Stop</span>}
        </button>
      ) : (
        <button
          onClick={handleStartMonitoring}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded',
            'bg-green-600 hover:bg-green-700 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-150'
          )}
          title="Start Monitoring"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {!compact && <span className="text-sm font-medium">Monitor</span>}
        </button>
      )}

      {/* Separator */}
      <div className="w-px h-5 bg-neutral-600" />

      {/* Connection Status */}
      <div className="flex items-center gap-1.5">
        {connectionStatus === 'connected' ? (
          <Wifi className={cn('w-4 h-4', getStatusColor(connectionStatus))} />
        ) : (
          <WifiOff className={cn('w-4 h-4', getStatusColor(connectionStatus))} />
        )}
        {!compact && (
          <span className={cn('text-sm', getStatusColor(connectionStatus))}>
            {getStatusText(connectionStatus)}
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <>
          <div className="w-px h-5 bg-neutral-600" />
          <div className="flex items-center gap-1.5 text-red-400" title={error}>
            <AlertCircle className="w-4 h-4" />
            {!compact && (
              <span className="text-sm truncate max-w-[200px]">{error}</span>
            )}
          </div>
        </>
      )}

      {/* Mode Indicator */}
      {isMonitoring && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-yellow-400">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            {!compact && <span className="text-xs uppercase tracking-wide">Live</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default MonitoringToolbar;
