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
