import { Table, FileSpreadsheet } from 'lucide-react';
import { commandRegistry } from '../commandRegistry';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { windowService } from '../../../services/windowService';
import type { Command } from '../types';

export function registerLayoutCommands(): void {
  const commands: Command[] = [
    {
      id: 'layout.openSheetEditor',
      category: 'view',
      label: 'Open Sheet Editor',
      description: 'Open an empty Sheet Editor tab',
      icon: <Table size={16} />,
      keywords: ['sheet', 'editor', 'csv', 'table', 'spreadsheet'],
      execute: () => {
        const { tabs, addTab, setActiveTab } = useEditorAreaStore.getState();

        const existingTab = tabs.find((t) => t.panelType === 'sheet-editor' && !t.data?.filePath);
        if (existingTab) {
          setActiveTab(existingTab.id);
          return;
        }

        addTab('sheet-editor', 'Sheet Editor');
      },
    },
    {
      id: 'tools.openSheetEditorPopup',
      category: 'view',
      label: 'Sheet Editor (Popup)',
      description: 'Open Sheet Editor in a floating popup window',
      icon: <FileSpreadsheet size={16} />,
      keywords: ['sheet', 'editor', 'popup', 'floating', 'window', 'tools'],
      execute: async () => {
        try {
          await windowService.createFloatingWindow(
            `sheet-editor-popup-${Date.now()}`,
            'sheet-editor',
            { x: 100, y: 100, width: 900, height: 600 },
          );
        } catch (err) {
          // Fallback: open as a tab if popup fails
          const { addTab } = useEditorAreaStore.getState();
          addTab('sheet-editor', 'Sheet Editor');
        }
      },
    },
  ];

  commandRegistry.registerAll(commands);
}
