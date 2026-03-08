import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useProjectStore } from '../../stores/projectStore';
import { useProjectDialogs } from '../../contexts/ProjectDialogContext';
import { ActivityBar } from './ActivityBar';
import { ExplorerPanel } from '../sidebar/ExplorerPanel';
import { SearchPanel } from '../sidebar/SearchPanel';
import { ModbusPanel } from '../sidebar/ModbusPanel';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { RecentProjectsList } from '../project/RecentProjectsList';

export function Sidebar() {
  const { activePanel, isVisible, width, setWidth } = useSidebarStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const { openNewProjectDialog, openOpenProjectPicker } = useProjectDialogs();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        setWidth(newWidth);
      }
    },
    [isResizing, setWidth]
  );

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const renderPanel = () => {
    switch (activePanel) {
      case 'explorer':
        return <ExplorerPanel />;
      case 'search':
        return <SearchPanel />;
      case 'modbus':
        return <ModbusPanel />;
      default:
        return null;
    }
  };

  const renderNoProjectContent = () => (
    <div className="flex flex-col h-full p-4">
      <div className="space-y-2 mb-6">
        <button
          onClick={() => openNewProjectDialog()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition-colors"
        >
          <Plus size={16} />
          <span>New Project</span>
        </button>
        <button
          onClick={() => openOpenProjectPicker()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] transition-colors"
        >
          <FolderOpen size={16} />
          <span>Open Project</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Recent Projects</h3>
        <RecentProjectsList compact maxItems={8} />
      </div>
    </div>
  );

  return (
    <div ref={sidebarRef} data-testid="sidebar" className="flex h-full">
      <ActivityBar />

      <div
        data-testid="sidebar-content"
        className={`bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col transition-all duration-200 overflow-hidden ${
          isVisible ? '' : 'w-0'
        }`}
        style={{ width: isVisible ? width : 0 }}
      >
        {/* Panel Header */}
        <div data-testid="sidebar-header" className="h-9 px-4 flex items-center border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {currentProject ? activePanel : 'start'}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-auto">
          {currentProject ? (
            <PanelErrorBoundary key={activePanel} panelName={activePanel}>
              {renderPanel()}
            </PanelErrorBoundary>
          ) : (
            renderNoProjectContent()
          )}
        </div>
      </div>

      {/* Resize Handle */}
      {isVisible && (
        <div
          data-testid="sidebar-resize-handle"
          className="w-1 cursor-col-resize hover:bg-[var(--color-accent)] active:bg-[var(--color-accent)] transition-colors"
          onMouseDown={startResizing}
        />
      )}
    </div>
  );
}
