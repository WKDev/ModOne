import { memo } from 'react';
import { PanelType } from '../../types/panel';
import { TabState } from '../../types/tab';
import { DocumentType } from '../../types/document';
import { DocumentProvider } from '../../contexts/DocumentContext';
import { LadderEditorPanel } from './content/LadderEditorPanel';
import { MemoryVisualizerPanel } from './content/MemoryVisualizerPanel';
import { OneCanvasPanel } from './content/OneCanvasPanel';
import { ScenarioEditorPanel } from './content/ScenarioEditorPanel';
import { ConsolePanel } from './content/ConsolePanel';
import { PropertiesPanel } from './content/PropertiesPanel';
import { CsvViewerPanel } from './content/CsvViewerPanel';
import { SettingsPanel } from './content/SettingsPanel';

const panelContentMap: Record<PanelType, React.ComponentType<{ data?: unknown }>> = {
  'ladder-editor': LadderEditorPanel,
  'memory-visualizer': MemoryVisualizerPanel,
  'one-canvas': OneCanvasPanel,
  'scenario-editor': ScenarioEditorPanel,
  'console': ConsolePanel,
  'properties': PropertiesPanel,
  'csv-viewer': CsvViewerPanel,
  'settings': SettingsPanel,
};

/**
 * Mapping from panel type to document type.
 * Only panels that support document-based editing have mappings.
 */
const panelTypeToDocumentType: Partial<Record<PanelType, DocumentType>> = {
  'one-canvas': 'canvas',
  'ladder-editor': 'ladder',
  'scenario-editor': 'scenario',
};

export interface TabContentProps {
  tabs: TabState[];
  activeTabId: string | null;
}

/**
 * Renders the content for the active tab with lazy loading
 * Only the active tab's content is mounted to optimize performance.
 *
 * If the tab has a documentId, the content is wrapped with DocumentProvider
 * to give child components access to the document context.
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

  // Check if this tab has a document associated with it
  const documentId = activeTab.data?.documentId as string | undefined;
  const documentType = panelTypeToDocumentType[activeTab.panelType];

  // Wrap with DocumentProvider if we have a document
  if (documentId && documentType) {
    return (
      <div className="flex-1 overflow-auto animate-tab-fade-in">
        <DocumentProvider
          documentId={documentId}
          documentType={documentType}
          tabId={activeTab.id}
        >
          <ContentComponent data={activeTab.data} />
        </DocumentProvider>
      </div>
    );
  }

  // No document - render without provider (will use global store)
  return (
    <div className="flex-1 overflow-auto animate-tab-fade-in">
      <ContentComponent data={activeTab.data} />
    </div>
  );
});
