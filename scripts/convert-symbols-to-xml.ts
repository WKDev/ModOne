/**
 * Convert all builtin TS symbol definitions to XML files.
 * Run with: npx tsx scripts/convert-symbols-to-xml.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'src', 'assets', 'builtin-symbols', 'xml');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  // Dynamic import to use the project's module system
  const { BUILTIN_SYMBOLS } = await import('../src/assets/builtin-symbols/index');
  const { symbolToXml } = await import('../src/services/symbolXmlParser');

  let count = 0;
  for (const [id, sym] of BUILTIN_SYMBOLS) {
    const filename = id.replace('builtin:', '') + '.symbol.xml';
    const xmlContent = symbolToXml(sym);
    writeFileSync(join(OUTPUT_DIR, filename), xmlContent, 'utf-8');
    console.log(`  ✓ ${filename}`);
    count++;
  }
  console.log(`\nConverted ${count} symbols to XML.`);
}

main().catch(console.error);
