import { useCallback } from 'react';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Play,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorAreaStore } from '../../stores/editorAreaStore';
import {
  selectCertificateFingerprint,
  selectCertificateValidTo,
  selectEndpoint,
  selectError,
  selectFeatureEnabled,
  selectIsStarting,
  selectIsStopping,
  selectRunning,
  selectSessionCount,
  selectSessionCountSupported,
  useOpcUaStore,
} from '../../stores/opcuaStore';
import {
  PanelButton,
  PanelSection,
  PanelShell,
  StatusBadge,
} from '../protocol/ProtocolPanelPrimitives';

export function OpcUaPanel() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const openProjectSettingsTab = useEditorAreaStore((state) => state.openProjectSettingsTab);

  const running = useOpcUaStore(selectRunning);
  const endpoint = useOpcUaStore(selectEndpoint);
  const sessionCount = useOpcUaStore(selectSessionCount);
  const sessionCountSupported = useOpcUaStore(selectSessionCountSupported);
  const fingerprint = useOpcUaStore(selectCertificateFingerprint);
  const validTo = useOpcUaStore(selectCertificateValidTo);
  const featureEnabled = useOpcUaStore(selectFeatureEnabled);
  const isStarting = useOpcUaStore(selectIsStarting);
  const isStopping = useOpcUaStore(selectIsStopping);
  const error = useOpcUaStore(selectError);
  const status = useOpcUaStore((state) => state.status);
  const { startServer, stopServer } = useOpcUaStore();

  const opcuaConfig = currentProject?.config.opcua;

  const handleStart = useCallback(async () => {
    if (!opcuaConfig) {
      return;
    }

    await startServer({
      port: opcuaConfig.port,
      server_name: opcuaConfig.server_name,
      username: opcuaConfig.username,
      password: opcuaConfig.password,
      security_policies: opcuaConfig.security_policies,
      allow_anonymous: opcuaConfig.allow_anonymous,
    });
  }, [opcuaConfig, startServer]);

  const handleCopy = useCallback((label: string, value?: string | null) => {
    if (!value) {
      return;
    }

    void navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }, []);

  if (!currentProject || !opcuaConfig) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-[var(--color-text-muted)]">
        Open a project to inspect OPC UA state.
      </div>
    );
  }

  const isExpiringSoon = validTo
    ? new Date(validTo).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="h-full overflow-y-auto">
      <PanelShell>
        {!featureEnabled ? (
          <PanelSection
            title="Feature Gate"
            description="This environment does not expose the OPC UA runtime. Project settings still persist to `.mop`."
            actions={<StatusBadge tone="warning">Unavailable</StatusBadge>}
          >
            <div className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-sm text-[var(--color-warning)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>OPC UA runtime support is disabled in the current build.</span>
            </div>
          </PanelSection>
        ) : null}

        <PanelSection
          title="Runtime"
          description="Sidebar shows live server state. Edit manifest-backed settings in Project Settings and restart explicitly."
          actions={
            <StatusBadge
              tone={running ? 'success' : opcuaConfig.enabled ? 'warning' : 'muted'}
            >
              {running ? 'Running' : opcuaConfig.enabled ? 'Restart To Apply' : 'Disabled'}
            </StatusBadge>
          }
        >
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Radio
                size={14}
                className={running ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}
              />
              {running ? 'Server active' : 'Server stopped'}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">UA:{opcuaConfig.port}</div>
          </div>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 px-3 py-2 text-sm text-[var(--color-error)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {running && endpoint ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <span>Endpoint</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[var(--color-accent)]"
                  onClick={() => handleCopy('Endpoint', endpoint)}
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
              <div className="break-all font-mono text-xs text-[var(--color-text-secondary)]">
                {endpoint}
              </div>
            </div>
          ) : null}
          {sessionCountSupported ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              Active sessions: <span className="text-[var(--color-text-primary)]">{sessionCount}</span>
            </div>
          ) : null}
          <div className="flex gap-2">
            <PanelButton
              tone="primary"
              className="flex-1"
              disabled={running || isStarting || isStopping || !featureEnabled}
              onClick={() => {
                void handleStart();
              }}
            >
              <Play size={14} />
              {isStarting ? 'Starting...' : 'Start'}
            </PanelButton>
            <PanelButton
              tone="danger"
              className="flex-1"
              disabled={!running || isStarting || isStopping}
              onClick={() => {
                void stopServer();
              }}
            >
              <Square size={14} />
              {isStopping ? 'Stopping...' : 'Stop'}
            </PanelButton>
          </div>
        </PanelSection>

        <PanelSection
          title="Manifest Settings"
          description="These values come from the project manifest and are only applied when you start or restart the server."
          actions={
            <PanelButton tone="neutral" onClick={openProjectSettingsTab}>
              <ExternalLink size={14} />
              Project Settings
            </PanelButton>
          }
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">Server Name</span>
              <span className="max-w-[150px] truncate text-[var(--color-text-primary)]">
                {opcuaConfig.server_name}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">Anonymous Access</span>
              <span className="text-[var(--color-text-primary)]">
                {opcuaConfig.allow_anonymous ? 'Allowed' : 'Credential Required'}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
              <div className="mb-1 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Security Policies
              </div>
              <div className="flex flex-wrap gap-2">
                {(opcuaConfig.security_policies ?? []).map((policy) => (
                  <StatusBadge key={policy} tone="muted">
                    {policy}
                  </StatusBadge>
                ))}
              </div>
            </div>
          </div>
        </PanelSection>

        {fingerprint ? (
          <PanelSection
            title="Certificate"
            description="Certificate details come from the running server."
            actions={
              <StatusBadge tone={isExpiringSoon ? 'warning' : 'success'}>
                {isExpiringSoon ? 'Expiring Soon' : 'Valid'}
              </StatusBadge>
            }
          >
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={12} />
                  Fingerprint
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[var(--color-accent)]"
                  onClick={() => handleCopy('Fingerprint', fingerprint)}
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
              <div className="break-all font-mono text-xs text-[var(--color-text-secondary)]">
                {fingerprint}
              </div>
            </div>
            {validTo ? (
              <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
                <span className="text-[var(--color-text-secondary)]">Valid Until</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    isExpiringSoon
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-text-primary)]'
                  }`}
                >
                  {isExpiringSoon ? <ShieldAlert size={12} /> : null}
                  {new Date(validTo).toLocaleDateString()}
                </span>
              </div>
            ) : null}
          </PanelSection>
        ) : null}

        {status?.activeSecurityPolicies?.length ? (
          <PanelSection
            title="Live Security"
            description="These are the policies currently advertised by the running server."
          >
            <div className="flex flex-wrap gap-2">
              {status.activeSecurityPolicies.map((policy) => (
                <StatusBadge key={policy} tone="success">
                  {policy}
                </StatusBadge>
              ))}
            </div>
          </PanelSection>
        ) : null}
      </PanelShell>
    </div>
  );
}
