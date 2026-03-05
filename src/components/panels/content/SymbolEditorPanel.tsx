import { useCallback } from 'react';
import { SymbolEditor } from '../../SymbolEditor/SymbolEditor';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
import { useProjectStore } from '../../../stores/projectStore';
import type { SymbolDefinition } from '../../../types/symbol';

interface SymbolEditorPanelProps {
  data?: unknown;
}

interface SymbolEditorTabData {
  symbol?: SymbolDefinition | null;
}

export function SymbolEditorPanel({ data }: SymbolEditorPanelProps) {
  const panelData = data as SymbolEditorTabData | undefined;
  const currentProjectPath = useProjectStore((state) => state.currentProjectPath);
  const { activeTabId, removeTab } = useEditorAreaStore((state) => ({
    activeTabId: state.activeTabId,
    removeTab: state.removeTab,
  }));

  const handleClose = useCallback(() => {
    if (activeTabId) {
      removeTab(activeTabId);
    }
  }, [activeTabId, removeTab]);

  if (!currentProjectPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
        Open a project to use Symbol Editor.
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden">
      <SymbolEditor
        symbol={panelData?.symbol ?? null}
        projectDir={currentProjectPath}
        onClose={handleClose}
      />
    </div>
  );
}
