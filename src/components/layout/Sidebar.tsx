import { useCallback, useEffect, useRef, useState } from 'react';
import { useSidebarStore } from '../../stores/sidebarStore';
import { ActivityBar } from './ActivityBar';
import { ExplorerPanel } from '../sidebar/ExplorerPanel';
import { SearchPanel } from '../sidebar/SearchPanel';
import { ModbusPanel } from '../sidebar/ModbusPanel';
import { SettingsPanel } from '../sidebar/SettingsPanel';

export function Sidebar() {
  const { activePanel, isVisible, width, setWidth } = useSidebarStore();
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
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  return (
    <div ref={sidebarRef} data-testid="sidebar" className="flex h-full">
      <ActivityBar />

      <div
        data-testid="sidebar-content"
        className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-200 overflow-hidden ${
          isVisible ? '' : 'w-0'
        }`}
        style={{ width: isVisible ? width : 0 }}
      >
        {/* Panel Header */}
        <div data-testid="sidebar-header" className="h-9 px-4 flex items-center border-b border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {activePanel}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-auto">
          {renderPanel()}
        </div>
      </div>

      {/* Resize Handle */}
      {isVisible && (
        <div
          data-testid="sidebar-resize-handle"
          className="w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-500 transition-colors"
          onMouseDown={startResizing}
        />
      )}
    </div>
  );
}
