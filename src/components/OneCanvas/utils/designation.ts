// 부품 종류별 자동 designation(PS1, K2…) prefix 기본표 + 다음 번호 계산
//
// prefix는 IEC 81346-2를 기준으로 한 기본표(아래)에 사용자 설정(앱 전역)을
// 덮어쓰는 구조다. 키는 builtin 심볼 id 기준 canonical 타입이라 별칭
// (power_source/powersource 등)이 한 칸으로 모인다. 표준 근거는
// docs/auto-designation/designation-codes.md 참고.

import { canonicalBlockType } from '@/assets/builtin-symbols';
import { useSettingsStore } from '@/stores/settingsStore';

/** designation prefix 기본표 — canonical 블록 타입 → prefix. 없는 타입은 자동 넘버링 제외 */
export const DEFAULT_DESIGNATION_PREFIXES: Readonly<Record<string, string>> = {
  // 전원 (G)
  powersource: 'G',
  power_source_dc_2p: 'G',
  power_source_ac_1p: 'G',
  power_source_ac_2p: 'G',
  // 신호 처리 — 릴레이/타이머/카운터/PLC I/O (K)
  relay: 'K',
  contactor: 'K',
  timer_on_delay: 'K',
  timer_off_delay: 'K',
  counter_up: 'K',
  counter_down: 'K',
  plc_in: 'K',
  plc_out: 'K',
  // 보호 (F)
  fuse: 'F',
  circuit_breaker: 'F',
  overload_relay: 'F',
  // 수동 조작 스위치 (S)
  switch_no: 'S',
  switch_nc: 'S',
  switch_changeover: 'S',
  push_button_no: 'S',
  push_button_nc: 'S',
  button: 'S',
  selector_switch: 'S',
  emergency_stop: 'S',
  // 단독 클래스
  motor: 'M',
  sensor: 'B',
  transformer: 'T',
  capacitor: 'C',
  resistor: 'R',
  inductor: 'L',
  diode: 'D',
  // 표시/계측 (P)
  led: 'P',
  pilot_lamp: 'P',
  scope: 'P',
  // 연결 (X)
  terminal: 'X',
  connector: 'X',
  terminal_block: 'X',
  // 흐름 차단/절체 (Q)
  disconnect_switch: 'Q',
  solenoid_valve: 'Q',
};

/** 정규식 메타문자 이스케이프 (override prefix가 임의 문자일 수 있으므로) */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 블록 타입의 designation prefix를 해석한다.
 * 우선순위: 사용자 override → 기본표 → undefined(자동 넘버링 안 함).
 * 빈 문자열 override는 "끔"으로 보고 undefined를 돌려준다.
 */
export function resolveDesignationPrefix(
  type: string,
  overrides: Record<string, string> = {},
): string | undefined {
  const key = canonicalBlockType(type);
  const value = overrides[key] ?? DEFAULT_DESIGNATION_PREFIXES[key];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 같은 prefix를 쓰는 기존 부품을 스캔해 다음 번호를 붙인 designation을 만든다.
 * 최댓값+1 방식(gap 허용). 수동으로 박은 값도 max 계산에 포함하므로 충돌하지 않는다.
 */
export function nextDesignation(
  prefix: string,
  components: Iterable<{ designation?: string }>,
): string {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  let max = 0;
  for (const component of components) {
    const designation = component?.designation;
    if (typeof designation !== 'string') continue;
    const matched = pattern.exec(designation);
    if (!matched) continue;
    const n = Number(matched[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

/**
 * 배치 시 부여할 자동 designation을 계산한다(앱 전역 설정의 override를 읽는다).
 * prefix가 없으면 undefined → 호출부는 기존 동작(심볼 기본값)을 유지한다.
 */
export function nextAutoDesignation(
  type: string,
  components: Iterable<{ designation?: string }>,
): string | undefined {
  const overrides = useSettingsStore.getState().settings.designationPrefixOverrides;
  const prefix = resolveDesignationPrefix(type, overrides);
  if (!prefix) return undefined;
  return nextDesignation(prefix, components);
}
