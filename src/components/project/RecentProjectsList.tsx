/**
 * RecentProjectsList Component
 *
 * Displays a list of recently opened projects with click-to-open
 * and right-click context menu for removal.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, MoreVertical, Trash2, FolderOpen, Clock } from 'lucide-react';
import { useProject } from '../../hooks/useProject';
import type { RecentProject } from '../../types/project';

interface RecentProjectsListProps {
  onProjectOpen?: () => void;
  maxItems?: number;
  compact?: boolean;
}

/**
 * Format relative time from ISO string
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

/**
 * Truncate path with ellipsis in the middle
 */
function truncatePath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;

  const fileName = path.split(/[/\\]/).pop() || '';
  const availableLength = maxLength - fileName.length - 5; // 5 for "...//"

  if (availableLength <= 0) {
    return `.../${fileName}`;
  }

  const start = path.substring(0, availableLength);
  return `${start}.../${fileName}`;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  project: RecentProject | null;
}

export function RecentProjectsList({
  onProjectOpen,
  maxItems = 10,
  compact = false,
}: RecentProjectsListProps) {
  const { recentProjects, openProject, removeFromRecent, isLoading } = useProject();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    project: null,
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
      }
    };

    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.isOpen]);

  // Handle project click
  const handleProjectClick = useCallback(
    async (project: RecentProject) => {
      try {
        await openProject(project.path);
        onProjectOpen?.();
      } catch (err) {
        console.error('Failed to open project:', err);
      }
    },
    [openProject, onProjectOpen]
  );

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, project: RecentProject) => {
      e.preventDefault();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        project,
      });
    },
    []
  );

  // Handle context menu actions
  const handleRemoveFromList = useCallback(async () => {
    if (contextMenu.project) {
      await removeFromRecent(contextMenu.project.path);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, [contextMenu.project, removeFromRecent]);

  const handleOpenFromContext = useCallback(async () => {
    if (contextMenu.project) {
      await handleProjectClick(contextMenu.project);
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, [contextMenu.project, handleProjectClick]);

  // Display items
  const displayProjects = recentProjects.slice(0, maxItems);

  if (displayProjects.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">최근 프로젝트가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Project List */}
      <div className="space-y-1">
        {displayProjects.map((project) => (
          <div
            key={project.path}
            onClick={() => handleProjectClick(project)}
            onContextMenu={(e) => handleContextMenu(e, project)}
            className={`
              group flex items-center gap-3 px-3 py-2 rounded cursor-pointer
              hover:bg-[var(--bg-secondary)] transition-colors
              ${isLoading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            {/* Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--accent-color)]/10 flex items-center justify-center">
              <FileText size={16} className="text-[var(--accent-color)]" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                {project.name}
              </div>
              {!compact && (
                <div className="text-xs text-[var(--text-muted)] truncate" title={project.path}>
                  {truncatePath(project.path)}
                </div>
              )}
            </div>

            {/* Time */}
            <div className="flex-shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Clock size={12} />
              <span>{formatRelativeTime(project.last_opened)}</span>
            </div>

            {/* More button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, project);
              }}
              className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] rounded transition-opacity"
            >
              <MoreVertical size={14} className="text-[var(--text-muted)]" />
            </button>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu.isOpen && contextMenu.project && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[160px] z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={handleOpenFromContext}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <FolderOpen size={14} />
            <span>열기</span>
          </button>
          <div className="border-t border-[var(--border-color)] my-1" />
          <button
            onClick={handleRemoveFromList}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
            <span>목록에서 제거</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default RecentProjectsList;
