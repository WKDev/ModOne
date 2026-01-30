import { useEffect, useState, useMemo, useCallback } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { useLayoutPersistenceStore } from './stores/layoutPersistenceStore';
import { useToolPanelStore } from './stores/toolPanelStore';
import { usePanelStore } from './stores/panelStore';
import { ThemeProvider } from './providers/ThemeProvider';
import { useStateSync } from './hooks/useStateSync';
import { useWindowClose } from './hooks/useWindowClose';
import { FloatingWindowContent } from './components/floating/FloatingWindowContent';
import { FloatingWindowRenderer } from './components/floating/FloatingWindowRenderer';
import { CommandPalette, useCommandPalette, registerAllCommands } from './components/CommandPalette';
import { ProjectDialogProvider } from './contexts/ProjectDialogContext';
import { UnsavedChangesDialog } from './components/project/UnsavedChangesDialog';

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
 * Main window content - full application with VSCode-style layout
 */
function MainWindowContent() {
  const { initialize, saveLastSession } = useLayoutPersistenceStore();
  const initializeToolPanel = useToolPanelStore((state) => state.initializeDefaultTabs);
  const toolPanelTabs = useToolPanelStore((state) => state.tabs);
  const openSettingsTab = usePanelStore((state) => state.openSettingsTab);
  const [isInitialized, setIsInitialized] = useState(false);

  // Command palette state (useCommandPalette hook handles Ctrl+Shift+P shortcut)
  const { isOpen: isPaletteOpen, close: closePalette } = useCommandPalette();

  // Handle Ctrl+, keyboard shortcut for settings
  const handleSettingsShortcut = useCallback((e: KeyboardEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd && e.key === ',') {
      e.preventDefault();
      openSettingsTab();
    }
  }, [openSettingsTab]);

  useEffect(() => {
    document.addEventListener('keydown', handleSettingsShortcut);
    return () => document.removeEventListener('keydown', handleSettingsShortcut);
  }, [handleSettingsShortcut]);

  // Window close handling with unsaved changes detection
  const {
    isDialogOpen: isWindowCloseDialogOpen,
    handleSaveAll: handleWindowCloseSaveAll,
    handleDontSave: handleWindowCloseDontSave,
    handleCancel: handleWindowCloseCancel,
  } = useWindowClose();

  // Initialize cross-window state synchronization
  useStateSync();

  // Register all commands on mount
  useEffect(() => {
    registerAllCommands();
  }, []);

  // Initialize layout persistence on mount
  useEffect(() => {
    const initApp = async () => {
      await initialize();
      setIsInitialized(true);
    };
    initApp();
  }, [initialize]);

  // Initialize tool panel tabs if not already done
  useEffect(() => {
    if (isInitialized && toolPanelTabs.length === 0) {
      initializeToolPanel();
    }
  }, [isInitialized, toolPanelTabs.length, initializeToolPanel]);

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

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <ProjectDialogProvider>
      <MainLayout />
      {/* Floating window event listener (only needed in main window) */}
      <FloatingWindowRenderer />
      {/* Command Palette */}
      <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} />
      {/* Window Close Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={isWindowCloseDialogOpen}
        onSave={handleWindowCloseSaveAll}
        onDontSave={handleWindowCloseDontSave}
        onCancel={handleWindowCloseCancel}
      />
    </ProjectDialogProvider>
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
