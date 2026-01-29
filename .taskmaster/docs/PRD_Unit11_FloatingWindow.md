# PRD Unit 11: Floating Window 시스템

## 개요
패널을 메인 윈도우 밖으로 드래그하여 독립적인 Floating Window로 분리하고, 다시 메인 윈도우로 병합할 수 있는 멀티 윈도우 시스템을 구현합니다.

---

## 디자인 레퍼런스
- **VSCode**: 에디터 탭을 별도 윈도우로 분리
- **Chrome DevTools**: 패널을 독립 윈도우로 분리 (Undock)
- **Adobe Photoshop**: 패널을 드래그하여 Floating 상태로 전환

---

## 기능 요구사항

### 핵심 기능

#### 1. 패널 → Floating Window 분리
- 패널을 메인 윈도우 영역 밖으로 드래그하면 Floating Window로 분리
- 또는 패널 헤더의 "Undock" 버튼 클릭으로 분리
- 분리된 윈도우는 독립적으로 이동/리사이즈 가능

#### 2. Floating Window → 메인 윈도우 병합
- Floating Window를 메인 윈도우로 드래그하면 기존 Docking 시스템으로 병합
- 또는 Floating Window 헤더의 "Dock" 버튼 클릭으로 병합
- 병합 시 기존 분할/탭 병합 로직 동일 적용

#### 3. Floating Window 독립 동작
- 독립적인 이동, 리사이즈, 최소화, 최대화
- 메인 윈도우와 동일한 패널 컨텐츠 렌더링
- 메인 윈도우 최소화 시에도 Floating Window 유지

---

## 시스템 아키텍처

### 윈도우 상태 흐름
```
┌─────────────────────────────────────────────────────────────┐
│                     Main Window                             │
│  ┌─────────────┬─────────────┐                             │
│  │   Panel A   │   Panel B   │  ← Grid 기반 Docking        │
│  ├─────────────┴─────────────┤                             │
│  │         Panel C           │                             │
│  └───────────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
           │                              ▲
           │ Drag outside                 │ Drag inside
           │ or Undock button             │ or Dock button
           ▼                              │
┌─────────────────────┐    ┌─────────────────────┐
│  Floating Window 1  │    │  Floating Window 2  │
│  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │    Panel A    │  │    │  │    Panel D    │  │
│  └───────────────┘  │    │  └───────────────┘  │
└─────────────────────┘    └─────────────────────┘
```

### 상태 관리 구조
```typescript
interface PanelState {
  id: string;
  type: PanelType;
  title: string;
  // 기존 Grid 관련
  gridArea?: string;
  // 새로운 Floating 관련
  windowId?: string | null;      // null = main window, string = floating window ID
  isFloating: boolean;
  floatingBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 탭 관련 (기존 유지)
  tabs?: TabState[];
  activeTabId?: string | null;
}

interface FloatingWindowState {
  windowId: string;
  panelId: string;
  bounds: { x: number; y: number; width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
}

interface WindowRegistryState {
  floatingWindows: Map<string, FloatingWindowState>;
  focusedWindowId: string | null;
}
```

---

## 구현 명세

### Phase 1: Tauri Backend - 윈도우 관리

#### 1.1 Tauri 설정 업데이트
```json
// tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "ModOne",
        // ... 기존 설정
      }
    ],
    "security": {
      "dangerousDisableAssetCspModification": true
    }
  }
}
```

#### 1.2 윈도우 명령어 모듈
```rust
// src-tauri/src/commands/window.rs

#[tauri::command]
pub async fn create_floating_window(
    app: AppHandle,
    panel_id: String,
    panel_type: String,
    bounds: WindowBounds,
) -> Result<String, String>;

#[tauri::command]
pub async fn close_floating_window(
    app: AppHandle,
    window_id: String,
) -> Result<(), String>;

#[tauri::command]
pub async fn update_floating_window_bounds(
    app: AppHandle,
    window_id: String,
    bounds: WindowBounds,
) -> Result<(), String>;

#[tauri::command]
pub async fn focus_floating_window(
    app: AppHandle,
    window_id: String,
) -> Result<(), String>;

#[tauri::command]
pub async fn list_floating_windows(
    app: AppHandle,
) -> Result<Vec<FloatingWindowInfo>, String>;
```

#### 1.3 윈도우 이벤트 핸들링
```rust
// 윈도우 이벤트 발신
app.emit_all("floating-window-created", &window_id)?;
app.emit_all("floating-window-closed", &window_id)?;
app.emit_all("floating-window-moved", &(window_id, bounds))?;
app.emit_all("floating-window-resized", &(window_id, bounds))?;
app.emit_all("floating-window-focused", &window_id)?;
```

### Phase 2: Frontend - 상태 관리 확장

#### 2.1 windowStore 추가
```typescript
// src/stores/windowStore.ts
interface WindowStore {
  floatingWindows: Map<string, FloatingWindowState>;
  focusedWindowId: string | null;

  // Actions
  registerFloatingWindow: (windowId: string, panelId: string, bounds: Bounds) => void;
  unregisterFloatingWindow: (windowId: string) => void;
  updateWindowBounds: (windowId: string, bounds: Bounds) => void;
  setFocusedWindow: (windowId: string | null) => void;
}
```

#### 2.2 panelStore 확장
```typescript
// 기존 panelStore에 추가
interface PanelStoreActions {
  // ... 기존 액션들

  // Floating 관련 액션
  undockPanel: (panelId: string) => Promise<string | null>;  // returns windowId
  dockPanel: (panelId: string, targetPanelId: string, dropPosition: DropPosition) => Promise<boolean>;
  updatePanelFloatingBounds: (panelId: string, bounds: Bounds) => void;
}
```

### Phase 3: Frontend - 드래그 감지 및 윈도우 생성

#### 3.1 메인 윈도우 경계 감지
```typescript
// src/hooks/useWindowBoundaryDetection.ts
function useWindowBoundaryDetection() {
  const checkOutsideMainWindow = (clientX: number, clientY: number): boolean => {
    // Tauri window bounds 확인
    // 마우스 위치가 메인 윈도우 밖인지 체크
  };

  return { checkOutsideMainWindow };
}
```

#### 3.2 PanelDndProvider 확장
```typescript
// 드래그 종료 시 윈도우 경계 체크
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active } = event;
  const pointerPosition = getPointerPosition(event);

  if (isOutsideMainWindow(pointerPosition)) {
    // Floating Window 생성
    undockPanel(active.id, pointerPosition);
  } else if (isOverMainWindow && dropTarget) {
    // 기존 Docking 로직
    // ...
  }
}, []);
```

### Phase 4: Floating Window 컴포넌트

#### 4.1 FloatingWindowRenderer
```typescript
// src/components/floating/FloatingWindowRenderer.tsx
// 메인 앱에서 floating window entry point 렌더링
function FloatingWindowRenderer() {
  const { floatingWindows } = useWindowStore();

  // Tauri 이벤트 리스너 등록
  useEffect(() => {
    const unlisten = listen('floating-window-created', (event) => {
      // 새 윈도우 등록
    });
    return () => unlisten.then(fn => fn());
  }, []);

  return null; // 실제 렌더링은 각 Tauri window에서
}
```

#### 4.2 FloatingWindowContent
```typescript
// src/components/floating/FloatingWindowContent.tsx
// 각 floating window에서 렌더링되는 컨텐츠
function FloatingWindowContent({ windowId, panelId }: Props) {
  const panel = usePanelStore(state => state.panels.find(p => p.id === panelId));

  return (
    <div className="floating-window-container">
      <FloatingWindowHeader
        title={panel.title}
        onDock={() => dockPanel(panelId)}
        onClose={() => closeFloatingWindow(windowId)}
      />
      <PanelContent type={panel.type} />
    </div>
  );
}
```

### Phase 5: 레이아웃 저장/복원

#### 5.1 LayoutConfig 확장
```typescript
interface LayoutConfig {
  name: string;
  grid: GridConfig;
  panels: PanelLayoutConfig[];
  sidebar: SidebarLayoutConfig;
  // 새로 추가
  floatingWindows: FloatingWindowLayoutConfig[];
}

interface FloatingWindowLayoutConfig {
  panelId: string;
  panelType: PanelType;
  bounds: { x: number; y: number; width: number; height: number };
}
```

#### 5.2 레이아웃 복원 로직
```typescript
async function restoreLayout(config: LayoutConfig) {
  // 1. Grid 패널 복원
  restoreGridPanels(config.panels);

  // 2. Floating 윈도우 복원
  for (const floatingConfig of config.floatingWindows) {
    await createFloatingWindow(
      floatingConfig.panelId,
      floatingConfig.panelType,
      floatingConfig.bounds
    );
  }
}
```

---

## UI/UX 명세

### Undock 버튼
패널 헤더에 Undock 아이콘 버튼 추가:
```
┌────────────────────────────────────────────┐
│ ⠿ Panel Title          [↗] [−] [□] [×]    │
└────────────────────────────────────────────┘
                          ↑
                       Undock 버튼
```

### Floating Window 헤더
```
┌────────────────────────────────────────────┐
│ Panel Title              [↙] [−] [□] [×]  │
├────────────────────────────────────────────┤
│                                            │
│            Panel Content                   │
│                                            │
└────────────────────────────────────────────┘
                            ↑
                         Dock 버튼
```

### 드래그 시각적 피드백
- 메인 윈도우 밖으로 드래그 시: 반투명 윈도우 프리뷰 표시
- 메인 윈도우로 다시 드래그 시: 기존 Drop Zone 하이라이트

---

## 기술 스택

### Backend (Tauri)
- `tauri::window::WindowBuilder` - 동적 윈도우 생성
- `tauri::Manager` - 윈도우 관리
- `tauri::Event` - 윈도우 이벤트

### Frontend (React)
- `@tauri-apps/api/window` - 윈도우 API
- `@tauri-apps/api/event` - 이벤트 리스너
- `zustand` - 상태 관리 (기존)
- `@dnd-kit/core` - 드래그앤드롭 (기존)

---

## 파일 구조

```
src/
├── components/
│   └── floating/
│       ├── FloatingWindowRenderer.tsx
│       ├── FloatingWindowContent.tsx
│       ├── FloatingWindowHeader.tsx
│       └── index.ts
├── stores/
│   ├── panelStore.ts          # 확장
│   └── windowStore.ts         # 신규
├── services/
│   └── windowService.ts       # 신규
├── hooks/
│   └── useWindowBoundary.ts   # 신규
├── types/
│   ├── panel.ts               # 확장
│   └── window.ts              # 신규
└── providers/
    └── PanelDndProvider.tsx   # 확장

src-tauri/src/
├── commands/
│   ├── mod.rs                 # window 모듈 추가
│   └── window.rs              # 신규
└── lib.rs                     # 명령어 등록
```

---

## 테스트 기준

### Unit Tests
- [ ] windowStore 상태 관리 로직
- [ ] panelStore floating 관련 액션
- [ ] 윈도우 경계 감지 로직

### Integration Tests
- [ ] Tauri 윈도우 생성/삭제 명령어
- [ ] 이벤트 발신/수신
- [ ] 레이아웃 저장/복원에 floating 윈도우 포함

### E2E Tests
- [ ] 패널 드래그하여 Floating Window 생성
- [ ] Floating Window를 메인으로 다시 Dock
- [ ] 앱 재시작 후 Floating Window 위치 복원
- [ ] 다중 모니터 환경에서 위치 유지

---

## 의존성
- Unit 2: UI 레이아웃 시스템 (패널, Docking 기반)
- 현재 구현된 panelStore, PanelDndProvider

## 차단 항목
- 없음 (독립적으로 구현 가능)

---

## 구현 우선순위

1. **Phase 1**: Tauri Backend 윈도우 명령어 (필수 기반)
2. **Phase 2**: windowStore 및 panelStore 확장 (상태 관리)
3. **Phase 3**: 드래그 경계 감지 및 Undock 로직
4. **Phase 4**: Floating Window 컴포넌트
5. **Phase 5**: 레이아웃 저장/복원 확장
6. **Phase 6**: 테스트 및 Edge Case 처리

---

## 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| 윈도우 간 상태 동기화 실패 | 데이터 불일치 | 단일 Source of Truth (panelStore) 유지 |
| Floating 윈도우 메모리 누수 | 성능 저하 | 윈도우 닫힘 시 cleanup 철저히 |
| 다중 모니터에서 위치 오류 | UX 저하 | 화면 경계 체크 후 보정 |
| 레이아웃 복원 시 윈도우 누락 | 데이터 손실 | 복원 실패 시 fallback (grid로 복원) |

---

## 대안 고려사항

### 간소화된 대안: Modal 기반 Detach
Native Tauri Window 대신 React Modal로 구현:
- 장점: 구현 복잡도 40% 감소
- 단점: 진정한 멀티 윈도우가 아님, 메인 윈도우에 종속

**결정**: 전체 Floating Window 구현 진행 (사용자 요구사항에 더 부합)
