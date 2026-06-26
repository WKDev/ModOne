<!-- vendor-neutral PLC 모델 계층(plc-model 크레이트 + VendorProfile 트레이트 분할) 아키텍처를 확정하는 설계문서 -->
# PLC 모델 계층 설계 — `plc-model` 크레이트 + VendorProfile 분할

> **상태**: 제안 (워크트리 A 발의). 계약(`00-CONTRACT.md`)을 건드리므로 B·C 합의 필요.
> **먼저 읽기**: [`00-CONTRACT.md`](./00-CONTRACT.md), [`01-WORKTREES.md`](./01-WORKTREES.md)

## 0. 왜 이 문서가 생겼나

워크트리 A는 `sim/executor.rs`(PLC 로직 실행기)를 `sim-engine`로 추출하려다
`VendorProfile` 트레이트에서 막혔다. 이 트레이트는 **제품의 핵심 추상화**다 —
LS·Siemens·Mitsubishi 등 제조사별 PLC를 vendor-neutral 모델로 변환하는 경계.
지금 모든 벤더를 구현할 건 아니지만, **이 추상화가 살 집(크레이트)과 인터페이스를
먼저 제대로 잡는 게 우선**이다. (사용자 결정: spec-first, 설계문서 먼저.)

## 1. 문제 진단 — `VendorProfile` 책임 혼재 (코드 근거)

현재 `src-tauri/src/plc_runtime/profile.rs`의 `VendorProfile: Send + Sync`는 두
책임이 섞여 있다.

```
VendorProfile (현재)
├── [A] vendor-neutral 모델 본질 — 프로토콜 무지, 순수
│     id · display_name · manufacturer · model_hint · hardware_topology
│     parse_address · format_address · validate_address
│     to_canonical · canonical_aliases · preferred_alias
│       └─ 의존: PlcManufacturer, PlcHardwareTopology  (project/config.rs)
│                CanonicalAddress, Canonical*           (modone-contract)
│
└── [B/C] 프로토콜 정책 — 역방향 의존 (누수)
      recommended_modbus_mapping_policy() → ModbusMappingPolicy   (B 소유 타입)
      legacy_modbus_mapping_policy()      → ModbusMappingPolicy
      modbus_mapping_policy(exposure)     → ModbusMappingPolicy   (default 메서드)
      opcua_alias_policy()                → OpcUaAliasPolicy       (C 도메인)
```

두 문제:

1. **[A]가 `crate::project`에 갇혀 있다.** PLC 하드웨어 모델 타입
   (`PlcManufacturer`, `PlcSettings`, `PlcHardwareTopology`, `PlcRackTopology`,
   `PlcRackKind`, `PlcHardwareModule`, `PlcModuleKind`, `PlcAddressWindow`,
   `PlcIoDirection`)은 순수 serde 구조체인데도 fs/SQLite 모듈인 `project/config.rs`
   안에 있다. 그래서 `executor` → `VendorProfile` → `project`로 의존이 새고,
   `sim-engine`이 wasm-pure해질 수 없다.
2. **[B/C] 정책 메서드가 모델 트레이트에 박혀 있다.** "이상적인 PLC 모델"이
   Modbus 매핑·OPC UA alias를 거꾸로 알게 된다. 깨끗한 아키텍처라면 PLC 모델은
   프로토콜을 몰라야 하고, 정책은 프로토콜 계층이 canonical 모델로부터 유도해야
   한다.

## 2. 목표 아키텍처

```
crates/
├── modone-contract        canonical memory + adapter (불변)
│      ▲
├── plc-model   ★신규       vendor-neutral PLC 추상화의 집
│   │   - Plc* 하드웨어 모델 타입  (project/config.rs에서 이전)
│   │   - VendorProfile 트레이트 = 주소변환·토폴로지만 (프로토콜 무지)
│   │   - Vendor* 타입 (VendorAddress/Metadata/Id/DataKind/NumberBase),
│   │     VendorProfileError
│   │   - profiles/{ls, melsec, …siemens, mitsubishi 추후}
│   │   - 의존: modone-contract 만 (+ serde/thiserror)
│   │      ▲          ▲          ▲
│   │  sim-engine  modbus-codec  opcua-codec   (셋 다 공유)
│   │
│   └── 프로토콜 정책은 확장 트레이트로 분리 (각 프로토콜 계층 소유):
│         ModbusPolicyProfile : VendorProfile   ← B (modbus-codec)
│         OpcUaAliasProfile    : VendorProfile   ← C (opcua-codec)
│
└── src-tauri/             native 셸. vendor profile *resolve*(project 의존) 잔류
```

**의존 방향(불변)**: `contract` ← `plc-model` ← {sim-engine, modbus-codec,
opcua-codec} ← `src-tauri`. `plc-model`은 `project`/`tauri`/소켓을 절대 모른다.

## 3. 트레이트 분할 상세

`plc-model`이 소유하는 **core** 트레이트 (프로토콜 무지):

```rust
// crates/plc-model/src/profile.rs
pub trait VendorProfile: Send + Sync {
    fn id(&self) -> VendorProfileId;
    fn display_name(&self) -> &'static str;
    fn manufacturer(&self) -> PlcManufacturer;       // Plc* 도 plc-model 소유
    fn model_hint(&self) -> Option<&str>;
    fn hardware_topology(&self) -> &PlcHardwareTopology;
    fn parse_address(&self, input: &str) -> Result<VendorAddress, VendorProfileError>;
    fn format_address(&self, a: &VendorAddress) -> Result<String, VendorProfileError>;
    fn validate_address(&self, a: &VendorAddress) -> Result<VendorAddressMetadata, VendorProfileError>;
    fn to_canonical(&self, a: &VendorAddress) -> Result<CanonicalAddress, VendorProfileError>;
    fn canonical_aliases(&self, c: &CanonicalAddress) -> Vec<VendorAddress>;
    fn preferred_alias(&self, c: &CanonicalAddress) -> Option<VendorAddress> { /* default */ }
}
```

프로토콜 정책은 **확장 트레이트**로 빠진다 (각 프로토콜 계층이 소유):

```rust
// modbus-codec (B 소유). ModbusMappingPolicy/Rule/Source 도 B.
pub trait ModbusPolicyProfile: VendorProfile {
    fn recommended_modbus_mapping_policy(&self) -> ModbusMappingPolicy;
    fn legacy_modbus_mapping_policy(&self) -> ModbusMappingPolicy;
    fn modbus_mapping_policy(&self, exposure: Option<&ModbusExposureSettings>)
        -> Result<ModbusMappingPolicy, VendorProfileError> { /* default */ }
}

// opcua-codec (C 소유). OpcUaAliasPolicy 도 C.
pub trait OpcUaAliasProfile: VendorProfile {
    fn opcua_alias_policy(&self) -> OpcUaAliasPolicy;
}
```

구체 프로파일(`LsProfile`, `MelsecFxQProfile`)은 `plc-model`에서 core를 impl하고,
B/C 계층(또는 src-tauri 조립 지점)에서 각자 확장 트레이트를 impl한다.

## 4. B·C 영향 및 **조정 필요 여부** (★ 중요)

`VendorProfile`은 세 워크트리가 모두 소비한다 (현재 호출처):

| 호출처 | 소유 | 무엇을 | 분할 후 |
|--------|------|--------|---------|
| `sim/executor.rs` | **A** | `&dyn VendorProfile` core 메서드만 | core 그대로 |
| `modbus/adapter.rs` | **B** | VendorProfile import | 경로만 변경 |
| `opcua/address_space.rs:290` | **C** | `.opcua_alias_policy()` | 확장 트레이트로 이동 |
| `opcua/server.rs`, `commands/opcua.rs` | **C** | VendorProfile import | 경로만 변경 |
| `sim/runtime_host.rs` | A(셸) | `resolve_modbus_mapping_policy` (free fn) | 잔류 |

**결론: B·C는 지금 멈출 필요 없다.** 2단계 마이그레이션으로 충돌을 없앤다.

- **Phase 1 (A, 지금 — 무중단)**: `plc-model` 크레이트 생성 + Plc* 타입 이전 +
  `VendorProfile`·`Vendor*`·`VendorProfileError`·구체 profiles **그대로** 이전
  (메서드 제거 없음, 정책 메서드도 일단 유지). `crate::plc_runtime`는 전부
  **하위호환 re-export** → 기존 경로(`crate::plc_runtime::VendorProfile` 등)가
  그대로 동작. **B·C의 진행 중 코드는 API 변화 0**, 나중에 main 리베이스만 하면 됨.
- **Phase 2 (나중, 합의 후)**: 정책 메서드를 `ModbusPolicyProfile`(B)·
  `OpcUaAliasProfile`(C) 확장 트레이트로 분리. 이때만 B·C가 호출부를 확장 트레이트
  import로 조정. **이 단계는 B·C 담당과 합의 후 별도 PR.**

→ 따라서 **지금 사용자에게 멈춤 요청 불필요**. Phase 2 진입 시점에만 3자 합의.

## 5. 마이그레이션 순서 (각 단계 빌드 green 유지)

1. `crates/plc-model` 생성 (Cargo.toml, lib.rs). deps: modone-contract, serde,
   thiserror. → `cargo check -p plc-model` green.
2. Plc* 하드웨어 타입을 `project/config.rs` → `plc-model/src/hardware.rs`로 이전.
   `project/config.rs`는 `pub use plc_model::{Plc*}` 재노출로 하위호환. → workspace green.
3. `profile.rs`의 순수부(Vendor* 타입, VendorProfileError, VendorProfile 트레이트)
   를 `plc-model`로 이전. `profiles/{ls,melsec}`도 이전. project 의존 resolve 함수
   (`resolve_vendor_profile`, `resolve_modbus_mapping_policy`)는 src-tauri 잔류.
   `plc_runtime`는 재노출. → workspace green, 기존 테스트 통과.
4. `sim-engine` 크레이트 생성, `executor`(+`engine`,`memory`,`debugger`,`counter`,
   `timer`,`tag_registry`,`types`)를 `plc-model`+`contract`만 의존하도록 이전.
   → `cargo check -p sim-engine --target wasm32-unknown-unknown` green.
5. (별도 PR, Phase 2) 정책 메서드 → 확장 트레이트 분리. B·C 합의 후.

각 단계는 독립 커밋. 4단계까지가 워크트리 A의 1차 머지 단위.

## 6. 향후 벤더 확장 (설계 검증)

새 제조사 추가 = `plc-model/src/profiles/<vendor>.rs` 파일 하나:
`VendorProfile` impl(주소 문법 파싱 → canonical 변환 + hardware_topology). Modbus/
OPC UA를 쓰면 `ModbusPolicyProfile`/`OpcUaAliasProfile`도 impl. 프로토콜 계층·
sim-engine은 **수정 불필요** (trait object로 소비). 이 무수정 확장성이 본 설계의
목표 검증 기준이다.

## 7. 검증 게이트

- `cargo check --workspace` green (모든 단계)
- `cargo check -p plc-model --target wasm32-unknown-unknown` green
- `cargo check -p sim-engine --target wasm32-unknown-unknown` green
- `cargo test -p modone-contract`, `cargo test -p plc-model`, 기존 profile/executor
  테스트 통과
- 계약 토폴로지 변경(`00-CONTRACT.md §1`)은 본 문서 합의 후 반영
