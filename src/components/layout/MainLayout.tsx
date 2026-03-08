import { useEffect } from 'react';
import { MenuBar } from './MenuBar';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { Sidebar } from './Sidebar';
import { EditorArea } from './EditorArea';
import { ToolPanel } from './ToolPanel';
import { useProjectStore } from '../../stores/projectStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useEditorAreaStore } from '../../stores/editorAreaStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function MainLayout() {
  const IS_MAC = navigator.userAgent.includes("Mac");

  useEffect(() => {
    const { currentProject } = useProjectStore.getState();
    if (!currentProject) {
      const { isVisible } = useSidebarStore.getState();
      if (isVisible) {
        useSidebarStore.getState().toggleVisibility();
      }

      const loadAndOpenWelcome = async () => {
        await useSettingsStore.getState().loadSettings();
        const { settings } = useSettingsStore.getState();
        if (settings.showWelcomePageOnStartup) {
          useEditorAreaStore.getState().openWelcomeTab();
        }
      };
      loadAndOpenWelcome();
    }
  }, []);

  return (
    <div data-testid="main-layout" className="h-screen w-screen overflow-hidden flex flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header: Menu Bar + Toolbar */}
      <header className="flex-shrink-0">
        {!IS_MAC && <MenuBar />}
        <Toolbar />
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Activity Bar */}
        <Sidebar />

        {/* Main Content: Editor + Tool Panel (VSCode-style) */}
        <main data-testid="panel-container" className="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg-primary)]">
          {/* Editor Area - takes remaining space */}
          <div className="flex-1 overflow-hidden">
            <EditorArea />
          </div>

          {/* Tool Panel - collapsible bottom panel */}
          <ToolPanel />
        </main>
      </div>

      {/* Footer: Status Bar */}
      <footer className="flex-shrink-0">
        <StatusBar />
      </footer>
    </div>
  );
}
