import { MacWindowBar } from "./MacWindowBar";
import { MenuBar } from './MenuBar';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { Sidebar } from './Sidebar';
import { EditorArea } from './EditorArea';
import { ToolPanel } from './ToolPanel';

export function MainLayout() {
  const IS_MAC = navigator.userAgent.includes("Mac");
  return (
    <div data-testid="main-layout" className="h-screen w-screen overflow-hidden flex flex-col bg-gray-900 text-gray-100">
      {/* Header: Menu Bar + Toolbar */}
      <header className="flex-shrink-0">
        {IS_MAC ? <MacWindowBar /> : <MenuBar />}
        <Toolbar />
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Activity Bar */}
        <Sidebar />

        {/* Main Content: Editor + Tool Panel (VSCode-style) */}
        <main data-testid="panel-container" className="flex-1 flex flex-col overflow-hidden bg-gray-900">
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
