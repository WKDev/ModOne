<!-- 심볼 XML 전용화 작업 중 내린 결정과 근거 기록 -->
# Symbol XML-only 정리 — Context Notes

## 배경 / 문제
- 사용자: led/조명 배치 시 canvas 크래시. 콘솔에 `<rect>`/`<line>` attribute NaN 에러 243+건.
- 사용자 지시: "이 프로젝트에 xml 심볼이 아닌건 싹 지워" — 심볼 시스템을 XML 전용으로 일원화.

## 심볼 3종 혼재 인벤토리 (조사 결과)
1. **XML 심볼 45개** — `src/assets/builtin-symbols/xml/*.symbol.xml`. 유지 대상.
   - 흐름: xml → `services/symbolXmlParser.ts:parseSymbolXml` → `builtin-symbols/index.ts` 레지스트리 →
     `symbolBridge`/`customSymbolBridge`(Pixi GraphicsContext) → `BlockRenderer`.
   - 블록 size/ports/props는 `utils/symbolBlockDefAdapter.ts`가 SymbolDefinition에서 파생.
2. **하드코딩 Pixi 팩토리** — `renderers/symbols/SymbolLibrary.ts`(~900줄, 31개 factory + SYMBOL_SIZES +
   SYMBOL_BUILDERS + LEGACY_TYPE_MAP). 현재 XML 조회 실패 시 **fallback**(`BlockRenderer.ts:187`,
   `GhostPreviewRenderer.ts`). 삭제 대상.
3. **SVG DOM 렌더** — `components/CanvasMinimap.tsx`가 블록을 `<rect>`, 와이어를 `<line>`로 그림.
   NaN 에러의 **표출 지점**(원천 아님).

## NaN 크래시 메커니즘 (확정)
- `CanvasMinimap.calculateBounds()`가 `Math.min/max(block.position, block.size)`로 bounds 계산.
- 블록 **하나라도** position/size가 NaN이면 → bounds.width/height = NaN → scale = NaN →
  **모든** rect/line 좌표가 NaN. 그래서 소수 블록인데도 243건.
- => 미니맵이 NaN 한 개에 전체가 무너지는 것 자체가 버그. Phase 0에서 방어.

## NaN 근원 (미확정 — 라이브 재현 필요)
- 정상 경로는 깨끗함을 확인:
  - 툴바 `canvasCommands.addComponent('led'|'scope', pos)` → `getBlockSize` → XML Layout.
  - led=20×30, pilot_lamp=20×20, scope=50×40 모두 유효한 `<ms:Layout>` 보유.
  - `getViewportCenter`는 zoom`??`1, pan`??`0 → 유한값.
- 따라서 NaN 블록은 다른 경로에서 유입 추정:
  - 후보 A: 사용자 제작 custom_symbol("조명"?)이 Layout/dims 누락.
  - 후보 B: 역직렬화(저장본 로드) 시 position/size 손상.
  - 후보 C: Toolbox 클릭 배치(onSelectSymbol)의 placement 핸들러(OneCanvasPanel) — 미확인.
- 결정: Phase 1에서 앱 실행 후 실제 NaN 필드를 읽고(추측 금지, 글로벌 규칙 10) 근원 수정.

## 결정 사항
- D1: 미니맵 방어를 먼저(Phase 0) — 크래시 즉시 차단, 근원과 독립적으로 옳은 수정.
- D2: SymbolLibrary 삭제 전 custom_symbol 렌더 경로가 fallback 없이 동작하는지 반드시 확인.
- D3: 작업은 main에서 진행(프로젝트 규약 기본). wire 작업만 추후 워크트리.
- D4: 파서 `services/symbolXmlParser.ts`는 numAttr이 `Number()`로 NaN 가능 — size/dims 경계에 가드.
