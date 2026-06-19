import { useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import type { TagDefinition } from '../../../../types/tags';

// ============================================================================
// Types
// ============================================================================

interface TagTreeViewProps {
  /** Filtered list of tags to display in the tree */
  tags: TagDefinition[];
  /** Currently selected tag ID (active in detail panel) */
  selectedTagId: string | null;
  /** Set of currently multi-selected tag IDs */
  selectedIds: Set<string>;
  /** Callback when a tag row is clicked */
  onTagClick: (tag: TagDefinition, flatIndex: number, e: React.MouseEvent) => void;
}

/** Discriminated union for flat rows rendered by the virtualizer */
type TreeRow =
  | { type: 'area'; area: string; count: number; expanded: boolean }
  | { type: 'tag'; tag: TagDefinition; area: string; depth: number };

/** Height of each row in pixels (matches flat list ROW_HEIGHT) */
const ROW_HEIGHT = 32;

// ============================================================================
// Component
// ============================================================================

/**
 * Tag Tree View
 *
 * Renders PLC tags grouped hierarchically by their canonical address area
 * (e.g., M, P, T, C, D, etc.) with expandable/collapsible area nodes.
 *
 * Uses @tanstack/react-virtual for efficient rendering of thousands of tags.
 * The tree is flattened into a virtual list where area headers and tag rows
 * are interleaved based on expansion state.
 */
export function TagTreeView({
  tags,
  selectedTagId,
  selectedIds,
  onTagClick,
}: TagTreeViewProps) {
  // Track which area nodes are expanded (all expanded by default)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(
    () => new Set(),
  );
  // Track if we've initialized expanded areas for current tag set
  const initializedRef = useRef(false);

  // ── Group tags by area ─────────────────────────────────────────────────
  const groupedByArea = useMemo(() => {
    const groups = new Map<string, TagDefinition[]>();

    for (const tag of tags) {
      const area = tag.canonicalAddress.area;
      let group = groups.get(area);
      if (!group) {
        group = [];
        groups.set(area, group);
      }
      group.push(tag);
    }

    // Sort areas alphabetically, then sort tags within each area by index
    const sortedEntries = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([area, areaTags]) => {
        areaTags.sort((a, b) => {
          if (a.canonicalAddress.index !== b.canonicalAddress.index) {
            return a.canonicalAddress.index - b.canonicalAddress.index;
          }
          return (a.canonicalAddress.bitIndex ?? -1) - (b.canonicalAddress.bitIndex ?? -1);
        });
        return [area, areaTags] as const;
      });

    return sortedEntries;
  }, [tags]);

  // Auto-expand all areas on first render or when tags change significantly
  useMemo(() => {
    if (!initializedRef.current && groupedByArea.length > 0) {
      setExpandedAreas(new Set(groupedByArea.map(([area]) => area)));
      initializedRef.current = true;
    }
  }, [groupedByArea]);

  // ── Flatten tree into virtual rows ─────────────────────────────────────
  const flatRows: TreeRow[] = useMemo(() => {
    const rows: TreeRow[] = [];

    for (const [area, areaTags] of groupedByArea) {
      const expanded = expandedAreas.has(area);
      rows.push({
        type: 'area',
        area,
        count: areaTags.length,
        expanded,
      });

      if (expanded) {
        for (const tag of areaTags) {
          rows.push({
            type: 'tag',
            tag,
            area,
            depth: 1,
          });
        }
      }
    }

    return rows;
  }, [groupedByArea, expandedAreas]);

  // ── Virtualizer ────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ── Toggle area expansion ──────────────────────────────────────────────
  const toggleArea = useCallback((area: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) {
        next.delete(area);
      } else {
        next.add(area);
      }
      return next;
    });
  }, []);

  // ── Expand / Collapse all ──────────────────────────────────────────────
  const allExpanded = expandedAreas.size === groupedByArea.length && groupedByArea.length > 0;

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedAreas(new Set());
    } else {
      setExpandedAreas(new Set(groupedByArea.map(([area]) => area)));
    }
  }, [allExpanded, groupedByArea]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Expand/collapse all toggle */}
      <div className="flex items-center px-3 py-1 border-b border-[var(--border-color)]">
        <button
          onClick={toggleAll}
          className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          title={allExpanded ? '모두 접기' : '모두 펼치기'}
        >
          {allExpanded ? '모두 접기' : '모두 펼치기'}
        </button>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
          {groupedByArea.length}개 영역
        </span>
      </div>

      {/* Virtualized tree */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = flatRows[virtualRow.index];

            return (
              <div
                key={
                  row.type === 'area'
                    ? `area:${row.area}`
                    : `tag:${row.tag.tagId}`
                }
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === 'area' ? (
                  <AreaRow
                    area={row.area}
                    count={row.count}
                    expanded={row.expanded}
                    onToggle={toggleArea}
                  />
                ) : (
                  <TagRow
                    tag={row.tag}
                    active={selectedTagId === row.tag.tagId}
                    selected={selectedIds.has(row.tag.tagId)}
                    depth={row.depth}
                    index={virtualRow.index}
                    onClick={onTagClick}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface AreaRowProps {
  area: string;
  count: number;
  expanded: boolean;
  onToggle: (area: string) => void;
}

/** Expandable area group header row */
function AreaRow({ area, count, expanded, onToggle }: AreaRowProps) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 h-full cursor-pointer select-none text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      onClick={() => onToggle(area)}
    >
      {expanded ? (
        <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
      ) : (
        <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
      )}
      {expanded ? (
        <FolderOpen size={14} className="text-[var(--accent-color)] shrink-0" />
      ) : (
        <Folder size={14} className="text-[var(--text-muted)] shrink-0" />
      )}
      <span>{getAreaDisplayName(area)}</span>
      <span className="text-[10px] text-[var(--text-muted)] ml-auto">
        {count}
      </span>
    </div>
  );
}

interface TagRowProps {
  tag: TagDefinition;
  active: boolean;
  selected: boolean;
  depth: number;
  index: number;
  onClick: (tag: TagDefinition, index: number, e: React.MouseEvent) => void;
}

/** Individual tag row within an area group */
function TagRow({ tag, active, selected, depth, index, onClick }: TagRowProps) {
  return (
    <div
      className={`flex items-center gap-2 h-full cursor-pointer text-xs transition-colors select-none ${
        active
          ? 'bg-[var(--accent-color)] text-white'
          : selected
            ? 'bg-[var(--accent-color)]/15 text-[var(--text-primary)]'
            : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
      }`}
      style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '12px' }}
      onClick={(e) => onClick(tag, index, e)}
    >
      {/* Tag class indicator dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          tag.class === 'semantic'
            ? active
              ? 'bg-white/70'
              : 'bg-[var(--accent-color)]'
            : active
              ? 'bg-white/50'
              : 'bg-[var(--text-muted)]'
        }`}
      />

      {/* Tag display name */}
      <span className="truncate font-medium">{tag.displayName}</span>

      {/* Address badge */}
      <span
        className={`ml-auto text-[10px] shrink-0 ${
          active ? 'text-white/70' : 'text-[var(--text-muted)]'
        }`}
      >
        {formatAddress(tag.canonicalAddress)}
      </span>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Format a canonical address for compact display */
function formatAddress(addr: TagDefinition['canonicalAddress']): string {
  const base = `${addr.area}${addr.index}`;
  return addr.bitIndex != null ? `${base}.${addr.bitIndex}` : base;
}

/** Map area codes to human-readable display names */
function getAreaDisplayName(area: string): string {
  const areaNames: Record<string, string> = {
    P: 'P (입력)',
    M: 'M (보조릴레이)',
    T: 'T (타이머)',
    C: 'C (카운터)',
    D: 'D (데이터)',
    L: 'L (링크)',
    K: 'K (상수)',
    U: 'U (사용자)',
    F: 'F (특수)',
    Z: 'Z (인덱스)',
    N: 'N (통신)',
    R: 'R (파일)',
    S: 'S (스텝)',
  };
  return areaNames[area] ?? `${area} (영역)`;
}
