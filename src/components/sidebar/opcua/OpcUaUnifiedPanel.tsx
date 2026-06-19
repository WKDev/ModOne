import { useProjectStore } from '../../../stores/projectStore';
import { OpcUaSubTabBar, useOpcUaSubTab } from './OpcUaSubTabs';
import { OpcUaConfigurationTab } from './OpcUaConfigurationTab';
import { OpcUaSessionsTab } from './OpcUaSessionsTab';
import { OpcUaAuditLogTab } from './OpcUaAuditLogTab';

export function OpcUaUnifiedPanel() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const { activeTab, setActiveTab } = useOpcUaSubTab();

  if (!currentProject || !currentProject.config.opcua) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-[var(--color-text-muted)]">
        Open a project to inspect OPC UA state.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="opcua-unified-panel">
      <OpcUaSubTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'configuration' && <OpcUaConfigurationTab />}
        {activeTab === 'sessions' && <OpcUaSessionsTab />}
        {activeTab === 'audit-log' && <OpcUaAuditLogTab />}
      </div>
    </div>
  );
}
