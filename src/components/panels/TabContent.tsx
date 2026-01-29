import { memo } from 'react';
import { PanelType } from '../../types/panel';
import { TabState } from '../../types/tab';
import { LadderEditorPanel } from './content/LadderEditorPanel';
import { MemoryVisualizerPanel } from './content/MemoryVisualizerPanel';
import { OneCanvasPanel } from './content/OneCanvasPanel';
import { ScenarioEditorPanel } from './content/ScenarioEditorPanel';
import { ConsolePanel } from './content/ConsolePanel';
import { PropertiesPanel } from './content/PropertiesPanel';
import { CsvViewerPanel } from './content/CsvViewerPanel';

const panelContentMap: Record<PanelType, React.ComponentType<{ data?: unknown }>> = {
  'ladder-editor': LadderEditorPanel,
  'memory-visualizer': MemoryVisualizerPanel,
  'one-canvas': OneCanvasPanel,
  'scenario-editor': ScenarioEditorPanel,
  'console': ConsolePanel,
  'properties': PropertiesPanel,
  'csv-viewer': CsvViewerPanel,
};

export interface TabContentProps {
  tabs: TabState[];
  activeTabId: string | null;
}

/**
 * Renders the content for the active tab with lazy loading
 * Only the active tab's content is mounted to optimize performance
 */
export const TabContent = memo(function TabContent({ tabs, activeTabId }: TabContentProps) {
  // Find active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <span className="text-sm">No active tab</span>
      </div>
    );
  }

  const ContentComponent = panelContentMap[activeTab.panelType];

  if (!ContentComponent) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <span className="text-sm">Unknown panel type: {activeTab.panelType}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto animate-tab-fade-in">
      <ContentComponent data={activeTab.data} />
    </div>
  );
});
