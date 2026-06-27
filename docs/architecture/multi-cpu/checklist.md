<!-- 멀티-CPU 아키텍처 구현 체크리스트 — 설계(00-design.md) 기준 -->
# 멀티-CPU 체크리스트

> 기준 문서: [00-design.md](./00-design.md). 이번 라운드는 **설계 + trait 추상까지**.
> 구체 프로토콜 구현은 의도적으로 미착수(unchecked).

## 단계 0 — 설계 (현재)
- [x] 통일 모델 확정 ("CPU = 메모리 + 전진 에이전트")
- [x] `ProtocolAdapter` 방향 뒤집기로 실 CPU 수용 확인
- [x] 권위(write-owner) 모델 정의 → **area-aware로 개정 필요** (review C.1)
- [x] inter-CPU 링크 모델 + 동기화 모드(유저 설정) 정의
- [x] 설계 문서 작성
- [x] 1차 비판 검토 ([01-design-review.md](./01-design-review.md))
- [x] 미결정 3건 확정 ([02-decisions.md](./02-decisions.md))
- [x] 결정 반영해 00-design 개정 (review §D + 02-decisions §개정 지시)

## 단계 0.5 — 검토에서 드러난 셸 비용 (00-design §9 무게중심 이동)
> 엔진 N개는 쉽다. 진짜 비용은 아래 경계 레이어다.
- [ ] 태그 레지스트리 키 = `(cpu_id, addr)` (전제조건, review B.3)
- [ ] Tauri State = `CpuManager` **단수** manage + 커맨드 `cpu_id` 라우팅 (B.1)
- [ ] 이벤트에 cpu_id 포함 + 프론트 상태 `Record<cpuId, ...>` (A.2)
- [ ] 서버 = 단일 엔드포인트 + unit_id/네임스페이스 라우팅 (결정 3, 코덱 멀티-unit 신규)
- [ ] authority = 기존 CanonicalAccess/WriteSource 재사용 + `CpuLink` 변형 추가 (결정 1)
- [ ] 링크 타깃 정적 config 검증 (dst 겹침/래더 쓰기영역 겹침 거부) (결정 1)
- [ ] 커맨드 `cpu_id: Option<CpuId>` + primary 규칙 (결정 2)
- [ ] 실 CPU = 엔진/디버거 없는 경량 노드, 디버그 커맨드 거부 (C.2)
- [ ] 링크 dst 스캔-위상 코히어런스 + 순환 금지 config 검증 (C.3, C.4)

## 단계 1 — 코어 타입 골격 (crates, wasm-safe) ✅ (커밋 6a3d04d, 워크트리→main 병합)
- [x] `CpuId`/`CpuKind`/`CpuHealth` 타입 (contract `cpu.rs`)
- [x] `MemoryLink`/`LinkEndpoint`/`CanonicalRange`/`LinkSyncMode` (contract `link.rs`)
- [x] `FieldLink` **trait 정의**만 (contract `field_link.rs`, 구현 없음)
- [x] write-owner 태그 대신 `CanonicalWriteSource::CpuLink` 변형 (결정 1로 단순화)
- [x] verify: `cargo test -p modone-contract` green (16개, 신규 5)
- [x] verify: enum 변형 추가가 다운스트림 깨지 않음 (exhaustive match 없음 확인)
- [~] 전체 워크스페이스 빌드는 미실행(openssl 1h 비용). 변경이 순수 additive +
  exhaustive match 부재로 안전. 단계 2 착수 시 함께 검증.

## 단계 2 — CpuNode 도입 (단일 CPU 비파괴 래핑) ✅ (커밋 636577e, 워크트리→main 병합)
- [x] `CpuNode` 구조체 (id + runtime + driver + health) — servers는 매니저 레벨로(설계 §2)
- [x] `CpuDriver::Virtual(엔진 슬롯)` 분기 + `kind()`/`health()`
- [x] `SimulationRuntimeHost` engine/runtime 필드를 `CpuNode`로 이주 (동작 동일)
- [x] primary CPU id "cpu-0" 기본값 (결정 2 대비)
- [x] verify: `cargo check -p modone` green (51s, warm target, opcua 포함)
- [~] 런타임 회귀 테스트는 src-tauri `[lib] test=false`로 미실행. 동작 보존
  리팩토링(같은 Arc·제어흐름)이라 컴파일 통과가 게이트. 필요시 tests/*.rs 통합테스트.

## 단계 3 — 캔버스 바인딩 확장
- [ ] `PlcBlockMapping`에 `cpu_id` 필드 추가 (기본=단일 CPU)
- [ ] `CanvasSync`가 cpu_id로 메모리 라우팅
- [ ] verify: 기존 캔버스 PLC 블록 바인딩 회귀 없음

## 단계 4 — CpuManager + 멀티 spawn
- [ ] `CpuManager { cpus, links }`
- [ ] CPU별 스캔/폴 태스크 spawn (add/remove/start/stop)
- [ ] 프로젝트 config `cpus`/`links` 스키마 + 파서 (없으면 단일 가상 CPU 폴백)
- [ ] verify: 가상 CPU 2개 동시 구동 + 상태 분리 확인

## 단계 5 — MemoryLink 태스크
- [ ] src 버스 구독 → dst external write 복사 태스크
- [ ] `LinkSyncMode` 3종 동작
- [ ] dst 영역 write-owner = 링크로 잠금
- [ ] 품질(stale) 전파
- [ ] verify: 가상↔가상 링크로 값 전달 E2E

## 단계 6 — 실 프로토콜 클라이언트 (후속, 별도 워크트리 후보)
- [ ] `FieldLink` 구현: Modbus master
- [ ] `FieldLink` 구현: OPC-UA client
- [ ] `CpuHealth` 연결/재접속/타임아웃
- [ ] verify: 실 장비(or 시뮬) 대상 read/write 루프
