// sim-wasm 루프백 데모 — wasm으로 빌드된 PLC 실행기를 Node에서 구동하고 canonical
// memory(P0 출력)를 관찰한다. 추가 툴체인 없이 raw WebAssembly로 로드한다.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const wasmPath = resolve(
  here,
  '../../../target/wasm32-unknown-unknown/release/sim_wasm.wasm',
);

const bytes = await readFile(wasmPath);
const mod = await WebAssembly.compile(bytes);

// wasm이 요구하는 import를 그대로 스텁으로 채운다(우리 로직은 순수 Rust라 실제로
// 필요한 import는 없어야 한다 — 진단용 출력).
const needed = WebAssembly.Module.imports(mod);
console.log('wasm imports:', needed.length ? needed : '(none)');
const importObject = {};
for (const { module, name, kind } of needed) {
  importObject[module] ??= {};
  if (kind === 'function') importObject[module][name] = () => 0;
}

const { exports: e } = await WebAssembly.instantiate(mod, importObject);

// 디바이스 코드 (lib.rs device_from_code와 일치): M=0, P=1
const M = 0;
const P = 1;

e.sim_init();

const results = [];
const observe = (label) => {
  const p0 = e.sim_read_bit(P, 0);
  results.push([label, p0]);
  console.log(`  ${label.padEnd(28)} P0 = ${p0}`);
};

console.log('데모: M0 접점 → P0 코일 (브라우저/Node wasm에서 PLC 스캔)');
observe('초기');
e.sim_set_bit(M, 0, 1);
e.sim_scan();
observe('M0=1 후 스캔');
e.sim_set_bit(M, 0, 0);
e.sim_scan();
observe('M0=0 후 스캔');

// 검증: 초기=0, M0=1→1, M0=0→0
const expected = [
  ['초기', 0],
  ['M0=1 후 스캔', 1],
  ['M0=0 후 스캔', 0],
];
const ok = results.every(([, v], i) => v === expected[i][1]);
console.log(ok ? '\n✅ PASS — canonical memory가 PLC 로직대로 변했다.' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
