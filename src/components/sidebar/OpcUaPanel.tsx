import { useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Radio,
  Copy,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOpcUaStore, selectRunning, selectEndpoint, selectSessionCount, selectSessionCountSupported, selectCertificateFingerprint, selectCertificateValidTo, selectFeatureEnabled, selectIsStarting, selectIsStopping, selectError } from '../../stores/opcuaStore';
import { useProjectStore } from '../../stores/projectStore';
import { useLayoutStore } from '../../stores/layoutStore';

export function OpcUaPanel() {
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
  const { startServer, stopServer, fetchStatus } = useOpcUaStore();

  const currentProject = useProjectStore((s) => s.currentProject);
  const opcuaPort = useLayoutStore((s) => s.opcuaPort);

  // Fetch initial status
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const opcuaConfig = currentProject?.config?.opcua;

  const handleStart = useCallback(async () => {
    if (!opcuaConfig) return;
    await startServer({
      port: opcuaConfig.port,
      server_name: opcuaConfig.server_name,
      username: opcuaConfig.username,
      password: opcuaConfig.password,
    });
  }, [opcuaConfig, startServer]);

  const handleStop = useCallback(async () => {
    await stopServer();
  }, [stopServer]);

  const handleCopyEndpoint = useCallback(() => {
    if (endpoint) {
      navigator.clipboard.writeText(endpoint);
      toast.success('Endpoint URL 복사됨');
    }
  }, [endpoint]);

  const handleCopyFingerprint = useCallback(() => {
    if (fingerprint) {
      navigator.clipboard.writeText(fingerprint);
      toast.success('Fingerprint 복사됨');
    }
  }, [fingerprint]);

  const isExpiringSoon = validTo ? new Date(validTo).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 : false;

  return (
    <div className="p-3 space-y-4">
      {/* Feature Not Enabled Banner */}
      {!featureEnabled && (
        <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
          <div className="text-xs text-[var(--color-warning)]">
            OPC UA 기능이 현재 환경에서 지원되지 않습니다.
          </div>
        </div>
      )}

      {/* Server Status */}
      <div className="bg-[var(--color-bg-primary)] rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">
          서버 상태
        </h3>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Radio
              size={16}
              className={running ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}
            />
            <span
              className={
                running ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'
              }
            >
              {running ? 'Running' : 'Stopped'}
            </span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">UA:{opcuaPort}</span>
        </div>

        {/* Endpoint URL */}
        {running && endpoint && (
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-[var(--color-text-muted)]">Endpoint</span>
              <button
                onClick={handleCopyEndpoint}
                className="p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded"
                title="Endpoint URL 복사"
              >
                <Copy size={10} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-tertiary)] rounded px-2 py-1 break-all">
              {endpoint}
            </div>
          </div>
        )}

        {/* Session Count */}
        {running && sessionCountSupported && (
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-[var(--color-text-secondary)]">Sessions</span>
            <span className="text-[var(--color-text-muted)]">{sessionCount}</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-3 text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 rounded px-2 py-1">
            {error}
          </div>
        )}

        {/* Server Controls */}
        <div className="flex gap-2">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm ${
              running || isStarting
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-success)] hover:bg-[var(--color-success)] text-white'
            }`}
            onClick={handleStart}
            disabled={running || isStarting || isStopping}
          >
            <Play size={14} />
            {isStarting ? '시작 중...' : 'Start'}
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-sm ${
              !running || isStopping
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-error)] hover:bg-[var(--color-error)] text-white'
            }`}
            onClick={handleStop}
            disabled={!running || isStarting || isStopping}
          >
            <Square size={14} />
            {isStopping ? '중지 중...' : 'Stop'}
          </button>
        </div>
      </div>

      {/* Certificate Info */}
      {fingerprint && (
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">
            인증서 정보
          </h3>

          {/* Fingerprint */}
          <div className="mb-2">
            <div className="flex items-center gap-1 mb-1">
              <ShieldCheck size={12} className="text-[var(--color-text-muted)]" />
              <span className="text-xs text-[var(--color-text-muted)]">SHA-256 Fingerprint</span>
              <button
                onClick={handleCopyFingerprint}
                className="p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded"
                title="Fingerprint 복사"
              >
                <Copy size={10} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-tertiary)] rounded px-2 py-1 break-all">
              {fingerprint}
            </div>
          </div>

          {/* Valid To */}
          {validTo && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">유효기간</span>
              <div className="flex items-center gap-1">
                {isExpiringSoon && (
                  <ShieldAlert size={12} className="text-[var(--color-warning)]" />
                )}
                <span
                  className={
                    isExpiringSoon
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-text-muted)]'
                  }
                >
                  {new Date(validTo).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Summary */}
      {opcuaConfig && (
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-3">
            설정 요약
          </h3>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Port</span>
              <span className="text-[var(--color-text-muted)]">{opcuaConfig.port}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Server Name</span>
              <span className="text-[var(--color-text-muted)] text-xs truncate max-w-[120px]">
                {opcuaConfig.server_name}
              </span>
            </div>
            {opcuaConfig.username && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Username</span>
                <span className="text-[var(--color-text-muted)]">{opcuaConfig.username}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              // Open project settings - dispatch a custom event or use a store action
              document.dispatchEvent(new CustomEvent('open-project-settings'));
            }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
          >
            <ExternalLink size={12} />
            프로젝트 설정 열기
          </button>
        </div>
      )}
    </div>
  );
}
