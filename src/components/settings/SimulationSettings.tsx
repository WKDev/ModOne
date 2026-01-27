import { useSettingsStore } from '../../stores/settingsStore';
import { TimerPrecision, SimulationSpeed, StepExecutionMode } from '../../types/settings';

interface SimulationSettingsProps {
  searchFilter?: string;
}

const timerPrecisionOptions: { value: TimerPrecision; label: string }[] = [
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '보통' },
  { value: 'high', label: '높음' },
];

const simulationSpeedOptions: { value: SimulationSpeed; label: string }[] = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
];

const stepExecutionOptions: { value: StepExecutionMode; label: string }[] = [
  { value: 'single-step', label: '단일 스텝' },
  { value: 'until-breakpoint', label: '브레이크포인트까지' },
  { value: 'continuous', label: '연속 실행' },
];

export function SimulationSettings({ searchFilter = '' }: SimulationSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const settings = getMergedSettings();

  const filter = searchFilter.toLowerCase();

  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((keyword) => keyword.toLowerCase().includes(filter));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">시뮬레이션 설정</h3>

      {/* Default scan time */}
      {isVisible(['scan time', '스캔 타임', '스캔 시간', 'plc', 'cycle']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            기본 스캔 타임
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={1000}
              value={settings.defaultScanTimeMs}
              onChange={(e) => {
                const value = Math.max(1, Math.min(1000, parseInt(e.target.value) || 10));
                updatePending('defaultScanTimeMs', value);
              }}
              className="w-24 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">ms</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            PLC 시뮬레이션의 기본 스캔 타임입니다. (1-1000ms)
          </p>
        </div>
      )}

      {/* Timer precision */}
      {isVisible(['timer', '타이머', 'precision', '정밀도', '정확도']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            타이머 정밀도
          </label>
          <select
            value={settings.timerPrecision}
            onChange={(e) => updatePending('timerPrecision', e.target.value as TimerPrecision)}
            className="w-full max-w-xs px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          >
            {timerPrecisionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--text-muted)]">
            높을수록 정확하지만 CPU 사용량이 증가합니다.
          </p>
        </div>
      )}

      {/* Simulation speed */}
      {isVisible(['speed', '속도', 'multiplier', '배속']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            시뮬레이션 속도
          </label>
          <div className="flex gap-2">
            {simulationSpeedOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center justify-center px-4 py-2 rounded cursor-pointer transition-colors ${
                  settings.simulationSpeedMultiplier === option.value
                    ? 'bg-[var(--accent-color)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <input
                  type="radio"
                  name="simulationSpeed"
                  value={option.value}
                  checked={settings.simulationSpeedMultiplier === option.value}
                  onChange={() => updatePending('simulationSpeedMultiplier', option.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            시뮬레이션 실행 속도 배율입니다.
          </p>
        </div>
      )}

      {/* Step execution mode */}
      {isVisible(['step', '스텝', 'execution', '실행', 'breakpoint', '브레이크포인트']) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--text-primary)]">
            스텝 실행 모드
          </label>
          <select
            value={settings.stepExecutionMode}
            onChange={(e) => updatePending('stepExecutionMode', e.target.value as StepExecutionMode)}
            className="w-full max-w-xs px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
          >
            {stepExecutionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--text-muted)]">
            디버깅 시 기본 스텝 실행 방식입니다.
          </p>
        </div>
      )}
    </div>
  );
}
