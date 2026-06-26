# 심볼 회전 기능 체크리스트

R 키로 선택된 심볼을 0,0(심볼 원점) 기준으로 회전. 회전 각도/방향은 설정에서 조정.

## 설정 (TS ↔ Rust 동기화 필수)
- [x] `src/types/settings.ts` — `RotationDirection` 타입 + `symbolRotationStep`, `symbolRotationDirection` 필드 + 기본값
- [x] `src-tauri/src/commands/settings.rs` — `RotationDirection` enum + 필드(serde default) + `Default` impl + 테스트

## 회전 로직
- [x] `src/components/OneCanvas/utils/canvas-commands.ts` — `rotateComponents` 순수 함수 추가
- [x] `src/stores/canvasStore.ts` — 회전값 0..359 정규화(음수 방향 대응)
- [x] `src/types/canvasFacade.ts` — `rotateSelected(degrees)` 인터페이스 추가
- [x] `src/stores/adapters/globalCanvasAdapter.ts` — `rotateSelected` 노출
- [x] `src/hooks/useCanvasFacade.ts` — `rotateDocumentSelected` 구현 + 두 return 객체에 추가

## 키보드 단축키
- [x] `src/components/OneCanvas/hooks/useCanvasKeyboardShortcuts.ts` — 설정값(step/direction)으로 부호 있는 각도 계산, Shift+R = 역방향
- [x] `src/components/panels/content/OneCanvasPanel.tsx` — 설정 읽어서 hook에 `rotateSelectedComponents` + step + direction 주입

## 렌더링 (0,0 기준 회전)
- [x] `src/components/OneCanvas/renderers/BlockRenderer.ts` — pivot을 중심(center)→원점(0,0)으로 변경

## 설정 UI
- [x] `src/components/settings/CanvasSettings.tsx` — 회전 각도/방향 패널 신규
- [x] `src/components/settings/SettingsDialog.tsx` — '캔버스' 카테고리 추가

## 검증
- [x] `pnpm tsc` 타입체크 통과 (EXIT 0)
- [x] vitest: interactionMode + canvas-commands(회전 신규 2건 포함) 전부 통과
- [~] Rust: **컴파일 성공**(15m53s, 신규 enum/필드/테스트 포함). 단, lib 테스트 실행 바이너리가
      `STATUS_ENTRYPOINT_NOT_FOUND(0xc0000139)`로 기동 실패 → 환경 DLL 문제(모든 lib 테스트 공통,
      내 변경과 무관). serde 패턴은 기존 통과 enum(Theme/Parity)과 동일.
- [ ] (가능하면) 실제 앱에서 심볼 선택 후 R 회전 동작 확인 — 미수행(수동)
