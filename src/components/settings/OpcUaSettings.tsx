import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Info, AlertTriangle, Lock, Unlock, UserX } from 'lucide-react';
import { useOpcUaStore, selectCertificateFingerprint, selectCertificateValidTo, selectRunning, selectEndpoint } from '../../stores/opcuaStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { opcuaService } from '../../services/opcuaService';
import type { OpcUaSecurityPolicy, SecurityPolicyInfo } from '../../types/project';
import { UserAccountManager } from './UserAccountManager';
import { SessionMonitoringTable } from './SessionMonitoringTable';
import { AuditLogViewer } from './AuditLogViewer';

interface OpcUaSettingsProps {
  searchFilter?: string;
}

/** Descriptions for each security policy to show as helper text */
const POLICY_DESCRIPTIONS: Record<OpcUaSecurityPolicy, string> = {
  None: '암호화 없음 — 개발/테스트 전용',
  Basic128Rsa15: '레거시 클라이언트 호환 (사용 중단됨)',
  Basic256: '레거시 클라이언트 호환 (사용 중단됨)',
  Basic256Sha256: '프로덕션 권장 최소 보안 수준',
  Aes128Sha256RsaOaep: '최신 보안 정책',
  Aes256Sha256RsPss: '가장 강력한 보안 정책',
};

export function OpcUaSettings({ searchFilter = '' }: OpcUaSettingsProps) {
  const fingerprint = useOpcUaStore(selectCertificateFingerprint);
  const validTo = useOpcUaStore(selectCertificateValidTo);
  const running = useOpcUaStore(selectRunning);
  const endpoint = useOpcUaStore(selectEndpoint);
  const opcuaPort = useLayoutStore((s) => s.opcuaPort);
  const { fetchStatus } = useOpcUaStore();

  // Security policies state
  const [policies, setPolicies] = useState<SecurityPolicyInfo[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Anonymous access state
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [anonymousLoading, setAnonymousLoading] = useState(false);
  const [anonymousSaving, setAnonymousSaving] = useState(false);

  // Fetch status on mount to get certificate info
  const [fetched, setFetched] = useState(false);
  useEffect(() => {
    if (!fetched) {
      fetchStatus();
      setFetched(true);
    }
  }, [fetched, fetchStatus]);

  // Fetch security policies on mount
  useEffect(() => {
    let cancelled = false;
    setPoliciesLoading(true);
    setPoliciesError(null);
    opcuaService
      .getSecurityPolicies()
      .then((result) => {
        if (!cancelled) {
          setPolicies(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPoliciesError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPoliciesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch anonymous access setting on mount
  useEffect(() => {
    let cancelled = false;
    setAnonymousLoading(true);
    opcuaService
      .getAnonymousAccess()
      .then((result) => {
        if (!cancelled) {
          setAllowAnonymous(result);
        }
      })
      .catch(() => {
        // Silently fail — defaults to false
      })
      .finally(() => {
        if (!cancelled) {
          setAnonymousLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTogglePolicy = useCallback(
    async (policyId: OpcUaSecurityPolicy, currentlyEnabled: boolean) => {
      // Build the new set of enabled policies
      const currentEnabled = policies.filter((p) => p.enabled).map((p) => p.id);
      let newEnabled: OpcUaSecurityPolicy[];

      if (currentlyEnabled) {
        // Disabling — remove from list
        newEnabled = currentEnabled.filter((id) => id !== policyId);
      } else {
        // Enabling — add to list
        newEnabled = [...currentEnabled, policyId];
      }

      // Must have at least one policy enabled
      if (newEnabled.length === 0) {
        return;
      }

      setSaving(true);
      setPoliciesError(null);
      try {
        const updated = await opcuaService.setSecurityPolicies(newEnabled);
        setPolicies(updated);
      } catch (err) {
        setPoliciesError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [policies]
  );

  const handleToggleAnonymous = useCallback(async () => {
    setAnonymousSaving(true);
    try {
      const newValue = await opcuaService.setAnonymousAccess(!allowAnonymous);
      setAllowAnonymous(newValue);
    } catch {
      // Error toast handled by service
    } finally {
      setAnonymousSaving(false);
    }
  }, [allowAnonymous]);

  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

  const enabledCount = policies.filter((p) => p.enabled).length;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">OPC UA 설정</h3>

      {/* Server Info (Read-only) */}
      {isVisible(['opcua', 'server', '서버', 'port', '포트', 'status', '상태']) && (
        <div className="space-y-4">
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            서버 정보
          </h4>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)]">상태</span>
              <span className={`text-sm ${running ? 'text-[var(--color-success)]' : 'text-[var(--text-muted)]'}`}>
                {running ? 'Running' : 'Stopped'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)]">포트</span>
              <span className="text-sm text-[var(--text-secondary)]">{opcuaPort}</span>
            </div>
            {running && endpoint && (
              <div className="space-y-1">
                <span className="text-sm text-[var(--text-primary)]">Endpoint</span>
                <div className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded px-3 py-2 break-all select-all">
                  {endpoint}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>
              OPC UA 서버 설정은 프로젝트 설정 패널에서 변경할 수 있습니다. (포트, 서버 이름, 인증 정보)
            </p>
          </div>
        </div>
      )}

      {/* Security Policies */}
      {isVisible(['security', 'policy', '보안', '정책', 'encryption', '암호화', 'Basic256', 'Aes128', 'Aes256', 'Rsa']) && (
        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              보안 정책 (Security Policies)
            </h4>
            {enabledCount > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                {enabledCount}개 활성
              </span>
            )}
          </div>

          {policiesLoading ? (
            <div className="text-xs text-[var(--text-muted)] py-2">보안 정책 로딩 중...</div>
          ) : policiesError ? (
            <div className="flex items-start gap-2 text-xs text-[var(--color-error)] py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{policiesError}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {policies.map((policy) => {
                const isOnlyEnabled = policy.enabled && enabledCount <= 1;

                return (
                  <label
                    key={policy.id}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors
                      ${policy.enabled
                        ? 'bg-[var(--accent-color)]/5 hover:bg-[var(--accent-color)]/10'
                        : 'hover:bg-[var(--bg-secondary)]'}
                      ${isOnlyEnabled ? 'cursor-not-allowed' : ''}
                      ${saving ? 'opacity-60 pointer-events-none' : ''}
                    `}
                    title={
                      isOnlyEnabled
                        ? '최소 하나의 보안 정책이 활성화되어야 합니다'
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={policy.enabled}
                      disabled={saving || isOnlyEnabled}
                      onChange={() => handleTogglePolicy(policy.id, policy.enabled)}
                      className="mt-0.5 accent-[var(--accent-color)]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {policy.requiresEncryption ? (
                          <Lock size={12} className="text-[var(--color-success)] shrink-0" />
                        ) : (
                          <Unlock size={12} className="text-[var(--text-muted)] shrink-0" />
                        )}
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {policy.displayName}
                        </span>
                        {policy.requiresEncryption && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                            {policy.messageSecurityMode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {POLICY_DESCRIPTIONS[policy.id]}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Warning when None is enabled */}
          {policies.some((p) => p.id === 'None' && p.enabled) && (
            <div className="flex items-start gap-2 text-xs text-[var(--color-warning,#e5a100)] bg-[var(--color-warning,#e5a100)]/5 rounded px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>
                "None" 정책이 활성화되어 있습니다. 암호화 없이 데이터가 전송됩니다.
                프로덕션 환경에서는 비활성화를 권장합니다.
              </p>
            </div>
          )}

          {running && (
            <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <Info size={14} className="shrink-0 mt-0.5" />
              <p>
                보안 정책 변경은 서버 재시작 후 적용됩니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Anonymous Access Toggle */}
      {isVisible(['anonymous', '익명', 'access', '접속', 'authentication', '인증']) && (
        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            익명 접속 (Anonymous Access)
          </h4>

          <label
            className={`flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors
              ${allowAnonymous
                ? 'bg-[var(--color-warning,#e5a100)]/5 hover:bg-[var(--color-warning,#e5a100)]/10'
                : 'hover:bg-[var(--bg-secondary)]'}
              ${anonymousSaving || anonymousLoading ? 'opacity-60 pointer-events-none' : ''}
            `}
          >
            <input
              type="checkbox"
              checked={allowAnonymous}
              disabled={anonymousSaving || anonymousLoading}
              onChange={handleToggleAnonymous}
              className="accent-[var(--accent-color)]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <UserX size={14} className={allowAnonymous ? 'text-[var(--color-warning,#e5a100)]' : 'text-[var(--text-muted)]'} />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  익명 클라이언트 접속 허용
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                인증 없이 OPC UA 클라이언트가 서버에 접속할 수 있습니다.
              </p>
            </div>
          </label>

          {allowAnonymous && (
            <div className="flex items-start gap-2 text-xs text-[var(--color-warning,#e5a100)] bg-[var(--color-warning,#e5a100)]/5 rounded px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>
                익명 접속이 활성화되어 있습니다. 인증 없이 누구나 서버에 접속하여 태그 데이터를 읽을 수 있습니다.
                프로덕션 환경에서는 비활성화를 권장합니다.
              </p>
            </div>
          )}

          {running && (
            <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
              <Info size={14} className="shrink-0 mt-0.5" />
              <p>
                익명 접속 설정 변경은 서버 재시작 후 적용됩니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* User Accounts */}
      <div className="pt-4 border-t border-[var(--border-color)]">
        <UserAccountManager searchFilter={searchFilter} />
      </div>

      {/* Session Monitoring */}
      {isVisible(['session', '세션', 'client', '클라이언트', 'monitor', '모니터링', 'connection', '연결']) && (
        <div className="pt-4 border-t border-[var(--border-color)]">
          <SessionMonitoringTable />
        </div>
      )}

      {/* Certificate Info (Read-only) */}
      {isVisible(['certificate', '인증서', 'pki', 'fingerprint']) && (
        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
          <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            인증서 정보
          </h4>

          {fingerprint ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[var(--text-muted)]" />
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    SHA-256 Fingerprint
                  </label>
                </div>
                <div className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded px-3 py-2 break-all select-all">
                  {fingerprint}
                </div>
              </div>

              {validTo && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">유효기간</label>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {new Date(validTo).toLocaleDateString()} 까지
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              서버가 실행 중일 때 인증서 정보가 표시됩니다.
            </p>
          )}
        </div>
      )}

      {/* Audit Log */}
      {isVisible(['audit', 'log', '감사', '로그', 'event', '이벤트']) && (
        <div className="pt-4 border-t border-[var(--border-color)]">
          <AuditLogViewer searchFilter={searchFilter} />
        </div>
      )}
    </div>
  );
}
