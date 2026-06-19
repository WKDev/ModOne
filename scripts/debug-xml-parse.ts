import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseHTML } from 'linkedom';

const { DOMParser: LinkedDOMParser } = parseHTML('');
(globalThis as any).DOMParser = LinkedDOMParser;

const __dirname = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(join(__dirname, '..', 'src', 'assets', 'builtin-symbols', 'xml', 'fuse.symbol.xml'), 'utf-8');

const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'application/xml');
const root = doc.documentElement;

console.log('Root tagName:', root.tagName);
console.log('Root localName:', root.localName);
console.log('Root children count:', root.children.length);
console.log('Root childNodes count:', root.childNodes.length);

for (const c of Array.from(root.children)) {
  console.log('  child:', c.tagName, c.localName, c.namespaceURI);
}

const graphicsEl = Array.from(root.children).find(c => {
  const tag = c.tagName ?? c.nodeName ?? '';
  return c.localName === 'Graphics' || tag === 'ms:Graphics' || tag.endsWith(':Graphics');
});
console.log('\nFound Graphics?', !!graphicsEl);
if (graphicsEl) {
  console.log('Graphics children:', graphicsEl.children.length);
  for (const c of Array.from(graphicsEl.children)) {
    console.log('  graphic child:', c.tagName, c.localName);
  }
}
