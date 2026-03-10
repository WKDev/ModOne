/**
 * Floating Window Content
 *
 * Main content component for floating windows.
 * Renders the panel content with a window header.
 */

import { useCallback, useState, useEffect } from 'react';
import { Window } from '@tauri-apps/api/window';
import { usePanelStore } from '../../stores/panelStore';

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
import { SymbolEditorPanel } from '../panels/content/SymbolEditorPanel';
import { WelcomePanel } from '../panels/content/WelcomePanel';
import { ProjectSettingsPanel } from '../panels/content/ProjectSettingsPanel';
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
  'symbol-editor': SymbolEditorPanel,
  'welcome': WelcomePanel,
  'project-settings': ProjectSettingsPanel,
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
  const [isLoading, setIsLoading] = useState(!panel);

  useEffect(() => {
    if (panel) {
      setIsLoading(false);
      return;
    }

    // Poll for panel availability (state sync may be in progress)
    const maxRetries = 30; // 30 x 100ms = 3 seconds
    let retries = 0;
    const timer = setInterval(() => {
      const currentPanel = usePanelStore.getState().panels.find((p) => p.id === panelId);
      if (currentPanel) {
        setIsLoading(false);
        clearInterval(timer);
      } else if (++retries >= maxRetries) {
        setIsLoading(false);
        clearInterval(timer);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [panel, panelId]);

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

    } catch (error) {
      console.error('Failed to close window:', error);
    }
  }, [windowId]);

  if (!panel) {
    if (isLoading) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-text-secondary)] rounded-full animate-spin" />
            <span className="text-sm">Loading panel...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]">
        Panel not found
      </div>
    );
  }

  const ContentComponent = panelContentMap[panel.type];

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
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
