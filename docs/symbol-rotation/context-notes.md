# 심볼 회전 — 컨텍스트 노트

## 요구사항 (사용자)
- 심볼들을 0,0 기준으로 회전 가능하게.
- R 키로 회전.
- 기존 키보드 단축키와 연계.
- 설정에 넣을 것: 회전 방향, 1회 R 당 회전 각도, 방향.

## 해석 / 결정
- 사용자가 "회전 방향"과 "방향"을 둘 다 언급했는데 같은 개념(중복 표현)으로 판단.
  → 설정 2개로 정리: **회전 각도(step, 기본 90°)** + **회전 방향(cw/ccw, 기본 cw)**.
- "방향"을 살리는 의미로 **Shift+R = 역방향** 단축키를 추가(기존 단축키와 자연스럽게 연계).
- "0,0 기준 회전": 심볼 로컬 원점(컨테이너 좌상단 = 배치 앵커) 기준 회전.
  기존 구현은 **중심(center) 기준**이었음 → BlockRenderer에서 pivot을 (0,0)으로 변경.

## 기존 코드에 이미 있던 것 (탐색 결과)
- `BaseBlock.rotation?: number` 필드 존재 (blocks.ts:60).
- `canvasStore.rotateSelectedComponents(degrees)` 구현 존재 (canvasStore.ts:611), 단 facade에 미노출.
- 키보드 hook에 R 키 핸들러 + `rotateSelected()` 존재하나, `rotateSelectedComponents` 콜백이
  OneCanvasPanel에서 주입되지 않아 no-op 였음. 각도도 90° 하드코딩.
- BlockRenderer `_applyTransform`이 center pivot으로 회전 적용 중 (BlockRenderer.ts:600).

## 아키텍처 메모
- UI는 `useCanvasFacade(documentId)`만 사용. 직접 store 접근 금지.
  → 회전도 facade에 `rotateSelected`로 노출해야 함 (document 모드 + global adapter 양쪽).
- document 모드 회전은 flip 패턴을 그대로 따라 `rotateDocumentSelected` 구현
  (canvas/schematic 양쪽 updateData).
- TS `AppSettings` ↔ Rust `AppSettings` struct는 1:1 동기화 필수 (settings.ts 주석 명시).
  serde rename_all=camelCase. RotationDirection은 lowercase("cw"/"ccw").
- 회전 음수값 대응: canvasStore에서 `((cur+deg)%360+360)%360`로 정규화.

## 주의(미해결) — 회전과 히트테스트 불일치
- 회전은 `BlockRenderer._applyTransform`에서 symbolRoot의 시각 transform으로만 적용됨.
  `block.position`/`block.size`(선택 박스·히트영역 계산 기준)는 회전해도 바뀌지 않음.
- 따라서 0,0 기준 회전 시 **시각물은 원점 기준으로 돌지만 선택/클릭 영역은 원래 사각형에 남음**.
  (이는 기존 center 회전에서도 있던 한계지만, 0,0 회전은 이동 폭이 커서 더 두드러질 수 있음.)
- 완전한 히트영역 회전은 별도 작업(상호작용 레이어 전반 수정) → 이번 범위에서 제외.

## 작업 위치
- worktree: `.claude/worktrees/feat+symbol-rotation` (branch worktree-feat+symbol-rotation)
- 로컬 main(c730adc) 기준으로 reset 함 (origin/main은 뒤처져 있었음).
