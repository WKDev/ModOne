<!-- 리본 제거 + 우측 도크 재설계의 결정사항과 근거를 기록하는 노트 -->

# 리본 제거 + 우측 도크 — Context Notes

## 문제 정의 (왜)
앱이 사실상 4개 툴(Ladder / Canvas / Scenario / Symbol)을 한 셸에 담은 **IDE**다.
그런데 상단에 **Office식 리본**(5탭)을 얹어서 두 UI 패러다임이 충돌한다.

- 리본 탭(Canvas/Ladder/Scenario/...)이 **에디터 탭과 의미 중복** — 같은 모드 상태를 두 곳에서 관리.
- 좌측 ActivityBar와 **명령 표면 역할 중복**.
- 세로 공간 ~100px 소비, 정작 명령은 해당 에디터 안에 있는 게 더 가깝다.
- 인스펙터류(Memory/Tag/Properties)는 **보면서 동시에 편집**하는데 지금 하단(가로)이라 부적합.

→ 전역 리본 제거, 명령을 컨텍스트(에디터/좌패널/메뉴)로 분산, 인스펙터는 우측 세로 도크(1/4)로.

## 최종 셸 레이아웃 (목표)
```
┌──────────────────────────────────────────────┐
│ MenuBar (전역: New/Open/Save, Sheet Editor)   │  ← 리본 제거
├────┬──────────────────────────┬───────────────┤
│ Act│  [에디터 로컬 툴바]       │  우측 도크    │
│ Bar│  EditorArea (탭)         │  (inspector)  │
│ +  │                          │  Memory Viz   │
│좌패│                          │  Tag Manager  │
│널  ├──────────────────────────┤  Properties   │
│    │  하단 패널 (Console)     │   (1/4 폭)    │
├────┴──────────────────────────┴───────────────┤
│ StatusBar                                      │
└────────────────────────────────────────────────┘
```

## 리본 명령 → 목적지 매핑 (전수)

| 리본 탭 | 그룹 | 명령(commandId) | 목적지 |
|---|---|---|---|
| Canvas | Project | file.new / file.open / file.save | **MenuBar (전역)** |
| Canvas | Canvas | canvas.openSymbolEditor / addButton / addLed / addScope | **Canvas 로컬 툴바** |
| Canvas | View | canvas.zoomIn / zoomOut / toggleGrid / toggleSnap | **Canvas 로컬 툴바** |
| Ladder | Contacts | ladder.addContactNO/NC/P/N | **Ladder 로컬 툴바(팔레트)** |
| Ladder | Logic | ladder.addCoil / addCoilSet / addWireH / addWireV | **Ladder 로컬 툴바** |
| Ladder | Edit | ladder.cut/copy/paste/deleteSelected | **Ladder 로컬 툴바** (+키보드 단축키 유지) |
| Scenario | Scenario | scenario.new/open/save/saveAs | **Scenario 로컬 툴바** |
| Scenario | Execution | scenario.run/pause/resume/stop | **Scenario 로컬 툴바** (실행 컨트롤 — 최우선 노출) |
| Scenario | Data | scenario.importCsv / exportCsv | **Scenario 로컬 툴바** |
| Integration | Modbus | modbus.startTcp/stopTcp/startRtu/stopRtu | **좌측 ModbusPanel 헤더** (이미 존재) |
| Integration | OPC UA | opcua.startServer/stopServer/copyEndpoint/showPanel | **좌측 OpcUaUnifiedPanel 헤더** (이미 존재) |
| Layout | Editors | layout.openSheetEditor | **MenuBar (View)** |
| Layout | Tools | tools.openSheetEditorPopup | **MenuBar (View)** |

> 핵심: **commandId/커맨드 라우팅은 그대로 둔다. UI 표면(버튼 위치)만 옮긴다.** 리스크 최소화.

## 우측 도크 설계

### Zone 모델
- `PanelZone`에 `'inspector'` 추가 → `'editor' | 'tool' | 'inspector'`.
- 레지스트리 zone 변경:
  - `memory-visualizer`: tool → **inspector**
  - `properties`: tool → **inspector**
  - `console`: tool **유지** (로그는 가로가 길어야 함 → 하단)
  - `tag-manager`: **신규** (inspector)

### 신규 store/component
- `rightDockStore.ts` — `toolPanelStore` 패턴 미러: `{ isVisible, width, tabs, activeTabId, isResizing, toggle, setWidth, setActiveTab, initializeDefaultTabs }`.
  - 기본 width = `window.innerWidth * 0.25` (1/4). min ~240px, max ~ 절반.
- `RightDock.tsx` — `Sidebar`의 우측 버전. `ResizeHandle`은 좌측 엣지에 둠(왼쪽으로 드래그 시 넓어짐). `TabContent` 재사용.
- `MainLayout`의 `<main>` 옆(형제)으로 배치하거나, 현재 `flex-1 flex` 컨테이너 안에서 Sidebar ↔ main ↔ RightDock 3열.

### Tag Manager (신규) vs 기존 tag-browser
- 기존 `tag-browser`는 **에디터 탭(전체화면)** — 대량 편집/그리드용. 유지.
- 신규 `tag-manager`는 **인스펙터(경량)** — 현재 컨텍스트 태그 목록/검색/즐겨찾기/빠른 추가. 도크 상주.
- 둘은 역할이 다르므로 공존. (중복 아님)

## 확정된 결정 (사용자 합의)
- ✅ #1 우측 도크 **기본 펼침**, 1/4 폭 고정 시작 (min 240 / max 50% 리사이즈).
- ✅ #2 하단 패널(Console only) **기본 접힘**.
- ✅ #3 에디터 로컬 툴바는 **공용 `<EditorToolbar>` + 기존 리본 config 재사용** (Option B). config로 표현 못 하는 특수 컨트롤이 생기는 에디터만 개별(Option A) 처리.

## 명령 아키텍처: 레지스트리 SSOT + placement + context-key (합의)

### 배경 — 발견성 보전이 재설계의 성패
리본을 없애고 명령을 로컬 툴바·메뉴·패널 헤더로 분산하면 "그 버튼 어디 있더라"의 멘탈 맵이 깨진다.
분산 자체는 옳지만 **전역 폴백(커맨드 팔레트)**이 반드시 같이 있어야 한다.
다행히 `CommandPalette`/`commandRegistry`가 **이미 존재**한다 → 신설이 아니라 SSOT로 승격하는 작업.

### 현재 구조 = VS Code 기여(contribution) 모델과 이미 닮음
| VS Code 개념 | 역할 | ModOne 현재 |
|---|---|---|
| `commands` (+handler) | id → 실행 | ✅ `src/components/CommandPalette/commandRegistry.ts` |
| `menus` (group/when/order) | "이 명령을 어디 보여줄까" | △ `src/components/layout/ribbon/config/*` (commandId 참조) |
| `keybindings` (id+key+when) | 단축키 | ✅ `useGlobalShortcuts` / 키보드 설정 |
| `when` context keys | 공유 조건 어휘 | ❌ **빈 곳 (신설 대상)** |

> 결정적 사실: 리본 버튼이 이미 `commandRegistry.execute(commandId)`로 실행됨 (`Toolbar.tsx:23`).
> **실행 라우팅은 이미 레지스트리로 단일화돼 있다.** 리본 config는 사실상 `menus` 기여 역할.

### 풀어야 할 구조적 빚 2개
1. **표시 메타데이터 이중화 (drift 위험)** — label/icon이 리본 config와 Command 등록 양쪽에 존재.
   → **Command를 label/icon/enablement의 SSOT로 못 박고**, 배치(placement)는 순수하게
   `{ commandId, group, order, when }`만 보유. 표시는 commandId로 레지스트리에서 해석.
2. **조건 어휘가 두 갈래 (핵심 구조물)** — 리본은 `RibbonContext` 구조체로 disabled/active 판단
   (`resolveRibbon.ts`), Command는 `when()` 임의 클로저로 판단. 같은 "쓸 수 있나?"를 두 언어로 중복.
   → **context-key 스토어 하나** 신설 (`activeEditor`, `hasSelection`, `scenario.running` 등 반응형 키).
   팔레트·로컬 툴바·단축키가 전부 같은 키를 읽음 → 일관성이 자동으로 따라옴.

### 효과 — 도크 재설계가 "새 surface 추가"로 환원
SSOT가 서면 Phase 3(명령 재배치)이 신규 로직이 아니라 배치 질의로 끝남.
```
getPlacements('ladder.toolbar') → [commandId...] → Command 해석 → 렌더
getPlacements('menubar.file')   → 동일
getPlacements('panel.modbus')   → 동일
CommandPalette                  → registry 전체
```
로컬 툴바·메뉴바·패널 헤더·팔레트 = 같은 레지스트리의 다른 투영(projection). 명령 로직 증가 0.

### YAGNI 선 — 플러그인 호스트는 짓지 않는다
`register`/`unregister`가 이미 있어 "플러그인이 명령+배치+context-key를 기여"하는 **데이터 모델**은
공짜로 따라온다. 하지만 실제 플러그인 로딩/샌드박스/API 표면은 지금 불필요.
**지을 것은 contribution 데이터 구조뿐** (도크 재설계 때문에 어차피 필요). 플러그인 적재는 나중에 얇게.

## 결정 로그
- (작성 시점) 패러다임 충돌이 근본 원인. 리본을 "삭제"가 아니라 "명령 재배치 후 제거"로 단계화하여 기능 손실 0 보장.
- console는 하단 유지, 인스펙터(memory/tag/properties)만 우측 이동.
- 발견성 보전을 위해 커맨드 팔레트를 1순위 폴백으로 채택 (이미 존재 → SSOT 승격).
- 명령 아키텍처를 레지스트리 SSOT + placement(=menus) + context-key(=when)로 정규화. 플러그인 호스트는 보류(YAGNI).
