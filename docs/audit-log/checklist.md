# 운영 감사 로그 — 체크리스트

## 설계 (완료)
- [x] 코드 실태 조사 (기존 엔진·훅 지점 파악)
- [x] 설계 문서 작성 (`design.md`)
- [x] context-notes 작성

## 결정 대기
- [ ] 엔진 재사용 방식 확정 — 추출(B) vs 최소변경(A) (`design.md` §3)
- [ ] Phase 1 범위 합의 (force·시뮬제어만 vs 더 넓게)

## Phase 1 — runtime 운영 감사 (미착수)
- [ ] (B 선택 시) `src-tauri/src/audit/` core 추출, opcua 감사를 소비자로 전환
- [ ] 운영 이벤트 타입 추가 (`ForceSet`/`ForceRelease`/`SimStart`/`SimStop`/`SimPause`/`SimResume`/`SimReset`)
- [ ] `RuntimeControl` 카테고리 추가
- [ ] `ladder_force_device`/`ladder_release_force`에 감사 기록 훅 (이전값→새값 캡처)
- [ ] `sim_run`/`sim_stop`/`sim_pause`/`sim_resume`/`sim_reset`에 감사 기록 훅
- [ ] `detail`에 `{address, before, after}` JSON 직렬화
- [ ] 감사 조회 Tauri 커맨드 (운영 카테고리용, 기존 `opcua_query_audit_log` 패턴)
- [ ] 프론트 감사 패널 (필터 + 페이지네이션)
- [ ] Rust 단위 테스트 (기록→조회 검증)
- [ ] `cargo test` / 빌드 통과 확인
- [ ] 커밋

## Phase 2+ (예정)
- [ ] 저작 감사 (canvasStore 도메인 이벤트)
- [ ] undo → 역방향 이벤트 append 연동
- [ ] (선택) 해시체인 위변조 탐지 (스키마 v4)
- [ ] actor 신원 (멀티유저/세션)
