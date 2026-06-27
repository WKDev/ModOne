# 운영 감사 로그 — 체크리스트

## 설계 (완료)
- [x] 코드 실태 조사 (기존 엔진·훅 지점 파악)
- [x] 설계 문서 작성 (`design.md`)
- [x] context-notes 작성

## 결정 (확정)
- [x] 엔진 재사용 방식 — **(B) 추출**, 단 src-tauri 모듈이 아닌 **새 크레이트 modone-audit** (테스트 실행 가능)
- [x] Phase 1 범위 — force·시뮬제어 감사

## Phase 1 — runtime 운영 감사 (완료)
- [x] `crates/modone-audit` core 추출 (types/store/state), opcua 감사를 소비자로 전환
- [x] 운영 이벤트 타입 (`force_set`/`force_release`/`sim_start`/`sim_stop`/`sim_pause`/`sim_resume`/`sim_reset`)
- [x] `runtime_control` 카테고리 (문자열)
- [x] `ladder_force_device`/`ladder_release_force`에 감사 훅
- [x] `sim_run`/`sim_stop`/`sim_pause`/`sim_resume`/`sim_reset`에 감사 훅 (+ `sim_continue` 연쇄)
- [x] `detail`에 JSON 직렬화 — force는 `{address, value}` (※ before/after 아님: 커맨드 레벨에서 이전 강제값 미보유, Phase 2에서 보강 가능)
- [x] 감사 조회 Tauri 커맨드 `runtime_query_audit_log` (별도 `RuntimeAuditState`)
- [x] 프론트 감사 패널 (`RuntimeAuditLogPanel`, tool zone, 필터+검색)
- [x] 크레이트 단위 테스트 17개 (기록→조회→보존)
- [x] 빌드 통과 — `cargo check -p modone` + `cargo test -p modone-audit` + `tsc --noEmit`
- [x] 커밋 (a439eb3 / 197fba6 / d98a74b / 프론트)

## Phase 1 잔여 (선택)
- [ ] 실제 앱 실행 후 패널 동작 시각 확인 (force 걸고 로그 뜨는지)
- [ ] 패널을 여는 메뉴/단축키 진입점 확인 (tool zone 자동 노출 여부)
- [ ] 페이지네이션 무한스크롤 (현재 limit 200 단발)

## Phase 2+ (예정)
- [ ] 저작 감사 (canvasStore 도메인 이벤트)
- [ ] undo → 역방향 이벤트 append 연동
- [ ] force before/after 캡처 (현재 값 조회 후 기록)
- [ ] (선택) 해시체인 위변조 탐지 (스키마 v4)
- [ ] actor 신원 (멀티유저/세션)
