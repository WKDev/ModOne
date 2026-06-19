/**
 * OpcUaServerPanel - Unified OPC UA editor panel with sub-tabs (Prosys style).
 *
 * Contains three sub-tabs:
 * - Configuration: Server runtime controls, security policies, anonymous access,
 *   user accounts, and certificate info (reuses sidebar OpcUaConfigurationTab)
 * - Sessions: Real-time session monitoring table
 * - Audit Log: Virtual-scrolled audit log with filters
 *
 * This panel provides the editor-area (tab-based) view for OPC UA server
 * management, reusing the sub-tab components from the sidebar unified panel.
 */

import { useProjectStore } from '../../../stores/projectStore';
import {
  OpcUaSubTabBar,
  useOpcUaSubTab,
  OpcUaConfigurationTab,
  OpcUaSessionsTab,
  OpcUaAuditLogTab,
} from '../../sidebar/opcua';

export function OpcUaServerPanel() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const { activeTab, setActiveTab } = useOpcUaSubTab();

  if (!currentProject || !currentProject.config.opcua) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-[var(--color-text-muted)]">
        Open a project to configure OPC UA server.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="opcua-server-panel">
      <OpcUaSubTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'configuration' && <OpcUaConfigurationTab />}
        {activeTab === 'sessions' && <OpcUaSessionsTab />}
        {activeTab === 'audit-log' && <OpcUaAuditLogTab />}
      </div>
    </div>
  );
}
