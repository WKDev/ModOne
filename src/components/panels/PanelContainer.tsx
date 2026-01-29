import { usePanelStore } from '../../stores/panelStore';
import { Panel } from './Panel';
import { DraggablePanel } from './DraggablePanel';

export function PanelContainer() {
  const { panels, gridConfig, activePanel, setActivePanel, removePanel, minimizePanel, maximizePanel } = usePanelStore();

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: gridConfig.columns.join(' '),
    gridTemplateRows: gridConfig.rows.join(' '),
    gap: '4px',
    height: '100%',
    width: '100%',
  };

  if (panels.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No panels open</p>
          <p className="text-sm">Use View menu to open panels</p>
        </div>
      </div>
    );
  }

  return (
    <div style={gridStyle} className="p-1">
      {panels.map((panel) => (
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
