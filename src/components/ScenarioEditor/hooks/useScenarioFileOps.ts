/**
 * useScenarioFileOps Hook
 *
 * File operations for scenario editor including open, save, import/export CSV.
 * Integrates with Tauri dialogs and backend commands.
 */

import { useCallback, useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { scenarioService } from '../../../services/scenarioService';

// ============================================================================
// Types
// ============================================================================

type PendingAction = 'new' | 'open' | null;

export interface UnsavedDialogProps {
  isOpen: boolean;
  onSave: () => Promise<void>;
  onDontSave: () => void;
  onCancel: () => void;
}

export interface UseScenarioFileOpsReturn {
  /** Create a new empty scenario */
  newScenario: () => void;
  /** Open a scenario from file */
  openScenario: () => Promise<void>;
  /** Save the current scenario */
  saveScenario: () => Promise<boolean>;
  /** Save the scenario to a new file */
  saveScenarioAs: () => Promise<boolean>;
  /** Import events from CSV */
  importCsv: () => Promise<void>;
  /** Export events to CSV */
  exportCsv: () => Promise<boolean>;
  /** Loading state */
  isLoading: boolean;
  /** Current error if any */
  error: string | null;
  /** Unsaved changes dialog props */
  unsavedDialog: UnsavedDialogProps;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useScenarioFileOps(): UseScenarioFileOpsReturn {
  // Store access
  const scenario = useScenarioStore((state) => state.scenario);
  const filePath = useScenarioStore((state) => state.filePath);
  const isDirty = useScenarioStore((state) => state.isDirty);
  const storeNewScenario = useScenarioStore((state) => state.newScenario);
  const loadScenario = useScenarioStore((state) => state.loadScenario);
  const markClean = useScenarioStore((state) => state.markClean);
  const setFilePath = useScenarioStore((state) => state.setFilePath);
  const addEvent = useScenarioStore((state) => state.addEvent);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // ============================================================================
  // Core Operations
  // ============================================================================

  /**
   * Perform the actual open operation
   */
  const performOpen = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const selected = await open({
        filters: [
          {
            name: 'Scenario',
            extensions: ['json'],
          },
        ],
        multiple: false,
        title: 'Open Scenario',
      });

      if (selected) {
        const data = await scenarioService.load(selected as string);
        loadScenario(data, selected as string);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open scenario';
      setError(message);
      console.error('Failed to open scenario:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadScenario]);

  /**
   * Perform the actual new operation
   */
  const performNew = useCallback(() => {
    storeNewScenario();
  }, [storeNewScenario]);

  // ============================================================================
  // Save Operations
  // ============================================================================

  /**
   * Save the current scenario
   */
  const saveScenario = useCallback(async (): Promise<boolean> => {
    if (!scenario) return false;

    // If no file path, use Save As
    if (!filePath) {
      return saveScenarioAs();
    }

    setIsLoading(true);
    setError(null);

    try {
      await scenarioService.save(filePath, scenario);
      markClean();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save scenario';
      setError(message);
      console.error('Failed to save scenario:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [scenario, filePath, markClean]);

  /**
   * Save the scenario to a new file
   */
  const saveScenarioAs = useCallback(async (): Promise<boolean> => {
    if (!scenario) return false;

    setIsLoading(true);
    setError(null);

    try {
      const defaultName = scenario.metadata.name.replace(/\s+/g, '_') || 'scenario';
      const selected = await save({
        filters: [
          {
            name: 'Scenario',
            extensions: ['json'],
          },
        ],
        defaultPath: `${defaultName}.json`,
        title: 'Save Scenario As',
      });

      if (selected) {
        await scenarioService.save(selected, scenario);
        setFilePath(selected);
        markClean();
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save scenario';
      setError(message);
      console.error('Failed to save scenario:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [scenario, setFilePath, markClean]);

  // ============================================================================
  // Unsaved Changes Handling
  // ============================================================================

  /**
   * Check for unsaved changes and prompt if needed
   */
  const checkUnsavedAndProceed = useCallback(
    (action: PendingAction): boolean => {
      if (isDirty) {
        setPendingAction(action);
        setShowUnsavedDialog(true);
        return false;
      }
      return true;
    },
    [isDirty]
  );

  /**
   * Handle save in unsaved dialog
   */
  const handleUnsavedSave = useCallback(async () => {
    const saved = await saveScenario();
    if (saved) {
      setShowUnsavedDialog(false);

      // Proceed with pending action
      if (pendingAction === 'new') {
        performNew();
      } else if (pendingAction === 'open') {
        await performOpen();
      }
      setPendingAction(null);
    }
  }, [saveScenario, pendingAction, performNew, performOpen]);

  /**
   * Handle don't save in unsaved dialog
   */
  const handleUnsavedDontSave = useCallback(() => {
    setShowUnsavedDialog(false);

    // Proceed with pending action
    if (pendingAction === 'new') {
      performNew();
    } else if (pendingAction === 'open') {
      performOpen();
    }
    setPendingAction(null);
  }, [pendingAction, performNew, performOpen]);

  /**
   * Handle cancel in unsaved dialog
   */
  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingAction(null);
  }, []);

  // ============================================================================
  // Public Operations
  // ============================================================================

  /**
   * Create a new scenario
   */
  const newScenario = useCallback(() => {
    if (checkUnsavedAndProceed('new')) {
      performNew();
    }
  }, [checkUnsavedAndProceed, performNew]);

  /**
   * Open a scenario from file
   */
  const openScenario = useCallback(async () => {
    if (checkUnsavedAndProceed('open')) {
      await performOpen();
    }
  }, [checkUnsavedAndProceed, performOpen]);

  // ============================================================================
  // CSV Operations
  // ============================================================================

  /**
   * Import events from CSV file
   */
  const importCsv = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const selected = await open({
        filters: [
          {
            name: 'CSV',
            extensions: ['csv'],
          },
        ],
        multiple: false,
        title: 'Import CSV',
      });

      if (selected) {
        const events = await scenarioService.importCSV(selected as string);

        if (events.length > 0) {
          // Ask user whether to merge or replace
          // For now, use browser confirm as a simple solution
          const shouldReplace = confirm(
            `Import ${events.length} events.\n\nClick OK to replace existing events, or Cancel to merge with existing.`
          );

          if (shouldReplace) {
            // Replace: Clear and add all
            // First reset the scenario to clear events
            const currentScenario = useScenarioStore.getState().scenario;
            if (currentScenario) {
              loadScenario(
                {
                  ...currentScenario,
                  events: events,
                },
                filePath ?? undefined
              );
            }
          } else {
            // Merge: Add to existing
            events.forEach((event) => {
              addEvent(event);
            });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import CSV';
      setError(message);
      console.error('Failed to import CSV:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadScenario, addEvent, filePath]);

  /**
   * Export events to CSV file
   */
  const exportCsv = useCallback(async (): Promise<boolean> => {
    if (!scenario || scenario.events.length === 0) {
      setError('No events to export');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const defaultName = scenario.metadata.name.replace(/\s+/g, '_') || 'scenario';
      const selected = await save({
        filters: [
          {
            name: 'CSV',
            extensions: ['csv'],
          },
        ],
        defaultPath: `${defaultName}.csv`,
        title: 'Export CSV',
      });

      if (selected) {
        await scenarioService.exportCSV(selected, scenario.events);
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export CSV';
      setError(message);
      console.error('Failed to export CSV:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [scenario]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    newScenario,
    openScenario,
    saveScenario,
    saveScenarioAs,
    importCsv,
    exportCsv,
    isLoading,
    error,
    unsavedDialog: {
      isOpen: showUnsavedDialog,
      onSave: handleUnsavedSave,
      onDontSave: handleUnsavedDontSave,
      onCancel: handleUnsavedCancel,
    },
  };
}

export default useScenarioFileOps;
