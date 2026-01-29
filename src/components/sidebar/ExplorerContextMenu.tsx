/**
 * Explorer Context Menu
 *
 * Right-click context menu for files and folders in the explorer panel.
 * Read-only operations only - no file system modifications.
 */

import { useEffect, useRef } from 'react';
import {
  FolderOpen,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { ProjectFileNode } from '../../types/fileTypes';

export type ExplorerContextAction =
  | 'open'
  | 'copyPath'
  | 'copyAbsolutePath'
  | 'revealInExplorer'
  | 'expand'
  | 'collapse';

interface ContextMenuItem {
  action: ExplorerContextAction;
  label: string;
  icon: React.ReactNode;
  separator?: boolean;
  showForFolder?: boolean;
  showForFile?: boolean;
}

const CONTEXT_MENU_ITEMS: ContextMenuItem[] = [
  {
    action: 'open',
    label: 'Open',
    icon: <FolderOpen size={14} />,
    showForFile: true,
  },
  {
    action: 'expand',
    label: 'Expand',
    icon: <ChevronDown size={14} />,
    showForFolder: true,
  },
  {
    action: 'collapse',
    label: 'Collapse',
    icon: <ChevronRight size={14} />,
    showForFolder: true,
  },
  {
    action: 'copyPath',
    label: 'Copy Relative Path',
    icon: <Copy size={14} />,
    separator: true,
    showForFile: true,
    showForFolder: true,
  },
  {
    action: 'copyAbsolutePath',
    label: 'Copy Absolute Path',
    icon: <Copy size={14} />,
    showForFile: true,
    showForFolder: true,
  },
  {
    action: 'revealInExplorer',
    label: 'Reveal in File Explorer',
    icon: <ExternalLink size={14} />,
    separator: true,
    showForFile: true,
    showForFolder: true,
  },
];

export interface ExplorerContextMenuProps {
  node: ProjectFileNode;
  position: { x: number; y: number };
  isExpanded?: boolean;
  onAction: (action: ExplorerContextAction, node: ProjectFileNode) => void;
  onClose: () => void;
}

export function ExplorerContextMenu({
  node,
  position,
  isExpanded,
  onAction,
  onClose,
}: ExplorerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    if (rect.right > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }
    if (rect.bottom > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [position]);

  const handleAction = (action: ExplorerContextAction) => {
    onAction(action, node);
    onClose();
  };

  // Filter items based on node type
  const isFolder = node.type === 'folder';
  const filteredItems = CONTEXT_MENU_ITEMS.filter((item) => {
    if (isFolder) {
      if (!item.showForFolder) return false;
      // Show expand/collapse based on current state
      if (item.action === 'expand' && isExpanded) return false;
      if (item.action === 'collapse' && !isExpanded) return false;
    } else {
      if (!item.showForFile) return false;
    }
    return true;
  });

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] py-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      {filteredItems.map((item, index) => (
        <div key={item.action}>
          {item.separator && index > 0 && (
            <div className="my-1 border-t border-gray-700" />
          )}
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-gray-300 hover:bg-gray-700 hover:text-white"
            onClick={() => handleAction(item.action)}
          >
            <span className="w-4 h-4 flex items-center justify-center text-gray-400">
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
