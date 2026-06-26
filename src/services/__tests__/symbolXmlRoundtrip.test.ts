/**
 * Guards that symbolToXml() losslessly round-trips the rich parts of the symbol
 * model that were previously dropped on save: full-replacement visual-state
 * graphics (e.g. led "lit") and animations (e.g. motor "running"). Regression
 * guard for the editor save path AND a prerequisite for making XML the builtin
 * source of truth (R2).
 */
import { describe, it, expect } from 'vitest';
import { BUILTIN_SYMBOLS } from '@/assets/builtin-symbols';
import { symbolToXml, parseSymbolXml } from '@/services/symbolXmlParser';

const norm = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

describe('symbolToXml round-trip (visual-state graphics + animations)', () => {
  const withRichState = [...BUILTIN_SYMBOLS].filter(([, s]) => {
    const vsGraphics = Object.values(s.visualStates ?? {}).some(
      (v) => ((v?.graphics?.length ?? 0) > 0),
    );
    const anims = s.animations && Object.keys(s.animations).length > 0;
    return vsGraphics || anims;
  });

  it('covers the interactive symbols (sanity: the set is non-empty)', () => {
    // led, pilot_lamp, switch_*, push_button_*, button, relay_contact_*, motor…
    expect(withRichState.length).toBeGreaterThanOrEqual(8);
  });

  it.each(withRichState.map(([id]) => id))(
    '%s: visual-state graphics survive serialize → parse',
    (id) => {
      const ts = BUILTIN_SYMBOLS.get(id)!;
      const [parsed] = parseSymbolXml(symbolToXml(ts));
      for (const [state, v] of Object.entries(ts.visualStates ?? {})) {
        if ((v?.graphics?.length ?? 0) > 0) {
          expect(norm(parsed.visualStates?.[state]?.graphics)).toEqual(norm(v!.graphics));
        }
      }
    },
  );

  it.each(withRichState.filter(([, s]) => s.animations && Object.keys(s.animations).length > 0).map(([id]) => id))(
    '%s: animations survive serialize → parse',
    (id) => {
      const ts = BUILTIN_SYMBOLS.get(id)!;
      const [parsed] = parseSymbolXml(symbolToXml(ts));
      expect(norm(parsed.animations)).toEqual(norm(ts.animations));
    },
  );
});
