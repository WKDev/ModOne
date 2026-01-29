/**
 * useProject Hook
 *
 * Custom React hook that combines projectService calls with Zustand store
 * for project lifecycle management (create, open, save, close).
 */

import { useCallback, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useExplorerStore } from '../stores/explorerStore';
import { projectService } from '../services/projectService';
import { explorerService } from '../services/explorerService';
import type {
  PlcManufacturer,
  ProjectData,
  ProjectInfo,
  RecentProject,
} from '../types/project';

/**
 * Format error message from various error types
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Project management hook
 *
 * Provides methods for project CRUD operations and state management.
 */
export function useProject() {
  // Get store state and actions
  const {
    currentProject,
    currentProjectPath,
    isModified,
    recentProjects,
    isLoading,
    loadingOperation,
    error,
    setProject,
    setCurrentProjectPath,
    setModified,
    updateConfig,
    setRecentProjects,
    addRecentProject,
    removeRecentProject,
    setLoading,
    setError,
    clearError,
    reset,
  } = useProjectStore();

  // Get explorer store actions
  const {
    loadProjectStructure,
    clearTree: clearExplorerTree,
    setLoading: setExplorerLoading,
    setError: setExplorerError,
  } = useExplorerStore();

  // ============================================================================
  // Recent Projects Management
  // ============================================================================

  /**
   * Refresh the recent projects list from backend
   */
  const refreshRecentProjects = useCallback(async (): Promise<void> => {
    try {
      const projects = await projectService.getRecentProjects();
      setRecentProjects(projects);
    } catch (err) {
      // Don't throw, just log - recent projects failing shouldn't break the app
      console.error('Failed to load recent projects:', err);
    }
  }, [setRecentProjects]);

  /**
   * Remove a project from recent projects list
   */
  const removeFromRecent = useCallback(
    async (path: string): Promise<void> => {
      try {
        await projectService.removeFromRecent(path);
        removeRecentProject(path);
      } catch (err) {
        console.error('Failed to remove from recent projects:', err);
      }
    },
    [removeRecentProject]
  );

  /**
   * Clear all recent projects
   */
  const clearRecentProjects = useCallback(async (): Promise<void> => {
    try {
      await projectService.clearRecentProjects();
      setRecentProjects([]);
    } catch (err) {
      console.error('Failed to clear recent projects:', err);
    }
  }, [setRecentProjects]);

  // Load recent projects on mount
  useEffect(() => {
    refreshRecentProjects();
  }, [refreshRecentProjects]);

  // ============================================================================
  // File Explorer Management
  // ============================================================================

  /**
   * Load the project file tree into the explorer
   */
  const loadFileTree = useCallback(
    async (projectPath: string): Promise<void> => {
      // Get the directory containing the .mop file
      const projectDir = projectPath.replace(/[\\/][^\\/]+\.mop$/i, '');

      setExplorerLoading(true);
      try {
        const files = await explorerService.listProjectFiles(projectDir);
        loadProjectStructure(projectDir, files);
      } catch (err) {
        const message = formatError(err);
        setExplorerError(`Failed to load project files: ${message}`);
        console.error('Failed to load project files:', err);
      }
    },
    [loadProjectStructure, setExplorerLoading, setExplorerError]
  );

  // ============================================================================
  // Project Lifecycle Operations
  // ============================================================================

  /**
   * Create a new project
   */
  const createProject = useCallback(
    async (
      name: string,
      path: string,
      plcManufacturer: PlcManufacturer,
      plcModel: string,
      scanTimeMs?: number
    ): Promise<ProjectInfo> => {
      setLoading(true, 'create');
      clearError();

      try {
        // Create the project
        const info = await projectService.createProject(
          name,
          path,
          plcManufacturer,
          plcModel,
          scanTimeMs
        );

        // Open the newly created project to load its data
        const data = await projectService.openProject(info.path);
        setProject(data, info.path);

        // Load file tree into explorer
        await loadFileTree(info.path);

        // Refresh recent projects
        await refreshRecentProjects();

        // Start auto-save for the new project
        await projectService.startAutoSave();

        return info;
      } catch (err) {
        const message = `Failed to create project: ${formatError(err)}`;
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setProject, loadFileTree, refreshRecentProjects, setError]
  );

  /**
   * Open an existing project
   */
  const openProject = useCallback(
    async (path: string): Promise<ProjectData> => {
      setLoading(true, 'open');
      clearError();

      try {
        const data = await projectService.openProject(path);
        setProject(data, path);

        // Load file tree into explorer
        await loadFileTree(path);

        // Refresh recent projects
        await refreshRecentProjects();

        // Start auto-save
        await projectService.startAutoSave();

        return data;
      } catch (err) {
        const message = `Failed to open project: ${formatError(err)}`;
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setProject, loadFileTree, refreshRecentProjects, setError]
  );

  /**
   * Open a recent project
   */
  const openRecentProject = useCallback(
    async (recentProject: RecentProject): Promise<ProjectData> => {
      return openProject(recentProject.path);
    },
    [openProject]
  );

  /**
   * Save the current project
   * @param path - Optional path for "Save As" operation
   */
  const saveProject = useCallback(
    async (path?: string): Promise<void> => {
      setLoading(true, 'save');
      clearError();

      try {
        await projectService.saveProject(path);
        setModified(false);

        // If Save As, update the current path
        if (path) {
          setCurrentProjectPath(path);
          await refreshRecentProjects();
        }
      } catch (err) {
        const message = `Failed to save project: ${formatError(err)}`;
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setModified, setCurrentProjectPath, refreshRecentProjects, setError]
  );

  /**
   * Close the current project
   * @param force - If true, close without checking for unsaved changes
   * @returns true if closed successfully, false if cancelled due to unsaved changes
   */
  const closeProject = useCallback(
    async (force = false): Promise<boolean> => {
      // If modified and not forcing, indicate there are unsaved changes
      if (isModified && !force) {
        return false;
      }

      setLoading(true, 'close');
      clearError();

      try {
        // Stop auto-save first
        await projectService.stopAutoSave();

        if (force) {
          await projectService.closeProjectForce();
        } else {
          await projectService.closeProject();
        }

        // Clear explorer file tree
        clearExplorerTree();

        reset();
        return true;
      } catch (err) {
        const message = `Failed to close project: ${formatError(err)}`;
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [isModified, setLoading, clearError, clearExplorerTree, reset, setError]
  );

  /**
   * Mark the current project as modified
   */
  const markModified = useCallback(async (): Promise<void> => {
    try {
      await projectService.markProjectModified();
      setModified(true);
    } catch (err) {
      console.error('Failed to mark project as modified:', err);
      // Still update local state even if backend call fails
      setModified(true);
    }
  }, [setModified]);

  /**
   * Check if there are unsaved changes that would be lost
   */
  const hasUnsavedChanges = useCallback((): boolean => {
    return isModified;
  }, [isModified]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    // State
    currentProject,
    currentProjectPath,
    isModified,
    recentProjects,
    isLoading,
    loadingOperation,
    error,

    // Project Operations
    createProject,
    openProject,
    openRecentProject,
    saveProject,
    closeProject,
    markModified,
    hasUnsavedChanges,

    // Config Operations
    updateConfig,

    // Recent Projects Operations
    refreshRecentProjects,
    removeFromRecent,
    clearRecentProjects,
    addRecentProject,

    // Error Handling
    clearError,
  };
}

export default useProject;
