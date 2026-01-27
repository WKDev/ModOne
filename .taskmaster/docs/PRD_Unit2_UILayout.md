# PRD Unit 2: UI 레이아웃 시스템

## 개요
VSCode 스타일의 유연한 패널 기반 레이아웃 시스템을 구현합니다.

---

## 디자인 레퍼런스
- **VSCode**: 패널 레이아웃, 탭 시스템
- **GxWorks3**: PLC 프로그래밍 UI
- **XG5000**: LS PLC 개발 환경

---

## 메인 윈도우 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Menu Bar                                                    │
├─────────────────────────────────────────────────────────────┤
│  Toolbar                                                     │
├─────┬───────────────────────────────────────────────────────┤
│     │                                                        │
│  S  │  Main Content Area (Grid-based Panels)                │
│  i  │  ┌─────────────────┬─────────────────────────────────┤
│  d  │  │                 │                                  │
│  e  │  │  Panel 1        │  Panel 2                        │
│  b  │  │  (Ladder View)  │  (Memory Visualizer)            │
│  a  │  │                 │                                  │
│  r  │  ├─────────────────┴─────────────────────────────────┤
│     │  │                                                    │
│     │  │  Panel 3 (OneCanvas / Scenario Editor)            │
│     │  │                                                    │
├─────┴──┴────────────────────────────────────────────────────┤
│  Status Bar                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트 명세

### 1. 메뉴 바 (Menu Bar)
```
File    Edit    View    Simulation    Modbus    Help
```

**File 메뉴:**
- New Project (Ctrl+N)
- Open Project (Ctrl+O)
- Save (Ctrl+S)
- Save As (Ctrl+Shift+S)
- Recent Projects →
- Exit

**Edit 메뉴:**
- Undo (Ctrl+Z)
- Redo (Ctrl+Y)
- Cut/Copy/Paste
- Preferences

**View 메뉴:**
- Toggle Sidebar
- Toggle Panel → (Memory/Canvas/Scenario/Ladder)
- Reset Layout
- Zoom In/Out

**Simulation 메뉴:**
- Start (F5)
- Stop (Shift+F5)
- Pause (F6)
- Step (F10)
- Reset

**Modbus 메뉴:**
- Server Settings
- Start Server
- Stop Server
- Connection Status

### 2. 툴바 (Toolbar)
아이콘 버튼 그룹:
- 프로젝트: New, Open, Save
- 시뮬레이션: Play, Pause, Stop, Step
- 보기: 패널 토글 버튼들

### 3. 사이드바 (Sidebar)
VSCode Activity Bar 스타일:
- **Explorer**: 프로젝트 파일 트리
- **Search**: 전역 검색
- **Modbus**: 서버 상태/설정
- **Settings**: 앱 설정

### 4. 패널 시스템

#### 패널 타입
```typescript
type PanelType =
  | 'ladder-editor'      // 래더 편집기
  | 'memory-visualizer'  // 메모리 뷰어
  | 'one-canvas'         // 회로 캔버스
  | 'scenario-editor'    // 시나리오 편집기
  | 'console'            // 로그 콘솔
  | 'properties';        // 속성 패널
```

#### 패널 컴포넌트 구조
```typescript
interface PanelProps {
  id: string;
  type: PanelType;
  title: string;
  isActive: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}
```

#### 그리드 레이아웃
- CSS Grid 기반
- 드래그로 영역 크기 조절
- 패널 드래그 앤 드롭 재배치

### 5. 탭 시스템
각 패널 영역 내 탭:
- 드래그로 탭 순서 변경
- 탭 드래그로 패널 분리/병합
- 닫기 버튼 (수정됨 표시: 점)

### 6. 상태 바 (Status Bar)
```
[Simulation: Running] [Scan: 10ms] [Modbus: TCP:502 Connected] [Memory: 45% Used]
```

---

## 레이아웃 프리셋

### Default Layout
```typescript
const defaultLayout: LayoutConfig = {
  grid: {
    columns: ['1fr', '1fr'],
    rows: ['1fr', '1fr'],
  },
  panels: [
    { area: '1 / 1 / 2 / 2', type: 'ladder-editor' },
    { area: '1 / 2 / 2 / 3', type: 'memory-visualizer' },
    { area: '2 / 1 / 3 / 3', type: 'one-canvas' },
  ],
};
```

### Compact Layout (단일 모니터)
```typescript
const compactLayout: LayoutConfig = {
  grid: {
    columns: ['1fr'],
    rows: ['1fr'],
  },
  panels: [
    { area: '1 / 1 / 2 / 2', tabs: ['ladder-editor', 'memory-visualizer', 'one-canvas'] },
  ],
};
```

---

## 설정 화면

### 일반 설정
- 테마: Light / Dark / System
- 언어: 한국어 / English / 日本語
- 자동 저장 간격
- 시작 시 마지막 프로젝트 열기

### 시뮬레이션 설정
- 기본 스캔 타임
- 타이머 정밀도
- 시뮬레이션 속도 배율

### Modbus 설정
- 기본 TCP 포트
- RTU 시리얼 설정
- 타임아웃 설정

### 외관 설정
- 폰트 크기
- 그리드 표시
- 애니메이션 켜기/끄기

---

## 상태 관리

### 레이아웃 상태
```typescript
interface LayoutState {
  sidebarVisible: boolean;
  sidebarWidth: number;
  activePanel: string | null;
  panels: PanelState[];
  gridConfig: GridConfig;
}

const useLayoutStore = create<LayoutState>((set) => ({
  sidebarVisible: true,
  sidebarWidth: 250,
  // ...
}));
```

### 설정 상태
```typescript
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSaveInterval: number;
  // ...
}
```

---

## 단축키

| 동작 | 단축키 |
|------|--------|
| 새 프로젝트 | Ctrl+N |
| 열기 | Ctrl+O |
| 저장 | Ctrl+S |
| 시뮬레이션 시작 | F5 |
| 시뮬레이션 중지 | Shift+F5 |
| 사이드바 토글 | Ctrl+B |
| 설정 | Ctrl+, |
| 명령 팔레트 | Ctrl+Shift+P |

---

## 구현 컴포넌트

```
src/components/
├── layout/
│   ├── MainLayout.tsx
│   ├── MenuBar.tsx
│   ├── Toolbar.tsx
│   ├── Sidebar.tsx
│   ├── StatusBar.tsx
│   ├── PanelContainer.tsx
│   ├── Panel.tsx
│   ├── TabBar.tsx
│   └── ResizeHandle.tsx
├── settings/
│   ├── SettingsDialog.tsx
│   ├── GeneralSettings.tsx
│   ├── SimulationSettings.tsx
│   └── ModbusSettings.tsx
└── common/
    ├── Icon.tsx
    ├── Button.tsx
    └── Tooltip.tsx
```

---

## 테스트 기준

### Unit Tests
- [ ] 패널 상태 관리 로직
- [ ] 레이아웃 직렬화/역직렬화
- [ ] 단축키 바인딩

### Integration Tests
- [ ] 패널 드래그 앤 드롭
- [ ] 레이아웃 저장/복원
- [ ] 설정 변경 반영

### E2E Tests
- [ ] 레이아웃 커스터마이징 플로우
- [ ] 설정 변경 및 재시작 후 유지
- [ ] 반응형 레이아웃 (창 크기 변경)

---

## 의존성
- Unit 1: 프로젝트 기반 구조 (레이아웃 설정 저장)

## 차단 항목
- Unit 4: Memory Visualizer (패널로 표시)
- Unit 5: OneCanvas (패널로 표시)
- Unit 6: Scenario Editor (패널로 표시)

---

## 구현 우선순위
1. 기본 레이아웃 구조 (Menu, Toolbar, StatusBar)
2. 패널 시스템 (드래그 없이)
3. 탭 시스템
4. 사이드바
5. 패널 리사이즈
6. 패널 드래그 앤 드롭
7. 설정 화면
8. 단축키 시스템
