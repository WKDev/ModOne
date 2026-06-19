/**
 * OpcUaSessionsTab - Sessions sub-tab within the unified OPC UA panel.
 *
 * Wraps the existing SessionMonitoringTable component, providing a consistent
 * layout with the other OPC UA sub-tabs. The SessionMonitoringTable handles
 * periodic polling (every 5 seconds) for session data including client IP,
 * security policy, connection time, and subscription count.
 */

import { SessionMonitoringTable } from '../../settings/SessionMonitoringTable';

export function OpcUaSessionsTab() {
  return (
    <div className="p-4" data-testid="opcua-sessions-tab">
      <SessionMonitoringTable />
    </div>
  );
}
