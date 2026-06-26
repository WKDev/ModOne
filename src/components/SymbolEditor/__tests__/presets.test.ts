// 아키타입 프리셋이 일관성 있고(검증 통과) 동작 가능한지 확인
import { describe, it, expect } from 'vitest';
import { ARCHETYPE_PRESETS, createArchetypeSymbol } from '../presets';
import { validateSymbol } from '../../../utils/symbolValidation';

describe('archetype presets', () => {
  for (const preset of ARCHETYPE_PRESETS) {
    describe(preset.id, () => {
      const sym = createArchetypeSymbol(preset.id);

      it('passes symbol validation', () => {
        const result = validateSymbol(sym);
        expect(result.valid).toBe(true);
      });

      it('has at least 2 pins and graphics', () => {
        expect(sym.pins.length).toBeGreaterThanOrEqual(2);
        expect(sym.graphics.length).toBeGreaterThanOrEqual(1);
      });

      it('behavior rules reference real pin ids', () => {
        const pinIds = new Set(sym.pins.map((p) => p.id));
        for (const rule of sym.behavior?.rules ?? []) {
          for (const cond of rule.conditions) {
            if (cond.portId) expect(pinIds.has(cond.portId)).toBe(true);
          }
        }
      });

      it('rules reference declared visual states', () => {
        const states = new Set(Object.keys(sym.visualStates ?? {}));
        for (const rule of sym.behavior?.rules ?? []) {
          for (const action of [...rule.thenActions, ...rule.elseActions]) {
            if (action.type === 'set_state' && action.stateName) {
              expect(states.has(action.stateName)).toBe(true);
            }
          }
        }
      });

      it('animation targets reference real graphic ids', () => {
        const graphicIds = new Set(sym.graphics.map((g) => g.id).filter(Boolean));
        for (const specs of Object.values(sym.animations ?? {})) {
          for (const spec of specs) {
            expect(graphicIds.has(spec.target)).toBe(true);
          }
        }
      });
    });
  }
});
