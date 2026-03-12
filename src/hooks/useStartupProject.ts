import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { projectService } from '@services/projectService';
import { explorerService } from '@services/explorerService';
import { useProjectStore } from '@stores/projectStore';
import { useExplorerStore } from '@stores/explorerStore';
import { useSidebarStore } from '@stores/sidebarStore';

function extractProjectDir(projectPath: string): string {
  return projectPath.replace(/[\\/][^\\/]+\.mop$/i, '');
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function useStartupProject(isInitialized: boolean) {
  const hasChecked = useRef(false);
  const [isStartupResolved, setIsStartupResolved] = useState(false);
  const setProject = useProjectStore((state) => state.setProject);
  const setLoading = useProjectStore((state) => state.setLoading);
  const setError = useProjectStore((state) => state.setError);
  const clearError = useProjectStore((state) => state.clearError);
  const setRecentProjects = useProjectStore((state) => state.setRecentProjects);
  const loadProjectStructure = useExplorerStore((state) => state.loadProjectStructure);
  const clearExplorerTree = useExplorerStore((state) => state.clearTree);
  const showSidebarPanel = useSidebarStore((state) => state.showPanel);

  useEffect(() => {
    if (!isInitialized || hasChecked.current) {
      return;
    }

    hasChecked.current = true;
    let isCancelled = false;

    const resolveStartup = () => {
      if (!isCancelled) {
        setIsStartupResolved(true);
      }
    };

    const openProjectAtPath = async (
      path: string,
      options: { silentFailure: boolean; successToast?: string; errorPrefix?: string }
    ): Promise<boolean> => {
      let backendProjectOpened = false;

      setLoading(true, 'open');
      clearError();

      try {
        const data = await projectService.openProject(path, {
          suppressErrorToast: true,
        });
        backendProjectOpened = true;

        const projectDir = extractProjectDir(path);
        const files = await explorerService.listProjectFiles(projectDir);

        if (isCancelled) {
          return true;
        }

        setProject(data, path);
        loadProjectStructure(projectDir, files);
        showSidebarPanel('explorer');

        try {
          const recentProjects = await projectService.getRecentProjects({
            suppressErrorToast: options.silentFailure,
          });
          if (!isCancelled) {
            setRecentProjects(recentProjects);
          }
        } catch {
          // Recent project refresh should not block startup restore.
        }

        try {
          await projectService.startAutoSave();
        } catch (error) {
          console.warn('Failed to start auto-save during startup restore:', error);
        }

        if (options.successToast) {
          toast.success(options.successToast);
        }

        return true;
      } catch (error) {
        if (backendProjectOpened) {
          try {
            await projectService.closeProjectForce({
              suppressErrorToast: true,
            });
          } catch {
            // Best-effort rollback only.
          }
        }

        if (isCancelled) {
          return false;
        }

        clearExplorerTree();

        if (options.silentFailure) {
          return false;
        }

        const message = formatError(error);
        setError(`${options.errorPrefix ?? 'Failed to open project'}: ${message}`);
        toast.error(`Failed to open project: ${message}`);
        return false;
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const initializeStartupProject = async () => {
      try {
        const cliProjectPath = await invoke<string | null>('get_cli_project_path');

        if (cliProjectPath) {
          await openProjectAtPath(cliProjectPath, {
            silentFailure: false,
            successToast: `Opened project from CLI: ${cliProjectPath.split(/[\\/]/).pop() ?? 'project'}`,
            errorPrefix: 'Failed to open CLI project',
          });
          return;
        }

        const recentProjects = await projectService.getRecentProjects({
          suppressErrorToast: true,
        });

        if (!isCancelled) {
          setRecentProjects(recentProjects);
        }

        const lastProject = recentProjects[0];
        if (!lastProject) {
          return;
        }

        await openProjectAtPath(lastProject.path, {
          silentFailure: true,
        });
      } catch {
        // Failing to inspect startup project sources should fall back to the welcome flow.
      } finally {
        resolveStartup();
      }
    };

    initializeStartupProject();

    return () => {
      isCancelled = true;
    };
  }, [
    clearError,
    clearExplorerTree,
    isInitialized,
    loadProjectStructure,
    setError,
    setLoading,
    setProject,
    setRecentProjects,
    showSidebarPanel,
  ]);

  return isStartupResolved;
}

export default useStartupProject;
