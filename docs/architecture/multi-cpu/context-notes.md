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
