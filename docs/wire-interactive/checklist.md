<!-- wire 인터랙티브 개선(라이브 추종/커서/선택/꺾임/히트영역) 작업 체크리스트 -->
# Wire 인터랙티브 개선 — Checklist

> 워크트리: feat+wire-interactive (base: main HEAD). Pixi 기반 OneCanvas.
> 요구사항(사용자): ①심볼 드래그 시 wire 라이브 추종 ②wire hover/선택 시 커서 변경
> ③드래그→selection ④꺾임(bend) 기준 select ⑤실제 wire보다 넓은 선택영역.

## #1 — 심볼 드래그 시 wire 라이브 추종 (헤드라인) ✅
- [x] 원인 확정: skipWireRecalc=true → state.wires 참조 불변 → wiresDirty=false → WireRenderer 미갱신
- [x] WireRenderer가 엔드포인트를 현재 블록 위치에서 해석 확인 (_resolveEndpointPosition)
- [x] SyncEngine: components/junctions dirty면 wires도 dirty 처리 → 드래그 중 라이브 추종
- [x] 드래그 끝 recalc/simplify는 그대로 유지(핸들 정리)

## #5 — 선택영역을 실제 wire보다 넓게 ✅
- [x] HitTester `wireHitRadius` 8→12 * LEGACY_MM_PER_PX (렌더 width 2의 ~6배 밴드). pad(4mm) 내라 색인 변경 불필요

## #4 — 꺾임(bend) 기준 select ✅(기존 동작 확인)
- [x] HitTester `_testWireSegments`가 [from,...handles,to] 모든 세그먼트 테스트 + nearest subIndex 반환 → 이미 bend-aware

## #2 — wire hover/선택 시 커서 변경 ✅
- [x] InteractionVisuals.setHover 추가, InteractionController idle pointer-move에서 hover hitTest(_updateHover, 변경시만 emit)
- [x] CanvasHost.setHover: 렌더러 하이라이트 + container.style.cursor (wire/junction=pointer, port=crosshair, block=move)
- [x] pointerOut/operate모드에서 _clearHover

## #3 — 드래그→selection ✅(기존 동작 확인)
- [x] box select(marquee) 결과에 wire 포함(handleBoxSelectingUp line 334), shift 병합 지원

## 검증 & 마무리
- [x] tsc --noEmit 클린
- [x] vitest: interaction 18 + OneCanvas/stores 221 통과, 회귀 없음
- [ ] 라이브 스모크(사용자): 블록 드래그 시 wire 추종 / wire hover 커서 / 넓은 히트
- [ ] 커밋 → main 병합 → 워크트리 제거
