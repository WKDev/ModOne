<!-- 멀티-CPU 설계 중 내린 결정과 그 근거 — 다음 세션이 재유도 없이 이어받기 위한 노트 -->
# 멀티-CPU 컨텍스트 노트

> 작업 중 내린 결정과 이유를 계속 덧붙인다. 다음 세션(사람/에이전트)이 결정을
> 다시 유도하지 않게 하는 게 목적이다.

## 2026-06-27 — 초기 설계 라운드

### 결정 1: "CPU = 메모리 + 전진 에이전트" 통일 모델 채택
- **왜**: 가상/실 CPU를 별도 시스템으로 분기하면 캔버스·모니터링·링크가 전부
  이중화된다. canonical 메모리를 공통 기판으로 두면 차이가 "메모리를 누가
  전진시키는가" 하나로 수렴한다.
- **근거 코드**: `CanonicalRuntimeFacade`(메모리+버스)와 `ProtocolAdapter`
  trait(`crates/modone-contract/src/adapter.rs:10-25`)이 이미 transport-agnostic.

### 결정 2: 실 CPU는 `ProtocolAdapter`의 "방향 뒤집기"로 수용
- **왜**: trait 시그니처를 안 바꿔도 됨. `apply_external_writes`=장비 폴링,
  `publish_dirty_state`=장비 쓰기로 의미만 재해석.
- **함의**: 서버 어댑터=CPU가 권위자, 클라이언트 어댑터=장비가 권위자.

### 결정 3: inter-CPU는 명시적 단방향 `MemoryLink`만. 공유 메모리 마술 금지
- **왜**: 실 PLC 현실(CC-Link/데이터링크/I-device/producer-consumer)이 전부
  선언적 단방향 복사. 암묵 공유는 권위 충돌로 무너짐.
- **구현 재사용**: src 버스 dirty window 구독 → dst external write. 기존
  `protocol_runtime.rs` 패턴 그대로.

### 결정 4 (유저): 동기화 모드를 프로젝트 설정으로 노출
- 유저 질문 "프로젝트 설정에서 유저가 설정할 수 있게 할 수 있나?"에 대한 답 = 그렇게 한다.
- `LinkSyncMode` = eventual(기본) | periodic(ms) | on_scan. 링크마다 지정.
- **한계 명시**: 실 CPU 끼는 링크는 lockstep 불가. 링크는 최종 일관성 스냅샷.

### 결정 5 (유저): 이번 라운드는 실 CPU **trait 추상까지만**
- 유저 질문 "첫 프로토콜?"에 "둘 다 trait만" 선택.
- `FieldLink` trait 정의 + `CpuDriver::Real` 분기 stub. Modbus master /
  OPC-UA client 구체 구현은 단계 6(후속, 별도 워크트리 후보).

### 결정 6: Ouroboros 미사용
- 제약이 코드에 이미 구체적. 발견이 아니라 구조 결정 문제 → spec-first 인터뷰
  엔진 불필요. 도메인 결정은 직접 질문으로 해결.

### 권위 모델 미해결 디테일 (다음 세션 주의)
- `CanonicalRuntimeFacade`에 영역별 write-owner 태그를 **어느 입도**로 둘지
  (area 단위 vs range 단위)는 미확정. range 단위가 정확하지만 비용 큼. 단계 1에서
  결정 필요.
- 위반 시 정책(거부 vs 경고 로그)도 미확정.

### 마이그레이션 원칙
- 단일 CPU → N CPU는 **비파괴**. CPU 1개짜리 `CpuManager`로 기존 동작을 먼저
  감싸고, config 없으면 단일 가상 CPU로 폴백. 각 단계 빌드 green + 회귀 없음.

## 2026-06-27 — 1차 설계 검토 (코드 검증)

전체 결과: [01-design-review.md](./01-design-review.md). 요약만 여기 남긴다.

### 깨진 가정: "N개 인스턴스화하면 끝"은 30%만 맞다
- ✅ 엔진 코어(CanonicalRuntimeFacade/Timer/Counter)는 전역 static 없음, N개 OK.
- ❌ 경계 레이어가 전부 단일 CPU 가정: 태그키 충돌, Tauri State 단일,
  커맨드 50+, 이벤트 채널 cpu_id 없음, 서버 단일 포트.
- **재정의**: 이건 엔진 리팩토링이 아니라 **셸/경계 리팩토링**. 작업량 ~70%가 셸.

### 검토가 만든 더 나은 결정 3가지
1. Tauri State는 N개 manage가 아니라 `CpuManager` **단수** manage + 커맨드
   `cpu_id` 라우팅(None=primary). 하위 호환 + State 폭발 방지.
   (탐색 에이전트의 `manage(HashMap)` 제안은 기각.)
2. 서버는 N포트가 아니라 **단일 엔드포인트 + 논리 라우팅**. Modbus unit_id →
   CpuId(코덱 신규 작업), OPC-UA 네임스페이스/CPU. 별도 포트는 옵션.
3. 태그 레지스트리 키 = `(cpu_id, addr)`가 cpu 네임스페이스의 **단일 시임**.
   이걸 고치면 캔버스/모니터링/바인딩이 자동 cpu-aware. §6 "작은 수술"의 전제.

### 신규 발견 설계 구멍 (탐색이 못 잡음)
- **권위 모델이 기존 서버 write-back을 깰 수 있음**. → area-aware authority로
  개정(입력성 영역=외부 writable, 출력성=CPU 소유). 일반 write-owner 가드 폐기.
- 실 CPU엔 엔진/디버거 없음 → `CpuDriver::Real`은 경량, 디버그 커맨드 거부.
- 링크 dst 스캔-위상 코히어런스(torn read) + 순환 링크 발진 방지 필요.

### 다음 세션이 결정할 것
- area-aware authority 분류표(어떤 canonical area가 외부 writable인가) — 미확정.
- 커맨드 cpu_id primary 기본값 규칙.
- 1차 서버 노출 범위: unit_id 라우팅 vs "노출은 1 CPU만, 내부 N개"(비용 절감).
