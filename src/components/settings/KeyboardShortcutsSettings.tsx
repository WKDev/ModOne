/**
 * Keyboard Shortcuts Settings Panel
 *
 * VS Code-inspired keyboard shortcut configuration UI.
 * Reads default shortcuts from CommandRegistry and user overrides from settingsStore.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Pencil, RotateCcw, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { commandRegistry } from '../CommandPalette/commandRegistry';
import { CATEGORY_LABELS } from '../CommandPalette/types';
import type { Command, CommandCategory } from '../CommandPalette/types';

interface KeyboardShortcutsSettingsProps {
  searchFilter?: string;
}

/** Category display order */
const CATEGORY_ORDER: CommandCategory[] = [
  'file',
  'edit',
  'view',
  'simulation',
  'debug',
  'ladder',
  'canvas',
  'scenario',
  'modbus',
  'settings',
  'help',
];

/**
 * Format a KeyboardEvent into a shortcut string like "Ctrl+Shift+S"
 */
function formatKeyCombo(e: KeyboardEvent): string | null {
  // Ignore lone modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null;
  }

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key;

  // Normalize key names
  if (key === ' ') key = 'Space';
  else if (key === 'Escape') key = 'Escape';
  else if (key === 'Delete') key = 'Delete';
  else if (key === 'Backspace') key = 'Backspace';
  else if (key === 'Enter') key = 'Enter';
  else if (key === 'ArrowUp') key = 'Up';
  else if (key === 'ArrowDown') key = 'Down';
  else if (key === 'ArrowLeft') key = 'Left';
  else if (key === 'ArrowRight') key = 'Right';
  else if (key.startsWith('F') && key.length >= 2 && key.length <= 3) {
    // Function keys: keep as-is (F1-F12)
  } else if (key === ',') key = ',';
  else if (key === '.') key = '.';
  else if (key === '?') key = '?';
  else if (key === '=') key = '=';
  else if (key === '-') key = '-';
  else if (key === '+') key = '+';
  else if (key === '0') key = '0';
  else key = key.length === 1 ? key.toUpperCase() : key;

  parts.push(key);
  return parts.join('+');
}

/**
 * Shortcut badge component — renders each key in its own <kbd>
 */
function ShortcutBadge({
  shortcut,
  isOverridden,
}: {
  shortcut: string;
  isOverridden?: boolean;
}) {
  const keys = shortcut.split('+');
  return (
    <span className="inline-flex items-center gap-0.5">
      {isOverridden && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] mr-1 flex-shrink-0" />
      )}
      {keys.map((key, i) => (
        <span key={i}>
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-secondary)] min-w-[1.5rem] text-center inline-block">
            {key}
          </kbd>
          {i < keys.length - 1 && (
            <span className="text-[var(--text-muted)] mx-0.5 text-xs">+</span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Inline shortcut recorder — captures the next keypress combination
 */
function ShortcutRecorder({
  onRecord,
  onCancel,
}: {
  onRecord: (shortcut: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      const combo = formatKeyCombo(e);
      if (combo) {
        onRecord(combo);
      }
    };

    const el = ref.current;
    el?.addEventListener('keydown', handleKeyDown);
    return () => el?.removeEventListener('keydown', handleKeyDown);
  }, [onRecord, onCancel]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-shortcut-recorder
      className="px-3 py-1 text-xs border-2 border-[var(--accent-color)] rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] animate-pulse focus:outline-none min-w-[10rem] text-center"
    >
      키 조합을 입력하세요...
    </div>
  );
}

export function KeyboardShortcutsSettings({
  searchFilter = '',
}: KeyboardShortcutsSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const settings = getMergedSettings();
  const overrides = settings.keybindingOverrides;

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{
    commandId: string;
    message: string;
  } | null>(null);

  const filter = searchFilter.toLowerCase();

  // Gather all commands that have a shortcut defined (default or overridden)
  const commandsWithShortcuts = useMemo(() => {
    const all = commandRegistry.getAll();
    return all.filter(
      (cmd) => cmd.shortcut || overrides[cmd.id]
    );
  }, [overrides]);

  // Build effective shortcut map for conflict detection
  const effectiveShortcuts = useMemo(() => {
    const map = new Map<string, string>(); // shortcut → commandId
    for (const cmd of commandsWithShortcuts) {
      const effective = overrides[cmd.id] || cmd.shortcut;
      if (effective) {
        map.set(effective, cmd.id);
      }
    }
    return map;
  }, [commandsWithShortcuts, overrides]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandCategory, Command[]>();

    for (const cmd of commandsWithShortcuts) {
      const effective = overrides[cmd.id] || cmd.shortcut || '';
      const matchTargets = [
        cmd.label,
        cmd.description || '',
        cmd.category,
        CATEGORY_LABELS[cmd.category] || '',
        effective,
        ...(cmd.keywords || []),
      ];

      const isVisible = !filter || matchTargets.some((t) => t.toLowerCase().includes(filter));
      if (!isVisible) continue;

      const existing = groups.get(cmd.category) || [];
      existing.push(cmd);
      groups.set(cmd.category, existing);
    }

    return groups;
  }, [commandsWithShortcuts, overrides, filter]);

  const handleRecord = useCallback(
    (commandId: string, newShortcut: string) => {
      // Check for conflicts
      const conflictingCmdId = effectiveShortcuts.get(newShortcut);
      if (conflictingCmdId && conflictingCmdId !== commandId) {
        const conflictCmd = commandRegistry.get(conflictingCmdId);
        setConflictWarning({
          commandId,
          message: `이 단축키는 '${conflictCmd?.label || conflictingCmdId}'에 이미 할당되어 있습니다.`,
        });
      } else {
        setConflictWarning(null);
      }

      // Save the override
      const newOverrides = { ...overrides, [commandId]: newShortcut };
      updatePending('keybindingOverrides', newOverrides);
      setRecordingId(null);
    },
    [overrides, effectiveShortcuts, updatePending]
  );

  const handleReset = useCallback(
    (commandId: string) => {
      const newOverrides = { ...overrides };
      delete newOverrides[commandId];
      updatePending('keybindingOverrides', newOverrides);
      if (conflictWarning?.commandId === commandId) {
        setConflictWarning(null);
      }
    },
    [overrides, updatePending, conflictWarning]
  );

  const handleResetAll = useCallback(() => {
    updatePending('keybindingOverrides', {});
    setConflictWarning(null);
  }, [updatePending]);

  const hasAnyOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">단축키 설정</h3>
        {hasAnyOverrides && (
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
          >
            <RotateCcw size={12} />
            모두 초기화
          </button>
        )}
      </div>

      {/* Conflict warning */}
      {conflictWarning && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
          <AlertTriangle size={14} className="flex-shrink-0" />
          {conflictWarning.message}
        </div>
      )}

      {/* Shortcut table */}
      <div className="border border-[var(--border-color)] rounded overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs font-medium text-[var(--text-muted)]">
          <span>명령</span>
          <span className="w-48 text-center">단축키</span>
          <span className="w-16" />
        </div>

        {/* Table body */}
        <div className="max-h-[400px] overflow-y-auto">
          {CATEGORY_ORDER.map((category) => {
            const commands = groupedCommands.get(category);
            if (!commands || commands.length === 0) return null;

            return (
              <div key={category}>
                {/* Category header */}
                <div className="px-3 py-1.5 bg-[var(--bg-secondary)]/50 text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-color)] sticky top-0 z-10">
                  {CATEGORY_LABELS[category]}
                </div>

                {/* Command rows */}
                {commands.map((cmd) => {
                  const isOverridden = cmd.id in overrides;
                  const effectiveShortcut = overrides[cmd.id] || cmd.shortcut || '';
                  const isRecording = recordingId === cmd.id;

                  return (
                    <div
                      key={cmd.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-secondary)]/30 items-center group"
                    >
                      {/* Command info */}
                      <div className="min-w-0">
                        <div className="text-sm text-[var(--text-primary)] truncate">
                          {cmd.label}
                        </div>
                        {cmd.description && (
                          <div className="text-xs text-[var(--text-muted)] truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>

                      {/* Shortcut display/recorder */}
                      <div className="w-48 flex justify-center">
                        {isRecording ? (
                          <ShortcutRecorder
                            onRecord={(s) => handleRecord(cmd.id, s)}
                            onCancel={() => {
                              setRecordingId(null);
                              setConflictWarning(null);
                            }}
                          />
                        ) : effectiveShortcut ? (
                          <ShortcutBadge
                            shortcut={effectiveShortcut}
                            isOverridden={isOverridden}
                          />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="w-16 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setRecordingId(isRecording ? null : cmd.id);
                            setConflictWarning(null);
                          }}
                          className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                          title="단축키 변경"
                        >
                          <Pencil size={13} />
                        </button>
                        {isOverridden && (
                          <button
                            onClick={() => handleReset(cmd.id)}
                            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            title="기본값으로 초기화"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Empty state */}
          {groupedCommands.size === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
              일치하는 단축키가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-xs text-[var(--text-muted)]">
        편집 버튼을 클릭한 후 원하는 키 조합을 누르면 단축키가 변경됩니다. ESC로 취소할 수 있습니다.
      </p>
    </div>
  );
}
