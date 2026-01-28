/**
 * useOpenProjectDialog Hook
 *
 * Provides a function to open a native file picker for .mop project files.
 */

import { useCallback, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useProject } from './useProject';

interface UseOpenProjectDialogReturn {
  openPicker: () => Promise<boolean>;
  isOpening: boolean;
  error: string | null;
}

/**
 * Hook for opening a project file picker
 */
export function useOpenProjectDialog(): UseOpenProjectDialogReturn {
  const { openProject } = useProject();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = useCallback(async (): Promise<boolean> => {
    setIsOpening(true);
    setError(null);

    try {
      const selected = await open({
        filters: [
          {
            name: 'ModOne Project',
            extensions: ['mop'],
          },
        ],
        multiple: false,
        title: '프로젝트 열기',
      });

      if (selected) {
        await openProject(selected as string);
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : '프로젝트를 열 수 없습니다.';
      setError(message);
      console.error('Failed to open project:', err);
      return false;
    } finally {
      setIsOpening(false);
    }
  }, [openProject]);

  return {
    openPicker,
    isOpening,
    error,
  };
}

export default useOpenProjectDialog;
