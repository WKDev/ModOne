import { ReactNode } from 'react';
import { MenuBar } from './MenuBar';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children?: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gray-900 text-gray-100">
      {/* Header: Menu Bar + Toolbar */}
      <header className="flex-shrink-0">
        <MenuBar />
        <Toolbar />
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Activity Bar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gray-900">
          {children}
        </main>
      </div>

      {/* Footer: Status Bar */}
      <footer className="flex-shrink-0">
        <StatusBar />
      </footer>
    </div>
  );
}
