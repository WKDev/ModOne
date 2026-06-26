<!-- 리본 제거 + 우측 인스펙터 도크 신설 작업의 단계별 체크리스트 -->

# 리본 제거 + 우측 도크 신설 — Checklist

> 상태: **설계 합의 대기** (구현 시작 전)
> 합의되면 Phase 1부터 체크하며 진행.

## Phase 0 — 설계 합의 (현재)
- [x] 현재 UI 셸 구조 파악 (MainLayout / Toolbar / Sidebar / ToolPanel / panelRegistry)
- [x] 리본 5개 탭 명령 전수 조사
- [x] 리본 명령 → 목적지 매핑 표 작성 (context-notes.md)
- [x] 우측 도크 패널 레지스트리 설계 (context-notes.md)
- [ ] **사용자 합의** (이 문서 + context-notes 검토 후 GO)

## Phase 1 — 우측 인스펙터 도크 신설 (리본은 일단 유지) — ✅ 워크트리 `feat/right-dock` 커밋 `6f60ec5`
- [x] `PanelZone`에 `'inspector'` 추가 (`src/types/panel.ts`) + `getInspectorPanelTypes()`
- [x] `src/stores/rightDockStore.ts` 신설 (width/isVisible/tabs/activeTab/resize — toolPanelStore 패턴 미러, width/visibility persist)
  - [x] 기본 width = 뷰포트의 25% (1/4), min 240 / max 50% 클램프
- [x] `src/components/layout/RightDock.tsx` 신설 (좌측 엣지 ResizeHandle 재사용, 탭 구조)
- [x] `MainLayout.tsx`에 `<RightDock />` 배치 (Sidebar | main | RightDock 3열)
- [x] `memory-visualizer`, `properties` zone을 `tool` → `inspector`로 이동
- [x] 곁들임: 하단 패널 기본 접힘(toolPanelStore), `useFileOpen` inspector 라우팅, `view.toggleRightPanel`(Ctrl+Alt+B) 연결
- [x] 검증: `tsc --noEmit` 통과, `vitest run` 1684 passed / 0 failed
- [x] 검증(시각): 브라우저 런타임(`pnpm dev` + Playwright)으로 확인 — 우측 도크 widthRatio=**0.25**, 탭=[Memory Visualizer, Tags, Properties], 하단 패널 접힘. (커밋 `a9fed6d`에서 DEFAULT_LAYOUT 접힘 수정)

## Phase 2 — Tag Manager (신규 인스펙터 패널) — ✅ 커밋 `df58f62`
- [x] `tag-manager` PanelType 추가 + 레지스트리 등록 (zone: inspector, label "Tags")
- [x] `TagManagerPanel.tsx` 신설 (경량 — 검색/watched-only 필터/행별 star watch+라이브값/인라인 빠른추가; 전체화면 `tag-browser`와 역할 구분)
  - [x] `tagManager/TagManagerRow.tsx` (이름·주소·값·star), `tagManager/QuickAddTagForm.tsx` (name/area/index)
  - [x] 기존 `useTagStore`/`useTagSearch` 재사용 (도메인 로직 신규 0)
- [x] 우측 도크 기본 탭에 포함 (inspector zone → `INSPECTOR_PANEL_TYPES` 자동)
- [x] 검증: `tsc --noEmit` 통과, `vitest run` 1684 passed / 0 failed
- [x] 검증(시각): Tags 탭 렌더 확인 (빈 레지스트리 → 검색바/"No tags"/0 tags 정상 표시). 추가/watch 동작은 백엔드 있는 환경에서 후속 확인.

## Phase 1.5 — 명령 아키텍처 정규화 (A·B 완료, placement는 YAGNI로 보류)
> 목적: 리본 제거로 잃는 발견성을 커맨드 팔레트로 메우고, enablement 어휘를 단일화.
- [x] **커맨드 팔레트 전역 노출** — 커밋 `56b043c`. Ctrl+Shift+P(기존) + MenuBar(View) "Command Palette…" 진입점. 전역 `commandPaletteStore`로 외부 진입점 가능.
- [x] **context-key 스토어 신설** — 커밋 `6ec81bd`. `activeEditorType` / `simulationStatus` / `scenarioStatus` / `modbusTcpRunning` / `opcuaRunning` 반응형 키. `useContextKeySync`가 소스 store→키 미러(소스가 SSOT). Toolbar가 `RibbonContext`를 이 스토어에서 조립 → 어휘 통일.
  - `hasSelection`은 소비자(Phase 3 ladder edit enablement) 생길 때 추가 — 현재 미사용이라 YAGNI로 제외.
- [x] 검증: `tsc --noEmit` 통과, `vitest run` 1684 passed / 0 failed
- [~] **placement 모델 / `getPlacements`** — **보류 결정**(사용자 합의). 리본 config가 이미 placement 데이터이고 Phase 3는 그걸 `<EditorToolbar>`로 직접 재사용(Option B)하므로 별도 추상이 도크 재설계에 불필요. 여러 surface 통합이 실제로 필요해질 때 얇게 도입.
  - label/icon 이중화(Command↔config) drift는 사소·기존 이슈로 수용. 필요 시 `Command.enabled()`만 나중에 추가.

## Phase 3 — 리본 명령 "갭 메우기" (커밋 `1653249`) — ⚠️ 범위 재정의
> **커버리지 감사 결과 Option B(EditorToolbar 신설) 불필요**: 에디터들이 이미 자체 로컬 툴바 보유
> (LadderToolbox/Toolbar, ScenarioToolbar, CanvasToolbar) + 사이드바 패널(ModbusPanel, OpcUaUnifiedPanel)
> + 커맨드 팔레트. 리본 명령 대부분이 **이미 다른 곳에 존재**. 신규 툴바를 만들면 3중 중복 →
> Phase 3는 "집 없는 명령만 메우기"로 축소.
- [x] **커버리지 감사** — 리본 5탭 전 명령 vs 네이티브 UI 매핑. 결과:
  - 완전 중복(손댈 것 없음): Ladder(12) / Scenario(10) / Modbus(4) / OPC UA start·stop·endpoint / Canvas zoom·grid·snap / file.new·open·save → 이미 네이티브 툴바·패널·팔레트
  - **갭(집 없음) 2건만 처리**:
    - [x] Canvas Symbol/Button/LED/Scope → `CanvasToolbar`에 Blocks 그룹 추가 (commandId 재사용)
    - [x] Sheet Editor / Sheet Editor (Popup) → MenuBar View 항목 추가
- [x] 검증: `tsc` + `vitest` 1684 통과. View 메뉴 Sheet Editor 항목 시각 확인.
  - [ ] Canvas Blocks 버튼 라이브 렌더 확인은 **보류** — 브라우저 런타임이 프로젝트 생성(네이티브 폴더 다이얼로그)을 못 해 캔버스를 못 띄움. 실제 Tauri 앱에서 후속 확인. (코드/타입/패턴은 검증됨)

## Phase 4 — 전역 리본 제거 — ✅ 커밋 `4fbfb79` (634줄 삭제)
- [x] `MainLayout.tsx`에서 `<Toolbar />` + Ribbon ErrorBoundary 제거 (header = MenuBar만)
- [x] `Toolbar.tsx` 및 `ribbon/` 전체 디렉터리 삭제 (config/registry/resolve/icons/types — 잔여 참조 0)
  - barrel `layout/index.ts`의 Toolbar export 제거. e2e `selectors.ts`의 toolbar/toolbarBtn은 고아지만 무해(스펙 미사용) → 남김.
- [x] header 높이 회수: 시각 검증 `HEADER_H=32`(메뉴바만, 리본 ~100px 회수)
- [x] 검증: `tsc` + `vitest`(1684) + `vite build` 통과. 시각: 리본 요소 0개(`RIBBON_ROOT=0/RIBBON_TABS=0`), 우측 도크 유지.

## Phase 5 — 마무리
- [x] `pnpm test`(vitest 1684) / `vite build` 통과
- [x] 시맨틱 커밋 분할: 도크 `6f60ec5` / tag-manager `df58f62` / 팔레트 `56b043c` / context-key `6ec81bd` / 하단접힘 `a9fed6d` / 갭메우기 `1653249` / 리본제거 `4fbfb79`
- [x] context-notes.md 결정사항 반영 (placement 보류, Phase 3 재정의)
- [ ] (후속) 실제 Tauri 앱에서 Canvas Blocks 버튼 + 리본 부재 최종 육안 확인
- [ ] (후속) `feat/right-dock` → main 머지
