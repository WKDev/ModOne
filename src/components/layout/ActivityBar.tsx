import { FolderTree, Search, Server, Settings } from 'lucide-react';
import { useSidebarStore, SidebarPanel } from '../../stores/sidebarStore';

interface ActivityBarItemProps {
  icon: React.ReactNode;
  panel: SidebarPanel;
  tooltip: string;
  isActive: boolean;
  onClick: () => void;
}

function ActivityBarItem({ icon, panel, tooltip, isActive, onClick }: ActivityBarItemProps) {
  return (
    <button
      data-testid={`activity-${panel}`}
      className={`w-12 h-12 flex items-center justify-center relative ${
        isActive
          ? 'text-white'
          : 'text-gray-500 hover:text-gray-300'
      }`}
      onClick={onClick}
      title={tooltip}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500" />
      )}
      {icon}
    </button>
  );
}

export function ActivityBar() {
  const { activePanel, setActivePanel, toggleVisibility, isVisible } = useSidebarStore();

  const handleItemClick = (panel: SidebarPanel) => {
    if (activePanel === panel && isVisible) {
      toggleVisibility();
    } else {
      setActivePanel(panel);
      if (!isVisible) {
        toggleVisibility();
      }
    }
  };

  const items: { panel: SidebarPanel; icon: React.ReactNode; tooltip: string }[] = [
    { panel: 'explorer', icon: <FolderTree size={24} />, tooltip: 'Explorer' },
    { panel: 'search', icon: <Search size={24} />, tooltip: 'Search' },
    { panel: 'modbus', icon: <Server size={24} />, tooltip: 'Modbus' },
    { panel: 'settings', icon: <Settings size={24} />, tooltip: 'Settings' },
  ];

  return (
    <div data-testid="activity-bar" className="w-12 bg-gray-900 border-r border-gray-700 flex flex-col">
      {items.map((item) => (
        <ActivityBarItem
          key={item.panel}
          panel={item.panel}
          icon={item.icon}
          tooltip={item.tooltip}
          isActive={activePanel === item.panel && isVisible}
          onClick={() => handleItemClick(item.panel)}
        />
      ))}
    </div>
  );
}
