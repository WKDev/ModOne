import { useRef, useState, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tab } from './Tab';
import { TabState } from '../../types/tab';
import { usePanelStore } from '../../stores/panelStore';

export interface TabBarProps {
  panelId: string;
  tabs: TabState[];
  activeTabId: string | null;
  onContextMenu?: (tabId: string, e: React.MouseEvent) => void;
  onAddTab?: () => void;
}

export function TabBar({
  panelId,
  tabs,
  activeTabId,
  onContextMenu,
  onAddTab,
}: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { setActiveTab, removeTab, reorderTabs } = usePanelStore();

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const hasOverflow = container.scrollWidth > container.clientWidth;
    setShowScrollButtons(hasOverflow);
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  }, []);

  // Scroll handlers
  const scrollLeft = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ left: -150, behavior: 'smooth' });
    setTimeout(updateScrollState, 300);
  };

  const scrollRight = () => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollBy({ left: 150, behavior: 'smooth' });
    setTimeout(updateScrollState, 300);
  };

  // Tab action handlers
  const handleTabActivate = (tabId: string) => {
    setActiveTab(panelId, tabId);
  };

  const handleTabClose = (tabId: string) => {
    removeTab(panelId, tabId);
  };

  const handleTabContextMenu = (tabId: string, e: React.MouseEvent) => {
    onContextMenu?.(tabId, e);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('tab-index', String(index));
    e.dataTransfer.setData('panel-id', panelId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('tab-index'), 10);
    const sourcePanelId = e.dataTransfer.getData('panel-id');

    if (sourcePanelId === panelId && !isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderTabs(panelId, fromIndex, toIndex);
    }

    setDragOverIndex(null);
  };

  // Empty state
  if (tabs.length === 0) {
    return (
      <div className="flex items-center h-8 bg-gray-900 border-b border-gray-700 px-2">
        <span className="text-xs text-gray-500 italic">No tabs</span>
        {onAddTab && (
          <button
            className="ml-2 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-700 text-gray-400 hover:text-white"
            onClick={onAddTab}
            title="Add tab"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center h-8 bg-gray-900 border-b border-gray-700">
      {/* Left scroll button */}
      {showScrollButtons && (
        <button
          className={`flex-shrink-0 w-6 h-full flex items-center justify-center
            ${canScrollLeft
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-gray-600 cursor-not-allowed'
            }`}
          onClick={scrollLeft}
          disabled={!canScrollLeft}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Tabs container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-stretch overflow-x-auto scrollbar-hide"
        onScroll={updateScrollState}
        onMouseEnter={updateScrollState}
      >
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`relative ${
              dragOverIndex === index ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
          >
            <Tab
              id={tab.id}
              title={tab.title}
              isActive={tab.id === activeTabId}
              isModified={tab.isModified}
              onActivate={() => handleTabActivate(tab.id)}
              onClose={() => handleTabClose(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(tab.id, e)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
            />
          </div>
        ))}

        {/* Drop zone at end */}
        <div
          className={`flex-shrink-0 w-4 h-full ${
            dragOverIndex === tabs.length
              ? 'bg-blue-500/20 border-l-2 border-blue-500'
              : ''
          }`}
          onDragOver={(e) => handleDragOver(e, tabs.length)}
          onDrop={(e) => handleDrop(e, tabs.length)}
        />
      </div>

      {/* Right scroll button */}
      {showScrollButtons && (
        <button
          className={`flex-shrink-0 w-6 h-full flex items-center justify-center
            ${canScrollRight
              ? 'text-gray-400 hover:text-white hover:bg-gray-700'
              : 'text-gray-600 cursor-not-allowed'
            }`}
          onClick={scrollRight}
          disabled={!canScrollRight}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Add tab button */}
      {onAddTab && (
        <button
          className="flex-shrink-0 w-6 h-full flex items-center justify-center border-l border-gray-700
            text-gray-400 hover:text-white hover:bg-gray-700"
          onClick={onAddTab}
          title="Add tab"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}

// Helper function to get icon for panel type
export function getPanelTypeIcon(_panelType: string): React.ReactNode {
  // Can be extended with actual icons per panel type
  return null;
}
