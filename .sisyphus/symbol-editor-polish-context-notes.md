# Symbol Editor Polish — Context Notes

## 현황 파악 (탐색 결과)
- 심볼 저장 백엔드는 **이미 완비**됨:
  - `PropertiesPanel`의 "Save Symbol" 버튼 → `symbolService.saveSymbol(projectDir, symbol, 'project')`
    → Tauri `symbol_save` → `storage::save_symbol` → `{project_dir}/symbols/{id}.json` (pretty JSON).
  - global scope는 APPDATA/ModOne/symbols/.
  - `symbolStore.saveSymbol`은 저장 후 해당 scope 리스트 갱신 → Toolbox(useSymbolLibrary) 반영.
- 그러나 **헤더의 Save 버튼은 dead**: `SymbolEditorPanel`이 `onSave`를 안 넘겨서 `onSave?.()`가 no-op.
  사용자가 "라이브러리 저장 기능이 없다"고 느낀 원인으로 추정.

## 결정 사항 (decisions)
1. **헤더 Save = 권위 있는 "Save to Library"**로 만든다. scope 선택(Project 기본/Global) + 검증 + toast + 라이브러리 새로고침.
   - 구현은 PropertiesPanel과 동일하게 `symbolService.saveSymbol` 직접 호출(에러 시 자체 toast+throw) 후
     `useSymbolStore.getState().loadLibrary(projectDir)`로 Toolbox 갱신, `dispatch(MARK_CLEAN)`.
   - 하위호환: 기존 `onSave?.(localSymbol)`도 계속 호출.
   - PropertiesPanel의 기존 Save 버튼은 e2e(`save-symbol-btn`)가 의존하므로 **유지**.
2. **Preview의 powered-pin 시뮬레이션은 구현하지 않는다.** 플랜 가드레일 `❌ 시뮬레이션 로직 구현 금지`.
   미사용 `previewPoweredPorts`/`void`는 제거하고 Preview는 정직한 static preview(편집 핸들 숨김 + visual state 순회)로 유지.
3. **TextTool**: `window.prompt`는 Tauri WebView2에서 신뢰 불가/블로킹. PinTool/PinConfigPopover 패턴을 그대로 미러링한
   `TextInputPopover` + `onOpenTextPopover` 콜백으로 교체.
4. **Polyline closed**: 데이터 모델 `PolylinePrimitive.closed`는 있으나 UI 없음. ShapeInspector에 체크박스 추가.
   업데이트 경로는 기존 `handleUpdatePrimitive`(useSymbolGeometry)를 PropertiesPanel→ShapeInspector로 thread.
5. **onAddPin** prop: 선언만 되고 destructure/사용 안 됨 → 오해 유발 dead prop. 편집 중인 파일이므로 제거.
6. **PortListPanel**: 자기 참조 외 0 → 고아. 전역 CLAUDE 규칙(사전 존재 dead code는 삭제 말고 보고)에 따라 보고만.

## 패턴 참조
- Pin 추가 흐름: `PinTool.setLastScreen` + `onMouseDown`→`onOpenPinPopover(sx,sy,cx,cy)`;
  `SymbolEditor`가 `pinPopover` state로 popover 띄우고 onConfirm에서 `handleAddPin(pin)`.
  → TextTool도 동일 구조로 미러링.
- 좌표: host의 `runToolDown(point, clientX, clientY)`에서 PinTool 특수처리 → TextTool도 추가.

## 검증 기준
- baseline: `npx vitest run src/components/SymbolEditor src/__tests__/symbol-validation.test.ts` = 138 pass.
- 변경 후 동일 그린 + `pnpm build` 타입 0.
