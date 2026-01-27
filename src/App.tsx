import { useEffect, useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { PanelContainer } from './components/panels';
import { usePanelStore } from './stores/panelStore';
import { useLayoutPersistenceStore } from './stores/layoutPersistenceStore';

function App() {
  const { panels, addPanel } = usePanelStore();
  const { initialize, saveLastSession, isLoading } = useLayoutPersistenceStore();
  const [isInitialized, setIsInitialized] = useState(false);

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
    <MainLayout>
      <PanelContainer />
    </MainLayout>
  );
}

export default App;
