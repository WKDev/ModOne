/**
 * Right Dock Component
 *
 * 우측 인스펙터 도킹 패널. Memory Visualizer / Properties 등 인스펙터 패널을
 * 세로 탭으로 띄우고 기본적으로 화면의 1/4 폭을 차지한다.
 * 좌측 엣지를 드래그해 폭을 조절한다. ToolPanel(하단)의 width 버전.
 */

import { useCallback, useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useRightDockStore } from '../../stores/rightDockStore';
import { TabContent } from '../panels/TabContent';
import { ResizeHandle } from './ResizeHandle';

export function RightDock() {
  const {
    isVisible,
    width,
    tabs,
    activeTabId,
    isResizing,
    toggle,
    hide,
    setWidth,
    setActiveTab,
    setResizing,
    initializeDefaultTabs,
  } = useRightDockStore();

  // Initialize default tabs on mount
  useEffect(() => {
    if (tabs.length === 0) {
      initializeDefaultTabs();
    }
  }, [tabs.length, initializeDefaultTabs]);

  const handleResize = useCallback(
    // ResizeHandle delta is positive when dragging left → widen the dock.
    (delta: number) => {
      setWidth(width + delta);
    },
    [width, setWidth]
  );

  const handleResizeStart = useCallback(() => setResizing(true), [setResizing]);
  const handleResizeEnd = useCallback(() => setResizing(false), [setResizing]);

  // Collapsed state - show a thin vertical reopen strip.
  if (!isVisible) {
    return (
      <div className="flex-shrink-0 w-8 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col items-center py-2">
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          onClick={toggle}
          title="Show Inspector"
        >
          <ChevronRight size={14} className="rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="right-dock"
      className="flex-shrink-0 flex border-l border-[var(--color-border)] bg-[var(--color-bg-primary)]"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle on the left edge */}
      <ResizeHandle
        direction="vertical"
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header / Tab Bar */}
        <div className="flex items-center h-8 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <DockTab
                key={tab.id}
                id={tab.id}
                title={tab.title}
                isActive={tab.id === activeTabId}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 px-2">
            <button
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              onClick={toggle}
              title="Collapse Inspector"
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-error)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              onClick={hide}
              title="Close Inspector"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-hidden ${isResizing ? 'pointer-events-none' : ''}`}>
          <TabContent tabs={tabs} activeTabId={activeTabId} />
        </div>
      </div>
    </div>
  );
}

function DockTab({
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
          ? 'text-[var(--color-text-primary)] border-b-2 border-[var(--color-accent)] bg-[var(--color-bg-primary)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border-b-2 border-transparent'
        }`}
      onClick={onClick}
    >
      {title}
    </button>
  );
}
