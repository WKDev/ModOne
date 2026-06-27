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

> Tauri는 `CpuManager` **하나만** manage 한다(N개 State 금지 — 검토 B.1).
> 외부 서버는 CPU별 N포트가 아니라 **단일 엔드포인트 + 논리 라우팅**이다(결정 3).

```
CpuManager                              // .manage()로 등록되는 유일 State
├── cpus: HashMap<CpuId, Arc<CpuNode>>
├── links: Vec<MemoryLink>             // inter-CPU 데이터 교환 (신규 핵심)
├── primary: CpuId                     // 커맨드 cpu_id=None 시 기본 (결정 2)
└── exposure: ProtocolExposure         // 단일 엔드포인트 + unit/ns 라우팅 (결정 3)

CpuNode {                               // CPU 1개 = 메모리 + 드라이버
    id: CpuId,
    runtime: Arc<CanonicalRuntimeFacade>,   // ← CPU마다 독립 메모리 + 버스
    driver: CpuDriver,                       // Virtual | Real
    health: CpuHealth,                       // 실 CPU: 연결/품질 상태
}

enum CpuDriver {
    Virtual(Arc<OneSimEngine>),              // 스캔 엔진 + Timer/Counter (기존)
    Real(Arc<dyn FieldLink>),                // 경량: 엔진/타이머/디버거 없음 (C.2)
}
```

> `CpuDriver::Real`은 **경량 노드**다. `OneSimEngine`/`TimerManager`/
> `CounterManager`/디버거를 돌리지 않는다(장비가 권위자). step/breakpoint 류
> 디버그 커맨드는 실 CPU에 대해 거부한다. status/메모리 스냅샷/모니터링은 미러
> 메모리 기준으로만 동작한다. (검토 C.2)

서버 노출(`ProtocolExposure`)은 CpuNode 밖, 매니저 레벨에 둔다. 한 Modbus
리스너(502)가 `unit_id → CpuId`로, 한 OPC-UA 서버가 `네임스페이스 → CpuId`로
디스패치한다. → `unit_id ↔ cpu_id` 매핑 테이블 + modbus-codec 멀티-unit 처리가
v1 범위다(결정 3, [02-decisions.md](./02-decisions.md)).

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

## 3. 권위(Authority) 모델 — 기존 모델 재사용, 재발명 금지

> 초기 초안의 "영역별 write-owner 태그"는 **폐기**했다. 권위 모델은 이미
> 존재하기 때문이다. (검토 C.1 → 결정 1, [02-decisions.md](./02-decisions.md))

이미 `crates/modone-contract/src/types.rs:102-152`에 다음이 구현돼 있다.

- `CanonicalAccess { ReadOnly, ReadWrite, InternalOnly }`
- `CanonicalWriteSource { InternalRuntime, Simulation, ExternalProtocol, ... }`
- `CanonicalAreaKind::default_access()` — area별 분류:
  Timer/Counter/System → `InternalOnly`(외부 프로토콜 쓰기 불가),
  Special → `ReadOnly`, 나머지(Input/Output/Internal/Retentive/Data) → `ReadWrite`
- `CanonicalAccess::allows_write(source)`가 강제(`types.rs:110-119`)

즉 "Modbus 클라이언트는 D엔 쓰되 타이머엔 못 쓴다"가 이미 성립한다. 멀티-CPU는
여기에 **두 가지만** 더한다.

1. **`CanonicalWriteSource::CpuLink` 변형 추가** — 링크 복사를 감사·구분 가능하게.
   접근 판정상 외부 취급(`is_internal()==false`) → ReadWrite 영역만 쓰고
   InternalOnly(타이머/카운터/시스템)는 못 쓴다.
2. **링크 타깃 정적(config-load) 검증** — 런타임 per-cell owner가 아니라 설정
   로드 시점 그래프 검증으로 충돌 차단(훨씬 싸다).
   - 같은 dst 셀에 2개 이상 링크 금지.
   - 가상 CPU dst가 그 CPU **래더가 쓰는 영역(컴파일된 코일/MOV dest)과 겹치면
     거부**.
   - 관례상 링크는 소비 CPU의 **입력성 영역**(InputBit + 예약 link DataWord)을
     타깃 → 래더는 자기 입력을 출력 위상에서 쓰지 않으므로 싸움이 원천 차단.

실 CPU 미러 쓰기는 기존 `ExternalProtocol` 의미를 재사용한다(장비가 권위자).

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

### 4.2 dst 스캔-위상 코히어런스 & 순환 금지 (검토 C.3/C.4)

- **torn read 방지**: dst가 가상 CPU면 복사를 그 CPU의 **입력 스캔 위상 경계**에
  적용한다(더블버퍼 또는 input-phase 큐). 스캔 도중 입력 영역을 덮어 찢긴 읽기가
  나는 것을 막는다. 실 CPU dst는 폴 쓰기 큐로 흘린다.
- **순환 발진 방지**: §3의 정적 검증(dst 단일 소유 + 입력성 타깃)으로 dst가
  read-only 성격이 되므로, dst 변경이 같은 셀의 역방향 링크를 트리거하지 않는다.
  A→B, B→A가 **겹치는 범위**를 link하는 config는 로드 시 거부한다.

## 5. CPU 헬스/품질 — 실 CPU는 끊긴다

실 CPU는 연결 끊김·타임아웃이 일상이다. CPU별 `CpuHealth`(연결 상태 + OPC
quality 유사 플래그)를 모델에 둔다. 가상 CPU는 항상 `Good`. 링크가 복사하는
값에도 품질이 전파되어, 끊긴 실 CPU에서 미러된 값이 stale임을 dst가 알 수 있게
한다. 캔버스는 이 품질을 시각적으로 표시한다.

## 6. OneCanvas 바인딩 — "작은 수술"의 전제는 태그 키 변경

> 이 "작은 수술"이 성립하려면 **태그 레지스트리 키가 `(cpu_id, addr)` 튜플**이어야
> 한다. 현재는 `area:index`만으로 키잉해 N-CPU에서 충돌한다
> (`crates/sim-engine/src/tag_registry.rs:297-305`, 검토 B.3). 키 변경이
> **선행 조건**이다.

태그 키가 cpu 네임스페이스를 갖게 되면, 그 한 곳의 변경이 캔버스·모니터링·
read/write_binding으로 자동 전파된다. 그 위에서 `PlcBlockMapping`은 **`CpuId` 한
필드 추가**가 전부다.

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
- ✅ `CanonicalWriteSource::CpuLink` 변형 (권위 모델 확장 — 결정 1)
- ❌ Modbus master / OPC-UA client 구체 구현 (후속)
- ❌ 멀티-CPU 캔버스/UI (후속)

## 9. 마이그레이션 경로 (단일 CPU → N CPU, 비파괴)

> **무게중심은 엔진이 아니라 셸이다**(검토 A). 엔진 N개는 쉽다. 진짜 비용은
> 태그 키·Tauri State·커맨드·이벤트·서버 라우팅이다.

1. **코어 타입 골격**(crates, wasm-safe): `CpuId`, `CpuDriver`/`CpuNode` 골격,
   `FieldLink` **trait만**, `MemoryLink`/`LinkSyncMode`, `CpuLink` write-source.
2. **태그 키 = `(cpu_id, addr)`** (선행 조건, B.3). 기본 cpu_id로 기존 동작 유지.
3. `CpuNode`로 단일 CPU 감싸기 — `SimulationRuntimeHost` 필드를 `CpuNode`로 이주,
   **CPU 1개짜리 `CpuManager`**를 유일 State로 manage. 동작 동일.
4. `PlcBlockMapping`에 `cpu_id` 추가, 기본값=primary. 기존 프로젝트 호환.
5. 커맨드에 `cpu_id: Option<CpuId>` + primary 라우팅(결정 2). 이벤트에 cpu_id.
6. config `cpus`/`links` + 정적 링크 검증(없으면 단일 가상 CPU 폴백).
7. 멀티 CPU spawn + `MemoryLink` 태스크(스캔-위상 코히어런스).
8. 서버 단일 엔드포인트 + unit_id/ns 라우팅(결정 3, modbus-codec 멀티-unit).
9. 실 프로토콜 클라이언트 구현(별도 워크트리 후보).

각 단계는 빌드 green + 기존 단일 CPU 시나리오 회귀 없음을 검증 기준으로 한다.
이번 워크트리 작업 범위 = **단계 1**(코어 타입 골격).
