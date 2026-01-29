import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { PanelContainer } from './components/panels';
import { usePanelStore } from './stores/panelStore';
import { useLayoutPersistenceStore } from './stores/layoutPersistenceStore';
import { ThemeProvider } from './providers/ThemeProvider';
import { PanelDndProvider } from './providers/PanelDndProvider';
import { useStateSync } from './hooks/useStateSync';
import { FloatingWindowContent } from './components/floating/FloatingWindowContent';
import { FloatingWindowRenderer } from './components/floating/FloatingWindowRenderer';

/**
 * Parse URL parameters to detect floating window mode
 */
function useFloatingWindowParams() {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const isFloating = params.get('floating') === 'true';
    const windowId = params.get('windowId');
    const panelId = params.get('panelId');
    const panelType = params.get('panelType');

    return {
      isFloating,
      windowId,
      panelId,
      panelType,
    };
  }, []);
}

/**
 * Main window content - full application with layout and panels
 */
function MainWindowContent() {
  const { panels, addPanel } = usePanelStore();
  const { initialize, saveLastSession, isLoading } = useLayoutPersistenceStore();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize cross-window state synchronization
  useStateSync();

  // Initialize layout persistence on mount
  useEffect(() => {
    const initApp = async () => {
      await initialize();
      setIsInitialized(true);
    };
    initApp();
  }, [initialize]);

  // Save session before window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Note: This is synchronous, so we can't await the save
      // The store handles this appropriately
      saveLastSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveLastSession]);

  // Add default panels only if layout hasn't been loaded from persistence
  useEffect(() => {
    if (isInitialized && !isLoading && panels.length === 0) {
      addPanel('console', '1 / 1 / 2 / 2');
      addPanel('properties', '1 / 2 / 2 / 3');
    }
  }, [isInitialized, isLoading, panels.length, addPanel]);

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <PanelDndProvider>
      <MainLayout>
        <PanelContainer />
      </MainLayout>
      {/* Floating window event listener (only needed in main window) */}
      <FloatingWindowRenderer />
    </PanelDndProvider>
  );
}

/**
 * Floating window content - simplified view for detached panels
 */
function FloatingWindowApp({ windowId, panelId }: { windowId: string; panelId: string }) {
  // Initialize cross-window state synchronization
  useStateSync();

  return <FloatingWindowContent windowId={windowId} panelId={panelId} />;
}

/**
 * Root App component - routes between main and floating window modes
 */
function App() {
  const { isFloating, windowId, panelId } = useFloatingWindowParams();

  // Floating window mode - render simplified content
  if (isFloating && windowId && panelId) {
    return (
      <ThemeProvider defaultTheme="dark">
        <FloatingWindowApp windowId={windowId} panelId={panelId} />
      </ThemeProvider>
    );
  }

  // Main window mode - render full application
  return (
    <ThemeProvider defaultTheme="dark">
      <MainWindowContent />
    </ThemeProvider>
  );
}

export default App;
