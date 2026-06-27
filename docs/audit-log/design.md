# 운영 감사 로그(Audit Log) 아키텍처 설계

> 시뮬레이션/런타임 조작 이력을 불변 기록으로 남겨 운영 감사·협업 신뢰성·컴플라이언스를 동시에 만족시키기 위한 설계 문서.
> 코드 작성 전 단계의 설계 합의를 기록한다. 결정/미결정을 명확히 구분한다.

## 0. 한 줄 요약

이 앱엔 이미 **검증된 범용 감사 엔진이 존재한다**(`src-tauri/src/opcua/audit.rs`). "새로 만들기"가 아니라 **이 엔진을 일반화해 운영 감사에 재사용**하는 것이 정답이다. 운영 감사의 본질은 단일 append-only 이벤트 로그이며, 되돌리기조차 "삭제"가 아니라 "역방향 이벤트 append"로 정의해 불변성과 양립시킨다.

---

## 1. 현재 상태 (코드로 검증됨, 2026-06-27)

### 1.1 이미 존재하는 감사 엔진 — `opcua/audit.rs` (2174줄)
- SQLite 백엔드, WAL 모드, 스키마 마이그레이션 v3 (`run_migrations`).
- `AuditLogger`: `record / log / log_full / query / get_by_id / enforce_retention / clear / count`.
- `AuditLoggerState`: thread-safe 래퍼 + 백그라운드 보존 스케줄러(기본 90일 / 50,000행 / 1시간 주기).
- 쿼리: 카테고리·이벤트타입·심각도·기간·자유텍스트 검색 + 페이지네이션.
- 테스트 다수 존재(삽입/조회/필터/보존/페이지네이션).
- Tauri 등록: `lib.rs:428` `AuditLogger::open` → `app.manage(AuditLoggerState)`, 커맨드 `opcua_query_audit_log` 등.
- **OPC UA 전용인 부분은 enum 값들(`AuditEventType`/`AuditEventCategory`)과 auth 헬퍼 메서드뿐.** 저장/조회/보존 엔진은 도메인 무관.

### 1.2 런타임 조작 지점 (감사 대상 이벤트 소스)
- Force 설정/해제: `commands/sim.rs:973` `ladder_force_device`, `:990` `ladder_release_force` → `MonitoringService.force_device/release_force` (`sim/monitoring.rs:135,143`).
- 시뮬 제어: `sim.rs` `sim_run / sim_stop / sim_pause / sim_resume / sim_reset`.
- 메모리 쓰기 버스: `modone-contract/src/event_bus.rs` `CanonicalMemoryBus.emit()`, `CanonicalWriteSource`(InternalRuntime/Simulation/ExternalProtocol/…)로 출처 구분 가능.

### 1.3 저작(design-time) 변경 지점
- `stores/canvasStore.ts` — 히스토리 스냅샷 이미 존재(`pushHistorySnapshot`, MAX 50), 모든 액션이 `set(...,'action/type')` 경유.
- 심볼 속성/핀 전기타입 편집: `SymbolEditor/` (`PinInspector`, `SymbolPropertiesEditor`, `editorModel.ts`의 `PinUpdate.electricalType`).

---

## 2. 핵심 원칙

1. **단일 append-only 이벤트 로그가 진실의 원천.** 운영/저작 구분은 별도 시스템이 아니라 한 스키마의 `category`/`source` 필드로.
2. **되돌리기는 삭제가 아니라 역방향 이벤트 append.** 디자인-타임 undo 스택(canvasStore)은 그대로 두고, 감사 로그엔 "취소됨" 이벤트가 추가로 쌓인다. 기록은 사라지지 않는다.
3. **의미 있는 도메인 이벤트만 기록.** 마우스 이동·드래그 같은 UI 노이즈는 제외. force/toggle/시뮬상태/속성변경 등 안전·추적 가치가 있는 것만.
4. **불변성이 본질.** "그냥 push하는 로그"가 아니라 사후 변조가 곤란해야 audit이다. (강한 보장은 §5 Phase 2.)

---

## 3. 중심 설계 결정 — 엔진 재사용 방식 (★미결정, 추천안 있음)

`opcua/audit.rs`는 2174줄로 **프로젝트 규약(>800줄 must-split)을 이미 위반** 중이다. 따라서 재사용과 코드 정리를 한 번에 해결하는 추천안이 있다.

**추천안 (B) — 범용 audit 모듈 추출.**
- 저장/조회/보존/마이그레이션 엔진을 `src-tauri/src/audit/`(도메인 무관 core)로 추출한다.
- OPC UA 감사는 이 core를 쓰는 얇은 소비자로 남긴다(enum + auth 헬퍼만 유지).
- 운영 감사용 카테고리/이벤트타입(`RuntimeControl`, `ForceSet`, `ForceRelease`, `SimStart`, `SimStop`, …)을 audit 모듈에 추가한다.
- 효과: 거대 파일 분해 + 두 도메인이 같은 검증된 엔진 공유.

**대안 (A) — 최소 변경.** 기존 `AuditEventType` enum에 운영 이벤트 타입만 추가하고 같은 DB를 공유, `source`로 구분. 가장 surgical하지만 "opcua" 네이밍/저장경로(`<app_data>/opcua/audit_log.db`)에 운영 이벤트가 섞이는 개념적 부채가 남는다.

> 추천: **(B)**. 단 Phase 1 범위는 §4로 최소화한다. 추출이 부담되면 (A)로 시작해 Phase 2에서 추출.

---

## 4. Phase 1 — 최소 슬라이스 (runtime force·시뮬제어 감사)

ROI가 가장 크고 범위가 명확한 런타임 운영 감사부터.

- **대상 이벤트.** force 설정/해제(이전값→새값, 대상 주소), 시뮬 start/stop/pause/resume/reset.
- **훅 지점.** Tauri 커맨드 레벨(`ladder_force_device` 등)에서 `AuditLoggerState.record(...)` 호출. `MonitoringService` 내부보다 커맨드 레벨이 actor/요청맥락을 잡기 쉽다.
- **스키마 재사용.** 기존 `AuditLogEntry`(timestamp/category/event_type/severity/message/detail/source) 그대로. `detail`에 `{address, before, after}` JSON.
- **조회 UI.** 기존 OPC UA 감사 조회 패턴을 본떠 프론트에 감사 패널 1개. 필터(기간/카테고리/검색) + 페이지네이션.
- **검증.** Rust 단위 테스트(이벤트 1건 기록→조회 확인), 기존 in-memory 로거 테스트 패턴 재사용.

## 5. Phase 2+ (예정, 미착수)

- **저작 감사 + 되돌리기 연동.** canvasStore 도메인 이벤트를 감사 로그로. undo→역방향 이벤트 append.
- **위변조 탐지(선택).** `prev_hash` 해시체인 컬럼 추가(스키마 v4). "append-only API"와 "파일 변조 불가"는 다르다 — 강한 컴플라이언스 요구가 확정될 때만 도입(과설계 방지).
- **actor 신원.** 멀티유저/세션 개념이 생기면 `client_info`에 사용자 식별 채움.
- **CanonicalMemoryBus 구독형 자동 캡처.** 커맨드 일일이 훅 거는 대신 버스 구독으로 일괄 캡처(노이즈 필터 설계 필요).

---

## 6. 비범위 (하지 않을 것)

- canvasStore의 기존 undo 스택을 감사 로그로 대체하지 않는다(목적이 다름).
- 모든 메모리 쓰기/UI 조작을 무차별 기록하지 않는다.
- Phase 1에서 해시체인·멀티유저 신원은 도입하지 않는다.
