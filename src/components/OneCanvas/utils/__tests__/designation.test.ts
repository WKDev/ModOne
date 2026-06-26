// 자동 designation prefix 해석/번호계산 순수 함수 테스트
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DESIGNATION_PREFIXES,
  nextDesignation,
  resolveDesignationPrefix,
} from '../designation';

describe('nextDesignation', () => {
  it('빈 목록이면 1번을 부여한다', () => {
    expect(nextDesignation('K', [])).toBe('K1');
  });

  it('최댓값+1을 부여한다 (gap 허용)', () => {
    const components = [{ designation: 'K1' }, { designation: 'K3' }];
    expect(nextDesignation('K', components)).toBe('K4');
  });

  it('수동으로 박은 큰 번호도 max 계산에 포함한다', () => {
    expect(nextDesignation('K', [{ designation: 'K9' }])).toBe('K10');
  });

  it('다른 prefix나 형식이 안 맞는 designation은 무시한다', () => {
    const components = [
      { designation: 'PSX' },
      { designation: 'K1' },
      { designation: undefined },
      {},
    ];
    expect(nextDesignation('PS', components)).toBe('PS1');
  });

  it('prefix가 접두 일치할 뿐인 값은 세지 않는다 (앵커 고정)', () => {
    // KM1 은 K 풀이 아니다
    expect(nextDesignation('K', [{ designation: 'KM1' }])).toBe('K1');
  });
});

describe('resolveDesignationPrefix', () => {
  it('기본표에서 prefix를 찾는다', () => {
    expect(resolveDesignationPrefix('relay')).toBe('K');
    expect(resolveDesignationPrefix('motor')).toBe('M');
    expect(resolveDesignationPrefix('inductor')).toBe('L');
    expect(resolveDesignationPrefix('diode')).toBe('D');
  });

  it('별칭은 canonical 키로 모여 같은 prefix가 된다', () => {
    expect(resolveDesignationPrefix('relay_coil')).toBe('K'); // → relay
    expect(resolveDesignationPrefix('power_source')).toBe('G'); // → powersource
    expect(resolveDesignationPrefix('plc_input')).toBe('K'); // → plc_in
  });

  it('prefix 없는 부품은 undefined', () => {
    expect(resolveDesignationPrefix('text')).toBeUndefined();
    expect(resolveDesignationPrefix('ground')).toBeUndefined();
    expect(resolveDesignationPrefix('relay_contact_no')).toBeUndefined();
  });

  it('사용자 override가 기본값을 덮는다', () => {
    expect(resolveDesignationPrefix('contactor', { contactor: 'KM' })).toBe('KM');
  });

  it('override는 canonical 키로 적용돼 별칭에도 반영된다', () => {
    expect(resolveDesignationPrefix('relay_coil', { relay: 'R' })).toBe('R');
  });

  it('빈 문자열 override는 자동 넘버링을 끈다', () => {
    expect(resolveDesignationPrefix('relay', { relay: '' })).toBeUndefined();
    expect(resolveDesignationPrefix('relay', { relay: '   ' })).toBeUndefined();
  });
});

describe('DEFAULT_DESIGNATION_PREFIXES', () => {
  it('사용자 확정 이탈값이 반영돼 있다', () => {
    expect(DEFAULT_DESIGNATION_PREFIXES.contactor).toBe('K'); // 81346 엄격 Q 대신 K
    expect(DEFAULT_DESIGNATION_PREFIXES.inductor).toBe('L');
    expect(DEFAULT_DESIGNATION_PREFIXES.diode).toBe('D');
    expect(DEFAULT_DESIGNATION_PREFIXES.plc_in).toBe('K');
  });
});
