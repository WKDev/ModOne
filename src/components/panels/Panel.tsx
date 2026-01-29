import { useState } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { PanelProps, PanelType } from '../../types/panel';
import { TabState } from '../../types/tab';
import { LadderEditorPanel } from './content/LadderEditorPanel';
import { MemoryVisualizerPanel } from './content/MemoryVisualizerPanel';
import { OneCanvasPanel } from './content/OneCanvasPanel';
import { ScenarioEditorPanel } from './content/ScenarioEditorPanel';
import { ConsolePanel } from './content/ConsolePanel';
import { PropertiesPanel } from './content/PropertiesPanel';
import { CsvViewerPanel } from './content/CsvViewerPanel';
import { TabBar } from './TabBar';
import { TabContent } from './TabContent';
import { TabContextMenu } from './TabContextMenu';

const panelContentMap: Record<PanelType, React.ComponentType> = {
  'ladder-editor': LadderEditorPanel,
  'memory-visualizer': MemoryVisualizerPanel,
  'one-canvas': OneCanvasPanel,
  'scenario-editor': ScenarioEditorPanel,
  'console': ConsolePanel,
  'properties': PropertiesPanel,
  'csv-viewer': CsvViewerPanel,
};

export interface ExtendedPanelProps extends PanelProps {
  tabs?: TabState[];
  activeTabId?: string | null;
  onAddTab?: () => void;
}

export function Panel({
  id,
  type,
  title,
  isActive,
  gridArea,
  onClose,
  onMinimize,
  onMaximize,
  onActivate,
  tabs,
  activeTabId,
  onAddTab,
}: ExtendedPanelProps) {
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    tabIndex: number;
    position: { x: number; y: number };
  } | null>(null);

  const hasTabs = tabs && tabs.length > 0;
  const ContentComponent = panelContentMap[type];

  const handleClick = (e: React.MouseEvent) => {
    // Don't activate if clicking on header buttons
    if ((e.target as HTMLElement).closest('button')) return;
    onActivate();
  };

  const handleTabContextMenu = (tabId: string, e: React.MouseEvent) => {
    const tabIndex = tabs?.findIndex((t) => t.id === tabId) ?? -1;
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

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={gridArea ? { gridArea } : undefined}
      onClick={handleClick}
    >
      {/* Panel Header */}
      <div
        className={`h-8 flex items-center justify-between pl-7 pr-2 flex-shrink-0 ${
          isActive ? 'bg-gray-700' : 'bg-gray-800'
        } border-b border-gray-700`}
      >
        <span className="text-sm text-gray-300 truncate">{title}</span>

        <div className="flex items-center gap-1">
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            title="Maximize"
          >
            <Square size={12} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-600 text-gray-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab Bar (if tabs exist) */}
      {hasTabs && (
        <TabBar
          panelId={id}
          tabs={tabs}
          activeTabId={activeTabId ?? null}
          onContextMenu={handleTabContextMenu}
          onAddTab={onAddTab}
        />
      )}

      {/* Panel Content */}
      <div className="flex-1 overflow-auto">
        {hasTabs ? (
          <TabContent tabs={tabs} activeTabId={activeTabId ?? null} />
        ) : (
          <ContentComponent />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && tabs && (
        <TabContextMenu
          panelId={id}
          tabId={contextMenu.tabId}
          tabIndex={contextMenu.tabIndex}
          totalTabs={tabs.length}
          position={contextMenu.position}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
