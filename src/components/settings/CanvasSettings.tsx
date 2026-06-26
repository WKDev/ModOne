// 캔버스/심볼 회전 동작(각도·방향) 설정 패널
import { RotateCw, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import type { RotationDirection } from '../../types/settings';

interface CanvasSettingsProps {
  searchFilter?: string;
}

const directionOptions: { value: RotationDirection; label: string; icon: React.ReactNode }[] = [
  { value: 'cw', label: '시계 방향', icon: <RotateCw size={18} /> },
  { value: 'ccw', label: '반시계 방향', icon: <RotateCcw size={18} /> },
];

export function CanvasSettings({ searchFilter = '' }: CanvasSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const settings = getMergedSettings();

  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

  // 1-360 범위로 보정
  const handleStepChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(360, Math.max(1, parsed));
    updatePending('symbolRotationStep', clamped);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">캔버스 설정</h3>

      {/* 회전 각도 */}
      {isVisible(['rotation', 'angle', 'step', '회전', '각도', '심볼', 'symbol', 'R']) && (
        <div className="space-y-2">
          <label
            htmlFor="symbolRotationStep"
            className="block text-sm font-medium text-[var(--text-primary)]"
          >
            R 1회 회전 각도: {settings.symbolRotationStep}°
          </label>
          <input
            id="symbolRotationStep"
            type="number"
            min={1}
            max={360}
            value={settings.symbolRotationStep}
            onChange={(e) => handleStepChange(e.target.value)}
            className="w-28 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          />
          <p className="text-xs text-[var(--text-muted)]">
            선택한 심볼을 R 키로 한 번 회전할 때 적용되는 각도입니다. (1~360°)
          </p>
        </div>
      )}

      {/* 회전 방향 */}
      {isVisible(['rotation', 'direction', '회전', '방향', '시계', '반시계']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">회전 방향</label>
          <div className="flex gap-2">
            {directionOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 px-4 py-2 rounded cursor-pointer transition-colors ${
                  settings.symbolRotationDirection === option.value
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <input
                  type="radio"
                  name="symbolRotationDirection"
                  value={option.value}
                  checked={settings.symbolRotationDirection === option.value}
                  onChange={() => updatePending('symbolRotationDirection', option.value)}
                  className="sr-only"
                />
                {option.icon}
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            R 키 회전의 기본 방향입니다. Shift+R 을 누르면 반대 방향으로 회전합니다.
          </p>
        </div>
      )}

      {/* 회전 시 와이어 연결 유지 */}
      {isVisible(['rotation', 'wire', 'connection', '회전', '와이어', '연결', '포트', 'port']) && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="symbolRotationKeepConnections"
            checked={settings.symbolRotationKeepConnections}
            onChange={(e) => updatePending('symbolRotationKeepConnections', e.target.checked)}
            className="mt-1 w-4 h-4 text-[var(--accent-color)] bg-[var(--bg-secondary)] border-[var(--border-color)] rounded focus:ring-[var(--accent-color)]"
          />
          <div>
            <label
              htmlFor="symbolRotationKeepConnections"
              className="block text-sm font-medium text-[var(--text-primary)] cursor-pointer"
            >
              회전 시 와이어 연결 유지
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              심볼을 회전할 때 포트에 연결된 와이어를 따라오게 합니다. 끄면 회전 시 연결이
              끊겨 와이어가 제자리에 남습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
