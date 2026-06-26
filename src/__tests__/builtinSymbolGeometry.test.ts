// 모든 builtin XML 심볼이 유한·양수 지오메트리를 갖는지 보장하는 회귀 테스트
//
// NaN width/height는 다운스트림 렌더러(CanvasMinimap 등)를 무너뜨린다.
// 이 테스트는 어떤 builtin 심볼도 NaN/0/음수 크기를 흘리지 못하게 막는다.
import { describe, expect, it } from 'vitest';
import { BUILTIN_SYMBOLS } from '../assets/builtin-symbols';
import { symbolDefToBlockDefinition } from '../utils/symbolBlockDefAdapter';

describe('builtin symbol geometry', () => {
  it('every builtin symbol has finite, positive Layout width/height', () => {
    for (const sym of BUILTIN_SYMBOLS.values()) {
      expect(Number.isFinite(sym.width), `${sym.id} width`).toBe(true);
      expect(Number.isFinite(sym.height), `${sym.id} height`).toBe(true);
      expect(sym.width, `${sym.id} width`).toBeGreaterThan(0);
      expect(sym.height, `${sym.id} height`).toBeGreaterThan(0);
    }
  });

  it('every builtin symbol derives a finite, positive block size', () => {
    for (const sym of BUILTIN_SYMBOLS.values()) {
      const { size } = symbolDefToBlockDefinition(sym);
      expect(Number.isFinite(size.width), `${sym.id} block width`).toBe(true);
      expect(Number.isFinite(size.height), `${sym.id} block height`).toBe(true);
      expect(size.width, `${sym.id} block width`).toBeGreaterThan(0);
      expect(size.height, `${sym.id} block height`).toBeGreaterThan(0);
    }
  });
});
