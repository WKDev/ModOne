/**
 * OpcUaAuditLogTab - Audit Log sub-tab within the unified OPC UA panel.
 *
 * Wraps the existing AuditLogViewer component inside the panel shell,
 * providing a consistent layout with the other OPC UA sub-tabs.
 * The AuditLogViewer handles all audit log functionality including:
 * - Virtual-scrolled log entries (via @tanstack/react-virtual)
 * - Category, event type, severity, date range, and text filters
 * - Retention settings with debounced save
 * - Clear all functionality
 * - Infinite scroll loading
 */

import { AuditLogViewer } from '../../settings/AuditLogViewer';

export function OpcUaAuditLogTab() {
  return (
    <div className="p-4" data-testid="opcua-audit-log-tab">
      <AuditLogViewer />
    </div>
  );
}
