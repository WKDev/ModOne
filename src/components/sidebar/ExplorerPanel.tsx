/**
 * Explorer Panel
 *
 * Solution Explorer style file browser for navigating project files.
 * Displays a tree view of the project structure and opens files in appropriate editors.
 */

import { useState, useCallback, memo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  CircuitBoard,
  Workflow,
  Table,
  Database,
  Settings,
  PlayCircle,
  FileJson,
  FileCode,
  FolderKanban,
  RefreshCw,
  ChevronDownSquare,
  ChevronRightSquare,
} from 'lucide-react';
import { useExplorerStore } from '../../stores/explorerStore';
import { useProjectStore } from '../../stores/projectStore';
import { useFileOpen } from '../../hooks/useFileOpen';
import { getFolderIcon } from '../../utils/fileTypeResolver';
import { fileDialogService } from '../../services/fileDialogService';
import type { ProjectFileNode, FileTypeInfo } from '../../types/fileTypes';
import {
  ExplorerContextMenu,
  type ExplorerContextAction,
} from './ExplorerContextMenu';

// Icon map for file types
const FILE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  CircuitBoard,
  Workflow,
  Table,
  Database,
  Settings,
  PlayCircle,
  FileJson,
  FileCode,
  File,
  FolderKanban,
};

interface TreeItemProps {
  node: ProjectFileNode;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
  onDoubleClick: (node: ProjectFileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: ProjectFileNode) => void;
}

/**
 * Get the appropriate icon component for a file type.
 */
function getFileIcon(fileInfo?: FileTypeInfo): React.ComponentType<{ size?: number; className?: string }> {
  if (!fileInfo) return File;
  return FILE_ICONS[fileInfo.icon] || File;
}

/**
 * Get the appropriate icon component for a folder.
 */
function getFolderIconComponent(folderName: string, isOpen: boolean): React.ReactNode {
  const { icon, color } = getFolderIcon(folderName);
  const IconComponent = FILE_ICONS[icon] || (isOpen ? FolderOpen : Folder);

  if (icon === 'Folder') {
    // Use default folder/folder-open icons
    return isOpen ? (
      <FolderOpen size={16} className="text-yellow-500 flex-shrink-0" />
    ) : (
      <Folder size={16} className="text-yellow-500 flex-shrink-0" />
    );
  }

  return <IconComponent size={16} className={`${color} flex-shrink-0`} />;
}

/**
 * Single tree item component.
 */
const TreeItem = memo(function TreeItem({
  node,
  level,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: TreeItemProps) {
  const paddingLeft = level * 12 + 8;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.path);
    if (node.type === 'folder') {
      onToggleExpand(node.path);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'file') {
      onDoubleClick(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(node.path);
    onContextMenu(e, node);
  };

  const isFolder = node.type === 'folder';
  const FileIcon = getFileIcon(node.fileInfo);
  const iconColor = node.fileInfo?.color || 'text-gray-400';

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1 py-1 text-sm transition-colors
          ${isSelected
            ? 'bg-blue-600/30 text-white'
            : 'hover:bg-gray-700 text-gray-300'
          }`}
        style={{ paddingLeft }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
            )}
            {getFolderIconComponent(node.name, isExpanded)}
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileIcon size={16} className={`${iconColor} flex-shrink-0`} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItemConnected
              key={child.id}
              node={child}
              level={level + 1}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Tree item connected to the store.
 */
function TreeItemConnected({
  node,
  level,
  onDoubleClick,
  onContextMenu,
}: {
  node: ProjectFileNode;
  level: number;
  onDoubleClick: (node: ProjectFileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: ProjectFileNode) => void;
}) {
  const isExpanded = useExplorerStore((state) => state.expandedPaths.has(node.path));
  const isSelected = useExplorerStore((state) => state.selectedPath === node.path);
  const toggleFolder = useExplorerStore((state) => state.toggleFolder);
  const selectPath = useExplorerStore((state) => state.selectPath);

  return (
    <TreeItem
      node={node}
      level={level}
      isExpanded={isExpanded}
      isSelected={isSelected}
      onToggleExpand={toggleFolder}
      onSelect={selectPath}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    />
  );
}

/**
 * Toolbar for the explorer panel.
 */
function ExplorerToolbar() {
  const expandAll = useExplorerStore((state) => state.expandAll);
  const collapseAll = useExplorerStore((state) => state.collapseAll);
  const fileTree = useExplorerStore((state) => state.fileTree);

  if (fileTree.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-700">
      <button
        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
        onClick={collapseAll}
        title="Collapse All"
      >
        <ChevronRightSquare size={16} />
      </button>
      <button
        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
        onClick={expandAll}
        title="Expand All"
      >
        <ChevronDownSquare size={16} />
      </button>
    </div>
  );
}

/**
 * Main Explorer Panel component.
 */
export function ExplorerPanel() {
  const fileTree = useExplorerStore((state) => state.fileTree);
  const isLoading = useExplorerStore((state) => state.isLoading);
  const error = useExplorerStore((state) => state.error);
  const expandedPaths = useExplorerStore((state) => state.expandedPaths);
  const expandFolder = useExplorerStore((state) => state.expandFolder);
  const collapseFolder = useExplorerStore((state) => state.collapseFolder);
  const currentProject = useProjectStore((state) => state.currentProject);

  const { openFileNode } = useFileOpen();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    node: ProjectFileNode;
    position: { x: number; y: number };
  } | null>(null);

  const handleDoubleClick = useCallback(
    (node: ProjectFileNode) => {
      openFileNode(node);
    },
    [openFileNode]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: ProjectFileNode) => {
      setContextMenu({
        node,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    []
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuAction = useCallback(
    async (action: ExplorerContextAction, node: ProjectFileNode) => {
      switch (action) {
        case 'open':
          openFileNode(node);
          break;

        case 'expand':
          expandFolder(node.path);
          break;

        case 'collapse':
          collapseFolder(node.path);
          break;

        case 'copyPath':
          await navigator.clipboard.writeText(node.path);
          break;

        case 'copyAbsolutePath':
          await navigator.clipboard.writeText(node.absolutePath);
          break;

        case 'revealInExplorer':
          // Use Tauri shell API to open the file location
          // This requires importing shell from @tauri-apps/plugin-shell
          try {
            const { open } = await import('@tauri-apps/plugin-shell');
            // Get the parent directory for files, or the directory itself for folders
            const pathToOpen = node.type === 'folder'
              ? node.absolutePath
              : node.absolutePath.substring(0, node.absolutePath.lastIndexOf('\\'));
            await open(pathToOpen);
          } catch (err) {
            console.error('Failed to open file explorer:', err);
          }
          break;

        case 'newCanvas':
          fileDialogService.requestNewCanvas(node.absolutePath);
          break;

        case 'newLadder':
          fileDialogService.requestNewLadder(node.absolutePath);
          break;

        case 'newScenario':
          fileDialogService.requestNewScenario(node.absolutePath);
          break;
      }
    },
    [openFileNode, expandFolder, collapseFolder]
  );

  // No project open state
  if (!currentProject) {
    return (
      <div className="py-2">
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          <p>No project open</p>
          <p className="mt-2 text-xs">
            Use File &gt; Open Project to get started
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="py-2">
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
          <p>Loading project files...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="py-2">
        <div className="px-4 py-8 text-center text-red-400 text-sm">
          <p>Error loading files</p>
          <p className="mt-2 text-xs text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // Empty tree state
  if (fileTree.length === 0) {
    return (
      <div className="py-2">
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          <p>No files in project</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ExplorerToolbar />
      <div className="flex-1 overflow-auto py-1">
        {fileTree.map((node) => (
          <TreeItemConnected
            key={node.id}
            node={node}
            level={0}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ExplorerContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          isExpanded={expandedPaths.has(contextMenu.node.path)}
          onAction={handleContextMenuAction}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
}
