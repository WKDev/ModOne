<!-- 멀티-CPU 설계(00-design.md) 1차 비판 검토 — 코드 검증으로 깨진 가정과 설계 재구성 -->
# 멀티-CPU 설계 검토 (1차)

> [00-design.md](./00-design.md)의 가정을 코드로 검증한 결과와, 그로 인한 설계
> 재구성·미해결 구멍을 기록한다. 핵심 한 줄: **이건 엔진 리팩토링이 아니라
> 셸/경계 리팩토링이다.**

## A. 검증 결과 — "N개 인스턴스화하면 끝"은 30%만 맞다

### A.1 ✅ 깨끗하게 인스턴스 단위 (엔진 코어)
- `CanonicalRuntimeFacade`: `new()`가 매번 독립 `Arc<RwLock<CanonicalMemory>>`
  생성 (`crates/sim-engine/src/memory.rs:31-40`). 버스도 facade에 종속.
- `TimerManager` (`crates/sim-engine/src/timer.rs:72-82`),
  `CounterManager` (`crates/sim-engine/src/counter.rs:58-69`): 전역 static 없음.
- → 가상 CPU의 **연산 코어는 N개 생성에 걸림돌 없음.** 설계의 §1~§2 전제는 유효.

### A.2 ❌ 단일 CPU를 가정하는 경계 레이어 (진짜 비용)
| 영역 | 문제 | 근거 |
|---|---|---|
| 태그 레지스트리 키 | cpu_id 없이 `area:index`로 키잉 → N-CPU 충돌 | `tag_registry.rs:297-305` |
| Tauri State | `shared_runtime`/`SimState` 단일 생성·manage | `src-tauri/src/lib.rs:347-357,400-403` |
| 커맨드 표면 50+ | 전부 단일 `State<SimState>`, cpu_id 파라미터 없음 | `commands/sim.rs:42-44,163+` |
| 이벤트 채널 | `sim:*` 이벤트에 cpu_id 없음, 프론트도 단일 상태 | `runtime_host.rs:22-25`, `useSimulation.ts:150-160` |
| 서버 포트 | Modbus/OPC-UA 단일 포트·단일 서버 필드 | `commands/modbus.rs:21-32`, `commands/opcua.rs:71-78` |

**결론**: 작업량의 ~70%가 셸(경계)에 있다. 마이그레이션 계획의 무게중심을
엔진이 아니라 이쪽으로 옮긴다.

## B. 설계 재구성 — 검증이 드러낸 더 날카로운 길 3가지

### B.1 Tauri State는 N개가 아니라 **`CpuManager` 1개**를 manage 한다
탐색 보고서의 `manage(HashMap<u8, SimState>)` 제안은 부적절하다. Tauri가 N개
타입 인스턴스를 들면 커맨드 시그니처와 라이프사이클이 폭발한다.

- **대신**: `CpuManager` 하나만 `.manage()`. 내부에 `HashMap<CpuId, CpuNode>`.
- 커맨드는 `cpu_id: Option<CpuId>` 파라미터를 받아 매니저 내부에서 라우팅
  (`None`이면 primary CPU). → State 관리는 **단수 유지**, 기존 단일 CPU
  프로젝트와 **하위 호환**.
- 50+ 커맨드에 `cpu_id` 인자를 더하는 일은 남지만, 기계적·일괄적이다(State
  재설계가 아님).

### B.2 서버는 N포트가 아니라 **단일 엔드포인트 + 논리 디바이스 라우팅**
"CPU마다 502+n, 4840+n 포트"는 산업 현실과도 어긋나고 포트 충돌·방화벽
지옥을 부른다. 게이트웨이의 실제 방식을 따른다.

- **Modbus**: 한 TCP 리스너(502) + **`unit_id` → `CpuId` 라우팅**. Modbus
  프로토콜이 바로 이 용도로 unit/slave id를 가진다. 단, 현재 코덱은 단일
  unit_id만 처리한다(`modbus/types.rs:51`, 코덱에 unit 디스패치 **없음**확인).
  → unit 라우팅은 **코덱 신규 작업**. 비용 있지만 N리스너보다 정도(正道).
- **OPC-UA**: 한 서버 + **CPU별 네임스페이스/폴더**. 노드 트리에서 CPU 분리.
- "CPU별 별도 포트"는 기본이 아니라 **옵션**으로 남긴다(격리 요구 시).

### B.3 태그 레지스트리가 **cpu 네임스페이스의 단일 시임(seam)**이다
태그 키 충돌은 흩어진 5개 버그가 아니라 **한 곳을 고치면 전파되는** 문제다.
태그 정체성을 `(cpu_id, CanonicalAddress)` 튜플로 바꾸면:
- 캔버스 바인딩(`PlcBlockMapping.cpu_id`), 모니터링, read/write_binding이
  전부 자동으로 cpu-aware가 된다.
- → §6의 "작은 수술"이 실제로 성립하는 이유. 단, 레지스트리 키 변경이 그
  전제조건임을 명시(00-design은 이를 빠뜨렸음).

## C. 탐색이 못 잡는 설계 레벨 구멍 (신규 발견)

### C.1 권위 모델 ↔ 기존 서버 write-back 충돌 (중요)
00-design §3의 "셀마다 owner 하나"는 **기존 양방향 서버를 깨뜨릴 수 있다.**
Modbus 클라이언트가 홀딩 레지스터(=래더가 읽는 D 영역)에 쓰는 것은 정당한
입력이다. 일반 write-owner 가드로 이를 막으면 회귀한다.
- **수정 방향**: 권위를 **area 의미 기반**으로. 입력성 영역(I, 외부 writable)
  과 출력성 영역(O/CPU 소유)을 구분. 새 제네릭 태그가 아니라 canonical area
  semantics를 활용. 링크 dst·실 CPU 미러도 이 분류에 얹는다.
- → 00-design §3을 "area-aware authority"로 개정 필요.

### C.2 실 CPU에는 엔진·타이머·카운터·디버거가 없다
실 CPU의 `CpuNode`는 `OneSimEngine`/`TimerManager`/`CounterManager`를 돌리지
않는다(장비가 권위자). 그런데 모니터링·디버거·step/breakpoint 커맨드는 엔진
존재를 가정한다.
- **수정 방향**: `CpuDriver::Real`은 scan 내부 구조가 없는 경량 노드.
  `sim_step`/`sim_add_breakpoint` 등 디버그 커맨드는 실 CPU에 대해 거부(또는
  no-op)하고 명확한 에러 반환. status/메모리 스냅샷/모니터링은 미러 메모리
  기준으로 동작.

### C.3 링크 dst의 스캔-위상 코히어런스
"eventual" 복사가 가상 CPU의 **입력 스캔 도중**에 dst 입력 영역을 덮으면
torn read가 난다. 00-design은 src 타이밍만 다뤘다.
- **수정 방향**: dst가 가상 CPU면 링크 복사를 **입력 스캔 위상 경계**에
  적용(더블버퍼 또는 input-phase 큐). 실 CPU dst는 폴 쓰기 큐로.

### C.4 순환 링크 / 피드백 발진
A→B, B→A가 겹치는 범위를 link하면 dirty 전파가 무한 핑퐁할 수 있다.
- **수정 방향**: 링크는 단방향 owner 규칙(§B.1/C.1)으로 dst를 read-only
  화 → dst 변경이 같은 셀의 역방향 링크를 트리거하지 않게 한다. 추가로 링크
  그래프의 owner 중복(같은 dst 셀에 2개 링크)을 config 검증에서 거부.

## D. 개정해야 할 00-design 항목 요약
- §3 권위 모델 → **area-aware authority**로 재서술 (C.1)
- §4 링크 → dst 스캔-위상 코히어런스 + 순환 금지 검증 추가 (C.3, C.4)
- §6 캔버스 → 태그 레지스트리 키 = `(cpu_id, addr)`가 전제임을 명시 (B.3)
- §2 구조 → 서버를 "단일 엔드포인트 + 논리 라우팅"으로, State는 `CpuManager`
  단수 manage로 (B.1, B.2)
- §2 `CpuDriver::Real`은 엔진/디버거 없는 경량 노드임을 명시 (C.2)
- §9 마이그레이션 → 무게중심을 셸(태그키·State·커맨드·이벤트·서버)로 이동.
  "엔진 N개"는 쉬운 단계, 진짜 비용은 그 다음.

## E. 미결정 → **해소됨** ([02-decisions.md](./02-decisions.md))
- ~~area-aware authority 분류표~~ → **이미 존재**(types.rs). 재사용 + `CpuLink`
  변형 + 정적 링크 검증. 검토 C.1/§3 초안 폐기. (결정 1)
- ~~커맨드 cpu_id 기본값~~ → `Option<CpuId>`, None=primary, primary=명시
  플래그 or 선언 첫 CPU. 단일 CPU 완전 하위 호환. (결정 2)
- ~~서버 노출 범위~~ → 단일 엔드포인트 + unit_id/네임스페이스 라우팅(유저
  확정). modbus-codec 멀티-unit 디스패치를 v1 범위로. (결정 3)
