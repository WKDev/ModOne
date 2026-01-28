/**
 * ScenarioToolbar Component
 *
 * Toolbar for scenario execution controls, file operations, and settings.
 */

import { memo, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { useScenarioStore, selectExecutionState, selectSettings } from '../../stores/scenarioStore';
import type { ScenarioStatus } from '../../types/scenario';

// ============================================================================
// Types
// ============================================================================

interface ScenarioToolbarProps {
  /** Callback when run is clicked */
  onRun?: () => void;
  /** Callback when pause is clicked */
  onPause?: () => void;
  /** Callback when stop is clicked */
  onStop?: () => void;
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
 * Check if run button should be enabled.
 */
function canRun(status: ScenarioStatus): boolean {
  return status === 'idle' || status === 'stopped' || status === 'paused';
}

/**
 * Check if pause button should be enabled.
 */
function canPause(status: ScenarioStatus): boolean {
  return status === 'running';
}

/**
 * Check if stop button should be enabled.
 */
function canStop(status: ScenarioStatus): boolean {
  return status === 'running' || status === 'paused';
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
  onRun,
  onPause,
  onStop,
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
  const setExecutionState = useScenarioStore((state) => state.setExecutionState);
  const updateSettings = useScenarioStore((state) => state.updateSettings);

  const { status, currentTime, currentLoopIteration } = executionState;
  const loopEnabled = settings?.loop ?? false;

  // Handlers
  const handleRun = useCallback(() => {
    setExecutionState({ status: 'running' });
    onRun?.();
  }, [setExecutionState, onRun]);

  const handlePause = useCallback(() => {
    setExecutionState({ status: 'paused' });
    onPause?.();
  }, [setExecutionState, onPause]);

  const handleStop = useCallback(() => {
    setExecutionState({ status: 'stopped', currentTime: 0, currentEventIndex: 0, completedEvents: [] });
    onStop?.();
  }, [setExecutionState, onStop]);

  const handleToggleLoop = useCallback(() => {
    updateSettings({ loop: !loopEnabled });
  }, [updateSettings, loopEnabled]);

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
        {/* Run/Resume */}
        <ToolbarButton
          icon={<Play size={16} />}
          label={compact ? undefined : (status === 'paused' ? 'Resume' : 'Run')}
          onClick={handleRun}
          disabled={!canRun(status)}
          variant="success"
          title="Run Scenario (F5)"
        />

        {/* Pause */}
        <ToolbarButton
          icon={<Pause size={16} />}
          label={compact ? undefined : 'Pause'}
          onClick={handlePause}
          disabled={!canPause(status)}
          variant="warning"
          title="Pause Scenario (F6)"
        />

        {/* Stop */}
        <ToolbarButton
          icon={<Square size={16} />}
          label={compact ? undefined : 'Stop'}
          onClick={handleStop}
          disabled={!canStop(status)}
          title="Stop Scenario (F7)"
        />
      </div>

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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Time Display */}
      <div className="flex items-center gap-2 px-2 py-1 bg-neutral-900 rounded font-mono text-sm">
        <span className="text-neutral-500">Time:</span>
        <span className={status === 'running' ? 'text-green-400' : 'text-neutral-200'}>
          {formatTime(currentTime)}
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
