# Symbol Editor "빵빵" — 4-Bundle Checklist

> 발견: behavior/simulation 엔진(IFTTT 룰·아키타입·visualState·animation·operate 클릭)은
> 이미 런타임에서 완전 동작. 핀 모델도 풍부. **갭은 에디터 저작 UI + PinRenderer 시각 충실도.**

## Phase A — 핀 풀 편집 + 렌더링 (KiCad급) ← Q1
- [ ] `pinStyle.ts`: 전기타입→색(hex) 맵 + 라벨 맵 (PortListPanel의 tailwind 맵을 hex로 공유화)
- [ ] `PinUpdate` 타입(editorModel)로 onUpdatePin 필드 확장 (shape/length/color/visibility/locked/group/description)
- [ ] `handleUpdatePin` Pick 확장 (generic spread라 안전)
- [ ] Pin Inspector(PropertiesPanel): shape, length, color, nameVisible/numberVisible, hidden, locked, group, description 컨트롤 추가
- [ ] PinConfigPopover(생성): shape 셀렉트 추가
- [ ] PinRenderer: 타입별 색, shape 렌더(line/inverted 버블/clock 삼각형), **핀 이름 렌더(현재 누락)**, nameVisible/numberVisible/labelOffset 반영
- [ ] PinRenderer 테스트 갱신/추가

## Phase B — 에디터 인터랙티브 프리뷰 ← Q2
- [ ] Preview에서 포트 클릭 → powered 토글 (previewPoweredPorts 재도입, 이번엔 정당)
- [ ] editor-side behaviorRuleEngine로 평가 → active visualState 산출 → 그래픽 오버라이드 적용
- [ ] 애니메이션(rotate) 에디터 티커로 실제 재생
- [ ] powered 포트/활성 state 시각 피드백(글로우/배지)
- [ ] 릴레이/LED/스위치 시나리오로 수동 검증

## Phase C — Behavior 저작 UX ← Bundle 3
- [ ] 아키타입 원클릭 프리셋(relay/lamp/motor/switch): 그래픽+핀+visualState+룰 시드
- [ ] 애니메이션 편집 UI (state별 rotate target/speed)
- [ ] visualState↔룰 연결 헬퍼/디스커버빌리티

## Phase D — PortListPanel 정리 ← Bundle 4
- [ ] types/port·usePortManager·history/commands·port-model.test 의존성 확인됨 → 모델은 유지
- [ ] 고아 PortListPanel.tsx 처리 (Pin Inspector로 기능 흡수 후 제거 또는 보류 결정)

## 검증
- [ ] `npx tsc --noEmit` 0
- [ ] `npx vitest run` 그린 유지
- [ ] 각 Phase 단위 커밋
