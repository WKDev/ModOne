import { useCallback, useState } from 'react';
import { usePanelStore } from '../../stores/panelStore';
import { Panel } from './Panel';
import { DraggablePanel } from './DraggablePanel';
import {
  FLOATING_PANEL_MIME_TYPE,
  type FloatingPanelDragData,
} from '../floating/FloatingWindowHeader';

export function PanelContainer() {
  const { panels, gridConfig, activePanel, setActivePanel, removePanel, minimizePanel, maximizePanel, dockPanel } = usePanelStore();
  const [isFloatingDragOver, setIsFloatingDragOver] = useState(false);

  // Filter out floating panels - only show docked panels in the grid
  const dockedPanels = panels.filter((panel) => !panel.isFloating);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: gridConfig.columns.join(' '),
    gridTemplateRows: gridConfig.rows.join(' '),
    gap: '4px',
    height: '100%',
    width: '100%',
  };

  // Handle drag over from floating windows
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(FLOATING_PANEL_MIME_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsFloatingDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only handle if leaving the container itself
    if (e.currentTarget === e.target) {
      setIsFloatingDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const data = e.dataTransfer.getData(FLOATING_PANEL_MIME_TYPE);
      if (data) {
        e.preventDefault();
        setIsFloatingDragOver(false);

        try {
          const { panelId } = JSON.parse(data) as FloatingPanelDragData;
          // Dock to default position (first available slot)
          await dockPanel(panelId);
        } catch (error) {
          console.error('Failed to dock floating panel:', error);
        }
      }
    },
    [dockPanel]
  );

  if (dockedPanels.length === 0) {
    return (
      <div
        className={`h-full w-full flex items-center justify-center text-gray-500 ${
          isFloatingDragOver ? 'ring-2 ring-purple-500 ring-inset bg-purple-500/10' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <p className="text-lg mb-2">No panels open</p>
          <p className="text-sm">Use View menu to open panels</p>
          {isFloatingDragOver && (
            <p className="text-sm text-purple-400 mt-2">Drop here to dock panel</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={gridStyle}
      className={`p-1 ${isFloatingDragOver ? 'ring-2 ring-purple-500 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dockedPanels.map((panel) => (
        <DraggablePanel
          key={panel.id}
          panel={panel}
          isActive={activePanel === panel.id}
        >
          <Panel
            id={panel.id}
            type={panel.type}
            title={panel.title}
            isActive={activePanel === panel.id}
            onClose={() => removePanel(panel.id)}
            onMinimize={() => minimizePanel(panel.id)}
            onMaximize={() => maximizePanel(panel.id)}
            onActivate={() => setActivePanel(panel.id)}
          />
        </DraggablePanel>
      ))}
    </div>
  );
}
