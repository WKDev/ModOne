<!-- 심볼 시스템을 XML 전용으로 정리하고 NaN 크래시를 잡는 작업 체크리스트 -->
# Symbol XML-only 정리 + NaN 크래시 수정 — Checklist

> 방향(사용자 확정): ②NaN 크래시 + ③비-XML 심볼 전면 삭제를 먼저, ①wire 인터랙티브는 이후 별도 워크트리.
> 범위: SymbolLibrary.ts(하드코딩 Pixi 팩토리) + SVG 렌더 경로 전면 삭제, 모든 블록을 XML 파이프라인으로 일원화, 45개 XML 심볼 렌더 검증.

## Phase 0 — 크래시 즉시 차단 (방어) ✅
- [x] CanvasMinimap: 비유한값 좌표 블록/와이어를 렌더에서 skip (rect/line/viewport 모두 가드)
- [x] calculateBounds: 블록 position/size가 유한값일 때만 min/max에 반영
- [ ] 빌드 통과 확인 (타입체크 — 단순 변경, 라이브 스모크는 Phase 1과 함께)

## Phase 1 — NaN 근원 특정 (라이브 재현) ⏳ 사용자 재현 대기
- [x] 파서 경계 NaN 가드: `numAttr`이 NaN→undefined 반환 (`?? default` 적용). `<Layout>` 누락도 가드
- [x] builtin 45개 모두 유한 size 확인 → **NaN 근원은 builtin 아님** (custom_symbol/역직렬화)
- [ ] 앱 실행 → led/조명 배치 재현, 어떤 블록의 어떤 필드가 NaN인지 확인 (사용자 제보 대기)
- [ ] 근원 경로 수정 (custom_symbol 지오메트리 / 역직렬화)

## Phase 2 — XML 전용화: 하드코딩 심볼 제거 ✅
- [x] custom_symbol fallback이 fallback 없이 안전한지 확인 (BLOCK_TYPE_TO_SYMBOL_ID가 custom_symbol 외 전부 커버)
- [x] placeholderContext.ts 신설 (빈 custom_symbol용 최소 placeholder)
- [x] BlockRenderer.ts: getSymbolContext/getSymbolSize fallback → placeholder
- [x] GhostPreviewRenderer.ts: 동일 처리
- [x] SymbolLibrary.ts(~900줄) 삭제 + symbols/index.ts·renderers/index.ts 배럴 정리
- [x] 고아 import 정리, 스테일 주석(symbolBridge/symbolThumbnails) 수정

## Phase 3 — XML 심볼 45개 렌더 검증 ✅(핵심)
- [x] builtinSymbolGeometry.test.ts: 45개 모두 유한·양수 Layout + 파생 block size 보장
- [x] BlockRenderer/roundtrip/parser 테스트 통과
- [ ] 라이브 스모크 (Phase 1 재현과 함께)

## Phase 4 — 검증 & 커밋
- [x] 타입체크 통과 (tsc --noEmit 클린)
- [x] 관련 vitest 통과 (parser/roundtrip/BlockRenderer/geometry)
- [ ] 라이브 스모크: led/조명/scope/button 배치 → 콘솔 NaN 0건, 미니맵 정상
- [ ] 의미 단위 커밋 (방어 / 삭제 / 가드)
