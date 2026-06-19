import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tags, Search, Filter, List, FolderTree, X, Plus, Eye, Trash2, Download, Upload, Loader2 } from 'lucide-react';
import { useTagStore } from '../../../../stores/tagStore';
import type { TagDefinition } from '../../../../types/tags';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { useMultiSelect } from '../../../../hooks/useMultiSelect';
import { TagTreeView } from './TagTreeView';
import { DraggableTagRow } from './DraggableTagRow';
import { ExportFormatMenu } from './ExportFormatMenu';
import type { ExportFormat } from './ExportFormatMenu';
import { ImportFormatMenu } from './ImportFormatMenu';
import type { ImportFormat } from './ImportFormatMenu';

// ============================================================================
// Types
// ============================================================================

interface TagListPanelProps {
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  isLoading: boolean;
  /** Externally observed set of multi-selected tag IDs */
  selectedIds: Set<string>;
  /** Callback when multi-selection set changes */
  onSelectedIdsChange: (ids: Set<string>) => void;
  /** Callback to enter tag creation mode */
  onCreateNew?: () => void;
  /** Callback to bulk-delete the currently selected tags */
  onBulkDelete?: (tagIds: string[]) => void;
  /** Callback when an export format is selected from the dropdown */
  onExport?: (format: ExportFormat) => void;
  /** Callback when an import format is selected from the dropdown */
  onImport?: (format: ImportFormat) => void;
  /** Whether an import operation is currently in progress */
  isImporting?: boolean;
  /** Whether an export operation is currently in progress */
  isExporting?: boolean;
}

type ClassFilter = 'all' | 'raw' | 'semantic';
type AccessFilter = 'all' | 'read' | 'readwrite';

/** View mode for the tag list panel */
export type TagListViewMode = 'flat' | 'tree';

/** Sort direction for table columns */
type SortDirection = 'asc' | 'desc' | null;

/** Sortable column keys matching the flat table columns */
type SortColumn = 'name' | 'area' | 'type';

/** Height of each tag row in pixels (for virtualizer) */
const ROW_HEIGHT = 32;

/** Height of the column header row */
const HEADER_HEIGHT = 28;

// ============================================================================
// Component
// ============================================================================

/**
 * Tag List Panel (left side of master-detail layout)
 *
 * Displays a searchable, filterable, virtualized list of PLC tags.
 * Supports multi-select, keyboard navigation, and selection state management.
 */
export function TagListPanel({
  selectedTagId,
  onSelectTag,
  isLoading,
  selectedIds,
  onSelectedIdsChange,
  onCreateNew,
  onBulkDelete,
  onExport,
  onImport,
  isImporting = false,
  isExporting = false,
}: TagListPanelProps) {
  const registry = useTagStore((s) => s.registry);
  const addWatchedTags = useTagStore((s) => s.addWatchedTags);
  const watchedTagIds = useTagStore((s) => s.watchedTagIds);

  // View mode state (flat list vs. tree hierarchy)
  const [viewMode, setViewMode] = useState<TagListViewMode>('flat');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');

  // Whether the filter dropdown row is expanded
  const [showFilters, setShowFilters] = useState(false);

  // Sort state for flat table columns
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Debounce search input (300ms)
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  // Ref for the scrollable container (virtualizer parent)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ref for the search input (focus management after clear)
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Export format menu state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  // Import format menu state
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importButtonRef = useRef<HTMLButtonElement>(null);

  // ── Search helpers ────────────────────────────────────────────────────
  /** Clear the search query and re-focus the input */
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  /** Handle keyboard events on the search input (Escape to clear) */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        if (searchQuery) {
          // Clear search text; stop propagation so panel doesn't close
          e.stopPropagation();
          handleClearSearch();
        }
      }
    },
    [searchQuery, handleClearSearch],
  );

  // ── Unique areas (derived from registry for area dropdown) ────────────
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    for (const tag of registry) {
      areas.add(tag.canonicalAddress.area);
    }
    return Array.from(areas).sort();
  }, [registry]);

  // Reset area filter if the selected area no longer exists in registry
  useEffect(() => {
    if (areaFilter !== 'all' && !uniqueAreas.includes(areaFilter)) {
      setAreaFilter('all');
    }
  }, [uniqueAreas, areaFilter]);

  // ── Filtered tags ──────────────────────────────────────────────────────
  const filteredTags = useMemo(() => {
    let tags = registry;

    // Filter by class
    if (classFilter !== 'all') {
      tags = tags.filter((t) => t.class === classFilter);
    }

    // Filter by access
    if (accessFilter !== 'all') {
      tags = tags.filter((t) => t.access === accessFilter);
    }

    // Filter by area
    if (areaFilter !== 'all') {
      tags = tags.filter((t) => t.canonicalAddress.area === areaFilter);
    }

    // Filter by search query (match tagId, displayName, description, address, area, type)
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      tags = tags.filter((t) => {
        return (
          t.tagId.toLowerCase().includes(q) ||
          t.displayName.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          formatAddress(t.canonicalAddress).toLowerCase().includes(q) ||
          t.canonicalAddress.area.toLowerCase().includes(q) ||
          inferDataType(t.canonicalAddress).toLowerCase().includes(q)
        );
      });
    }

    // Sort by column if active
    if (sortColumn && sortDirection) {
      const dir = sortDirection === 'asc' ? 1 : -1;
      tags = [...tags].sort((a, b) => {
        let cmp = 0;
        switch (sortColumn) {
          case 'name':
            cmp = a.displayName.localeCompare(b.displayName);
            break;
          case 'area':
            cmp =
              a.canonicalAddress.area.localeCompare(b.canonicalAddress.area) ||
              a.canonicalAddress.index - b.canonicalAddress.index;
            break;
          case 'type':
            cmp = inferDataType(a.canonicalAddress).localeCompare(
              inferDataType(b.canonicalAddress),
            );
            break;
        }
        return cmp * dir;
      });
    }

    return tags;
  }, [registry, classFilter, accessFilter, areaFilter, debouncedQuery, sortColumn, sortDirection]);

  // ── Virtualizer ────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: filteredTags.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ── Multi-select (Ctrl+Click toggle, Shift+Click range) ─────────────
  const getTagId = useCallback((tag: TagDefinition) => tag.tagId, []);

  const {
    handleItemClick: handleMultiSelectClick,
    selectAll,
  } = useMultiSelect<TagDefinition>({
    items: filteredTags,
    getItemId: getTagId,
    onSingleSelect: onSelectTag,
    onSelectionChange: onSelectedIdsChange,
  });

  /** Adapter: TagTreeView / flat list both call (tag, index, event) but the
   *  hook only needs (tag, event) because it resolves indices internally. */
  const handleTagClick = useCallback(
    (tag: TagDefinition, _index: number, e: React.MouseEvent) => {
      handleMultiSelectClick(tag, e);
    },
    [handleMultiSelectClick],
  );

  // ── Keyboard shortcut: Ctrl/Cmd+A → select all ──────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // Only capture if the tag list panel (or a child) has focus
        const panel = scrollContainerRef.current?.closest('[data-tag-list-panel]');
        if (panel && panel.contains(document.activeElement)) {
          e.preventDefault();
          selectAll();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectAll]);

  // ── Column sort toggle ──────────────────────────────────────────────
  const handleColumnSort = useCallback((column: SortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol !== column) {
        // Switching to a new column: start ascending
        setSortDirection('asc');
        return column;
      }
      // Same column: cycle asc → desc → null
      setSortDirection((prevDir) => {
        if (prevDir === 'asc') return 'desc';
        if (prevDir === 'desc') return null;
        return 'asc';
      });
      return column;
    });
  }, []);

  // Clear sort column when direction resets to null
  useEffect(() => {
    if (sortDirection === null) {
      setSortColumn(null);
    }
  }, [sortDirection]);

  // ── View mode toggle ─────────────────────────────────────────────────
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'flat' ? 'tree' : 'flat'));
  }, []);

  // ── Filter helpers ─────────────────────────────────────────────────────
  const hasActiveFilters = classFilter !== 'all' || accessFilter !== 'all' || areaFilter !== 'all';

  const clearAllFilters = useCallback(() => {
    setClassFilter('all');
    setAccessFilter('all');
    setAreaFilter('all');
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  // ── Bulk watch: add all selected tags to the watch list ────────────────
  /** Whether any selected tags are not yet watched (i.e. bulk-watch would do something) */
  const hasUnwatchedSelected = useMemo(() => {
    if (selectedIds.size < 2) return false;
    for (const id of selectedIds) {
      if (!watchedTagIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, watchedTagIds]);

  const handleBulkWatch = useCallback(() => {
    if (selectedIds.size === 0) return;
    addWatchedTags(Array.from(selectedIds));
  }, [selectedIds, addWatchedTags]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0 || !onBulkDelete) return;
    onBulkDelete(Array.from(selectedIds));
  }, [selectedIds, onBulkDelete]);

  // ── Export menu handlers ──────────────────────────────────────────────
  const toggleExportMenu = useCallback(() => {
    setShowExportMenu((prev) => !prev);
  }, []);

  const closeExportMenu = useCallback(() => {
    setShowExportMenu(false);
  }, []);

  const handleExportFormat = useCallback(
    (format: ExportFormat) => {
      onExport?.(format);
    },
    [onExport],
  );

  // ── Import menu handlers ──────────────────────────────────────────────
  const toggleImportMenu = useCallback(() => {
    setShowImportMenu((prev) => !prev);
  }, []);

  const closeImportMenu = useCallback(() => {
    setShowImportMenu(false);
  }, []);

  const handleImportFormat = useCallback(
    (format: ImportFormat) => {
      onImport?.(format);
    },
    [onImport],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" data-tag-list-panel tabIndex={-1}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)]">
        <Tags size={16} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
          Tags
        </span>

        {/* Create new tag button */}
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            title="새 태그 생성"
            className="p-1 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10"
            aria-label="Create new tag"
          >
            <Plus size={14} />
          </button>
        )}

        {/* Import button with format dropdown */}
        {onImport && (
          <button
            ref={importButtonRef}
            onClick={toggleImportMenu}
            title="태그 가져오기"
            className={`p-1 rounded transition-colors ${
              isImporting
                ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10 animate-pulse cursor-wait'
                : showImportMenu
                  ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10'
            }`}
            aria-label="Import tags"
            aria-expanded={showImportMenu}
            aria-haspopup="menu"
            data-testid="import-button"
            disabled={isImporting}
          >
            <Upload size={14} />
          </button>
        )}

        {/* Export button with format dropdown */}
        {onExport && (
          <button
            ref={exportButtonRef}
            onClick={toggleExportMenu}
            title="태그 내보내기"
            className={`p-1 rounded transition-colors ${
              isExporting
                ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10 cursor-wait'
                : showExportMenu
                  ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--accent-color)] hover:bg-[var(--accent-color)]/10'
            }`}
            aria-label="Export tags"
            aria-expanded={showExportMenu}
            aria-haspopup="menu"
            data-testid="export-button"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
          </button>
        )}

        {/* View mode toggle */}
        <button
          onClick={toggleViewMode}
          title={viewMode === 'flat' ? '트리 뷰로 전환' : '목록 뷰로 전환'}
          className="p-1 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] ml-auto"
          aria-label={`Switch to ${viewMode === 'flat' ? 'tree' : 'flat'} view`}
        >
          {viewMode === 'flat' ? (
            <FolderTree size={14} />
          ) : (
            <List size={14} />
          )}
        </button>

        {/* Bulk watch button – visible when multiple tags are selected */}
        {selectedIds.size > 1 && hasUnwatchedSelected && (
          <button
            onClick={handleBulkWatch}
            title={`선택한 ${selectedIds.size}개 태그를 감시 목록에 추가`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors text-[var(--accent-color)] bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)]/20"
            aria-label={`Add ${selectedIds.size} selected tags to watch list`}
          >
            <Eye size={12} />
            <span>Watch {selectedIds.size}</span>
          </button>
        )}

        {/* Bulk delete button – visible when multiple tags are selected */}
        {selectedIds.size > 1 && onBulkDelete && (
          <button
            onClick={handleBulkDelete}
            title={`선택한 ${selectedIds.size}개 태그 삭제`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors text-red-400 bg-red-500/10 hover:bg-red-500/20"
            aria-label={`Delete ${selectedIds.size} selected tags`}
          >
            <Trash2 size={12} />
            <span>Delete {selectedIds.size}</span>
          </button>
        )}

        <span className="text-[10px] text-[var(--text-muted)]">
          {selectedIds.size > 1 && (
            <span className="text-[var(--accent-color)] mr-1">
              {selectedIds.size} selected ·
            </span>
          )}
          {filteredTags.length}
          {filteredTags.length !== registry.length && ` / ${registry.length}`}
        </span>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border-color)]">
        <div className="flex items-center flex-1 gap-1.5 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
          <Search size={13} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="태그 검색..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--text-muted)]"
            aria-label="Search tags"
          />
          {/* Clear button - only visible when search has text */}
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="p-0.5 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] shrink-0"
              aria-label="Clear search"
              title="검색 지우기 (Esc)"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={toggleFilters}
          title="필터 표시/숨기기"
          className={`p-1 rounded transition-colors ${
            hasActiveFilters
              ? 'text-[var(--accent-color)] bg-[var(--accent-color)]/10'
              : showFilters
                ? 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <Filter size={14} />
        </button>
      </div>

      {/* Filter dropdowns row */}
      {showFilters && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border-color)] flex-wrap">
          {/* Class filter */}
          <FilterSelect
            label="클래스"
            value={classFilter}
            onChange={(v) => setClassFilter(v as ClassFilter)}
            options={[
              { value: 'all', label: '전체' },
              { value: 'raw', label: 'Raw' },
              { value: 'semantic', label: 'Semantic' },
            ]}
          />

          {/* Access filter */}
          <FilterSelect
            label="접근"
            value={accessFilter}
            onChange={(v) => setAccessFilter(v as AccessFilter)}
            options={[
              { value: 'all', label: '전체' },
              { value: 'read', label: 'Read' },
              { value: 'readwrite', label: 'Read/Write' },
            ]}
          />

          {/* Area filter */}
          <FilterSelect
            label="영역"
            value={areaFilter}
            onChange={setAreaFilter}
            options={[
              { value: 'all', label: '전체' },
              ...uniqueAreas.map((area) => ({ value: area, label: area })),
            ]}
          />
        </div>
      )}

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1 px-3 py-1 border-b border-[var(--border-color)] flex-wrap">
          {classFilter !== 'all' && (
            <FilterBadge label={classFilter} onClear={() => setClassFilter('all')} />
          )}
          {accessFilter !== 'all' && (
            <FilterBadge label={accessFilter} onClear={() => setAccessFilter('all')} />
          )}
          {areaFilter !== 'all' && (
            <FilterBadge label={`영역: ${areaFilter}`} onClear={() => setAreaFilter('all')} />
          )}
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] ml-1"
          >
            초기화
          </button>
        </div>
      )}

      {/* Tag List / Tree Content */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-[var(--text-muted)] text-sm">
          태그 로딩 중...
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[var(--text-muted)] text-sm">
          <Tags size={24} strokeWidth={1.5} />
          <p>
            {registry.length === 0
              ? '등록된 태그가 없습니다'
              : '검색 결과가 없습니다'}
          </p>
        </div>
      ) : viewMode === 'tree' ? (
        /* Column headers not shown for tree view */
        /* ── Tree View ──────────────────────────────────────────────── */
        <TagTreeView
          tags={filteredTags}
          selectedTagId={selectedTagId}
          selectedIds={selectedIds}
          onTagClick={handleTagClick}
        />
      ) : (
        /* ── Flat Table View ────────────────────────────────────────── */
        <>
          {/* Column Headers */}
          <div
            className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)] select-none shrink-0"
            style={{ height: HEADER_HEIGHT }}
          >
            <button
              onClick={() => handleColumnSort('name')}
              className="flex items-center gap-1 flex-1 min-w-0 px-3 h-full text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-left"
            >
              <span>Name</span>
              <SortIndicator column="name" activeColumn={sortColumn} direction={sortDirection} />
            </button>
            <button
              onClick={() => handleColumnSort('area')}
              className="flex items-center gap-1 w-[72px] shrink-0 px-2 h-full text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-left"
            >
              <span>Area</span>
              <SortIndicator column="area" activeColumn={sortColumn} direction={sortDirection} />
            </button>
            <button
              onClick={() => handleColumnSort('type')}
              className="flex items-center gap-1 w-[64px] shrink-0 px-2 h-full text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-left"
            >
              <span>Type</span>
              <SortIndicator column="type" activeColumn={sortColumn} direction={sortDirection} />
            </button>
          </div>

          {/* Virtualized Rows */}
          <div ref={scrollContainerRef} className="flex-1 overflow-auto">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const tag = filteredTags[virtualRow.index];
                const active = selectedTagId === tag.tagId;
                const selected = selectedIds.has(tag.tagId);
                const dataType = inferDataType(tag.canonicalAddress);

                return (
                  <DraggableTagRow
                    key={tag.tagId}
                    tag={tag}
                    index={virtualRow.index}
                    isActive={active}
                    isSelected={selected}
                    dataType={dataType}
                    formattedAddress={formatAddress(tag.canonicalAddress)}
                    selectedIds={selectedIds}
                    onClick={(e) => handleTagClick(tag, virtualRow.index, e)}
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
        </>
      )}

      {/* Import format selection dropdown */}
      <ImportFormatMenu
        isOpen={showImportMenu}
        anchorRef={importButtonRef}
        onSelectFormat={handleImportFormat}
        onClose={closeImportMenu}
        isProcessing={isImporting}
      />

      {/* Export format selection dropdown */}
      <ExportFormatMenu
        isOpen={showExportMenu}
        anchorRef={exportButtonRef}
        onSelectFormat={handleExportFormat}
        onClose={closeExportMenu}
      />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

/** Sort direction indicator arrow for column headers */
function SortIndicator({
  column,
  activeColumn,
  direction,
}: {
  column: SortColumn;
  activeColumn: SortColumn | null;
  direction: SortDirection;
}) {
  if (column !== activeColumn || direction === null) {
    return null;
  }
  return (
    <span className="text-[8px] leading-none">
      {direction === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

/** Compact dropdown select for a single filter dimension */
function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
      <span className="uppercase tracking-wide whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-[11px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-1.5 py-0.5 outline-none cursor-pointer transition-colors
          focus:ring-1 focus:ring-blue-500
          ${value !== 'all' ? 'text-[var(--accent-color)]' : 'text-[var(--text-primary)]'}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface FilterBadgeProps {
  label: string;
  onClear: () => void;
}

/** Small pill badge showing an active filter with a dismiss button */
function FilterBadge({ label, onClear }: FilterBadgeProps) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-color)]/10 text-[var(--accent-color)]">
      {label}
      <button
        onClick={onClear}
        className="hover:text-[var(--text-primary)] transition-colors ml-0.5"
        aria-label={`${label} 필터 제거`}
      >
        <X size={10} />
      </button>
    </span>
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

/** Infer the data type from a canonical address */
function inferDataType(addr: TagDefinition['canonicalAddress']): string {
  return addr.bitIndex != null ? 'BOOL' : 'WORD';
}
