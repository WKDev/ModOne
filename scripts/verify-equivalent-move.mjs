// 동작 보존 분리(behavior-preserving move) 검증기 — 옮긴 함수 본문이 git 기준점과
// 줄 순서까지 동일한지 함수별로 대조한다. (god-class/god-module 분리 리팩터링 검증용)
//
// Usage:  node scripts/verify-equivalent-move.mjs <config.json>
// Exit:   0 = 모든 함수 본문 일치, 1 = 불일치/누락 (CI 가능)
//
// config.json 예시는 docs/refactoring/oversized-file-splits.md 참고.
//   {
//     "baselineRef": "<git ref>",            // 분리 직전 커밋 (예: "abc123^")
//     "originalPath": "src/.../Foo.ts",       // baseline에서의 원본 경로
//     "newPaths": ["src/.../Foo.ts", "src/.../fooHandlers.ts"],  // 분리 후 파일들
//     "contextNames": ["self", "this", "ctx"],// 주입된 컨텍스트 파라미터/인자 (제거)
//     "stripUnderscores": true,               // private→public 시 떼낸 `_`
//     "dropSuffixes": ["Ctx"],                // 이름 충돌 회피용 접미사 (예: snapToGridCtx)
//     "extraReplace": [["pat", "flags", "repl"]],  // 추가 정규화(선택)
//     "pairs": [["_origName", "newName"]]     // 선택: 수동 페어. 없으면 정규화 이름으로 자동 페어
//   }
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error('usage: node scripts/verify-equivalent-move.mjs <config.json>');
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const contextNames = cfg.contextNames ?? ['self', 'this', 'ctx'];
const stripUnderscores = cfg.stripUnderscores ?? true;
const dropSuffixes = cfg.dropSuffixes ?? [];
const extraReplace = cfg.extraReplace ?? [];

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

// execFileSync (no shell) so refs containing `^`/`~` aren't mangled by cmd.exe on Windows.
const original = stripComments(
  execFileSync('git', ['show', `${cfg.baselineRef}:${cfg.originalPath}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
);
const neu = stripComments(cfg.newPaths.map((p) => readFileSync(p, 'utf8')).join('\n'));

// Brace-match a body starting at/after `from` (first `{` → matching `}`).
function bodyFrom(src, from) {
  let i = src.indexOf('{', from);
  if (i < 0) return null;
  const start = i;
  let d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) return src.slice(start + 1, i); }
  }
  return null;
}

const SKIP = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'do', 'else']);

// Enumerate top-level functions/methods → Map(rawName → body).
function enumerate(src) {
  const fns = new Map();
  for (const m of src.matchAll(/(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const b = bodyFrom(src, m.index);
    if (b != null) fns.set(m[1], b);
  }
  // class members at 2-space indent
  for (const m of src.matchAll(/^ {2}(?:(?:private|public|protected|static|async|get|set|readonly)\s+)*([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const name = m[1];
    if (SKIP.has(name) || fns.has(name)) continue;
    // Skip signatures without a body (interface/abstract members): a `;` before the next `{`.
    const brace = src.indexOf('{', m.index);
    const semi = src.indexOf(';', m.index);
    if (brace < 0 || (semi !== -1 && semi < brace)) continue;
    const b = bodyFrom(src, m.index);
    if (b != null) fns.set(name, b);
  }
  return fns;
}

// Normalize a function NAME for auto-pairing.
function normName(name) {
  let n = name;
  if (stripUnderscores) n = n.replace(/_/g, '');
  for (const suf of dropSuffixes) if (n.endsWith(suf)) n = n.slice(0, -suf.length);
  return n.toLowerCase();
}

// Canonicalize a BODY into an ordered list of logic lines (intended rewrites removed).
function canon(b) {
  const ctxAlt = contextNames.join('|');
  return b.split(/[;\n]/).map((line) => {
    let t = line;
    // typed context param:  `self: SomeType,`
    for (const c of contextNames) t = t.replace(new RegExp(`${c}\\s*:\\s*[\\w<>\\[\\], ]+?\\s*,?\\s*(?=[),])`, 'g'), '');
    t = t.replace(new RegExp(`(?:${ctxAlt})\\.`, 'g'), '');        // self./this. prefix
    t = t.replace(new RegExp(`\\b(?:${ctxAlt})\\s*,\\s*`, 'g'), ''); // leading context arg
    t = t.replace(new RegExp(`\\b(?:${ctxAlt})\\b`, 'g'), '');      // bare context token
    for (const suf of dropSuffixes) t = t.replace(new RegExp(suf, 'g'), '');
    for (const [pat, flags, repl] of extraReplace) t = t.replace(new RegExp(pat, flags), repl);
    if (stripUnderscores) t = t.replace(/_/g, '');
    return t.toLowerCase().replace(/\s+/g, '');
  }).filter((t) => t.length > 0 && t !== '{' && t !== '}' && t !== '()');
}

const origFns = enumerate(original);
const newFns = enumerate(neu);

// Build pairs.
let pairs;
if (cfg.pairs) {
  pairs = cfg.pairs;
} else {
  const newByNorm = new Map();
  for (const name of newFns.keys()) newByNorm.set(normName(name), name);
  pairs = [];
  for (const oName of origFns.keys()) {
    const n = newByNorm.get(normName(oName));
    if (n) pairs.push([oName, n]);
  }
}

let pass = 0; const fails = []; const unmatched = [];
const pairedOrig = new Set(pairs.map(([o]) => o));
for (const oName of origFns.keys()) if (!pairedOrig.has(oName)) unmatched.push(oName);

for (const [o, n] of pairs) {
  const co = canon(origFns.get(o) ?? bodyByName(original, o));
  const cn = canon(newFns.get(n) ?? bodyByName(neu, n));
  if (!co || !cn) { fails.push(`MISSING  ${o} -> ${n}`); continue; }
  const equal = co.length === cn.length && co.every((l, i) => l === cn[i]);
  if (equal) { pass++; continue; }
  const d = [];
  for (let i = 0; i < Math.max(co.length, cn.length); i++) if (co[i] !== cn[i]) d.push(`    L${i}: orig[${co[i] ?? '∅'}] != new[${cn[i] ?? '∅'}]`);
  fails.push(`FAIL  ${o} -> ${n}  (orig ${co.length} / new ${cn.length} lines)\n${d.slice(0, 10).join('\n')}`);
}

// fallback name-targeted extractor (for explicit pairs whose names enumerate missed)
function bodyByName(src, name) {
  let m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
  if (!m) m = new RegExp(`(?:^|[^.\\w])${name}\\s*\\([^)]*\\)\\s*(?::[^{;]+)?\\{`, 'm').exec(src);
  return m ? bodyFrom(src, m.index) : null;
}

console.log(`baseline ${cfg.baselineRef}:${cfg.originalPath}`);
console.log(`pairs ${pairs.length} | PASS ${pass} | FAIL ${fails.length}`);
if (unmatched.length) console.log(`\n⚠ original functions with no new counterpart (${unmatched.length}): ${unmatched.join(', ')}`);
if (fails.length) { console.log('\n' + fails.join('\n\n')); process.exit(1); }
console.log('\n✓ all paired bodies are line-for-line identical (modulo configured rewrites)');
