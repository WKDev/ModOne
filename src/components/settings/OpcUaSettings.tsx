import { useEffect, useState } from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import { useOpcUaStore, selectCertificateFingerprint, selectCertificateValidTo, selectRunning, selectEndpoint } from '../../stores/opcuaStore';
import { useLayoutStore } from '../../stores/layoutStore';

interface OpcUaSettingsProps {
  searchFilter?: string;
}

export function OpcUaSettings({ searchFilter = '' }: OpcUaSettingsProps) {
  const fingerprint = useOpcUaStore(selectCertificateFingerprint);
  const validTo = useOpcUaStore(selectCertificateValidTo);
  const running = useOpcUaStore(selectRunning);
  const endpoint = useOpcUaStore(selectEndpoint);
  const opcuaPort = useLayoutStore((s) => s.opcuaPort);
  const { fetchStatus } = useOpcUaStore();

  // Fetch status on mount to get certificate info
  const [fetched, setFetched] = useState(false);
  useEffect(() => {
    if (!fetched) {
      fetchStatus();
      setFetched(true);
    }
  }, [fetched, fetchStatus]);

  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

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
    </div>
  );
}
