import { useSettingsStore } from '../../stores/settingsStore';
import { BaudRate, Parity, StopBits } from '../../types/settings';

interface ModbusSettingsProps {
  searchFilter?: string;
}

const baudRateOptions: BaudRate[] = [9600, 19200, 38400, 57600, 115200];
const parityOptions: { value: Parity; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'odd', label: 'Odd' },
  { value: 'even', label: 'Even' },
];
const stopBitsOptions: StopBits[] = [1, 2];

export function ModbusSettings({ searchFilter = '' }: ModbusSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const settings = getMergedSettings();

  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Modbus 설정</h3>

      {/* TCP Settings Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          TCP 설정
        </h4>

        {/* Default TCP port */}
        {isVisible(['tcp', 'port', '포트', '502']) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              기본 TCP 포트
            </label>
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.defaultTcpPort}
              onChange={(e) => {
                const value = Math.max(1, Math.min(65535, parseInt(e.target.value) || 502));
                updatePending('defaultTcpPort', value);
              }}
              className="w-32 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Modbus TCP 서버의 기본 포트입니다. (1-65535)
            </p>
          </div>
        )}
      </div>

      {/* RTU Settings Section */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
        <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          RTU 설정
        </h4>

        {/* COM Port */}
        {isVisible(['com', 'port', '포트', 'serial', '시리얼']) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">COM 포트</label>
            <input
              type="text"
              placeholder="COM1"
              value={settings.rtuComPort}
              onChange={(e) => updatePending('rtuComPort', e.target.value)}
              className="w-32 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
            />
            <p className="text-xs text-[var(--text-muted)]">
              RTU 통신에 사용할 시리얼 포트입니다.
            </p>
          </div>
        )}

        {/* Baud Rate */}
        {isVisible(['baud', 'rate', '전송 속도', '보레이트']) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">전송 속도</label>
            <select
              value={settings.rtuBaudRate}
              onChange={(e) => updatePending('rtuBaudRate', parseInt(e.target.value) as BaudRate)}
              className="w-32 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            >
              {baudRateOptions.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Parity */}
        {isVisible(['parity', '패리티', '검사']) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">패리티</label>
            <select
              value={settings.rtuParity}
              onChange={(e) => updatePending('rtuParity', e.target.value as Parity)}
              className="w-32 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            >
              {parityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Stop Bits */}
        {isVisible(['stop', 'bits', '정지 비트']) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">정지 비트</label>
            <select
              value={settings.rtuStopBits}
              onChange={(e) => updatePending('rtuStopBits', parseInt(e.target.value) as StopBits)}
              className="w-32 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            >
              {stopBitsOptions.map((bits) => (
                <option key={bits} value={bits}>
                  {bits}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Connection Settings Section */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
        <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          연결 설정
        </h4>

        {/* Connection timeout */}
        {isVisible(['timeout', '타임아웃', '연결', 'connection']) && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              연결 타임아웃
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                max={30000}
                step={100}
                value={settings.connectionTimeoutMs}
                onChange={(e) => {
                  const value = Math.max(100, Math.min(30000, parseInt(e.target.value) || 3000));
                  updatePending('connectionTimeoutMs', value);
                }}
                className="w-24 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
              />
              <span className="text-sm text-[var(--text-secondary)]">ms</span>
            </div>
          </div>
        )}

        {/* Auto reconnect */}
        {isVisible(['auto', 'reconnect', '자동 재연결', '재연결']) && (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoReconnect"
              checked={settings.autoReconnect}
              onChange={(e) => updatePending('autoReconnect', e.target.checked)}
              className="mt-1 w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-secondary)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
            />
            <div>
              <label
                htmlFor="autoReconnect"
                className="block text-sm font-medium text-[var(--text-primary)] cursor-pointer"
              >
                자동 재연결
              </label>
              <p className="text-xs text-[var(--text-muted)]">
                연결이 끊어지면 자동으로 재연결을 시도합니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
