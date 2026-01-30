/**
 * Editor Area Component
 *
 * Main editor area in the VSCode-style layout.
 * Displays all editor-type panels (canvas, ladder, scenario, csv) as tabs.
 */

import { useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEditorAreaStore } from '../../stores/editorAreaStore';
import { Tab } from '../panels/Tab';
import { TabContent } from '../panels/TabContent';
import { useTabClose } from '../../hooks/useTabClose';
import { UnsavedChangesDialog } from '../project/UnsavedChangesDialog';

export function EditorArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    tabIndex: number;
    position: { x: number; y: number };
  } | null>(null);

  const { tabs, activeTabId, setActiveTab, reorderTabs } = useEditorAreaStore();

  // Tab close handling with unsaved changes support
  const {
    isDialogOpen,
    requestClose: requestTabClose,
    handleSave,
    handleDontSave,
    handleCancel,
  } = useTabClose();

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
    setActiveTab(tabId);
  };

  const handleTabClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      // Use a pseudo panel ID for editor area tabs
      requestTabClose('editor-area', tab);
    }
  };

  const handleTabContextMenu = (tabId: string, e: React.MouseEvent) => {
    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    setContextMenu({
      tabId,
      tabIndex,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('editor-tab-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
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
    const fromIndex = parseInt(e.dataTransfer.getData('editor-tab-index'), 10);

    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderTabs(fromIndex, toIndex);
    }

    setDragOverIndex(null);
  };

  // Empty state
  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full w-full bg-gray-900">
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No files open</p>
            <p className="text-sm">Open a file from the Explorer to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-900">
      {/* Tab Bar */}
      <div className="flex items-center h-9 bg-gray-900 border-b border-gray-700 flex-shrink-0">
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
                dragOverIndex === index
                  ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500'
                  : ''
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
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        <TabContent tabs={tabs} activeTabId={activeTabId} />
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <EditorAreaContextMenu
          tabId={contextMenu.tabId}
          tabIndex={contextMenu.tabIndex}
          totalTabs={tabs.length}
          position={contextMenu.position}
          onClose={closeContextMenu}
        />
      )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={isDialogOpen}
        onSave={handleSave}
        onDontSave={handleDontSave}
        onCancel={handleCancel}
      />
    </div>
  );
}

/**
 * Context menu for editor area tabs
 * Uses the editor area store instead of panel store
 */
function EditorAreaContextMenu({
  tabId,
  tabIndex,
  totalTabs,
  position,
  onClose,
}: {
  tabId: string;
  tabIndex: number;
  totalTabs: number;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const { removeTab, closeOtherTabs, closeTabsToRight, closeAllTabs, duplicateTab } =
    useEditorAreaStore();

  const handleAction = (action: string) => {
    switch (action) {
      case 'close':
        removeTab(tabId);
        break;
      case 'closeOthers':
        closeOtherTabs(tabId);
        break;
      case 'closeToRight':
        closeTabsToRight(tabId);
        break;
      case 'closeAll':
        closeAllTabs();
        break;
      case 'duplicate':
        duplicateTab(tabId);
        break;
    }
    onClose();
  };

  const menuItems = [
    { action: 'close', label: 'Close', shortcut: 'Ctrl+W' },
    { action: 'closeOthers', label: 'Close Others', disabled: totalTabs <= 1 },
    { action: 'closeToRight', label: 'Close to the Right', disabled: tabIndex >= totalTabs - 1 },
    { action: 'closeAll', label: 'Close All', separator: true },
    { action: 'duplicate', label: 'Duplicate Tab' },
  ];

  return (
    <div
      className="fixed z-50 bg-gray-800 border border-gray-700 rounded shadow-lg py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <div key={item.action}>
          {item.separator && index > 0 && (
            <div className="border-t border-gray-700 my-1" />
          )}
          <button
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between
              ${item.disabled
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-gray-200 hover:bg-gray-700'
              }`}
            onClick={() => !item.disabled && handleAction(item.action)}
            disabled={item.disabled}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-gray-500 ml-4">{item.shortcut}</span>
            )}
          </button>
        </div>
      ))}

      {/* Click outside to close */}
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}
