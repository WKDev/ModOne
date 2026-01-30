/**
 * Tool Panel Component
 *
 * Bottom tool panel in the VSCode-style layout.
 * Contains Console, Memory Visualizer, and Properties panels as tabs.
 * Supports resizing and collapse/expand.
 */

import { useCallback, useEffect } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useToolPanelStore } from '../../stores/toolPanelStore';
import { TabContent } from '../panels/TabContent';
import { ResizeHandle } from './ResizeHandle';

export function ToolPanel() {
  const {
    isVisible,
    height,
    tabs,
    activeTabId,
    isResizing,
    toggle,
    hide,
    setHeight,
    setActiveTab,
    setResizing,
    initializeDefaultTabs,
  } = useToolPanelStore();

  // Initialize default tabs on mount
  useEffect(() => {
    if (tabs.length === 0) {
      initializeDefaultTabs();
    }
  }, [tabs.length, initializeDefaultTabs]);

  const handleResize = useCallback(
    (delta: number) => {
      // Delta is positive when dragging up (increasing height)
      setHeight(height + delta);
    },
    [height, setHeight]
  );

  const handleResizeStart = useCallback(() => {
    setResizing(true);
  }, [setResizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(false);
  }, [setResizing]);

  const handleTabActivate = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Collapsed state - show only the tab bar header
  if (!isVisible) {
    return (
      <div className="flex-shrink-0 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center h-8 px-2">
          {/* Tab buttons as toggle triggers */}
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                onClick={() => {
                  setActiveTab(tab.id);
                  toggle();
                }}
              >
                {tab.title}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Expand button */}
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-white"
            onClick={toggle}
            title="Show Panel"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col border-t border-gray-700 bg-gray-900"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <ResizeHandle
        direction="horizontal"
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />

      {/* Tool Panel Header / Tab Bar */}
      <div className="flex items-center h-8 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        {/* Tabs */}
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <ToolTab
              key={tab.id}
              id={tab.id}
              title={tab.title}
              isActive={tab.id === activeTabId}
              onClick={() => handleTabActivate(tab.id)}
            />
          ))}
        </div>

        {/* Panel Actions */}
        <div className="flex items-center gap-1 px-2">
          {/* Collapse button */}
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-white"
            onClick={toggle}
            title="Hide Panel"
          >
            <ChevronDown size={14} />
          </button>
          {/* Close button */}
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-600 text-gray-400 hover:text-white"
            onClick={hide}
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tool Panel Content */}
      <div
        className={`flex-1 overflow-hidden ${isResizing ? 'pointer-events-none' : ''}`}
      >
        <TabContent tabs={tabs} activeTabId={activeTabId} />
      </div>
    </div>
  );
}

/**
 * Tool tab component - simplified version for tool panel
 */
function ToolTab({
  id,
  title,
  isActive,
  onClick,
}: {
  id: string;
  title: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-tab-id={id}
      className={`px-4 h-full text-xs font-medium transition-colors
        ${isActive
          ? 'text-gray-100 border-b-2 border-blue-500 bg-gray-900'
          : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent'
        }`}
      onClick={onClick}
    >
      {title}
    </button>
  );
}
