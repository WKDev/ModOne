/**
 * Designation Prefix Settings Panel
 *
 * 부품 자동 넘버링(PS1, K2…)에 쓰이는 종류별 prefix를 편집한다.
 * 기본값은 IEC 81346-2 기준(docs/auto-designation/designation-codes.md),
 * 사용자가 덮어쓴 값만 settings.designationPrefixOverrides에 저장된다.
 */

import { useCallback, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { DEFAULT_DESIGNATION_PREFIXES } from '../OneCanvas/utils/designation';

interface DesignationSettingsProps {
  searchFilter?: string;
}

/** canonical 블록 타입 → 표시 이름 */
const TYPE_LABELS: Record<string, string> = {
  powersource: '전원',
  power_source_dc_2p: '전원 (DC 2P)',
  power_source_ac_1p: '전원 (AC 1P)',
  power_source_ac_2p: '전원 (AC 2P)',
  relay: '릴레이',
  contactor: '전자접촉기',
  timer_on_delay: '온딜레이 타이머',
  timer_off_delay: '오프딜레이 타이머',
  counter_up: '업카운터',
  counter_down: '다운카운터',
  plc_in: 'PLC 입력',
  plc_out: 'PLC 출력',
  fuse: '퓨즈',
  circuit_breaker: '차단기',
  overload_relay: '과부하 릴레이',
  switch_no: '스위치 (NO)',
  switch_nc: '스위치 (NC)',
  switch_changeover: '절체 스위치',
  push_button_no: '푸시버튼 (NO)',
  push_button_nc: '푸시버튼 (NC)',
  button: '버튼',
  selector_switch: '셀렉터 스위치',
  emergency_stop: '비상정지',
  motor: '모터',
  sensor: '센서',
  transformer: '변압기',
  capacitor: '커패시터',
  resistor: '저항',
  inductor: '인덕터',
  diode: '다이오드',
  led: 'LED',
  pilot_lamp: '파일럿 램프',
  scope: '오실로스코프',
  terminal: '단자',
  connector: '커넥터',
  terminal_block: '단자대',
  disconnect_switch: '단로기',
  solenoid_valve: '솔레노이드 밸브',
};

export function DesignationSettings({ searchFilter = '' }: DesignationSettingsProps) {
  const { getMergedSettings, updatePending } = useSettingsStore();
  const overrides = getMergedSettings().designationPrefixOverrides;

  const filter = searchFilter.trim().toLowerCase();

  const rows = useMemo(() => {
    return Object.keys(DEFAULT_DESIGNATION_PREFIXES)
      .map((type) => ({
        type,
        label: TYPE_LABELS[type] ?? type,
        defaultPrefix: DEFAULT_DESIGNATION_PREFIXES[type],
      }))
      .filter(({ type, label, defaultPrefix }) =>
        !filter ||
        type.includes(filter) ||
        label.toLowerCase().includes(filter) ||
        defaultPrefix.toLowerCase().includes(filter)
      )
      .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  }, [filter]);

  const setOverride = useCallback(
    (type: string, value: string, defaultPrefix: string) => {
      const trimmed = value.trim();
      const next = { ...overrides };
      // 비었거나 기본값과 같으면 override 제거 → 기본값 복귀
      if (!trimmed || trimmed === defaultPrefix) {
        delete next[type];
      } else {
        next[type] = trimmed;
      }
      updatePending('designationPrefixOverrides', next);
    },
    [overrides, updatePending]
  );

  const handleResetAll = useCallback(() => {
    updatePending('designationPrefixOverrides', {});
  }, [updatePending]);

  const hasAnyOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">부품 넘버링 (Designation)</h3>
        {hasAnyOverrides && (
          <button
            onClick={handleResetAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
          >
            <RotateCcw size={12} />
            모두 초기화
          </button>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        부품을 배치하면 종류별 prefix에 번호가 자동으로 붙는다 (예: K1, K2…). 기본값은 IEC 81346-2를 따른다.
        칸을 비우면 기본값으로 돌아가고, prefix를 지워 빈 값으로 두면 그 종류는 자동 넘버링을 하지 않는다.
      </p>

      {/* Prefix table */}
      <div className="border border-[var(--border-color)] rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_5rem_6rem_2rem] gap-2 px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] text-xs font-medium text-[var(--text-muted)]">
          <span>부품 종류</span>
          <span className="text-center">기본값</span>
          <span className="text-center">prefix</span>
          <span />
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {rows.map(({ type, label, defaultPrefix }) => {
            const isOverridden = type in overrides;
            const value = overrides[type] ?? '';
            return (
              <div
                key={type}
                className="grid grid-cols-[1fr_5rem_6rem_2rem] gap-2 px-3 py-2 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-secondary)]/30 items-center group"
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate">{label}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{type}</div>
                </div>
                <div className="text-center text-xs font-mono text-[var(--text-muted)]">
                  {defaultPrefix}
                </div>
                <div className="flex justify-center">
                  <input
                    type="text"
                    value={value}
                    placeholder={defaultPrefix}
                    onChange={(e) => setOverride(type, e.target.value, defaultPrefix)}
                    className={`w-20 px-2 py-1 text-xs font-mono text-center bg-[var(--bg-secondary)] border rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] ${
                      isOverridden
                        ? 'border-[var(--accent-color)]'
                        : 'border-[var(--border-color)]'
                    }`}
                  />
                </div>
                <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  {isOverridden && (
                    <button
                      onClick={() => setOverride(type, '', defaultPrefix)}
                      className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      title="기본값으로 초기화"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
              일치하는 부품이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
