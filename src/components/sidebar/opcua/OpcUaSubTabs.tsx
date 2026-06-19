import { useState, type ReactNode } from 'react';
import { Settings, Users, FileText } from 'lucide-react';

export type OpcUaSubTab = 'configuration' | 'sessions' | 'audit-log';

interface SubTabDefinition {
  id: OpcUaSubTab;
  label: string;
  icon: ReactNode;
}

const SUB_TABS: SubTabDefinition[] = [
  { id: 'configuration', label: 'Configuration', icon: <Settings size={14} /> },
  { id: 'sessions', label: 'Sessions', icon: <Users size={14} /> },
  { id: 'audit-log', label: 'Audit Log', icon: <FileText size={14} /> },
];

export function useOpcUaSubTab(initial: OpcUaSubTab = 'configuration') {
  const [activeTab, setActiveTab] = useState<OpcUaSubTab>(initial);
  return { activeTab, setActiveTab } as const;
}

interface OpcUaSubTabBarProps {
  activeTab: OpcUaSubTab;
  onTabChange: (tab: OpcUaSubTab) => void;
}

export function OpcUaSubTabBar({ activeTab, onTabChange }: OpcUaSubTabBarProps) {
  return (
    <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      {SUB_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
              isActive
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
            data-testid={`opcua-subtab-${tab.id}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
