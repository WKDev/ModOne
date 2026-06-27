<!-- 가상 CPU N개 + 실 CPU N개를 한 모델에서 동시 운용하는 멀티-CPU 런타임 아키텍처 설계 -->
# 멀티-CPU 아키텍처 — 가상 CPU N개 + 실 CPU N개 동시 운용

> 상태: **설계(Design)**. 코드 미착수. 실 CPU 연동은 **trait 추상까지만** 확정하고
> 구체 프로토콜 구현(Modbus master / OPC-UA client)은 후속 단계로 미룬다.
> 동기화 모델은 **프로젝트 설정으로 유저가 고르는** 것을 전제로 설계한다.

## 0. 문제 정의

현재 런타임은 **단일 CPU 전용**이다.

- `SimulationRuntimeHost`가 메모리 1개(`CanonicalRuntimeFacade`) + 엔진 1개
  (`OneSimEngine`)를 들고, 스캔 루프를 1개만 spawn 한다.
  (`src-tauri/src/sim/runtime_host.rs:27-39`, `:118-168`)
- 통신은 전부 **서버(slave) 방향**이다. 외부 클라이언트가 우리에게 붙는다.
  실 PLC를 **읽어오는** 마스터/클라이언트는 없다.
  (`src-tauri/src/modbus/{tcp,rtu}.rs`, `src-tauri/src/opcua/server.rs`)

목표는 한 프로젝트 안에서 **가상 CPU 여러 개와 실 PLC CPU 여러 개를 동시에**
올리고, 그들 사이에 데이터를 주고받게 하는 것이다.

## 1. 설계의 척추 — "CPU = 메모리 이미지 + 그것을 전진시키는 에이전트"

코드의 결정적 자산은 `CanonicalRuntimeFacade`(메모리 + 이벤트 버스)와
`ProtocolAdapter` trait(`crates/modone-contract/src/adapter.rs:10-25`)이다.
이미 transport-agnostic이다. 여기서 통일 모델이 나온다.

**모든 것은 canonical 메모리 이미지에 붙는 에이전트다.**

| 에이전트 | 하는 일 | 현재 |
|---|---|---|
| 래더 엔진 | 로직으로 출력 메모리를 계산 | `OneSimEngine` ✅ |
| 서버 어댑터 | 외부 클라이언트 ↔ 메모리 | `ModbusAdapter`(server) ✅ |
| **필드 클라이언트** | 실 PLC ↔ 메모리 미러 | ❌ 신규(trait만) |
| **메모리 링크** | CPU A 메모리 → CPU B 메모리 | ❌ 신규 |
| 캔버스 | 메모리 읽기/쓰기 view | `CanvasSync` ✅ |

이 모델에서 **가상 CPU와 실 CPU의 차이는 단 하나**, "메모리를 누가 전진시키는가"다.

- **가상 CPU** = 메모리 + 래더 엔진. 내부 로직이 권위자(authority).
- **실 CPU** = 메모리 + 필드 클라이언트. 실제 장비가 권위자, 메모리는 미러.

나머지 시스템(캔버스 바인딩, 모니터링, inter-CPU 링크)은 둘을 구분하지 않는다.
"주소로 읽고 쓸 수 있는 canonical 메모리를 가진 CPU"일 뿐이다. **이 대칭성이
설계 전체를 단순하게 만든다.**

### 1.1 핵심 통찰 — `ProtocolAdapter`는 방향만 뒤집으면 실 PLC에도 맞는다

`ProtocolAdapter` trait의 시그니처를 바꿀 필요가 없다. "external"의 정체가
다를 뿐이다.

- **서버 어댑터(기존)**: `apply_external_writes` = 클라이언트가 쓴 값 → canonical.
  `publish_dirty_state` = canonical → 클라이언트가 읽을 버퍼. **CPU가 권위자.**
- **클라이언트 어댑터(신규)**: `apply_external_writes` = **실 장비에서 폴링** →
  canonical. `publish_dirty_state` = canonical 출력 → **실 장비에 쓰기.**
  **장비가 권위자.**

→ 실 PLC는 "또 하나의 external 당사자"일 뿐이다. trait 재사용이 성립한다.

## 2. 런타임 구조 (현재 → 목표)

```
CpuManager                              // SimulationRuntimeHost를 대체/감싸는 상위
├── cpus: HashMap<CpuId, Arc<CpuNode>>
└── links: Vec<MemoryLink>              // inter-CPU 데이터 교환 (신규 핵심)

CpuNode {                               // CPU 1개 = 메모리 + 드라이버 + 노출
    id: CpuId,
    runtime: Arc<CanonicalRuntimeFacade>,   // ← CPU마다 독립 메모리 + 버스
    driver: CpuDriver,                       // Virtual | Real
    servers: Arc<ProtocolRuntime>,           // 이 CPU를 외부로 노출 (선택)
    health: CpuHealth,                       // 실 CPU: 연결/품질 상태
}

enum CpuDriver {
    Virtual(Arc<OneSimEngine>),              // 기존 스캔 엔진 그대로
    Real(Arc<dyn FieldLink>),                // 신규 trait: 폴/쓰기 루프
}
```

변화는 4곳에 국한된다.

1. **메모리를 CPU별로 분리.** `CanonicalRuntimeFacade`는 이미 인스턴스이므로
   N개 만들면 끝. 버스도 자연히 CPU별로 분리된다. 현재 `SimulationRuntimeHost`가
   `runtime` 하나를 들고 있는 것을 `CpuNode` 안으로 내린다.
2. **스캔/폴 태스크를 CPU별로.** 지금 `run_scan_loop`을 1개 spawn 하는 것을
   (`runtime_host.rs:164-168`), 가상 CPU는 각자 스캔 태스크, 실 CPU는 각자 폴
   태스크로. tokio가 N개 태스크를 무리 없이 돌린다. `ProtocolRuntime`은 이미
   멀티 어댑터를 지원하므로(`protocol_runtime.rs:47-74`) CPU별 1개씩 재사용한다.
3. **`FieldLink`(실 CPU 드라이버) trait 신규.** 추상 trait은 contract 크레이트,
   전송 구현(socket/serial)은 **반드시 `src-tauri`에만** 둔다(wasm은 리스닝/
   아웃바운드 소켓 제약 — `docs/wasm-migration/00-CONTRACT.md` §0 참조). 이번
   단계 산출물은 **trait 정의까지**.
4. **`MemoryLink`(inter-CPU 데이터 교환) 신규.** 진짜 새로 설계할 부분. §4.

## 3. 권위(Authority) 모델 — 충돌 없는 메모리 소유권

> 메모리 셀마다 권위자는 **정확히 하나**. 이걸 어기면 미러와 로직이 같은 셀을
> 두고 싸운다.

- 가상 CPU: 자기 출력/내부 영역의 권위자.
- 실 CPU: 자기 전 메모리의 권위자. 미러 영역은 모델 안에서 **read-only**.
- 메모리 링크의 `dst` 영역은 **링크가 권위자**가 되며, 해당 CPU의 로직은
  그 영역을 못 쓰게 잠근다(read-only 마킹).

`CanonicalRuntimeFacade` 레벨에 **영역별 write-owner 태그**를 둬서, 권위자 아닌
주체의 쓰기를 거부(또는 경고)한다. 이건 멀티-CPU의 정합성을 지키는 핵심 가드다.

## 4. inter-CPU 링크 — 마술 글로벌 메모리 금지

실 PLC 세계의 방식을 그대로 따른다. Mitsubishi CC-Link/데이터링크, Siemens
I-device, 프로듀서/컨슈머 태그 — 전부 **명시적으로 선언된 단방향 복사**다.
"공유 메모리" 같은 암묵 마술을 만들면 권위 충돌로 무너진다.

```
MemoryLink {
    src: (CpuId, CanonicalRange),   // 권위자
    dst: (CpuId, CanonicalRange),   // 미러 (dst CPU 입장에서 read-only)
    sync: LinkSyncMode,             // §4.1 — 프로젝트 설정으로 유저가 선택
}
```

구현은 기존 패턴 재사용이다. src CPU의 버스 dirty window를 구독
(`protocol_runtime.rs:114-118`의 `bus().subscribe()`와 동일 메커니즘) → 매핑된
영역을 dst 메모리에 external write로 복사하는 태스크. 가상 CPU 출력이 실 CPU
입력으로, 실 CPU 미러가 가상 CPU 입력으로 흐른다 — 이게 "함께 운용"의 실체다.

### 4.1 동기화 모드는 프로젝트 설정값이다 (유저 선택)

타이밍 현실이 다르므로(가상=빠르고 결정적, 실=느리고 지터) 링크의 동기화 강도를
**프로젝트 config로 노출**한다. 링크마다 다르게 줄 수 있다.

```yaml
# project config (예시)
cpus:
  - id: vcpu-main
    kind: virtual
  - id: rplc-line1
    kind: real            # 드라이버 구현은 후속 단계
links:
  - src: { cpu: vcpu-main, area: O, range: [0, 15] }
    dst: { cpu: rplc-line1, area: I, range: [0, 15] }
    sync: eventual        # eventual | periodic(ms) | on_scan
```

- **eventual** (기본): src dirty 발생 시 비동기 복사. 가장 단순·안전. 사이클
  정확도는 보장 안 함. 실 PLC 현실에 부합.
- **periodic(ms)**: 고정 주기 스냅샷 복사. 실 장비 폴 주기와 맞출 때.
- **on_scan**: src(가상)의 스캔 종료 이벤트에 동기. 가상↔가상 링크에서만 의미
  있음(실 CPU는 외부 비동기이므로 lockstep 불가).

> **정직한 한계**: 실 CPU가 끼는 링크는 lockstep(사이클 정확)으로 묶을 수 없다.
> 링크는 "최종 일관성 스냅샷"이지 동기 교환이 아니다. UI/문서에서 이걸 숨기지
> 않는다.

## 5. CPU 헬스/품질 — 실 CPU는 끊긴다

실 CPU는 연결 끊김·타임아웃이 일상이다. CPU별 `CpuHealth`(연결 상태 + OPC
quality 유사 플래그)를 모델에 둔다. 가상 CPU는 항상 `Good`. 링크가 복사하는
값에도 품질이 전파되어, 끊긴 실 CPU에서 미러된 값이 stale임을 dst가 알 수 있게
한다. 캔버스는 이 품질을 시각적으로 표시한다.

## 6. OneCanvas 바인딩 — 작은 수술

현재 `PlcBlockMapping`은 블록 → 단일 canonical 주소를 바인딩한다
(`src-tauri/src/sim/canvas_sync.rs`). 여기에 **`CpuId` 한 필드 추가**가 전부다.

```rust
pub struct PlcBlockMapping {
    pub cpu_id: CpuId,                 // ← 추가
    pub block_id: String,
    pub binding: RuntimeBinding,
    // ... 나머지 동일
}
```

캔버스는 그 태그 뒤가 가상이든 실이든 신경 쓰지 않는다. §1 대칭성의 보상이다.

## 7. wasm 경계 (불변)

- **순수 코어(crates)**: `CpuId`, `CpuDriver` 추상, `FieldLink` trait,
  `MemoryLink`/`LinkSyncMode` 타입, 권위 모델. wasm 컴파일 가능해야 함.
- **native 셸(src-tauri)**: `CpuManager` 런타임, 실제 전송(Modbus master /
  OPC-UA client) 구현, tokio 태스크 spawn.

`docs/wasm-migration/00-CONTRACT.md`의 코어/셸 경계를 넘지 않는다.

## 8. 이번 단계 산출물 경계

- ✅ `CpuId`, `CpuNode`, `CpuDriver`, `CpuManager` 타입 골격
- ✅ `FieldLink` **trait 정의**(구체 구현 X)
- ✅ `MemoryLink` + `LinkSyncMode` + 프로젝트 config 스키마
- ✅ 권위(write-owner) 모델 설계
- ❌ Modbus master / OPC-UA client 구체 구현 (후속)
- ❌ 멀티-CPU 캔버스/UI (후속)

## 9. 마이그레이션 경로 (단일 CPU → N CPU, 비파괴)

1. `CpuNode`를 도입하되 **CPU 1개짜리 `CpuManager`**로 기존 동작을 그대로 감싼다.
   (`SimulationRuntimeHost`의 필드를 `CpuNode` 안으로 이주.)
2. `PlcBlockMapping`에 `cpu_id` 추가, 기본값 = 그 단일 CPU. 기존 프로젝트 호환.
3. config에 `cpus`/`links` 추가(없으면 단일 가상 CPU로 폴백).
4. `FieldLink` trait + `CpuDriver::Real` 분기 추가(구현은 stub).
5. 멀티 CPU spawn + `MemoryLink` 태스크.
6. 실 프로토콜 클라이언트 구현(별도 워크트리 후보).

각 단계는 빌드 green + 기존 단일 CPU 시나리오 회귀 없음을 검증 기준으로 한다.
