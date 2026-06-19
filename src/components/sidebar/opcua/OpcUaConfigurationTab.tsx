import { memo, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Square,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../../../hooks/useProject';
import { useProjectStore } from '../../../stores/projectStore';
import { useEditorAreaStore } from '../../../stores/editorAreaStore';
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
} from '../../../stores/opcuaStore';
import {
  PanelButton,
  PanelField,
  PanelInput,
  PanelSection,
  PanelShell,
  StatusBadge,
} from '../../protocol/ProtocolPanelPrimitives';
import { UserAccountManager } from '../../settings/UserAccountManager';
import { opcuaService } from '../../../services/opcuaService';
import type { OpcUaSecurityPolicy, ProjectConfigPatch, SecurityPolicyInfo } from '../../../types/project';

/** Shallow array equality (order-independent) for security policy lists */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
}

/** Descriptions for each security policy */
const POLICY_DESCRIPTIONS: Record<OpcUaSecurityPolicy, string> = {
  None: 'No encryption — development/test only',
  Basic128Rsa15: 'Legacy client compatibility (deprecated)',
  Basic256: 'Legacy client compatibility (deprecated)',
  Basic256Sha256: 'Recommended minimum for production',
  Aes128Sha256RsaOaep: 'Modern security policy',
  Aes256Sha256RsPss: 'Strongest security policy',
};

export function OpcUaConfigurationTab() {
  const currentProject = useProjectStore((state) => state.currentProject);
  const { updateConfig } = useProject();
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
  const { startServer, stopServer, restartServer } = useOpcUaStore();

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

  const applyPatch = useCallback(
    (patch: ProjectConfigPatch) => {
      void updateConfig(patch);
    },
    [updateConfig]
  );

  const handlePortChange = useCallback(
    (rawValue: string) => {
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed)) return;
      const nextPort = Math.max(1, Math.min(65535, parsed));
      applyPatch({ opcua: { port: nextPort } });
    },
    [applyPatch]
  );

  const handleServerNameChange = useCallback(
    (rawValue: string) => {
      applyPatch({ opcua: { server_name: rawValue } });
    },
    [applyPatch]
  );

  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  /**
   * Collect all pending configuration from the project manifest and perform
   * an atomic server restart via the backend `opcua_restart_server` command.
   * This ensures security policies, anonymous access, user accounts, port,
   * server name, and address space changes are all applied in one cycle.
   */
  const handleRestart = useCallback(async () => {
    if (!opcuaConfig) return;
    setIsRestarting(true);
    try {
      await restartServer({
        port: opcuaConfig.port,
        server_name: opcuaConfig.server_name,
        username: opcuaConfig.username,
        password: opcuaConfig.password,
        security_policies: opcuaConfig.security_policies,
        allow_anonymous: opcuaConfig.allow_anonymous,
      });
      toast.success('OPC UA server restarted', {
        description: 'All pending configuration changes have been applied.',
      });
    } catch {
      // Error is already captured by the store and displayed in the UI
    } finally {
      setIsRestarting(false);
      setShowRestartConfirm(false);
    }
  }, [opcuaConfig, restartServer]);

  if (!opcuaConfig) {
    return null;
  }

  /**
   * True when any saved manifest setting differs from the running server.
   * Compares port, security policies, and anonymous access against the live
   * status reported by the backend. Server name is not in status so changes
   * to it always require a restart when the server is running.
   */
  const needsRestart = running && status != null && (
    opcuaConfig.port !== status.port ||
    !arraysEqual(opcuaConfig.security_policies ?? [], status.activeSecurityPolicies ?? []) ||
    (opcuaConfig.allow_anonymous ?? false) !== (status.allowAnonymous ?? false)
  );

  const isExpiringSoon = validTo
    ? new Date(validTo).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false;

  return (
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
          <PanelButton
            tone="neutral"
            className="flex-1"
            disabled={!running || isStarting || isStopping || isRestarting}
            onClick={() => setShowRestartConfirm(true)}
            data-testid="opcua-restart-button"
          >
            <RefreshCw size={14} className={isRestarting ? 'animate-spin' : ''} />
            {isRestarting ? 'Restarting...' : 'Restart'}
          </PanelButton>
        </div>
      </PanelSection>

      {/* ── Server Settings (editable) ── */}
      <PanelSection
        title="Server Settings"
        description="Configure port and server name. Changes are saved to the project manifest and applied on server start/restart."
        actions={
          needsRestart ? (
            <StatusBadge tone="warning">Restart Required</StatusBadge>
          ) : (
            <PanelButton tone="neutral" onClick={openProjectSettingsTab}>
              <ExternalLink size={14} />
              All Settings
            </PanelButton>
          )
        }
      >
        <PanelField label="Port Number" hint="TCP port the OPC UA server listens on (1–65535).">
          <PanelInput
            type="number"
            min={1}
            max={65535}
            value={opcuaConfig.port}
            disabled={running}
            placeholder="4840"
            onChange={(e) => handlePortChange(e.target.value)}
            data-testid="opcua-port-input"
          />
        </PanelField>
        <PanelField label="Server Name" hint="Display name advertised to OPC UA clients.">
          <PanelInput
            type="text"
            value={opcuaConfig.server_name}
            disabled={running}
            placeholder="ModOne PLC Simulator"
            onChange={(e) => handleServerNameChange(e.target.value)}
            data-testid="opcua-server-name-input"
          />
        </PanelField>

        {/* Restart hint when running and settings were changed */}
        {needsRestart ? (
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2">
            <div className="flex items-start gap-2 text-xs text-[var(--color-warning)]">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>Settings differ from running server. Restart to apply.</span>
            </div>
            <PanelButton
              tone="neutral"
              disabled={isStarting || isStopping}
              onClick={() => {
                void handleRestart();
              }}
            >
              <RefreshCw size={12} />
              Restart
            </PanelButton>
          </div>
        ) : null}

        {/* Inputs are disabled while server is running – show a subtle note */}
        {running && !needsRestart ? (
          <div className="text-xs text-[var(--color-text-muted)]">
            Stop the server to edit port and server name.
          </div>
        ) : null}

        {/* Read-only summary rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
            <span className="text-[var(--color-text-secondary)]">Anonymous Access</span>
            <span className="text-[var(--color-text-primary)]">
              {opcuaConfig.allow_anonymous ? 'Allowed' : 'Credential Required'}
            </span>
          </div>
        </div>
      </PanelSection>

      <SecurityPoliciesSection running={running} />

      <UserAccountsSection running={running} />

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

      {/* Restart Confirmation Dialog */}
      <RestartConfirmDialog
        isOpen={showRestartConfirm}
        isRestarting={isRestarting}
        sessionCount={sessionCount}
        onConfirm={() => {
          void handleRestart();
        }}
        onCancel={() => setShowRestartConfirm(false)}
      />
    </PanelShell>
  );
}

// ============================================================================
// Restart Confirmation Dialog
// ============================================================================

interface RestartConfirmDialogProps {
  isOpen: boolean;
  isRestarting: boolean;
  sessionCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function RestartConfirmDialog({
  isOpen,
  isRestarting,
  sessionCount,
  onConfirm,
  onCancel,
}: RestartConfirmDialogProps) {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isRestarting) {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRestarting, onCancel]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/50"
        onClick={() => !isRestarting && onCancel()}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Icon & Title */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]/10">
                <RefreshCw size={20} className="text-[var(--color-warning)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                Restart OPC UA Server?
              </h3>
            </div>

            {/* Message */}
            <div className="mb-6 ml-[52px] space-y-2 text-sm text-[var(--color-text-secondary)]">
              <p>
                The server will be stopped and restarted with the current
                configuration settings.
              </p>
              {sessionCount > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    {sessionCount} active session{sessionCount !== 1 ? 's' : ''} will
                    be disconnected.
                  </span>
                </div>
              ) : null}
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isRestarting}
                className="rounded px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isRestarting}
                className="flex items-center gap-2 rounded bg-[var(--color-accent)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="opcua-restart-confirm"
              >
                {isRestarting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Restarting…
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Restart Server
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Security Policies Section
// ============================================================================

interface SecurityPoliciesSectionProps {
  running: boolean;
}

function SecurityPoliciesSection({ running }: SecurityPoliciesSectionProps) {
  const [policies, setPolicies] = useState<SecurityPolicyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch security policies on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPolicyError(null);
    opcuaService
      .getSecurityPolicies()
      .then((result) => {
        if (!cancelled) setPolicies(result);
      })
      .catch((err) => {
        if (!cancelled) setPolicyError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledCount = policies.filter((p) => p.enabled).length;

  const handleTogglePolicy = useCallback(
    async (policyId: OpcUaSecurityPolicy, currentlyEnabled: boolean) => {
      const currentEnabled = policies.filter((p) => p.enabled).map((p) => p.id);
      let newEnabled: OpcUaSecurityPolicy[];

      if (currentlyEnabled) {
        newEnabled = currentEnabled.filter((id) => id !== policyId);
      } else {
        newEnabled = [...currentEnabled, policyId];
      }

      // Must have at least one policy enabled
      if (newEnabled.length === 0) {
        return;
      }

      setSaving(true);
      setPolicyError(null);
      try {
        const updated = await opcuaService.setSecurityPolicies(newEnabled);
        setPolicies(updated);
        toast.success('Security policies updated', {
          description: 'Restart the server to apply changes.',
        });
      } catch (err) {
        setPolicyError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [policies],
  );

  return (
    <PanelSection
      title="Security Policies"
      description="Toggle which security policies are enabled for OPC UA endpoint connections. Changes require a server restart."
      actions={
        enabledCount > 0 ? (
          <StatusBadge tone="muted">{enabledCount} enabled</StatusBadge>
        ) : null
      }
    >
      {loading ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-center text-xs text-[var(--color-text-muted)]">
          Loading security policies…
        </div>
      ) : policyError ? (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 px-3 py-2 text-sm text-[var(--color-error)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{policyError}</span>
        </div>
      ) : (
        <div className="space-y-1">
          {policies.map((policy) => (
            <SecurityPolicyRow
              key={policy.id}
              policy={policy}
              enabledCount={enabledCount}
              saving={saving}
              onToggle={handleTogglePolicy}
            />
          ))}
        </div>
      )}

      {/* Warning when None policy is enabled */}
      {policies.some((p) => p.id === 'None' && p.enabled) ? (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            The &quot;None&quot; policy is enabled — data is transmitted without encryption.
            Disable this for production environments.
          </span>
        </div>
      ) : null}

      {/* Restart hint when running */}
      {running ? (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>Security policy changes take effect after server restart.</span>
        </div>
      ) : null}
    </PanelSection>
  );
}

// ============================================================================
// Security Policy Row (memoized for performance)
// ============================================================================

interface SecurityPolicyRowProps {
  policy: SecurityPolicyInfo;
  enabledCount: number;
  saving: boolean;
  onToggle: (policyId: OpcUaSecurityPolicy, currentlyEnabled: boolean) => void;
}

const SecurityPolicyRow = memo(function SecurityPolicyRow({
  policy,
  enabledCount,
  saving,
  onToggle,
}: SecurityPolicyRowProps) {
  const isOnlyEnabled = policy.enabled && enabledCount <= 1;

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        policy.enabled
          ? 'bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10'
          : 'hover:bg-[var(--color-surface-muted)]'
      } ${isOnlyEnabled ? 'cursor-not-allowed' : ''} ${saving ? 'pointer-events-none opacity-60' : ''}`}
      title={
        isOnlyEnabled
          ? 'At least one security policy must remain enabled'
          : undefined
      }
    >
      <input
        type="checkbox"
        checked={policy.enabled}
        disabled={saving || isOnlyEnabled}
        onChange={() => onToggle(policy.id, policy.enabled)}
        className="mt-0.5 accent-[var(--color-accent)]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {policy.requiresEncryption ? (
            <Lock size={12} className="shrink-0 text-[var(--color-success)]" />
          ) : (
            <Unlock size={12} className="shrink-0 text-[var(--color-text-muted)]" />
          )}
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {policy.displayName}
          </span>
          {policy.requiresEncryption ? (
            <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              {policy.messageSecurityMode}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {POLICY_DESCRIPTIONS[policy.id]}
        </p>
      </div>
    </label>
  );
});

// ============================================================================
// User Accounts Section
// ============================================================================

interface UserAccountsSectionProps {
  running: boolean;
}

function UserAccountsSection({ running }: UserAccountsSectionProps) {
  const [allowAnonymous, setAllowAnonymous] = useState<boolean | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Fetch the current anonymous access setting on mount
  useEffect(() => {
    let cancelled = false;
    opcuaService
      .getAnonymousAccess()
      .then((value) => {
        if (!cancelled) setAllowAnonymous(value);
      })
      .catch(() => {
        // Silently ignore – feature may not be available
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleAnonymous = useCallback(async () => {
    if (allowAnonymous === null) return;
    const next = !allowAnonymous;
    setIsToggling(true);
    try {
      const result = await opcuaService.setAnonymousAccess(next);
      setAllowAnonymous(result);
      toast.success(
        result ? 'Anonymous access enabled' : 'Anonymous access disabled',
        { description: 'Restart the server to apply this change.' }
      );
    } catch {
      toast.error('Failed to update anonymous access setting');
    } finally {
      setIsToggling(false);
    }
  }, [allowAnonymous]);

  return (
    <PanelSection
      title="User Accounts"
      description="Manage OPC UA user accounts and anonymous access. Restart the server to apply changes."
      actions={
        <StatusBadge tone={allowAnonymous ? 'warning' : 'muted'}>
          {allowAnonymous ? 'Anonymous On' : 'Auth Required'}
        </StatusBadge>
      }
    >
      {/* Anonymous access toggle */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <ShieldOff
            size={14}
            className={
              allowAnonymous
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-text-muted)]'
            }
          />
          <span>Allow Anonymous Connections</span>
        </div>
        <button
          type="button"
          onClick={() => {
            void handleToggleAnonymous();
          }}
          disabled={isToggling || allowAnonymous === null}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            allowAnonymous
              ? 'bg-[var(--color-warning)]'
              : 'border border-[var(--color-border)] bg-[var(--color-surface-muted)]'
          }`}
          title={
            allowAnonymous
              ? 'Disable anonymous access'
              : 'Enable anonymous access'
          }
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              allowAnonymous ? 'left-[calc(100%-18px)]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Restart hint when running */}
      {running && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>
            Account and anonymous access changes require a server restart to
            take effect.
          </span>
        </div>
      )}

      {/* User account list with add/edit/remove */}
      <UserAccountManager />
    </PanelSection>
  );
}
