import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProjectConfig, ProjectData, RecentProject } from '../types/project';

// Loading operation types for granular loading state
export type LoadingOperation =
  | 'create'
  | 'open'
  | 'save'
  | 'close'
  | 'recent'
  | null;

interface ProjectStoreState {
  /** Currently loaded project data */
  currentProject: ProjectData | null;
  /** Path to the current project file */
  currentProjectPath: string | null;
  /** Whether the current project has unsaved changes */
  isModified: boolean;
  /** List of recently opened projects */
  recentProjects: RecentProject[];
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Which operation is currently loading (for granular UI feedback) */
  loadingOperation: LoadingOperation;
  /** Error message from the last failed operation */
  error: string | null;
}

interface ProjectStoreActions {
  /** Set the current project and optionally its path */
  setProject: (project: ProjectData | null, path?: string | null) => void;
  /** Set the current project file path */
  setCurrentProjectPath: (path: string | null) => void;
  /** Set the modified state */
  setModified: (modified: boolean) => void;
  /** Update the project config (partial merge) and mark as modified */
  updateConfig: (config: Partial<ProjectConfig>) => void;
  /** Set the recent projects list */
  setRecentProjects: (projects: RecentProject[]) => void;
  /** Add a project to the recent list */
  addRecentProject: (project: RecentProject) => void;
  /** Remove a project from the recent list */
  removeRecentProject: (path: string) => void;
  /** Set loading state with optional operation type */
  setLoading: (loading: boolean, operation?: LoadingOperation) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Clear the error state */
  clearError: () => void;
  /** Reset store to initial state */
  reset: () => void;
}

type ProjectStore = ProjectStoreState & ProjectStoreActions;

const initialState: ProjectStoreState = {
  currentProject: null,
  currentProjectPath: null,
  isModified: false,
  recentProjects: [],
  isLoading: false,
  loadingOperation: null,
  error: null,
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setProject: (project, path) =>
        set(
          (state) => ({
            currentProject: project,
            currentProjectPath: path !== undefined ? path : state.currentProjectPath,
            isModified: project?.is_modified ?? false,
            error: null,
          }),
          false,
          'setProject'
        ),

      setCurrentProjectPath: (path) =>
        set({ currentProjectPath: path }, false, 'setCurrentProjectPath'),

      setModified: (modified) =>
        set({ isModified: modified }, false, 'setModified'),

      updateConfig: (configUpdate) =>
        set(
          (state) => {
            if (!state.currentProject) return state;
            return {
              currentProject: {
                ...state.currentProject,
                config: {
                  ...state.currentProject.config,
                  ...configUpdate,
                },
              },
              isModified: true,
            };
          },
          false,
          'updateConfig'
        ),

      setRecentProjects: (projects) =>
        set({ recentProjects: projects }, false, 'setRecentProjects'),

      addRecentProject: (project) =>
        set(
          (state) => ({
            recentProjects: [
              project,
              ...state.recentProjects.filter((p) => p.path !== project.path),
            ].slice(0, 10),
          }),
          false,
          'addRecentProject'
        ),

      removeRecentProject: (path) =>
        set(
          (state) => ({
            recentProjects: state.recentProjects.filter((p) => p.path !== path),
          }),
          false,
          'removeRecentProject'
        ),

      setLoading: (loading, operation = null) =>
        set(
          {
            isLoading: loading,
            loadingOperation: loading ? operation : null,
          },
          false,
          'setLoading'
        ),

      setError: (error) =>
        set({ error, isLoading: false, loadingOperation: null }, false, 'setError'),

      clearError: () =>
        set({ error: null }, false, 'clearError'),

      reset: () =>
        set(initialState, false, 'reset'),
    }),
    { name: 'project-store' }
  )
);
