/**
 * ScenarioToolbar Component
 *
 * Toolbar for scenario execution controls, file operations, and settings.
 */

import { memo, useState, useCallback, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Settings,
  FileText,
  FolderOpen,
  Save,
  Download,
  Upload,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { useScenarioStore, selectExecutionState, selectSettings, selectScenario } from '../../stores/scenarioStore';
import { useScenarioExecution } from './hooks/useScenarioExecution';
import type { ScenarioStatus } from '../../types/scenario';
import { getScenarioDuration } from '../../types/scenario';

// ============================================================================
// Types
// ============================================================================

interface ScenarioToolbarProps {
  /** Callback when new scenario is requested */
  onNew?: () => void;
  /** Callback when open is requested */
  onOpen?: () => void;
  /** Callback when save is requested */
  onSave?: () => void;
  /** Callback when save as is requested */
  onSaveAs?: () => void;
  /** Callback when import CSV is requested */
  onImportCSV?: () => void;
  /** Callback when export CSV is requested */
  onExportCSV?: () => void;
  /** Callback when settings is clicked */
  onSettings?: () => void;
  /** Whether toolbar is compact mode */
  compact?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format time in seconds to mm:ss.fff format.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.round((secs - wholeSecs) * 1000);

  return `${mins.toString().padStart(2, '0')}:${wholeSecs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Check if stop button should be enabled.
 */
function canStop(status: ScenarioStatus): boolean {
  return status === 'running' || status === 'paused';
}

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target) return false;
  const element = target as HTMLElement;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  title?: string;
}

const ToolbarButton = memo(function ToolbarButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  variant = 'default',
  title,
}: ToolbarButtonProps) {
  const variantClasses = {
    default: 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    success: 'bg-green-600 hover:bg-green-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : variantClasses[variant]}
        ${active ? 'ring-2 ring-blue-400' : ''}
      `}
    >
      {icon}
      {label && <span className="font-medium">{label}</span>}
    </button>
  );
});

// ============================================================================
// Timeline Scrubber
// ============================================================================

interface TimelineScrubberProps {
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  totalDuration: number;
  /** Whether scrubber is disabled */
  disabled?: boolean;
  /** Callback when seek is requested */
  onSeek?: (timeSecs: number) => void;
}

const TimelineScrubber = memo(function TimelineScrubber({
  currentTime,
  totalDuration,
  disabled = false,
  onSeek,
}: TimelineScrubberProps) {
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onSeek || totalDuration <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * totalDuration;

    onSeek(Math.max(0, Math.min(targetTime, totalDuration)));
  }, [disabled, onSeek, totalDuration]);

  return (
    <div
      className={`
        relative h-2 w-24 rounded-full cursor-pointer transition-colors
        ${disabled ? 'bg-neutral-800 cursor-not-allowed' : 'bg-neutral-700 hover:bg-neutral-600'}
      `}
      onClick={handleClick}
      role="slider"
      aria-label="Scenario timeline scrubber. Click to seek."
      aria-valuemin={0}
      aria-valuemax={totalDuration}
      aria-valuenow={currentTime}
      aria-disabled={disabled}
      title="Click to seek. Press Home to return to start."
    >
      {/* Progress fill */}
      <div
        className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-100"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
      {/* Thumb indicator */}
      {!disabled && totalDuration > 0 && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border border-neutral-400 transition-all duration-100"
          style={{ left: `calc(${Math.min(progress, 100)}% - 6px)` }}
        />
      )}
    </div>
  );
});

// ============================================================================
// File Menu Dropdown
// ============================================================================

interface FileMenuProps {
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onImportCSV?: () => void;
  onExportCSV?: () => void;
}

const FileMenu = memo(function FileMenu({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onImportCSV,
  onExportCSV,
}: FileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback((action?: () => void) => {
    setIsOpen(false);
    action?.();
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded text-sm transition-colors"
      >
        <FileText size={16} />
        <span>File</span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-20 py-1">
            <MenuItem
              icon={<FileText size={16} />}
              label="New Scenario"
              shortcut="Ctrl+N"
              onClick={() => handleClick(onNew)}
            />
            <MenuItem
              icon={<FolderOpen size={16} />}
              label="Open..."
              shortcut="Ctrl+O"
              onClick={() => handleClick(onOpen)}
            />
            <MenuDivider />
            <MenuItem
              icon={<Save size={16} />}
              label="Save"
              shortcut="Ctrl+S"
              onClick={() => handleClick(onSave)}
            />
            <MenuItem
              icon={<Save size={16} />}
              label="Save As..."
              shortcut="Ctrl+Shift+S"
              onClick={() => handleClick(onSaveAs)}
            />
            <MenuDivider />
            <MenuItem
              icon={<Upload size={16} />}
              label="Import CSV..."
              onClick={() => handleClick(onImportCSV)}
            />
            <MenuItem
              icon={<Download size={16} />}
              label="Export CSV..."
              onClick={() => handleClick(onExportCSV)}
            />
          </div>
        </>
      )}
    </div>
  );
});

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const MenuItem = memo(function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
        ${disabled
          ? 'text-neutral-500 cursor-not-allowed'
          : 'text-neutral-200 hover:bg-neutral-700'
        }
      `}
    >
      <span className="text-neutral-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-neutral-500">{shortcut}</span>
      )}
    </button>
  );
});

const MenuDivider = memo(function MenuDivider() {
  return <div className="my-1 border-t border-neutral-700" />;
});

// ============================================================================
// Main Component
// ============================================================================

export const ScenarioToolbar = memo(function ScenarioToolbar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onImportCSV,
  onExportCSV,
  onSettings,
  compact = false,
}: ScenarioToolbarProps) {
  // Store state
  const executionState = useScenarioStore(selectExecutionState);
  const settings = useScenarioStore(selectSettings);
  const scenario = useScenarioStore(selectScenario);
  const updateSettings = useScenarioStore((state) => state.updateSettings);

  // Execution hook
  const {
    status: backendStatus,
    isRunning,
    isPaused,
    error,
    run,
    pause,
    resume,
    stop,
    seek,
    clearError,
  } = useScenarioExecution();

  const { status, currentTime, currentLoopIteration } = executionState;
  const loopEnabled = settings?.loop ?? false;

  // Calculate total duration and event counts
  const totalDuration = scenario ? getScenarioDuration(scenario) : 0;
  const totalEvents = backendStatus?.totalEvents ?? scenario?.events.length ?? 0;
  const executedEvents = backendStatus?.executedEvents ?? 0;
  const nextEventTime = backendStatus?.nextEventTime ?? null;

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Handlers
  const handlePlayPause = useCallback(async () => {
    if (isRunning) {
      await pause();
    } else if (isPaused) {
      await resume();
    } else {
      await run();
    }
  }, [isRunning, isPaused, run, pause, resume]);

  const handleStop = useCallback(async () => {
    await stop();
  }, [stop]);

  const handleSeek = useCallback(async (timeSecs: number) => {
    await seek(timeSecs);
  }, [seek]);

  const handleToggleLoop = useCallback(() => {
    updateSettings({ loop: !loopEnabled });
  }, [updateSettings, loopEnabled]);

  // Keyboard shortcuts (F5/Space, Shift+F5, Home)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input field
      if (isInputElement(e.target)) return;

      // Shift+F5: Stop (must check before F5 alone)
      if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        handleStop();
        return;
      }

      // F5 or Space: Toggle play/pause
      if (e.key === 'F5' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      // Home: Seek to beginning
      if (e.key === 'Home') {
        e.preventDefault();
        handleSeek(0);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleStop, handleSeek]);

  return (
    <div
      className={`
        flex items-center gap-2 bg-neutral-800 border-b border-neutral-700
        ${compact ? 'px-2 py-1' : 'px-3 py-2'}
      `}
    >
      {/* File Menu */}
      <FileMenu
        onNew={onNew}
        onOpen={onOpen}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onImportCSV={onImportCSV}
        onExportCSV={onExportCSV}
      />

      {/* Separator */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Execution Controls */}
      <div className="flex items-center gap-1">
        {/* Play/Pause toggle */}
        <ToolbarButton
          icon={isRunning ? <Pause size={16} /> : <Play size={16} />}
          label={compact ? undefined : (isRunning ? 'Pause' : isPaused ? 'Resume' : 'Run')}
          onClick={handlePlayPause}
          disabled={false}
          variant={isRunning ? 'warning' : 'success'}
          title={isRunning ? 'Pause Scenario (F5 or Space)' : 'Run Scenario (F5 or Space)'}
        />

        {/* Stop */}
        <ToolbarButton
          icon={<Square size={16} />}
          label={compact ? undefined : 'Stop'}
          onClick={handleStop}
          disabled={!canStop(status)}
          title="Stop Scenario (Shift+F5)"
        />
      </div>

      {/* Error Display */}
      {error && (
        <>
          <div className="w-px h-6 bg-neutral-600" />
          <div className="flex items-center gap-1.5 px-2 py-1 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
            <AlertCircle size={14} />
            <span className="max-w-[200px] truncate" title={error}>{error}</span>
          </div>
        </>
      )}

      {/* Separator */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Loop Toggle */}
      <ToolbarButton
        icon={<Repeat size={16} />}
        label={compact ? undefined : `Loop: ${loopEnabled ? 'ON' : 'OFF'}`}
        onClick={handleToggleLoop}
        active={loopEnabled}
        title="Toggle Loop"
      />

      {/* Timeline Scrubber */}
      <TimelineScrubber
        currentTime={currentTime}
        totalDuration={totalDuration}
        disabled={status === 'idle' || totalDuration <= 0}
        onSeek={handleSeek}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Event Counter */}
      {totalEvents > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-neutral-900 rounded font-mono text-xs text-neutral-400">
          <span>Event</span>
          <span className="text-neutral-200">{executedEvents}/{totalEvents}</span>
        </div>
      )}

      {/* Next Event Time */}
      {nextEventTime !== null && status === 'running' && (
        <div className="flex items-center gap-1 px-2 py-1 bg-neutral-900 rounded font-mono text-xs text-neutral-400">
          <span>Next:</span>
          <span className="text-blue-400">{formatTime(nextEventTime)}</span>
        </div>
      )}

      {/* Time Display */}
      <div className="flex items-center gap-2 px-2 py-1 bg-neutral-900 rounded font-mono text-sm">
        <span className={status === 'running' ? 'text-green-400' : 'text-neutral-200'}>
          {formatTime(currentTime)}
        </span>
        <span className="text-neutral-500">/</span>
        <span className="text-neutral-400">
          {formatTime(totalDuration)}
        </span>
        {loopEnabled && settings && settings.loopCount > 0 && (
          <span className="text-neutral-500">
            (Loop {currentLoopIteration}/{settings.loopCount})
          </span>
        )}
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        {status === 'running' && (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            {!compact && <span className="text-sm text-green-400">Running</span>}
          </>
        )}
        {status === 'paused' && (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            {!compact && <span className="text-sm text-yellow-400">Paused</span>}
          </>
        )}
        {(status === 'idle' || status === 'stopped') && (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-500" />
            {!compact && <span className="text-sm text-neutral-400">Ready</span>}
          </>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-neutral-600" />

      {/* Settings */}
      <ToolbarButton
        icon={<Settings size={16} />}
        onClick={onSettings}
        title="Scenario Settings"
      />
    </div>
  );
});

export default ScenarioToolbar;
