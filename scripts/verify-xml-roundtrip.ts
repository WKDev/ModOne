/**
 * Verify XML roundtrip: TS → XML → parse → compare
 * Run with: npx tsx scripts/verify-xml-roundtrip.ts
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';

// Polyfill DOMParser for Node.js
const { DOMParser: LinkedDOMParser } = parseHTML('');
(globalThis as any).DOMParser = LinkedDOMParser;

const __dirname = dirname(fileURLToPath(import.meta.url));
const XML_DIR = join(__dirname, '..', 'src', 'assets', 'builtin-symbols', 'xml');

async function main() {
  const { BUILTIN_SYMBOLS } = await import('../src/assets/builtin-symbols/index');
  const { parseSymbolXml } = await import('../src/services/symbolXmlParser');

  let pass = 0;
  let fail = 0;
  const errors: string[] = [];

  for (const [id, original] of BUILTIN_SYMBOLS) {
    const filename = id.replace('builtin:', '') + '.symbol.xml';
    try {
      const xml = readFileSync(join(XML_DIR, filename), 'utf-8');
      const [parsed] = parseSymbolXml(xml);

      // Compare key fields
      const checks: [string, unknown, unknown][] = [
        ['id', parsed.id, original.id],
        ['name', parsed.name, original.name],
        ['width', parsed.width, original.width],
        ['height', parsed.height, original.height],
        ['pins.length', parsed.pins.length, original.pins.length],
        ['graphics.length', parsed.graphics.length, original.graphics.length],
        ['properties.length', parsed.properties.length, original.properties.length],
        ['category', parsed.category, original.category],
      ];

      let blockFail = false;
      for (const [field, got, expected] of checks) {
        if (got !== expected) {
          errors.push(`  ${id}: ${field} mismatch: got=${got}, expected=${expected}`);
          blockFail = true;
        }
      }

      // Check pin IDs match
      const origPinIds = original.pins.map(p => p.id).sort().join(',');
      const parsedPinIds = parsed.pins.map(p => p.id).sort().join(',');
      if (origPinIds !== parsedPinIds) {
        errors.push(`  ${id}: pin IDs mismatch: got=[${parsedPinIds}], expected=[${origPinIds}]`);
        blockFail = true;
      }

      // Check units
      if (original.units && parsed.units) {
        if (original.units.length !== parsed.units.length) {
          errors.push(`  ${id}: units.length mismatch: got=${parsed.units.length}, expected=${original.units.length}`);
          blockFail = true;
        }
      } else if (original.units && !parsed.units) {
        errors.push(`  ${id}: units missing in parsed`);
        blockFail = true;
      }

      if (blockFail) fail++;
      else pass++;
    } catch (err) {
      errors.push(`  ${id}: PARSE ERROR: ${err}`);
      fail++;
    }
  }

  console.log(`\nRoundtrip verification: ${pass} pass, ${fail} fail`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(e));
  }
}

main().catch(console.error);
