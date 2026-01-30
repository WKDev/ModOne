/**
 * ScenarioEditorPanel Component
 *
 * Main panel content for scenario editing, combining toolbar, grid, and progress display.
 * Integrates with scenario store and execution engine.
 *
 * Supports both document-based editing (via DocumentContext) and
 * global store editing (legacy mode).
 */

import { memo, useState, useEffect } from 'react';
import {
  ScenarioToolbar,
  ScenarioGrid,
  ExecutionProgress,
  ScenarioSettingsDialog,
  useScenarioFileOps,
} from '../../ScenarioEditor';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useDocumentContext } from '../../../contexts/DocumentContext';
import { UnsavedChangesDialog } from '../../project/UnsavedChangesDialog';

// ============================================================================
// Types
// ============================================================================

interface ScenarioEditorPanelProps {
  /** Tab data (contains documentId, filePath) */
  data?: unknown;
}

// ============================================================================
// Component
// ============================================================================

export const ScenarioEditorPanel = memo(function ScenarioEditorPanel(
  _props: ScenarioEditorPanelProps
) {
  // Get document context (may be null if not in document mode)
  const { documentId, documentType } = useDocumentContext();

  // Log for debugging during development
  // TODO: Wire up document-based editing when ready
  useEffect(() => {
    if (documentId && documentType === 'scenario') {
      console.debug('ScenarioEditorPanel: Using document mode', { documentId });
    }
  }, [documentId, documentType]);

  // File operations
  const fileOps = useScenarioFileOps();

  // Store access
  const scenario = useScenarioStore((state) => state.scenario);
  const newScenario = useScenarioStore((state) => state.newScenario);

  // Settings dialog state
  const [showSettings, setShowSettings] = useState(false);

  // Initialize with new scenario if none loaded
  if (!scenario) {
    newScenario();
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Toolbar */}
      <ScenarioToolbar
        onNew={fileOps.newScenario}
        onOpen={fileOps.openScenario}
        onSave={fileOps.saveScenario}
        onSaveAs={fileOps.saveScenarioAs}
        onImportCSV={fileOps.importCsv}
        onExportCSV={fileOps.exportCsv}
        onSettings={() => setShowSettings(true)}
      />

      {/* Grid (scrollable area) */}
      <div className="flex-1 overflow-auto min-h-0 p-2">
        <ScenarioGrid height="100%" />
      </div>

      {/* Progress Bar */}
      <ExecutionProgress />

      {/* Settings Dialog */}
      <ScenarioSettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog {...fileOps.unsavedDialog} />
    </div>
  );
});

export default ScenarioEditorPanel;
