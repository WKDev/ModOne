# Symbol Editor 완전무결 + 라이브러리 저장 — Checklist

## 핵심 (사용자 명시 요청)
- [x] **헤더 "Save to Library" 기능**: 심볼을 프로젝트 폴더 라이브러리에 저장 (scope 선택: Project/Global)
  - [x] 헤더 Save 버튼이 실제 저장 동작 (기존 dead — onSave 미전달 → 직접 저장으로 교체)
  - [x] 저장 전 validateSymbol 검증, 에러 시 toast
  - [x] 저장 후 loadLibrary 새로고침 → Toolbox에 즉시 노출
  - [x] 성공/실패 toast

## 기존 기능 정상화 (완전무결)
- [x] **TextTool**: window.prompt → 인앱 TextInputPopover (WebView2에서 prompt 신뢰 불가)
- [x] **Polyline `closed` 토글**: ShapeInspector에 체크박스 추가 (렌더러는 이미 closePath 지원)
- [x] **Dead code 정리**: SymbolEditorHost `onAddPin` 미사용 prop 제거
- [x] **Preview**: 미사용 `previewPoweredPorts` 스캐폴딩 제거 (시뮬레이션은 프로젝트 가드레일상 금지 → static preview로 정직하게 유지)

## 검증
- [x] `npx vitest run` 전체 그린 (1722 pass / 0 fail, 241 skip)
- [x] `npx tsc --noEmit` 타입 에러 0
- [ ] 실제 앱에서 저장→Toolbox 노출 수동 확인 (사용자 환경 필요)

## 보고만 (삭제 안 함 — pre-existing dead code)
- [ ] PortListPanel.tsx: 자기 자신 외 참조 0 → 고아 코드. 사용자에게 보고.
