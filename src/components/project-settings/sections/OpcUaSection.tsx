import { memo, useCallback } from 'react';
import {
  PanelField,
  PanelInput,
  PanelSection,
  StatusBadge,
} from '../../protocol/ProtocolPanelPrimitives';
import {
  DEFAULT_PROJECT_CONFIG,
  type OpcUaSecurityPolicy,
} from '../../../types/project';
import type { CategorySectionProps } from '../types';

const OPCUA_POLICIES: OpcUaSecurityPolicy[] = [
  'None',
  'Basic128Rsa15',
  'Basic256',
  'Basic256Sha256',
  'Aes128Sha256RsaOaep',
  'Aes256Sha256RsPss',
];

export const OpcUaSection = memo(function OpcUaSection({
  config,
  searchFilter,
  onPatch,
  extra,
}: CategorySectionProps) {
  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  const opcua = config.opcua ?? DEFAULT_PROJECT_CONFIG.opcua!;
  const opcuaRunning = extra?.opcuaRunning ?? false;
  const enabledPolicies = opcua.security_policies ?? ['Basic256Sha256'];

  const patchOpcUa = useCallback(
    (patch: Partial<typeof opcua>) =>
      onPatch({ opcua: { ...opcua, ...patch } }),
    [opcua, onPatch],
  );

  const togglePolicy = useCallback(
    (policy: OpcUaSecurityPolicy) => {
      const nextPolicies = enabledPolicies.includes(policy)
        ? enabledPolicies.filter((item) => item !== policy)
        : [...enabledPolicies, policy];

      if (nextPolicies.length === 0) return;
      patchOpcUa({ security_policies: nextPolicies });
    },
    [enabledPolicies, patchOpcUa],
  );

  if (!isVisible(['opc', 'ua', 'port', 'server', 'security', 'policy', 'username', 'password', 'anonymous'])) {
    return null;
  }

  return (
    <PanelSection
      title="OPC UA"
      description="Project-level OPC UA server definition. Runtime panel uses these settings and restart is explicit."
      actions={
        <StatusBadge
          tone={opcuaRunning ? 'warning' : opcua.enabled ? 'success' : 'muted'}
        >
          {opcuaRunning
            ? 'Restart Required'
            : opcua.enabled
              ? 'Configured'
              : 'Disabled'}
        </StatusBadge>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={opcua.enabled}
            onChange={(e) => patchOpcUa({ enabled: e.target.checked })}
          />
          Enable OPC UA server during simulation
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={opcua.allow_anonymous ?? false}
            onChange={(e) => patchOpcUa({ allow_anonymous: e.target.checked })}
          />
          Allow anonymous sessions
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PanelField label="Port">
          <PanelInput
            type="number"
            min={1}
            max={65535}
            value={opcua.port}
            onChange={(e) =>
              patchOpcUa({
                port: Math.max(
                  1,
                  Math.min(65535, Number.parseInt(e.target.value || '4840', 10)),
                ),
              })
            }
          />
        </PanelField>
        <PanelField label="Server Name">
          <PanelInput
            value={opcua.server_name}
            onChange={(e) => patchOpcUa({ server_name: e.target.value })}
          />
        </PanelField>
        <PanelField label="Username">
          <PanelInput
            value={opcua.username ?? ''}
            onChange={(e) => patchOpcUa({ username: e.target.value })}
          />
        </PanelField>
        <PanelField label="Password">
          <PanelInput
            type="password"
            value={opcua.password ?? ''}
            onChange={(e) => patchOpcUa({ password: e.target.value })}
          />
        </PanelField>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Security Policies
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {OPCUA_POLICIES.map((policy) => (
            <label
              key={policy}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
            >
              <input
                type="checkbox"
                checked={enabledPolicies.includes(policy)}
                disabled={
                  enabledPolicies.length === 1 && enabledPolicies.includes(policy)
                }
                onChange={() => togglePolicy(policy)}
              />
              {policy}
            </label>
          ))}
        </div>
      </div>
    </PanelSection>
  );
});
