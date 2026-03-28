import { FolderTree, Search, Server, Radio, Tags } from 'lucide-react';
import { useSidebarStore, SidebarPanel } from '../../stores/sidebarStore';
import { useEditorAreaStore } from '../../stores/editorAreaStore';

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
          ? 'text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
      }`}
      onClick={onClick}
      title={tooltip}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
      )}
      {icon}
    </button>
  );
}

const ACTIVITY_BAR_ITEMS: { panel: SidebarPanel; icon: React.ReactNode; tooltip: string }[] = [
  { panel: 'explorer', icon: <FolderTree size={24} />, tooltip: 'Explorer' },
  { panel: 'search', icon: <Search size={24} />, tooltip: 'Search' },
  { panel: 'modbus', icon: <Server size={24} />, tooltip: 'Modbus' },
  { panel: 'opcua', icon: <Radio size={24} />, tooltip: 'OPC UA' },
];

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

  const handleOpenTagBrowser = () => {
    useEditorAreaStore.getState().openTagBrowserTab();
  };

  return (
    <div data-testid="activity-bar" className="w-12 bg-[var(--color-bg-primary)] border-r border-[var(--color-border)] flex flex-col">
      {ACTIVITY_BAR_ITEMS.map((item) => (
        <ActivityBarItem
          key={item.panel}
          panel={item.panel}
          icon={item.icon}
          tooltip={item.tooltip}
          isActive={activePanel === item.panel && isVisible}
          onClick={() => handleItemClick(item.panel)}
        />
      ))}

      {/* Separator */}
      <div className="mx-3 my-1 border-t border-[var(--color-border)]" />

      {/* Tag Browser - opens as singleton editor tab */}
      <button
        data-testid="activity-tag-browser"
        className="w-12 h-12 flex items-center justify-center relative text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        onClick={handleOpenTagBrowser}
        title="Tag Browser"
      >
        <Tags size={24} />
      </button>
    </div>
  );
}
