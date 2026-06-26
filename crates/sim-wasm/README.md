<!-- sim-engine을 wasm으로 구동하는 최소 루프백 하니스의 빌드/실행 안내 -->
# sim-wasm — 브라우저/Node에서 도는 PLC 시뮬레이터 (최소 하니스)

`sim-engine`(PLC 사이클 실행기)을 wasm으로 노출하는 루프백 데모다. **킬러 기능
검증**: 엔진/네이티브 셸 없이 브라우저(또는 Node)에서 PLC 로직을 실행하고
canonical memory를 관찰한다.

- wasm-bindgen/wasm-pack **불필요**. raw `extern "C"` 숫자 ABI만 쓴다.
- 시간/ID는 `modone-contract::runtime_env`의 wasm 카운터라 **JS 환경 의존 0**
  → wasm 모듈이 자기완결적이라 빈 import로 인스턴스화된다.

## 빌드 & 실행

```sh
# 1) wasm 빌드 (wasm32-unknown-unknown 타깃 필요: rustup target add wasm32-unknown-unknown)
cargo build -p sim-wasm --target wasm32-unknown-unknown --release

# 2) Node 데모 실행 (M0 접점 → P0 코일 스캔, P0 출력 관찰)
node crates/sim-wasm/demo/run.mjs
```

기대 출력:

```
wasm imports: (none)
  초기            P0 = 0
  M0=1 후 스캔     P0 = 1
  M0=0 후 스캔     P0 = 0
✅ PASS
```

## ABI (`src/lib.rs`)

| export | 설명 |
|--------|------|
| `sim_init()` | 메모리/실행기 생성 + 데모 프로그램(series([M0, P0])) 컴파일 |
| `sim_set_bit(dev, idx, val)` | 입력 비트 쓰기 (dev: M=0,P=1,X=2,Y=3,K=4) |
| `sim_scan()` | 1 스캔 실행 |
| `sim_read_bit(dev, idx) -> u32` | canonical memory 비트 읽기 (1/0) |

## 한계 / 다음
- 데모 프로그램은 Rust에 하드코딩(M0→P0). 임의 프로그램(JSON) 주입은 추후
  wasm-bindgen 계층 또는 바이트 ABI로 확장.
- wasm 타임스탬프는 합성 카운터. 실시간이 필요하면 `runtime_env`에 시간 콜백 주입.
- 브라우저 로드는 동일 `.wasm`을 `WebAssembly.instantiate`로 (Vite 통합은 추후).
