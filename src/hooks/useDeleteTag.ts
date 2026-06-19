/**
 * useDeleteTag - Hook for deleting tags with native OS confirmation dialog
 *
 * Shows a native confirmation dialog via @tauri-apps/plugin-dialog before
 * deleting a tag from the registry. On confirmation, calls the backend
 * delete command and updates UI state (registry, watched tags, selection).
 *
 * Supports both single-tag and bulk (multi-select) deletion.
 */

import { useCallback } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { useTagStore } from '../stores/tagStore';
import { toast } from 'sonner';

interface UseDeleteTagOptions {
  /** Called after a tag is successfully deleted, with the deleted tag ID */
  onDeleted?: (tagId: string) => void;
  /** Called after bulk deletion completes, with all successfully deleted IDs */
  onBulkDeleted?: (tagIds: string[]) => void;
}

/**
 * Returns handler functions for single and bulk tag deletion with confirmation.
 *
 * @param options.onDeleted - Callback invoked after single tag deletion
 * @param options.onBulkDeleted - Callback invoked after bulk deletion
 * @returns deleteTag(tagId, displayName) and deleteBulk(tagIds)
 */
export function useDeleteTag(options?: UseDeleteTagOptions) {
  const storeDeleteTag = useTagStore((s) => s.deleteTag);
  const storeDeleteTags = useTagStore((s) => s.deleteTags);

  const deleteTag = useCallback(
    async (tagId: string, displayName?: string) => {
      const label = displayName || tagId;

      // Show native OS confirmation dialog
      const confirmed = await ask(
        `'${label}' 태그를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        { title: '태그 삭제 확인', kind: 'warning' },
      );

      if (!confirmed) return false;

      // Call store action (which calls backend and updates state)
      const success = await storeDeleteTag(tagId);

      if (success) {
        toast.success('태그 삭제 완료', {
          description: `'${label}' 태그가 삭제되었습니다.`,
        });
        options?.onDeleted?.(tagId);
      }

      return success;
    },
    [storeDeleteTag, options],
  );

  /**
   * Bulk-delete multiple tags with a single confirmation dialog.
   * Returns the list of IDs that were successfully deleted.
   */
  const deleteBulk = useCallback(
    async (tagIds: string[]) => {
      if (tagIds.length === 0) return [];

      // For a single tag, delegate to the single-delete flow
      if (tagIds.length === 1) {
        const success = await deleteTag(tagIds[0]);
        return success ? tagIds : [];
      }

      // Show native OS confirmation dialog for bulk delete
      const confirmed = await ask(
        `선택한 ${tagIds.length}개의 태그를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
        { title: '태그 일괄 삭제 확인', kind: 'warning' },
      );

      if (!confirmed) return [];

      const deleted = await storeDeleteTags(tagIds);

      if (deleted.length > 0) {
        toast.success('태그 일괄 삭제 완료', {
          description: `${deleted.length}개의 태그가 삭제되었습니다.`,
        });
        options?.onBulkDeleted?.(deleted);
      }

      return deleted;
    },
    [deleteTag, storeDeleteTags, options],
  );

  return { deleteTag, deleteBulk };
}
