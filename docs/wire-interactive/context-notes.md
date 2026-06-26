<!-- wire 인터랙티브 작업 중 결정과 근거 기록 -->
# Wire 인터랙티브 개선 — Context Notes

## 코드 맵 (핵심 앵커)
- 드래그 핸들러: `interaction/interactionPointerHandlers.ts`
  - `handleDraggingItemsMove` L243: `moveComponent(id, newPos, true, true)` — 4번째=skipWireRecalc
  - `handleDraggingItemsUp` L286-289: `moveComponent(..., false, false)` — 끝에서 recalc+simplify
- store: `stores/canvasStore.ts` `moveComponent` L542-583
  - skipWireRecalc=false → `getWiresConnectedToComponent` + `recalculateAutoHandles` + `simplifyWireHandles`
- 동기화: `sync/SyncEngine.ts`
  - dirty 판정 L163-176: `current.X !== previous.X` 참조비교
  - L311-312 wiresDirty → `wireRenderer.renderAll`; RAF 스로틀 L216-224
- 렌더: `renderers/WireRenderer.ts`
  - `_buildWirePoints` L277, `_resolveEndpointPosition` L303 — **port 엔드포인트를 block.position+port.absolutePosition로 라이브 해석**. 핸들은 절대좌표 저장값 사용.
- 히트: `core/HitTester.ts` `wireHitRadius: 8*LEGACY_MM_PER_PX` L33; `_buildWirePolyline` L280; `pointToSegmentDistance` L367-393
- 공간색인: `core/SpatialIndex.ts` 와이어 bounds pad=4 L332
- 선택: `types/selection.ts` ('block'|'wire'|'junction'); 박스선택 와이어 포함 L334
- 커서: 현재 미구현 (CSS 클래스만). CanvasHost 컨테이너 ref에 style.cursor 설정 필요.

## 결정 사항
- **D1 (#1 라이브 추종): A+B 병행 채택.**
  - (B) SyncEngine에서 blocks/junctions dirty면 wires도 dirty → 직선 wire 포함 엔드포인트가 항상
    블록 위치를 따라 재렌더(WireRenderer가 엔드포인트를 라이브 해석).
  - (A) 드래그 move에서 skipWireRecalc=false(skipHistory=true 유지) → 연결 wire를 매 프레임 recalc해
    **직각 라우팅을 라이브 유지**. (초기엔 B만 적용 → 드래그 중 사선→릴리즈에서 직각 스냅 문제
    보고되어 A 추가.)
  - 드리프트 안전성: recalculateAutoHandles는 매 프레임 호출해도 안정 — 자동 wire는 매번 처음부터
    재계산, user-handle wire는 source==='user'만 남기고 auto 브릿지 폐기·재생성(누적 없음).
- **D2 (#5 히트영역):** wireHitRadius 확대. 렌더 wire width와 비교해 "조금 더 넓게" 수준으로.
- **D3 (#4 꺾임):** HitTester가 이미 세그먼트별(subIndex) 히트 → 꺾임 기준 동작. 추가 구현보다 검증/튜닝.
- **D4 (#2 커서):** idle pointer-move hover hitTest 신설 + CanvasHost로 콜백 → cursor 설정. 과하지 않게.
- **D5 (#3 박스선택):** 이미 wire 포함. 검증 위주.

## 미해결/주의
- 라이브 추종 시 wires renderAll이 매 프레임 전체 재렌더 → 대형 회로 성능. 기존도 blocks를
  매 프레임 재렌더하므로 일관적. 필요 시 연결 wire만 부분 갱신으로 후속 최적화 여지.
