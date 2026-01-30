/**
 * Explorer Store
 *
 * Manages the file tree state for the project explorer panel.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProjectFileNode, FileNodeResult } from '../types/fileTypes';
import { resolveFileType } from '../utils/fileTypeResolver';
import { explorerService } from '../services/explorerService';

interface ExplorerState {
  /** The file tree structure */
  fileTree: ProjectFileNode[];
  /** Path of the currently selected file/folder */
  selectedPath: string | null;
  /** Set of expanded folder paths */
  expandedPaths: Set<string>;
  /** The project root path */
  projectRoot: string | null;
  /** Whether the tree is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

interface ExplorerActions {
  /** Load the file structure from a project directory */
  loadProjectStructure: (projectRoot: string, files: FileNodeResult[]) => void;
  /** Refresh the file tree from the current project root */
  refreshFileTree: () => Promise<void>;
  /** Toggle a folder's expanded state */
  toggleFolder: (path: string) => void;
  /** Expand a specific folder */
  expandFolder: (path: string) => void;
  /** Collapse a specific folder */
  collapseFolder: (path: string) => void;
  /** Select a file or folder */
  selectPath: (path: string | null) => void;
  /** Clear the file tree */
  clearTree: () => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Expand all folders */
  expandAll: () => void;
  /** Collapse all folders */
  collapseAll: () => void;
}

type ExplorerStore = ExplorerState & ExplorerActions;

/**
 * Generate a unique ID for a file node based on its path.
 */
function generateNodeId(path: string): string {
  return `node-${path.replace(/[\\\/]/g, '-')}`;
}

/**
 * Convert backend FileNodeResult to frontend ProjectFileNode.
 */
function convertFileNode(node: FileNodeResult): ProjectFileNode {
  const fileInfo = node.is_dir ? undefined : resolveFileType(node.path);

  return {
    id: generateNodeId(node.path),
    name: node.name,
    path: node.path,
    absolutePath: node.absolute_path,
    type: node.is_dir ? 'folder' : 'file',
    fileInfo,
    children: node.children?.map(convertFileNode),
  };
}

/**
 * Collect all folder paths from the file tree.
 */
function collectFolderPaths(nodes: ProjectFileNode[]): string[] {
  const paths: string[] = [];

  function traverse(node: ProjectFileNode) {
    if (node.type === 'folder') {
      paths.push(node.path);
      node.children?.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return paths;
}

const initialState: ExplorerState = {
  fileTree: [],
  selectedPath: null,
  expandedPaths: new Set(),
  projectRoot: null,
  isLoading: false,
  error: null,
};

export const useExplorerStore = create<ExplorerStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadProjectStructure: (projectRoot, files) => {
        const fileTree = files.map(convertFileNode);

        // Auto-expand root level folders
        const rootPaths = fileTree
          .filter((node) => node.type === 'folder')
          .map((node) => node.path);

        set(
          {
            fileTree,
            projectRoot,
            expandedPaths: new Set(rootPaths),
            isLoading: false,
            error: null,
          },
          false,
          'loadProjectStructure'
        );
      },

      refreshFileTree: async () => {
        const { projectRoot, expandedPaths } = get();
        if (!projectRoot) {
          return;
        }

        set({ isLoading: true }, false, 'refreshFileTree:start');

        try {
          const files = await explorerService.listProjectFiles(projectRoot);
          const fileTree = files.map(convertFileNode);

          // Preserve expanded state
          set(
            {
              fileTree,
              isLoading: false,
              error: null,
              // Keep the existing expanded paths
              expandedPaths,
            },
            false,
            'refreshFileTree:success'
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to refresh file tree';
          set(
            { error: message, isLoading: false },
            false,
            'refreshFileTree:error'
          );
        }
      },

      toggleFolder: (path) => {
        set(
          (state) => {
            const newExpanded = new Set(state.expandedPaths);
            if (newExpanded.has(path)) {
              newExpanded.delete(path);
            } else {
              newExpanded.add(path);
            }
            return { expandedPaths: newExpanded };
          },
          false,
          'toggleFolder'
        );
      },

      expandFolder: (path) => {
        set(
          (state) => {
            const newExpanded = new Set(state.expandedPaths);
            newExpanded.add(path);
            return { expandedPaths: newExpanded };
          },
          false,
          'expandFolder'
        );
      },

      collapseFolder: (path) => {
        set(
          (state) => {
            const newExpanded = new Set(state.expandedPaths);
            newExpanded.delete(path);
            return { expandedPaths: newExpanded };
          },
          false,
          'collapseFolder'
        );
      },

      selectPath: (path) => {
        set({ selectedPath: path }, false, 'selectPath');
      },

      clearTree: () => {
        set(initialState, false, 'clearTree');
      },

      setLoading: (loading) => {
        set({ isLoading: loading }, false, 'setLoading');
      },

      setError: (error) => {
        set({ error, isLoading: false }, false, 'setError');
      },

      expandAll: () => {
        const { fileTree } = get();
        const allFolders = collectFolderPaths(fileTree);
        set(
          { expandedPaths: new Set(allFolders) },
          false,
          'expandAll'
        );
      },

      collapseAll: () => {
        set({ expandedPaths: new Set() }, false, 'collapseAll');
      },
    }),
    { name: 'explorer-store' }
  )
);
