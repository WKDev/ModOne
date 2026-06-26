<!-- wasm 마이그레이션의 공유 계약(crate 경계 + ProtocolAdapter)을 확정하는 문서 -->
# 계약 (Contract) — wasm 코어 / native 셸 경계

> 이 문서는 3개 워크트리가 **공유하는 불변 계약**이다. 변경하려면 세 워크트리
> 담당자가 합의해야 한다. 계약을 바꾸면 모두가 영향을 받는다.

## 0. 배경 결정 (왜 이렇게 하나)

- 제품은 **산업 프로토콜 시뮬레이터**다. Modbus TCP(502)/OPC UA(4840) 서버의
  존재 이유는 외부 클라이언트가 *우리에게* TCP로 접속하는 것이다.
- **브라우저 샌드박스는 리스닝 TCP 소켓을 금지한다.** wasm으로도 불가능하다.
  → 진짜 프로토콜 서빙은 native 컴포넌트가 어딘가에서 반드시 돈다.
- 그래서 "웹앱 vs 설치형"이 아니라 **"웹 UI + 재배치 가능한 native 엔진"**이다.
  엔진(=현재 Rust 백엔드)은 하나, 배포 모드만 3가지다.

```
   Web UI (React/TS)
        │  전송 추상화 (Tauri IPC | WebSocket/HTTP | wasm 직접호출)
   ┌────┴───────────────────────────────────────┐
   │ (A) wasm-in-browser  → 루프백만, 무설치      │ 데모/저작/오프라인
   │ (B) localhost daemon → 진짜 TCP 소켓        │ 1인, zero-config
   │ (C) 온프레 공유 서버 → 진짜 TCP, 다중 사용자 │ 팀/실습실
   └─────────────────────────────────────────────┘
```

- **wasm의 역할**: "엔진 없이 브라우저에서 도는 tier". 킬러 기능은 **sim 엔진**
  (브라우저에서 PLC 로직 실행). 프로토콜 *서빙*은 native 전용이다.
- **언어**: 코어는 **Rust** 유지. wasm·native 둘 다 1급이면서 런타임 부담이
  없는 유일 선택지 + 기존 ~8천 LOC 자산 재사용. (Go/C#는 GC 런타임이 wasm에
  통째로 실려 부적합. C++는 가능하나 안전성/속도/자산 면에서 열위.)
- **OPC UA**: 일단 Rust 데몬으로 시작하되 **언제든 .NET 데몬으로 갈아끼울 수
  있게 어댑터 패턴**으로 작성한다 (§4 참조). OPC UA 실서빙은 native 전용이므로
  프로세스 경계에서 교체 가능하다.

## 1. 크레이트 토폴로지

단일 Cargo 워크스페이스. 코어 크레이트는 wasm·native 양쪽으로 컴파일된다.
전송(소켓/serial/TLS)은 코어 **바깥**(native 셸)에서 주입한다.

```
modone/ (workspace root)
├── crates/
│   ├── modone-contract     ← [Phase 0, main에 확정] 공유 계약. 모두가 의존.
│   │     types · memory(CanonicalMemory) · event_bus · adapter(trait)
│   ├── sim-engine          ← 워크트리 A. PLC 사이클 실행기 (전송 없음)
│   ├── modbus-codec        ← 워크트리 B. PDU 코덱 + 매핑 (소켓 없음)
│   └── opcua-codec         ← 워크트리 C. 코덱 + 주소공간 + 어댑터 trait
├── src-tauri/              ← native 셸. tokio 소켓·serial·TLS·SQLite·fs·Tauri
│   (Tauri lib + 헤드리스 데몬 바이너리 둘 다 빌드)
└── src/                    ← Web UI (React/TS)
```

**의존 방향(절대 역류 금지)**: `contract` ← {sim-engine, modbus-codec,
opcua-codec} ← `src-tauri`. 코어 크레이트는 `src-tauri`, `project`,
`tauri`, `tokio runtime`, 소켓을 **절대 의존하지 않는다.**

## 2. `modone-contract` 표면 (Phase 0에서 main에 확정)

기존 `src-tauri/src/plc_runtime`에서 그대로 들어올린 것 + adapter trait.

- `types`: `CanonicalAreaKind`, `CanonicalAccess`, `CanonicalValue`,
  `CanonicalWriteSource`, `CanonicalAddress`, `CanonicalMemoryChange`,
  `CanonicalMemoryBatchChange`, `CanonicalMemoryEvent` (serde만 의존)
- `memory`: `CanonicalMemory`, `CanonicalMemoryError`, `CanonicalMemorySnapshot`
- `event_bus`: `CanonicalMemoryBus` (tokio `sync` broadcast — wasm 호환)
- `adapter`:
  ```rust
  pub trait ProtocolAdapter: Send + Sync {
      fn apply_external_writes(&self) -> Result<(), BoxErr>;
      fn publish_dirty_state(&self, windows: &[DirtyPublishWindow]) -> Result<(), BoxErr>;
      fn publish_runtime_state(&self) -> Result<(), BoxErr>;
      fn full_sync(&self) -> Result<(), BoxErr>;
  }
  pub struct DirtyPublishWindow { pub area: CanonicalAreaKind,
                                  pub start_index: u32, pub end_index: u32 }
  // DirtyPublishWindow::single(addr) 제공.
  // ※ intersects_rule(ModbusMappingRule) 은 modbus 전용 → modbus-codec(B) 소유.
  ```
- **계약 밖(중요)**: Modbus 매핑 정책 타입(`ModbusMappingPolicy/Rule/AddressSpace/
  Source`)은 modbus 전용이라 **modbus-codec(B)**가 소유한다. vendor profile
  resolve(`project` 의존)는 `src-tauri`에 잔류하고 B에서 정책 타입을 import한다.

## 3. wasm-purity 부채 (워크트리 A가 갚는다)

Phase 0 계약은 native-first로 추출한다(B/C가 즉시 native 작업 시작 가능).
다음 wasm 적대적 의존성은 **워크트리 A**가 코어를 wasm으로 빌드하며 해소한다.
계약 표면(타입/시그니처)은 그대로 두고 내부 구현만 바꾼다.

- `chrono::Utc::now()` (memory.rs 타임스탬프) → `wasmbind` feature 또는 시간
  주입(`now: fn() -> String` 콜백). **타임스탬프 String 필드는 유지.**
- `uuid::v4` (batch_id) → `js` feature(getrandom) 또는 ID 주입.
- `tokio::sync::broadcast` (event_bus) → tokio `sync`는 wasm 컴파일됨. 단
  `protocol_runtime`(interval/spawn/select)은 **native 전용**, A가 wasm용
  루프백 펌프를 별도 작성.

## 4. OPC UA 어댑터 패턴 (워크트리 C 필수)

OPC UA 서버를 **Rust 데몬으로 시작하되, 구현을 직접 노출하지 말고 trait 뒤에
숨긴다.** 나중에 동일 trait의 .NET 데몬 구현으로 무중단 교체 가능해야 한다.

```rust
// opcua-codec 또는 src-tauri 경계에 정의
pub trait OpcUaServerBackend: Send + Sync {
    fn start(&self, cfg: OpcUaStartConfig) -> Result<(), OpcUaError>;
    fn stop(&self) -> Result<(), OpcUaError>;
    fn update_node_values(&self, updates: &[NodeValueUpdate]) -> Result<(), OpcUaError>;
    fn take_external_writes(&self) -> Vec<NodeValueUpdate>;
    // 상태/감사/보안은 trait 메서드 또는 별도 trait로
}
// 구현체: RustOpcUaBackend (opcua crate v0.12, 지금)
//        DotNetOpcUaBackend (별도 프로세스, 추후) — 둘 다 같은 trait
```

- `OpcUaAdapter`(canonical↔opcua 동기화)는 `OpcUaServerBackend`에만 의존하고
  구체 구현을 모른다.
- 구체 백엔드 선택은 `src-tauri`의 조립 지점 한 곳에서. config 플래그로 분기.
- `opcua` crate v0.12는 wasm 컴파일 불가 → **OPC UA 실서빙은 native 전용**으로
  확정. wasm/브라우저 tier는 OPC UA를 제공하지 않는다(또는 추후 codec만 분리).

## 5. 동기화 모델 (변경 금지)

`src-tauri/src/sim/protocol_runtime.rs`의 기존 설계 유지:
canonical 쓰기 → 이벤트 버스 → 2ms 코얼레싱 / 최대 10ms 플러시 →
어댑터 `apply_external_writes()` → `publish_dirty_state(windows)`.
이 루프는 native 전용. wasm tier는 A가 단순 동기 펌프로 대체한다.

## 6. 검증 게이트 (각 워크트리 머지 전)

- `cargo check --workspace` green
- 코어 크레이트는 `cargo check -p <crate> --target wasm32-unknown-unknown` green
  (단 opcua-codec의 native 백엔드 제외 — feature-gate)
- 기존 테스트 통과: `cargo test -p modone-contract`, 각 크레이트 단위 테스트
- 빌드 green이 최우선. 계약 변경은 PR로만, 세 담당 합의.
