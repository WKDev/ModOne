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

## Phase 3 — 리본 명령 재배치 (context-key 위에서, 리본 config 직접 재사용 = Option B)
- [ ] **에디터 로컬 툴바**: Ladder(Contacts/Logic/Edit), Canvas(Tools/View), Scenario(File/Execution/Data)
  - [ ] 각 에디터 패널 상단에 얇은 로컬 툴바 컴포넌트 추가 (commandId 재사용)
- [ ] **좌측 패널 헤더**: Modbus(TCP/RTU) → ModbusPanel, OPC UA(Start/Stop/Endpoint/Panel) → OpcUaUnifiedPanel
- [ ] **MenuBar(전역)**: file.new/open/save, layout.openSheetEditor, tools.openSheetEditorPopup
- [ ] 검증: 모든 commandId가 새 위치에서 정상 실행 (커맨드 라우팅은 그대로, UI 표면만 이동)

## Phase 4 — 전역 리본 제거
- [ ] `MainLayout.tsx`에서 `<Toolbar />` + Ribbon ErrorBoundary 제거
- [ ] `Toolbar.tsx` 및 `ribbon/config/*` 정리 (다른 참조 없으면 삭제)
- [ ] header 높이 회수로 세로 공간 확보 확인
- [ ] 검증: 빌드 통과, 모든 명령 접근 경로 유지, E2E(CDP) 스모크

## Phase 5 — 마무리
- [ ] `pnpm test` / 빌드 통과
- [ ] 시맨틱 커밋 분할 (zone 추가 / 도크 / tag-manager / 명령 재배치 / 리본 제거)
- [ ] context-notes.md 최종 결정사항 반영
