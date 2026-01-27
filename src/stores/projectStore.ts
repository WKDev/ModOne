import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProjectData, RecentProject } from '../types/project';

interface ProjectStoreState {
  currentProject: ProjectData | null;
  isModified: boolean;
  recentProjects: RecentProject[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectStoreActions {
  setProject: (project: ProjectData | null) => void;
  setModified: (modified: boolean) => void;
  setRecentProjects: (projects: RecentProject[]) => void;
  addRecentProject: (project: RecentProject) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type ProjectStore = ProjectStoreState & ProjectStoreActions;

const initialState: ProjectStoreState = {
  currentProject: null,
  isModified: false,
  recentProjects: [],
  isLoading: false,
  error: null,
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setProject: (project) =>
        set({ currentProject: project, isModified: false, error: null }, false, 'setProject'),

      setModified: (modified) =>
        set({ isModified: modified }, false, 'setModified'),

      setRecentProjects: (projects) =>
        set({ recentProjects: projects }, false, 'setRecentProjects'),

      addRecentProject: (project) =>
        set(
          (state) => ({
            recentProjects: [
              project,
              ...state.recentProjects.filter((p) => p.path !== project.path),
            ].slice(0, 10), // Keep only 10 most recent
          }),
          false,
          'addRecentProject'
        ),

      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'setLoading'),

      setError: (error) =>
        set({ error }, false, 'setError'),

      reset: () =>
        set(initialState, false, 'reset'),
    }),
    { name: 'project-store' }
  )
);
