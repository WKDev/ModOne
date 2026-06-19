import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Tags } from 'lucide-react';
import { useTagStore } from '../../../stores/tagStore';
import { useDeleteTag } from '../../../hooks/useDeleteTag';
import { useTagImportExportDialogs } from '../../../hooks/useTagImportExportDialogs';
import { useTagImportWithConflicts } from '../../../hooks/useTagImportWithConflicts';
import type { TagDragData } from '../../../types/dnd';
import { TAG_DRAG_TYPE, WATCH_LIST_DROP_ID } from '../../../types/dnd';
import { ResizeHandle } from '../../layout/ResizeHandle';
import { TagListPanel } from './tagBrowser/TagListPanel';
import { TagDetailPanel } from './tagBrowser/TagDetailPanel';
import { TagImportConflictDialog } from './tagBrowser/TagImportConflictDialog';
import type { ExportFormat } from './tagBrowser/ExportFormatMenu';
import type { ImportFormat } from './tagBrowser/ImportFormatMenu';

/** Minimum width for the left (tag list) panel in pixels */
const MIN_LEFT_WIDTH = 240;
/** Maximum width ratio for the left panel (% of container) */
const MAX_LEFT_RATIO = 0.6;
/** Default width for the left panel in pixels */
const DEFAULT_LEFT_WIDTH = 360;

/**
 * Tag Browser Panel
 *
 * Singleton panel for browsing, editing, monitoring, and managing PLC tags.
 * Provides a master-detail layout with a resizable split pane:
 * - Left panel: Tag list with search, filtering, and multi-select
 * - Right panel: Tag detail view and monitoring
 */
export function TagBrowserPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  /** Currently active tag drag data (null when no drag is active) */
  const [activeDrag, setActiveDrag] = useState<TagDragData | null>(null);

  const fetchRegistry = useTagStore((s) => s.fetchRegistry);
  const registry = useTagStore((s) => s.registry);
  const isLoadingRegistry = useTagStore((s) => s.isLoadingRegistry);
  const watchedTagIds = useTagStore((s) => s.watchedTagIds);
  const addWatchedTags = useTagStore((s) => s.addWatchedTags);

  const handleSelectTag = useCallback((id: string | null) => {
    setSelectedTagId(id);
    setIsCreating(false);
  }, []);

  const handleCreateNew = useCallback(() => {
    setSelectedTagId(null);
    setIsCreating(true);
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
  }, []);

  const handleTagCreated = useCallback((tagId: string) => {
    setIsCreating(false);
    setSelectedTagId(tagId);
  }, []);

  /** Clear selection when a tag is deleted */
  const handleTagDeleted = useCallback(
    (tagId: string) => {
      if (selectedTagId === tagId) {
        setSelectedTagId(null);
      }
      setSelectedIds((prev) => {
        if (!prev.has(tagId)) return prev;
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    },
    [selectedTagId],
  );

  /** Handle bulk deletion results – clear deleted IDs from selection state */
  const handleBulkDeleted = useCallback(
    (deletedIds: string[]) => {
      const deletedSet = new Set(deletedIds);
      if (selectedTagId && deletedSet.has(selectedTagId)) {
        setSelectedTagId(null);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of deletedIds) {
          next.delete(id);
        }
        return next.size === prev.size ? prev : next;
      });
    },
    [selectedTagId],
  );

  const { deleteBulk } = useDeleteTag({
    onDeleted: handleTagDeleted,
    onBulkDeleted: handleBulkDeleted,
  });

  /** Trigger bulk delete for the given tag IDs (called from TagListPanel) */
  const handleBulkDelete = useCallback(
    (tagIds: string[]) => {
      deleteBulk(tagIds);
    },
    [deleteBulk],
  );

  // ── Import / Export ──────────────────────────────────────────────────
  const {
    openImportDialog,
    exportWithSaveDialog,
    isDialogOpen: isExporting,
  } = useTagImportExportDialogs();
  const {
    startImport,
    isProcessing: isImporting,
    pendingConflicts,
    showConflictDialog,
    resolveConflicts,
    cancelConflictDialog,
    lastResult: importResult,
  } = useTagImportWithConflicts();

  /** Handle export format selection from TagListPanel's dropdown menu */
  const handleExport = useCallback(
    (format: ExportFormat) => {
      // Pass selected tag IDs if multi-selected, otherwise export all
      const params = selectedIds.size > 1
        ? { tagIds: Array.from(selectedIds) }
        : undefined;
      exportWithSaveDialog(format, params);
    },
    [exportWithSaveDialog, selectedIds],
  );

  /** Handle import format selection: open file dialog → start import flow */
  const handleImport = useCallback(
    async (format: ImportFormat) => {
      const result = await openImportDialog(format);
      if (result) {
        await startImport(result.content, result.format);
        // Refresh registry after successful import
      }
    },
    [openImportDialog, startImport],
  );

  // Refresh registry after a successful import
  useEffect(() => {
    if (importResult && (importResult.created > 0 || importResult.overwritten > 0)) {
      fetchRegistry();
    }
  }, [importResult, fetchRegistry]);

  // Load tag registry on mount
  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  const handleResize = useCallback(
    (delta: number) => {
      setLeftWidth((prev) => {
        const containerWidth = containerRef.current?.clientWidth ?? 900;
        const maxLeft = containerWidth * MAX_LEFT_RATIO;
        // delta is negative when moving right (ResizeHandle convention for vertical)
        const newWidth = prev - delta;
        return Math.max(MIN_LEFT_WIDTH, Math.min(maxLeft, newWidth));
      });
    },
    [],
  );

  // ── DnD sensors ──────────────────────────────────────────────────────
  // Pointer sensor requires 8px movement to avoid accidental drags.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  /** Track active drag for DragOverlay rendering */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as TagDragData | undefined;
    if (data && data.type === TAG_DRAG_TYPE) {
      setActiveDrag(data);
    }
  }, []);

  /**
   * Handle drag-end for adding tags to the watch list and reordering.
   *
   * Two drag scenarios are handled:
   * 1. Tag list → Watch list drop zone: adds dragged (+ multi-selected) tags
   *    to the watched set, skipping any that are already watched.
   * 2. Watch list reorder: future enhancement.
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Ignore if there's no drop target
      if (!over) return;

      const dragData = active.data.current as TagDragData | undefined;

      // Only handle tag-list-item drags (not sortable reorders or panel drags)
      if (!dragData || dragData.type !== TAG_DRAG_TYPE) return;

      // Accept drops on the watch list drop zone, or on any existing
      // watched-tag sortable item (which means "insert into watch list")
      const droppedOnWatchZone = over.id === WATCH_LIST_DROP_ID;
      const droppedOnWatchedItem = watchedTagIds.has(String(over.id));

      if (!droppedOnWatchZone && !droppedOnWatchedItem) return;

      // Collect the tag IDs to add. `tagIds` includes multi-selected tags;
      // `addWatchedTags` in the store already filters out duplicates.
      const idsToAdd = dragData.tagIds.length > 0
        ? dragData.tagIds
        : [dragData.tagId];

      addWatchedTags(idsToAdd);
      setActiveDrag(null);
    },
    [watchedTagIds, addWatchedTags],
  );

  /** Cancel handler – clear overlay state */
  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  /** Resolve the display name for the primary dragged tag */
  const activeDragDisplayName = activeDrag
    ? (registry.find((t) => t.tagId === activeDrag.tagId)?.displayName ?? activeDrag.tagId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={containerRef}
        className="flex flex-1 h-full overflow-hidden bg-[var(--bg-primary)]"
      >
        {/* Left Panel: Tag List */}
        <div
          className="flex flex-col h-full overflow-hidden shrink-0"
          style={{ width: leftWidth }}
        >
          <TagListPanel
            selectedTagId={selectedTagId}
            onSelectTag={handleSelectTag}
            isLoading={isLoadingRegistry}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            onCreateNew={handleCreateNew}
            onBulkDelete={handleBulkDelete}
            onExport={handleExport}
            onImport={handleImport}
            isImporting={isImporting}
            isExporting={isExporting}
          />
        </div>

        {/* Resizable Divider */}
        <ResizeHandle direction="vertical" onResize={handleResize} />

        {/* Right Panel: Tag Detail + Monitoring */}
        <div className="flex flex-col flex-1 h-full overflow-hidden min-w-[200px]">
          <TagDetailPanel
            selectedTagId={selectedTagId}
            onTagDeleted={handleTagDeleted}
            isCreating={isCreating}
            onCancelCreate={handleCancelCreate}
            onTagCreated={handleTagCreated}
          />
        </div>
      </div>

      {/* Import conflict resolution dialog */}
      <TagImportConflictDialog
        isOpen={showConflictDialog}
        conflicts={pendingConflicts}
        onResolve={resolveConflicts}
        onCancel={cancelConflictDialog}
      />

      {/* Drag overlay – rendered in a portal outside the scroll container */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded shadow-lg border border-[var(--accent-color)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] pointer-events-none whitespace-nowrap">
            <Tags size={14} className="text-[var(--accent-color)] shrink-0" />
            <span className="font-medium truncate max-w-[180px]">
              {activeDragDisplayName}
            </span>
            {activeDrag.tagIds.length > 1 && (
              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent-color)] text-white font-semibold">
                +{activeDrag.tagIds.length - 1}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
