/**
 * Floating Window Content
 *
 * Main content component for floating windows.
 * Renders the panel content with a window header.
 */

import { useCallback } from 'react';
import { Window } from '@tauri-apps/api/window';
import { usePanelStore } from '../../stores/panelStore';
import { useWindowStore } from '../../stores/windowStore';
import { windowService } from '../../services/windowService';
import { FloatingWindowHeader } from './FloatingWindowHeader';

// Panel content components
import { LadderEditorPanel } from '../panels/content/LadderEditorPanel';
import { MemoryVisualizerPanel } from '../panels/content/MemoryVisualizerPanel';
import { OneCanvasPanel } from '../panels/content/OneCanvasPanel';
import { ScenarioEditorPanel } from '../panels/content/ScenarioEditorPanel';
import { ConsolePanel } from '../panels/content/ConsolePanel';
import { PropertiesPanel } from '../panels/content/PropertiesPanel';
import { CsvViewerPanel } from '../panels/content/CsvViewerPanel';
import { SettingsPanel } from '../panels/content/SettingsPanel';
import type { PanelType } from '../../types/panel';

const panelContentMap: Record<PanelType, React.ComponentType> = {
  'ladder-editor': LadderEditorPanel,
  'memory-visualizer': MemoryVisualizerPanel,
  'one-canvas': OneCanvasPanel,
  'scenario-editor': ScenarioEditorPanel,
  'console': ConsolePanel,
  'properties': PropertiesPanel,
  'csv-viewer': CsvViewerPanel,
  'settings': SettingsPanel,
};

interface FloatingWindowContentProps {
  /** ID of the Tauri window */
  windowId: string;
  /** ID of the panel to display */
  panelId: string;
}

export function FloatingWindowContent({
  windowId,
  panelId,
}: FloatingWindowContentProps) {
  const panel = usePanelStore((state) =>
    state.panels.find((p) => p.id === panelId)
  );
  const dockPanel = usePanelStore((state) => state.dockPanel);
  const removePanel = usePanelStore((state) => state.removePanel);
  const unregisterFloatingWindow = useWindowStore(
    (state) => state.unregisterFloatingWindow
  );

  const handleDock = useCallback(async () => {
    try {
      await dockPanel(panelId);
    } catch (error) {
      console.error('Failed to dock panel:', error);
    }
  }, [dockPanel, panelId]);

  const handleMinimize = useCallback(async () => {
    try {
      const currentWindow = Window.getCurrent();
      await currentWindow.minimize();
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      const currentWindow = Window.getCurrent();
      const isMaximized = await currentWindow.isMaximized();
      if (isMaximized) {
        await currentWindow.unmaximize();
      } else {
        await currentWindow.maximize();
      }
    } catch (error) {
      console.error('Failed to maximize window:', error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await windowService.closeFloatingWindow(windowId);
      unregisterFloatingWindow(windowId);
      removePanel(panelId);
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }, [windowId, panelId, unregisterFloatingWindow, removePanel]);

  if (!panel) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-gray-400">
        Panel not found
      </div>
    );
  }

  const ContentComponent = panelContentMap[panel.type];

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 overflow-hidden">
      <FloatingWindowHeader
        title={panel.title}
        windowId={windowId}
        panelId={panelId}
        onDock={handleDock}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
      />
      <div className="flex-1 overflow-auto">
        <ContentComponent />
      </div>
    </div>
  );
}
