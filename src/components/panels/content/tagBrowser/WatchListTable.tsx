/**
 * WatchListTable - Virtualized monitoring table for watched tag values
 *
 * Uses @tanstack/react-virtual to efficiently render only visible rows
 * of live tag values, supporting thousands of watched tags smoothly.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Eye, EyeOff, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';
import {
  useTagStore,
  selectTagRegistry,
  selectWatchedTagIds,
  selectTagValues,
} from '../../../../stores/tagStore';
import type { TagDefinition, TagTypedValue } from '../../../../types/tags';
import { toast } from 'sonner';

// ============================================================================
// Constants
// ============================================================================

/** Height of each monitoring row in pixels (for virtualizer) */
const MONITOR_ROW_HEIGHT = 32;

/** Height of the table header */
const MONITOR_HEADER_HEIGHT = 28;

// ============================================================================
// Helpers
// ============================================================================

/** Format tag value for compact table display */
function formatValue(value: TagTypedValue | undefined): string {
  if (!value) return '—';
  if (value.type === 'bool') return value.data ? 'TRUE' : 'FALSE';
  return String(value.data);
}

/** Get CSS color class based on tag value */
function getValueColorClass(value: TagTypedValue | undefined): string {
  if (!value) return 'text-[var(--color-text-muted)]';
  if (value.type === 'bool') {
    return value.data ? 'text-green-400' : 'text-[var(--color-text-muted)]';
  }
  return 'text-[var(--color-text-primary)]';
}

/** Format canonical address compactly */
function formatAddress(addr: TagDefinition['canonicalAddress']): string {
  const base = `${addr.area}${addr.index}`;
  return addr.bitIndex != null ? `${base}.${addr.bitIndex}` : base;
}

// ============================================================================
// WatchListRow (inline value editing)
// ============================================================================

const WatchListRow = memo(function WatchListRow({
  tag,
  value,
  onRemove,
  isSelected,
  onSelect,
  style,
}: {
  tag: TagDefinition;
  value: TagTypedValue | undefined;
  onRemove: (tagId: string) => void;
  isSelected: boolean;
  onSelect: (tagId: string, e: React.MouseEvent) => void;
  style: React.CSSProperties;
}) {
  const writeTag = useTagStore((s) => s.writeTag);
  const isWritable = tag.access === 'readwrite';

  // ── Bool toggle ──
  const handleToggleBool = useCallback(async () => {
    if (!isWritable || !value || value.type !== 'bool') return;
    try {
      await writeTag(tag.tagId, { type: 'bool', data: !value.data });
    } catch {
      // Error already toasted by service
    }
  }, [isWritable, value, writeTag, tag.tagId]);

  // ── u16 inline edit ──
  const [editingValue, setEditingValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback(() => {
    if (!isWritable || !value || value.type !== 'u16') return;
    setEditingValue(String(value.data));
    setIsEditing(true);
  }, [isWritable, value]);

  const handleCommitWrite = useCallback(async () => {
    setIsEditing(false);
    const num = parseInt(editingValue, 10);
    if (isNaN(num) || num < 0 || num > 65535) {
      toast.error('유효하지 않은 값', {
        description: 'u16 값은 0-65535 범위여야 합니다',
      });
      return;
    }
    try {
      await writeTag(tag.tagId, { type: 'u16', data: num });
    } catch {
      // Error already toasted by service
    }
  }, [editingValue, writeTag, tag.tagId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCommitWrite();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleCommitWrite],
  );

  return (
    <div
      style={style}
      className={`flex items-center border-b border-[var(--color-border)] transition-colors group cursor-pointer ${
        isSelected
          ? 'bg-[var(--color-accent)]/15 outline outline-1 outline-[var(--color-accent)]/40'
          : 'hover:bg-[var(--color-bg-tertiary)]'
      }`}
      onClick={(e) => onSelect(tag.tagId, e)}
      data-tag-id={tag.tagId}
    >
      {/* Tag name (displayName) */}
      <div className="flex-1 min-w-0 px-2 truncate text-xs text-[var(--color-text-primary)]" title={tag.displayName}>
        {tag.displayName}
      </div>

      {/* Tag ID */}
      <div className="w-[120px] shrink-0 px-2 truncate text-xs font-mono text-[var(--color-text-muted)]" title={tag.tagId}>
        {tag.tagId}
      </div>

      {/* Address */}
      <div className="w-[72px] shrink-0 px-2 text-xs font-mono text-[var(--color-text-muted)]">
        {formatAddress(tag.canonicalAddress)}
      </div>

      {/* Live value */}
      <div className="w-[100px] shrink-0 px-2 flex items-center gap-1">
        {isEditing ? (
          <input
            type="number"
            min={0}
            max={65535}
            step={1}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={handleCommitWrite}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs font-mono bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] rounded px-1 py-0.5 text-[var(--color-text-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <>
            <span
              className={`text-xs font-mono truncate ${getValueColorClass(value)} ${
                isWritable && value?.type === 'u16'
                  ? 'cursor-pointer hover:underline'
                  : ''
              }`}
              onClick={(e) => { e.stopPropagation(); handleStartEdit(); }}
              title={isWritable && value?.type === 'u16' ? '클릭하여 값 편집' : undefined}
            >
              {formatValue(value)}
            </span>

            {/* Bool toggle button */}
            {isWritable && value?.type === 'bool' && (
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleBool(); }}
                className="p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors shrink-0"
                title="값 토글"
              >
                {value.data ? (
                  <ToggleRight size={14} className="text-green-400" />
                ) : (
                  <ToggleLeft size={14} className="text-[var(--color-text-muted)]" />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Type */}
      <div className="w-[48px] shrink-0 px-2 text-[10px] text-[var(--color-text-muted)] uppercase">
        {value?.type ?? '—'}
      </div>

      {/* Remove from watch (X button) */}
      <div className="w-[28px] shrink-0 flex items-center justify-center">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(tag.tagId); }}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-red-400"
          title="감시 해제"
          aria-label={`${tag.displayName} 감시 해제`}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// WatchListTable (main component)
// ============================================================================

/**
 * Virtualized monitoring table that renders live values
 * for all watched tags. Uses @tanstack/react-virtual so only
 * visible rows are mounted, supporting thousands of tags.
 */
type SortColumn = 'tag' | 'value' | 'tagId';
type SortDir = 'asc' | 'desc';

export const WatchListTable = memo(function WatchListTable() {
  const registry = useTagStore(selectTagRegistry);
  const watchedTagIds = useTagStore(selectWatchedTagIds);
  const tagValues = useTagStore(selectTagValues);
  const removeWatchedTags = useTagStore((s) => s.removeWatchedTags);

  // Sort state
  const [sortCol, setSortCol] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Selection state for keyboard Delete support
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSort = useCallback((col: SortColumn) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return col;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  // Scroll container ref for the virtualizer
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Build ordered list of watched tag definitions
  const watchedTags = useMemo(() => {
    const tagMap = new Map(registry.map((t) => [t.tagId, t]));
    const result: TagDefinition[] = [];
    for (const id of watchedTagIds) {
      const tag = tagMap.get(id);
      if (tag) result.push(tag);
    }

    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortCol) {
          case 'tag':
            cmp = a.displayName.localeCompare(b.displayName);
            break;
          case 'tagId':
            cmp = a.tagId.localeCompare(b.tagId);
            break;
          case 'value': {
            const va = tagValues.get(a.tagId);
            const vb = tagValues.get(b.tagId);
            const na = va ? (va.type === 'bool' ? (va.data ? 1 : 0) : Number(va.data)) : -Infinity;
            const nb = vb ? (vb.type === 'bool' ? (vb.data ? 1 : 0) : Number(vb.data)) : -Infinity;
            cmp = na - nb;
            break;
          }
        }
        return cmp * dir;
      });
    }

    return result;
  }, [registry, watchedTagIds, sortCol, sortDir, tagValues]);

  // Virtualizer for the watch list rows
  const virtualizer = useVirtualizer({
    count: watchedTags.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => MONITOR_ROW_HEIGHT,
    overscan: 10,
  });

  // Row selection handler (click, Ctrl+click, Shift+click)
  const lastSelectedRef = useRef<string | null>(null);

  const handleRowSelect = useCallback(
    (tagId: string, e: React.MouseEvent) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (e.ctrlKey || e.metaKey) {
          // Toggle individual selection
          if (next.has(tagId)) {
            next.delete(tagId);
          } else {
            next.add(tagId);
          }
        } else if (e.shiftKey && lastSelectedRef.current) {
          // Range selection
          const lastIdx = watchedTags.findIndex((t) => t.tagId === lastSelectedRef.current);
          const curIdx = watchedTags.findIndex((t) => t.tagId === tagId);
          if (lastIdx !== -1 && curIdx !== -1) {
            const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
            for (let i = start; i <= end; i++) {
              next.add(watchedTags[i].tagId);
            }
          }
        } else {
          // Single select (replace)
          next.clear();
          next.add(tagId);
        }
        return next;
      });
      lastSelectedRef.current = tagId;
    },
    [watchedTags],
  );

  // Remove a tag from watch list (via X button)
  const handleRemove = useCallback(
    (tagId: string) => {
      removeWatchedTags([tagId]);
      // Also clear from selection
      setSelectedIds((prev) => {
        if (!prev.has(tagId)) return prev;
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    },
    [removeWatchedTags],
  );

  // Delete key handler - removes all selected tags from watch list
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        const idsToRemove = [...selectedIds];
        removeWatchedTags(idsToRemove);
        setSelectedIds(new Set());
      } else if (e.key === 'Escape') {
        // Clear selection on Escape
        setSelectedIds(new Set());
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+A to select all watched tags
        e.preventDefault();
        setSelectedIds(new Set(watchedTags.map((t) => t.tagId)));
      }
    },
    [selectedIds, removeWatchedTags, watchedTags],
  );

  // Clear all watched tags
  const handleClearAll = useCallback(() => {
    removeWatchedTags([...watchedTagIds]);
    setSelectedIds(new Set());
  }, [removeWatchedTags, watchedTagIds]);

  // Empty state
  if (watchedTags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)]">
        <EyeOff size={24} strokeWidth={1.5} className="mb-2 opacity-50" />
        <p className="text-xs">감시 중인 태그가 없습니다</p>
        <p className="text-[10px] mt-0.5 opacity-70">
          태그를 끌어다 놓거나 감시 버튼을 클릭하세요
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col outline-none"
      style={{ minHeight: 0 }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="grid"
      aria-label="감시 목록"
    >
      {/* Table header */}
      <div
        className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] select-none shrink-0"
        style={{ height: MONITOR_HEADER_HEIGHT }}
      >
        <SortableHeader label="Tag" column="tag" activeCol={sortCol} dir={sortDir} onSort={handleSort} className="flex-1 min-w-0" />
        <SortableHeader label="Tag ID" column="tagId" activeCol={sortCol} dir={sortDir} onSort={handleSort} className="w-[120px] shrink-0" />
        <div className="w-[72px] shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Addr
        </div>
        <SortableHeader label="Value" column="value" activeCol={sortCol} dir={sortDir} onSort={handleSort} className="w-[100px] shrink-0" />
        <div className="w-[48px] shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Type
        </div>
        <div className="w-[28px] shrink-0 flex items-center justify-center">
          {watchedTags.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              title="모두 감시 해제"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Watch count badge */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-1">
          <Eye size={11} className="text-[var(--color-accent)]" />
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {watchedTags.length} tag{watchedTags.length !== 1 ? 's' : ''} watched
          </span>
          {selectedIds.size > 0 && (
            <span className="text-[10px] text-[var(--color-accent)] ml-1">
              ({selectedIds.size} selected — Delete to remove)
            </span>
          )}
        </div>
      </div>

      {/* Virtualized rows */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto"
        style={{ maxHeight: '400px' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const tag = watchedTags[virtualRow.index];
            const value = tagValues.get(tag.tagId);

            return (
              <WatchListRow
                key={tag.tagId}
                tag={tag}
                value={value}
                onRemove={handleRemove}
                isSelected={selectedIds.has(tag.tagId)}
                onSelect={handleRowSelect}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// SortableHeader
// ============================================================================

function SortableHeader({
  label,
  column,
  activeCol,
  dir,
  onSort,
  className = '',
}: {
  label: string;
  column: SortColumn;
  activeCol: SortColumn | null;
  dir: SortDir;
  onSort: (col: SortColumn) => void;
  className?: string;
}) {
  const isActive = activeCol === column;
  return (
    <button
      onClick={() => onSort(column)}
      className={`flex items-center gap-0.5 px-2 h-full text-[10px] font-semibold uppercase tracking-wider transition-colors text-left ${
        isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
      } ${className}`}
    >
      <span>{label}</span>
      {isActive && (
        <span className="text-[8px] leading-none">
          {dir === 'asc' ? '\u25B2' : '\u25BC'}
        </span>
      )}
    </button>
  );
}

export default WatchListTable;
