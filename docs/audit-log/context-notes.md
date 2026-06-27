# 운영 감사 로그 — 컨텍스트 노트

작업 중 내린 결정과 그 근거를 계속 덧붙인다.

## 2026-06-27 — 초기 조사·설계

- **요구 확정.** 사용자는 세 가지를 모두 원함: 운영 감사 / 협업·되돌리기 신뢰성 / 컴플라이언스·안전 추적.
- **결정적 발견.** `src-tauri/src/opcua/audit.rs`에 이미 SQLite 기반 범용 감사 엔진이 완성·테스트되어 있음. 처음부터 만들 필요 없음. OPC UA 전용은 enum 값과 auth 헬퍼뿐, 저장/조회/보존 엔진은 도메인 무관.
  - 근거: 엔진이 `record/query/retention/migration(v3)`까지 갖췄고, `AuditLoggerState`가 thread-safe + 보존 스케줄러까지 포함. Tauri 등록도 `lib.rs:428`에 이미 있음.
- **숨은 충돌 해소.** "되돌리기(가변)" vs "컴플라이언스(불변)"는 정면 충돌. 해법은 undo를 "삭제"가 아니라 "역방향 이벤트 append"로 정의하는 것. 이러면 한 append-only 로그로 세 요구가 동시 충족.
- **엔진 재사용 방식은 미결정.** 추천은 (B) 범용 `audit/` 모듈 추출. 추가 근거: `opcua/audit.rs`가 2174줄로 프로젝트 자체 규약(>800줄 must-split)을 이미 위반 — 추출이 재사용+분해를 동시 해결. 부담되면 (A) 최소변경으로 시작 가능.
- **Phase 1 = 런타임 force·시뮬제어 감사.** ROI 최대, 범위 명확. 훅은 `MonitoringService` 내부보다 Tauri 커맨드 레벨(`ladder_force_device` 등)이 actor/맥락 잡기 유리.
- **해시체인은 Phase 2 선택사항으로 미룸.** "append-only API"와 "파일 변조 불가"는 다름. 강한 컴플라이언스 요구가 확정되기 전 도입은 과설계. 현재 스키마는 v3.
- **비범위 명시.** canvasStore 기존 undo 스택을 감사 로그로 대체하지 않음(목적 상이). 무차별 기록 금지.

### 다음 세션 진입점
1. `design.md` §3 결정(추출 B / 최소변경 A) 확정.
2. Phase 1 범위 합의 후 `checklist.md`의 Phase 1 항목부터.
3. 관련 코드: `opcua/audit.rs`(엔진), `commands/sim.rs:973~`(force 커맨드), `sim/monitoring.rs:135~`(force 내부), `lib.rs:428`(등록 패턴).

## 2026-06-27 — 구현 (워크트리 feat/audit-log-runtime)

- **결정 확정: (B) 범용 크레이트 추출.** 사용자가 "워크트리에서 1번((B)+Phase1)" 지시.
- **엔진 = 새 크레이트 `crates/modone-audit`.** src-tauri 안 모듈이 아니라 크레이트로 뺀 이유. `[lib]test=false`라 src-tauri 단위테스트는 실행 불가지만, 크레이트는 `cargo test -p modone-audit`로 **실제 실행**된다(17개 통과). 거대파일(2174줄) 분해도 겸함. types/store/state로 분리.
- **추출 중 잠재버그 2건 발견·수정.** `AuditLogQuery::default()`의 limit이 0이라 쿼리가 항상 0건 반환(manual Default 200으로 수정), set_max_rows 최소 100 clamp 미반영 테스트. 둘 다 `[lib]test=false`로 기존 테스트가 실행된 적 없어 잠복했음.
- **opcua/audit.rs는 ~430줄로 슬림화.** enum(AuditEventCategory/Type) + 확장 트레잇(OpcuaAuditStore=Result 반환, OpcuaAuditState=no-op 반환) + 인증/계정 헬퍼만 유지. AuditLogger/AuditLoggerState는 엔진 타입 별칭. DB 경로는 `open_opcua_audit()` 자유함수로 보존.
- **드롭한 미사용 헬퍼.** log_auth_unknown_user*, log_auth_disabled_account_with_ip (소비자 전수조사 결과 미사용).
- **런타임 감사.** `sim/audit.rs`의 `RuntimeAuditState`(newtype — opcua 감사와 **Tauri State 타입 충돌 회피**), 별도 DB `<app_data>/runtime/audit_log.db`. force=Warning, 시뮬상태=Info. 훅은 Tauri 커맨드 레벨(`ladder_force_device`/`release`/`sim_run/stop/pause/resume/reset`). `sim_continue`가 `sim_resume`를 직접 호출해 함께 시그니처 수정.
- **빌드 함정 회피.** 워크트리 빈 target는 openssl ~1시간. `CARGO_TARGET_DIR`을 메인 체크아웃 target으로 지정 + `scripts/with-perl.ps1 -- cargo check -p modone`(`-p`가 PS 파라미터로 오인되니 `--` 구분자 필수) → openssl 캐시 재사용으로 **38초** 컴파일 통과(경고는 전부 기존 dead-code).
- **never-type fallback 힌트(sim.rs)는 빌드 차단 아님.** 2021 에디션 미래경고(★), 기존 opcua_query_audit_log와 동일 패턴.
- **프론트.** `runtimeAuditService.ts` + `RuntimeAuditLogPanel.tsx`(tool zone). category/eventType이 opcua union과 안 맞아 런타임 전용 타입 정의(AuditSeverity만 재사용). 가상스크롤 없이 단순(limit 200). `tsc --noEmit` 통과.

### 검증 명령 (재현용)
- 엔진 테스트: `cargo test -p modone-audit` (빠름, openssl 무관).
- src-tauri 컴파일: `$env:CARGO_TARGET_DIR='C:\Users\chanh\Projects\ModOne\target'; .\scripts\with-perl.ps1 -- cargo check -p modone`.
- 프론트: `npx tsc --noEmit`.

### 커밋
1. a439eb3 crates/modone-audit 추출 (+잠재버그 2건 수정)
2. 197fba6 opcua를 엔진 소비자로
3. d98a74b 런타임 감사 훅 + 조회 커맨드
4. d526213 프론트 패널 / f745cd7 main 병합
5. 0f30d10 **시작 패닉 수정** (아래)

## 2026-06-27 — 실제 앱 실행 검증에서 런타임 버그 발견·수정

- **증상.** `pnpm tauri dev`로 띄우니 시작 즉시 패닉: `there is no reactor running, must be called from the context of a Tokio 1.x runtime` (state.rs:66). 앱 exit 101.
- **원인.** 크레이트 `start_retention_scheduler`가 `tokio::spawn`을 호출하는데, Tauri `setup()`은 tokio 런타임 컨텍스트 **밖**에서 돈다. 원본 opcua는 `tauri::async_runtime::spawn`(컨텍스트 무관)을 써서 괜찮았던 것 — 크레이트를 tauri-free로 만들며 이 보장을 잃었다.
- **놓친 이유.** `cargo check`·`cargo test -p modone-audit`·`tsc` 전부 통과. 단위테스트가 스케줄러를 "런타임 없는 컨텍스트에서" 시작하지 않아 못 잡음. **실제 앱을 띄워야만** 드러나는 종류.
- **수정(0f30d10).** 보존 루프는 async 불필요(주기적 sync 호출) → `std::thread + mpsc::recv_timeout`으로 교체. 런타임 무관, tokio 의존 제거.
- **e2e 검증(CDP).** 실 백엔드에 `runtime_query_audit_log` 등록 확인 → `sim_run`/`sim_stop` 호출 → DB에 sim_start/sim_stop 2건 기록 → `RuntimeAuditLogPanel`(하단 탭 자동 노출)에 렌더 확인. 스크린샷 캡처.
- **교훈.** Tauri `setup()`/명령 외 컨텍스트에서 백그라운드 작업 spawn 시 `tokio::spawn` 금지 → `tauri::async_runtime::spawn` 또는 std 스레드. [[tauri-setup-no-tokio-context]]
