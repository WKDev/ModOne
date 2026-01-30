# PRD Unit 10: Missing Features Implementation

## Overview
Unit 10은 PRD Unit 1-9에서 계획되었으나 실제로 구현되지 않은 핵심 기능들을 완성합니다. 시나리오 실행 엔진, Undo/Redo 시스템, 명령 팔레트, Scope 블록 고급 기능을 포함합니다.

---

## 1. Scenario Execution Engine (시나리오 실행 엔진)

### 1.1 개요
Unit 6에서 정의된 Scenario Editor의 실행 기능을 구현합니다. 시간 기반으로 ModServer 메모리에 값을 자동으로 쓰는 엔진입니다.

### 1.2 실행 흐름
```
scenario_run() 호출
    │
    ├─ 이벤트 목록을 시간순 정렬
    ├─ 시작 시간 기록
    │
    ├─ Loop: 현재 시간 계산 (elapsed = now - start)
    │   │
    │   ├─ 실행 대기 이벤트 중 time <= elapsed 인 것 찾기
    │   │   ├─ ModServer 메모리에 값 쓰기
    │   │   ├─ persist=false인 경우 타이머 등록 (duration 후 원복)
    │   │   └─ 이벤트 실행 완료 이벤트 발생
    │   │
    │   ├─ 모든 이벤트 완료 시
    │   │   ├─ loop=true: 시작 시간 리셋, 반복
    │   │   └─ loop=false: 실행 종료
    │   │
    │   └─ pause/stop 신호 체크
    │
    └─ 종료
```

### 1.3 Rust 구조체

```rust
// src-tauri/src/scenario/executor.rs

use std::collections::BinaryHeap;
use std::cmp::Ordering;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio::time::sleep;

/// Scenario execution state
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScenarioState {
    Idle,
    Running,
    Paused,
    Completed,
    Error(String),
}

/// Scheduled event for execution
#[derive(Debug, Clone)]
struct ScheduledEvent {
    event: ScenarioEvent,
    execute_at: Duration,
}

impl Ord for ScheduledEvent {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse for min-heap (earliest first)
        other.execute_at.cmp(&self.execute_at)
    }
}

impl PartialOrd for ScheduledEvent {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Pending release for persist=false events
struct PendingRelease {
    address: String,
    original_value: u16,
    release_at: Instant,
}

/// Scenario execution engine
pub struct ScenarioExecutor {
    /// Current state
    state: ScenarioState,
    /// Current scenario
    scenario: Option<Scenario>,
    /// Event queue (min-heap by time)
    event_queue: BinaryHeap<ScheduledEvent>,
    /// Pending releases for persist=false events
    pending_releases: Vec<PendingRelease>,
    /// Start time of current execution
    start_time: Option<Instant>,
    /// Pause time (for resume calculation)
    pause_time: Option<Instant>,
    /// Total paused duration
    paused_duration: Duration,
    /// Current loop iteration
    current_loop: u32,
    /// Executed event count
    executed_count: usize,
    /// Control channel
    control_tx: Option<mpsc::Sender<ScenarioControl>>,
    /// Reference to ModServer memory
    modbus_memory: Arc<RwLock<ModbusMemory>>,
}

/// Control commands
pub enum ScenarioControl {
    Pause,
    Resume,
    Stop,
    Seek(f64), // Jump to specific time
}

/// Execution status for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioStatus {
    pub state: ScenarioState,
    pub elapsed_time: f64,
    pub total_events: usize,
    pub executed_events: usize,
    pub current_loop: u32,
    pub total_loops: u32,
    pub next_event_time: Option<f64>,
    pub last_executed_event_id: Option<String>,
}

impl ScenarioExecutor {
    pub fn new(modbus_memory: Arc<RwLock<ModbusMemory>>) -> Self;

    /// Load scenario for execution
    pub fn load(&mut self, scenario: Scenario) -> Result<(), String>;

    /// Start or resume execution
    pub async fn run(&mut self, app_handle: AppHandle) -> Result<(), String>;

    /// Pause execution
    pub fn pause(&mut self) -> Result<(), String>;

    /// Resume from pause
    pub fn resume(&mut self) -> Result<(), String>;

    /// Stop execution
    pub fn stop(&mut self) -> Result<(), String>;

    /// Seek to specific time
    pub fn seek(&mut self, time_secs: f64) -> Result<(), String>;

    /// Get current status
    pub fn get_status(&self) -> ScenarioStatus;

    /// Execute a single event
    async fn execute_event(&mut self, event: &ScenarioEvent) -> Result<(), String>;

    /// Process pending releases
    async fn process_releases(&mut self);

    /// Schedule release for persist=false event
    fn schedule_release(&mut self, event: &ScenarioEvent, original_value: u16);
}
```

### 1.4 Tauri Commands

```rust
// src-tauri/src/commands/scenario.rs (추가)

#[tauri::command]
pub async fn scenario_run(
    scenario: Scenario,
    state: State<'_, ScenarioExecutorState>,
    app_handle: AppHandle,
) -> Result<(), String>;

#[tauri::command]
pub async fn scenario_pause(
    state: State<'_, ScenarioExecutorState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scenario_resume(
    state: State<'_, ScenarioExecutorState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scenario_stop(
    state: State<'_, ScenarioExecutorState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scenario_seek(
    time_secs: f64,
    state: State<'_, ScenarioExecutorState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scenario_get_status(
    state: State<'_, ScenarioExecutorState>,
) -> Result<ScenarioStatus, String>;
```

### 1.5 Tauri Events

```rust
// 프론트엔드로 발생하는 이벤트

/// 이벤트 실행됨
app_handle.emit("scenario:event-executed", EventExecutedPayload {
    event_id: String,
    time: f64,
    address: String,
    value: u16,
});

/// 상태 변경됨
app_handle.emit("scenario:status-changed", ScenarioStatus);

/// 루프 완료
app_handle.emit("scenario:loop-completed", LoopCompletedPayload {
    loop_number: u32,
    total_loops: u32,
});

/// 실행 완료
app_handle.emit("scenario:completed", ());

/// 에러 발생
app_handle.emit("scenario:error", String);
```

### 1.6 프론트엔드 연동

```typescript
// src/components/ScenarioEditor/hooks/useScenarioExecution.ts

interface UseScenarioExecutionReturn {
  status: ScenarioStatus | null;
  isRunning: boolean;
  isPaused: boolean;
  run: (scenario: Scenario) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (timeSecs: number) => Promise<void>;
}

export function useScenarioExecution(): UseScenarioExecutionReturn {
  const [status, setStatus] = useState<ScenarioStatus | null>(null);

  useEffect(() => {
    // Subscribe to scenario events
    const unlistenExecuted = listen('scenario:event-executed', (e) => {
      // Update grid row highlight
    });

    const unlistenStatus = listen('scenario:status-changed', (e) => {
      setStatus(e.payload as ScenarioStatus);
    });

    return () => {
      unlistenExecuted.then(fn => fn());
      unlistenStatus.then(fn => fn());
    };
  }, []);

  // ... invoke functions
}
```

### 1.7 구현 우선순위
1. ScenarioExecutor 기본 구조
2. run/stop 기본 실행
3. 이벤트 실행 및 ModServer 연동
4. pause/resume 구현
5. persist=false 자동 해제
6. 루프 실행
7. seek 기능
8. 프론트엔드 상태 동기화

---

## 2. Undo/Redo System (실행 취소/다시 실행)

### 2.1 개요
Ladder Editor에서 편집 작업의 실행 취소(Undo)와 다시 실행(Redo)을 지원합니다.

### 2.2 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Edit History Manager                                    │
├─────────────────────────────────────────────────────────┤
│  undoStack: EditAction[]     redoStack: EditAction[]    │
│  [Action1, Action2, Action3] [Action4, Action5]         │
│                    ↑                                     │
│               currentState                               │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Edit Action Types

```typescript
// src/components/LadderEditor/types/editHistory.ts

type EditActionType =
  | 'PLACE_ELEMENT'
  | 'DELETE_ELEMENT'
  | 'MOVE_ELEMENT'
  | 'MODIFY_ELEMENT'
  | 'ADD_NETWORK'
  | 'DELETE_NETWORK'
  | 'MOVE_NETWORK'
  | 'ADD_BRANCH'
  | 'DELETE_BRANCH'
  | 'BATCH';  // Multiple actions grouped

interface EditAction {
  id: string;
  type: EditActionType;
  timestamp: number;
  description: string;  // Human-readable description for UI

  // Data needed to undo/redo
  before: EditActionData;
  after: EditActionData;
}

interface PlaceElementAction extends EditAction {
  type: 'PLACE_ELEMENT';
  before: null;  // Element didn't exist
  after: {
    networkIndex: number;
    row: number;
    col: number;
    element: LadderElement;
  };
}

interface DeleteElementAction extends EditAction {
  type: 'DELETE_ELEMENT';
  before: {
    networkIndex: number;
    row: number;
    col: number;
    element: LadderElement;
    // Connected wires that were also deleted
    connectedWires?: Wire[];
  };
  after: null;
}

interface MoveElementAction extends EditAction {
  type: 'MOVE_ELEMENT';
  before: {
    networkIndex: number;
    row: number;
    col: number;
  };
  after: {
    networkIndex: number;
    row: number;
    col: number;
  };
  elementId: string;
}

interface ModifyElementAction extends EditAction {
  type: 'MODIFY_ELEMENT';
  elementId: string;
  before: Partial<LadderElement>;
  after: Partial<LadderElement>;
}

interface BatchAction extends EditAction {
  type: 'BATCH';
  actions: EditAction[];  // Sub-actions to undo/redo together
}
```

### 2.4 Edit History Manager

```typescript
// src/components/LadderEditor/hooks/useEditHistory.ts

interface EditHistoryConfig {
  maxHistorySize: number;  // Default: 100
  debounceMs: number;      // Group rapid edits, Default: 500
}

interface UseEditHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  historyLength: number;

  pushAction: (action: Omit<EditAction, 'id' | 'timestamp'>) => void;
  undo: () => EditAction | null;
  redo: () => EditAction | null;

  // Batch operations
  startBatch: (description: string) => void;
  commitBatch: () => void;
  cancelBatch: () => void;

  // History management
  clear: () => void;
  getHistory: () => EditAction[];
}

export function useEditHistory(config?: Partial<EditHistoryConfig>): UseEditHistoryReturn {
  const [undoStack, setUndoStack] = useState<EditAction[]>([]);
  const [redoStack, setRedoStack] = useState<EditAction[]>([]);
  const [batchActions, setBatchActions] = useState<EditAction[] | null>(null);
  const [batchDescription, setBatchDescription] = useState<string>('');

  const pushAction = useCallback((action: Omit<EditAction, 'id' | 'timestamp'>) => {
    const fullAction: EditAction = {
      ...action,
      id: generateId(),
      timestamp: Date.now(),
    };

    if (batchActions !== null) {
      // Collecting batch
      setBatchActions(prev => [...(prev || []), fullAction]);
    } else {
      setUndoStack(prev => {
        const newStack = [...prev, fullAction];
        // Limit stack size
        if (newStack.length > (config?.maxHistorySize ?? 100)) {
          newStack.shift();
        }
        return newStack;
      });
      // Clear redo stack on new action
      setRedoStack([]);
    }
  }, [batchActions, config?.maxHistorySize]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return null;

    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    return action;
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return null;

    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    return action;
  }, [redoStack]);

  // ... batch operations

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoDescription: undoStack[undoStack.length - 1]?.description ?? null,
    redoDescription: redoStack[redoStack.length - 1]?.description ?? null,
    historyLength: undoStack.length,
    pushAction,
    undo,
    redo,
    startBatch,
    commitBatch,
    cancelBatch,
    clear,
    getHistory,
  };
}
```

### 2.5 Ladder Store 통합

```typescript
// src/stores/ladderStore.ts (수정)

interface LadderState {
  // ... existing state

  // Edit history
  editHistory: {
    undoStack: EditAction[];
    redoStack: EditAction[];
  };
}

interface LadderActions {
  // ... existing actions

  // Undo/Redo
  pushEditAction: (action: Omit<EditAction, 'id' | 'timestamp'>) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

// Action executor - applies action to state
function applyAction(state: LadderState, action: EditAction, reverse: boolean): LadderState {
  const data = reverse ? action.before : action.after;

  switch (action.type) {
    case 'PLACE_ELEMENT':
      if (reverse) {
        // Remove element
        return removeElementAt(state, data.networkIndex, data.row, data.col);
      } else {
        // Add element
        return placeElementAt(state, data.networkIndex, data.row, data.col, data.element);
      }

    case 'DELETE_ELEMENT':
      if (reverse) {
        // Restore element and wires
        let newState = placeElementAt(state, data.networkIndex, data.row, data.col, data.element);
        if (data.connectedWires) {
          newState = restoreWires(newState, data.connectedWires);
        }
        return newState;
      } else {
        return removeElementAt(state, action.before.networkIndex, action.before.row, action.before.col);
      }

    case 'MODIFY_ELEMENT':
      return updateElement(state, action.elementId, reverse ? action.before : action.after);

    case 'BATCH':
      let batchState = state;
      const actions = reverse ? [...action.actions].reverse() : action.actions;
      for (const subAction of actions) {
        batchState = applyAction(batchState, subAction, reverse);
      }
      return batchState;

    // ... other cases
  }
}
```

### 2.6 키보드 단축키 연동

```typescript
// src/components/LadderEditor/hooks/useLadderKeyboardShortcuts.ts (수정)

// Ctrl+Z: Undo
useHotkeys('ctrl+z', (e) => {
  e.preventDefault();
  if (canUndo) {
    undo();
  }
}, [canUndo, undo]);

// Ctrl+Y or Ctrl+Shift+Z: Redo
useHotkeys('ctrl+y, ctrl+shift+z', (e) => {
  e.preventDefault();
  if (canRedo) {
    redo();
  }
}, [canRedo, redo]);
```

### 2.7 UI 표시

```typescript
// Edit 메뉴에 표시
<MenuItem
  onClick={undo}
  disabled={!canUndo}
  shortcut="Ctrl+Z"
>
  Undo {undoDescription ? `"${undoDescription}"` : ''}
</MenuItem>

<MenuItem
  onClick={redo}
  disabled={!canRedo}
  shortcut="Ctrl+Y"
>
  Redo {redoDescription ? `"${redoDescription}"` : ''}
</MenuItem>
```

### 2.8 구현 우선순위
1. EditAction 타입 정의
2. useEditHistory 훅 구현
3. ladderStore에 통합
4. PLACE_ELEMENT, DELETE_ELEMENT 구현
5. MODIFY_ELEMENT 구현
6. MOVE_ELEMENT 구현
7. 네트워크 작업 (ADD/DELETE_NETWORK)
8. BATCH 작업
9. 키보드 단축키 연동
10. 메뉴 UI 업데이트

---

## 3. Command Palette (명령 팔레트)

### 3.1 개요
VSCode 스타일의 명령 팔레트를 구현하여 키보드로 모든 명령에 빠르게 접근할 수 있게 합니다.

### 3.2 UI 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│  > search commands...                                   [X] │
├─────────────────────────────────────────────────────────────┤
│  Recently Used                                              │
│  ├─ ▶ Simulation: Start                          F5        │
│  └─ 📁 File: Save                                Ctrl+S    │
├─────────────────────────────────────────────────────────────┤
│  File                                                       │
│  ├─ 📄 File: New Project                         Ctrl+N    │
│  ├─ 📂 File: Open Project                        Ctrl+O    │
│  ├─ 💾 File: Save                                Ctrl+S    │
│  └─ 💾 File: Save As                             Ctrl+Shift+S│
├─────────────────────────────────────────────────────────────┤
│  Simulation                                                 │
│  ├─ ▶ Simulation: Start                          F5        │
│  ├─ ⏸ Simulation: Pause                          F6        │
│  ├─ ⏹ Simulation: Stop                           Shift+F5  │
│  └─ ⏭ Simulation: Step                           F10       │
├─────────────────────────────────────────────────────────────┤
│  View                                                       │
│  ├─ 📊 View: Toggle Memory Visualizer                      │
│  ├─ 🔧 View: Toggle Ladder Editor                          │
│  └─ ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Command Registry

```typescript
// src/components/CommandPalette/types.ts

interface Command {
  id: string;
  category: CommandCategory;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string[];  // Additional search terms
  when?: () => boolean; // Condition for visibility
  execute: () => void | Promise<void>;
}

type CommandCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'simulation'
  | 'modbus'
  | 'ladder'
  | 'canvas'
  | 'scenario'
  | 'debug'
  | 'settings'
  | 'help';

// src/components/CommandPalette/commandRegistry.ts

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private recentCommands: string[] = [];

  register(command: Command): void;
  unregister(commandId: string): void;
  get(commandId: string): Command | undefined;
  getAll(): Command[];
  getByCategory(category: CommandCategory): Command[];
  search(query: string): Command[];
  execute(commandId: string): Promise<void>;
  addToRecent(commandId: string): void;
  getRecent(limit?: number): Command[];
}

export const commandRegistry = new CommandRegistry();
```

### 3.4 기본 명령 등록

```typescript
// src/components/CommandPalette/commands/fileCommands.ts

import { commandRegistry } from '../commandRegistry';

export function registerFileCommands() {
  commandRegistry.register({
    id: 'file.newProject',
    category: 'file',
    label: 'New Project',
    icon: <FileIcon />,
    shortcut: 'Ctrl+N',
    keywords: ['create', 'new'],
    execute: () => {
      // Open new project dialog
      useProjectStore.getState().openNewProjectDialog();
    },
  });

  commandRegistry.register({
    id: 'file.openProject',
    category: 'file',
    label: 'Open Project',
    icon: <FolderOpenIcon />,
    shortcut: 'Ctrl+O',
    execute: async () => {
      const path = await open({
        filters: [{ name: 'ModOne Project', extensions: ['mop'] }],
      });
      if (path) {
        await invoke('open_project', { path });
      }
    },
  });

  commandRegistry.register({
    id: 'file.save',
    category: 'file',
    label: 'Save',
    icon: <SaveIcon />,
    shortcut: 'Ctrl+S',
    when: () => useProjectStore.getState().isProjectOpen,
    execute: async () => {
      await invoke('save_project', { path: null });
    },
  });

  // ... more file commands
}

// src/components/CommandPalette/commands/simulationCommands.ts

export function registerSimulationCommands() {
  commandRegistry.register({
    id: 'simulation.start',
    category: 'simulation',
    label: 'Start Simulation',
    icon: <PlayIcon />,
    shortcut: 'F5',
    when: () => !useSimStore.getState().isRunning,
    execute: async () => {
      await invoke('sim_start');
    },
  });

  commandRegistry.register({
    id: 'simulation.stop',
    category: 'simulation',
    label: 'Stop Simulation',
    icon: <StopIcon />,
    shortcut: 'Shift+F5',
    when: () => useSimStore.getState().isRunning,
    execute: async () => {
      await invoke('sim_stop');
    },
  });

  // ... more simulation commands
}

// src/components/CommandPalette/commands/index.ts

export function registerAllCommands() {
  registerFileCommands();
  registerEditCommands();
  registerViewCommands();
  registerSimulationCommands();
  registerModbusCommands();
  registerLadderCommands();
  registerCanvasCommands();
  registerScenarioCommands();
  registerDebugCommands();
  registerSettingsCommands();
  registerHelpCommands();
}
```

### 3.5 Command Palette 컴포넌트

```typescript
// src/components/CommandPalette/CommandPalette.tsx

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent + all by category
      return {
        recent: commandRegistry.getRecent(5),
        categories: groupByCategory(commandRegistry.getAll()),
      };
    }
    return {
      recent: [],
      categories: { results: commandRegistry.search(query) },
    };
  }, [query]);

  // Flatten for keyboard navigation
  const flatList = useMemo(() => {
    const list: Command[] = [];
    if (filteredCommands.recent.length > 0) {
      list.push(...filteredCommands.recent);
    }
    Object.values(filteredCommands.categories).forEach(commands => {
      list.push(...commands);
    });
    return list;
  }, [filteredCommands]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatList[selectedIndex]) {
          executeCommand(flatList[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  const executeCommand = async (command: Command) => {
    onClose();
    commandRegistry.addToRecent(command.id);
    await command.execute();
  };

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-[600px] max-h-[400px] bg-white dark:bg-neutral-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
          <SearchIcon className="w-5 h-5 text-neutral-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-700 rounded">
            Esc
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-[340px] overflow-y-auto">
          {filteredCommands.recent.length > 0 && (
            <CommandSection title="Recently Used">
              {filteredCommands.recent.map((cmd, i) => (
                <CommandItem
                  key={cmd.id}
                  command={cmd}
                  isSelected={selectedIndex === i}
                  onClick={() => executeCommand(cmd)}
                />
              ))}
            </CommandSection>
          )}

          {Object.entries(filteredCommands.categories).map(([category, commands]) => (
            <CommandSection key={category} title={formatCategory(category)}>
              {commands.map((cmd, i) => {
                const globalIndex = calculateGlobalIndex(i, category, filteredCommands);
                return (
                  <CommandItem
                    key={cmd.id}
                    command={cmd}
                    isSelected={selectedIndex === globalIndex}
                    onClick={() => executeCommand(cmd)}
                  />
                );
              })}
            </CommandSection>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 3.6 전역 단축키 등록

```typescript
// src/App.tsx (또는 src/providers/CommandPaletteProvider.tsx)

function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Register Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <MainLayout />
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
      />
    </>
  );
}
```

### 3.7 컴포넌트 구조

```
src/components/CommandPalette/
├── CommandPalette.tsx        # 메인 팔레트 컴포넌트
├── CommandItem.tsx           # 개별 명령 항목
├── CommandSection.tsx        # 카테고리 섹션
├── commandRegistry.ts        # 명령 레지스트리
├── commands/                 # 명령 정의
│   ├── index.ts
│   ├── fileCommands.ts
│   ├── editCommands.ts
│   ├── viewCommands.ts
│   ├── simulationCommands.ts
│   ├── modbusCommands.ts
│   ├── ladderCommands.ts
│   ├── canvasCommands.ts
│   ├── scenarioCommands.ts
│   ├── debugCommands.ts
│   ├── settingsCommands.ts
│   └── helpCommands.ts
├── hooks/
│   └── useCommandPalette.ts
├── utils/
│   ├── search.ts             # 퍼지 검색
│   └── grouping.ts           # 카테고리 그룹핑
└── types.ts
```

### 3.8 구현 우선순위
1. Command 타입 및 CommandRegistry 구현
2. CommandPalette UI 컴포넌트
3. 기본 명령 등록 (File, View)
4. 키보드 네비게이션
5. 퍼지 검색 구현
6. 최근 사용 명령 저장
7. 모든 카테고리 명령 등록
8. 조건부 명령 표시 (when)

---

## 4. Scope Block Advanced Features (오실로스코프 고급 기능)

### 4.1 개요
OneCanvas의 Scope 블록에 실시간 신호 파형 추적, 트리거 모드, 줌/팬 기능을 추가합니다.

### 4.2 Scope 데이터 구조

```typescript
// src/components/OneCanvas/types.ts (확장)

interface ScopeChannel {
  id: string;
  enabled: boolean;
  color: string;
  portId: string;           // Connected port
  scale: number;            // V/div
  offset: number;           // Vertical offset
  coupling: 'DC' | 'AC';
}

interface ScopeSettings {
  timeBase: number;         // ms/div (1, 2, 5, 10, 20, 50, 100, 200, 500, 1000)
  triggerMode: 'auto' | 'normal' | 'single';
  triggerChannel: number;   // 0-3
  triggerLevel: number;     // Voltage level
  triggerEdge: 'rising' | 'falling';
  holdOff: number;          // ms
  runMode: 'run' | 'stop';
}

interface ScopeData {
  channels: ScopeChannelData[];
  sampleRate: number;       // samples per second
  bufferSize: number;       // samples to keep
  triggered: boolean;
  triggerPosition: number;  // Sample index of trigger
}

interface ScopeChannelData {
  channelIndex: number;
  samples: Float32Array;    // Circular buffer
  writeIndex: number;
  min: number;
  max: number;
}
```

### 4.3 Scope 시뮬레이션 엔진

```rust
// src-tauri/src/canvas/scope.rs

use std::collections::VecDeque;
use std::sync::Arc;
use parking_lot::RwLock;

/// Scope simulation engine
pub struct ScopeEngine {
    /// Sample buffer per channel
    channels: Vec<ChannelBuffer>,
    /// Settings
    settings: ScopeSettings,
    /// Sample rate (Hz)
    sample_rate: u32,
    /// Buffer size (samples)
    buffer_size: usize,
    /// Trigger state
    trigger_state: TriggerState,
}

struct ChannelBuffer {
    samples: VecDeque<f32>,
    previous_sample: f32,
}

struct TriggerState {
    armed: bool,
    triggered: bool,
    trigger_index: usize,
    hold_off_remaining: f32,
}

impl ScopeEngine {
    pub fn new(channel_count: usize, buffer_size: usize, sample_rate: u32) -> Self;

    /// Add sample to channel
    pub fn add_sample(&mut self, channel: usize, voltage: f32);

    /// Check trigger condition
    fn check_trigger(&mut self, channel: usize, voltage: f32) -> bool;

    /// Get waveform data for rendering
    pub fn get_waveform_data(&self, channel: usize) -> Vec<f32>;

    /// Get all channels data for frontend
    pub fn get_display_data(&self) -> ScopeDisplayData;

    /// Update settings
    pub fn update_settings(&mut self, settings: ScopeSettings);

    /// Run single trigger
    pub fn single_trigger(&mut self);

    /// Force trigger
    pub fn force_trigger(&mut self);

    /// Reset
    pub fn reset(&mut self);
}

#[derive(Serialize, Clone)]
pub struct ScopeDisplayData {
    pub channels: Vec<ChannelDisplayData>,
    pub triggered: bool,
    pub trigger_position: f32,  // 0.0 - 1.0
    pub time_per_div: f32,
}

#[derive(Serialize, Clone)]
pub struct ChannelDisplayData {
    pub index: usize,
    pub points: Vec<(f32, f32)>,  // (x, y) normalized 0-1
    pub min: f32,
    pub max: f32,
    pub average: f32,
}
```

### 4.4 Tauri Commands

```rust
// src-tauri/src/commands/canvas.rs (추가)

#[tauri::command]
pub async fn scope_get_data(
    scope_id: String,
    state: State<'_, CanvasState>,
) -> Result<ScopeDisplayData, String>;

#[tauri::command]
pub async fn scope_update_settings(
    scope_id: String,
    settings: ScopeSettings,
    state: State<'_, CanvasState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scope_single_trigger(
    scope_id: String,
    state: State<'_, CanvasState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scope_force_trigger(
    scope_id: String,
    state: State<'_, CanvasState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn scope_run_stop(
    scope_id: String,
    run: bool,
    state: State<'_, CanvasState>,
) -> Result<(), String>;
```

### 4.5 Scope Block UI 개선

```typescript
// src/components/OneCanvas/components/blocks/ScopeBlock.tsx (개선)

export const ScopeBlock = memo(function ScopeBlock({
  block,
  isSelected,
  onSelect,
  // ... other props
}: ScopeBlockProps) {
  const [displayData, setDisplayData] = useState<ScopeDisplayData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Poll for waveform data during simulation
  useEffect(() => {
    if (!isSimulationRunning) return;

    const interval = setInterval(async () => {
      const data = await invoke('scope_get_data', { scopeId: block.id });
      setDisplayData(data);
    }, 50); // 20 FPS

    return () => clearInterval(interval);
  }, [block.id, isSimulationRunning]);

  return (
    <BlockWrapper {...}>
      <div className="scope-block">
        {/* Compact view */}
        {!isExpanded && (
          <ScopeCompactView
            data={displayData}
            channels={block.channels}
            onExpand={() => setIsExpanded(true)}
          />
        )}

        {/* Expanded view (modal) */}
        {isExpanded && (
          <ScopeExpandedView
            scopeId={block.id}
            data={displayData}
            settings={block.settings}
            onClose={() => setIsExpanded(false)}
          />
        )}
      </div>
    </BlockWrapper>
  );
});
```

### 4.6 Scope Expanded View

```typescript
// src/components/OneCanvas/components/blocks/ScopeExpandedView.tsx

interface ScopeExpandedViewProps {
  scopeId: string;
  data: ScopeDisplayData | null;
  settings: ScopeSettings;
  onClose: () => void;
}

export function ScopeExpandedView({
  scopeId,
  data,
  settings,
  onClose
}: ScopeExpandedViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw waveform
  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    drawGrid(ctx);
    drawWaveforms(ctx, data);
    drawTriggerMarker(ctx, data.triggerPosition);
    drawCursors(ctx);
    drawMeasurements(ctx);
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[800px] h-[600px] bg-neutral-900 rounded-lg flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-700">
          {/* Run/Stop */}
          <button onClick={() => invoke('scope_run_stop', { scopeId, run: !settings.runMode })}>
            {settings.runMode === 'run' ? <StopIcon /> : <PlayIcon />}
          </button>

          {/* Single */}
          <button onClick={() => invoke('scope_single_trigger', { scopeId })}>
            Single
          </button>

          {/* Time base */}
          <select
            value={settings.timeBase}
            onChange={(e) => updateSettings({ timeBase: Number(e.target.value) })}
          >
            {[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map(t => (
              <option key={t} value={t}>{t} ms/div</option>
            ))}
          </select>

          {/* Trigger mode */}
          <select
            value={settings.triggerMode}
            onChange={(e) => updateSettings({ triggerMode: e.target.value })}
          >
            <option value="auto">Auto</option>
            <option value="normal">Normal</option>
            <option value="single">Single</option>
          </select>

          <div className="flex-1" />

          <button onClick={onClose}>
            <XIcon />
          </button>
        </div>

        {/* Main display */}
        <div className="flex-1 flex">
          {/* Waveform canvas */}
          <canvas
            ref={canvasRef}
            className="flex-1"
            width={640}
            height={480}
          />

          {/* Channel controls */}
          <div className="w-40 border-l border-neutral-700 p-2">
            {[0, 1, 2, 3].map(ch => (
              <ChannelControl
                key={ch}
                channel={ch}
                settings={settings.channels?.[ch]}
                onChange={(s) => updateChannelSettings(ch, s)}
              />
            ))}
          </div>
        </div>

        {/* Measurements */}
        <div className="px-4 py-2 border-t border-neutral-700 text-xs text-neutral-400">
          {data && (
            <div className="flex gap-4">
              {data.channels.map((ch, i) => (
                <span key={i} style={{ color: CHANNEL_COLORS[i] }}>
                  CH{i+1}: Vpp={ch.max - ch.min}V, Avg={ch.average.toFixed(2)}V
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 4.7 컴포넌트 구조

```
src/components/OneCanvas/components/blocks/
├── ScopeBlock.tsx            # 메인 Scope 블록 (기존 파일 수정)
├── ScopeCompactView.tsx      # 축소 뷰 (블록 내 표시)
├── ScopeExpandedView.tsx     # 확장 뷰 (전체 화면)
├── ScopeCanvas.tsx           # 파형 렌더링 캔버스
├── ChannelControl.tsx        # 채널별 설정
├── TriggerControl.tsx        # 트리거 설정
└── ScopeMeasurements.tsx     # 측정값 표시

src-tauri/src/canvas/
├── mod.rs                    # (기존)
├── scope.rs                  # Scope 엔진 (새로 추가)
└── types.rs                  # (기존)
```

### 4.8 구현 우선순위
1. ScopeEngine 기본 구조 (Rust)
2. 샘플 버퍼 및 수집
3. 기본 파형 렌더링 (Canvas)
4. 트리거 로직 (Auto/Normal)
5. 프론트엔드 통합
6. 확장 뷰 UI
7. 채널 설정
8. 측정값 계산 (Vpp, Freq, etc.)
9. 커서 기능
10. 데이터 내보내기

---

## 5. 테스트 전략

### 5.1 Unit Tests

```typescript
// Scenario Executor
- 이벤트 정렬 및 스케줄링
- 시간 기반 실행
- pause/resume 상태 관리
- persist=false 자동 해제

// Edit History
- pushAction 스택 관리
- undo/redo 동작
- BATCH 액션 처리
- 히스토리 크기 제한

// Command Palette
- 명령 등록/해제
- 퍼지 검색
- 최근 명령 저장

// Scope Engine
- 샘플 버퍼링
- 트리거 감지
- 파형 데이터 생성
```

### 5.2 Integration Tests

```typescript
// Scenario + ModServer
- 시나리오 실행 시 메모리 값 변경 확인
- Memory Visualizer에 값 반영 확인

// Undo/Redo + Ladder Editor
- 요소 배치 후 Undo 시 제거 확인
- Redo 시 복원 확인
- 복잡한 편집 시퀀스

// Command Palette + All Modules
- 명령 실행 후 상태 변경 확인

// Scope + Circuit Simulation
- 회로 전압 변화 파형 표시 확인
```

### 5.3 E2E Tests

```typescript
// Scenario Execution Flow
test('should execute scenario events at correct times', async () => {
  // Load scenario with 3 events
  // Start execution
  // Wait and verify memory changes
  // Verify progress UI updates
});

// Undo/Redo Flow
test('should undo and redo element placement', async () => {
  // Place element
  // Press Ctrl+Z
  // Verify element removed
  // Press Ctrl+Y
  // Verify element restored
});

// Command Palette Flow
test('should execute command from palette', async () => {
  // Press Ctrl+Shift+P
  // Type command name
  // Press Enter
  // Verify command executed
});
```

---

## 6. 의존성

### 새 라이브러리 (프론트엔드)
```json
{
  "fuse.js": "^7.0.0"  // 퍼지 검색 (Command Palette)
}
```

### 새 라이브러리 (백엔드)
```toml
# 추가 의존성 없음 - 기존 tokio, chrono 활용
```

---

## 7. 구현 우선순위 (전체)

### Phase 1: Scenario Execution (1주)
1. ScenarioExecutor 구조 구현
2. run/stop 기본 동작
3. 이벤트 실행 및 ModServer 연동
4. pause/resume
5. 프론트엔드 상태 동기화

### Phase 2: Undo/Redo (1주)
1. EditAction 타입 정의
2. useEditHistory 훅
3. Ladder Store 통합
4. 기본 액션 (Place/Delete/Modify)
5. 키보드 단축키

### Phase 3: Command Palette (3일)
1. CommandRegistry
2. UI 컴포넌트
3. 기본 명령 등록
4. 퍼지 검색

### Phase 4: Scope Advanced (1주)
1. Scope 엔진 (Rust)
2. 파형 렌더링
3. 트리거 로직
4. 확장 뷰 UI

### Phase 5: Testing & Polish (3일)
1. Unit 테스트 작성
2. Integration 테스트
3. E2E 테스트
4. 버그 수정 및 최적화

---

## 8. 완료 기준

- [ ] 시나리오 실행 시 시간에 맞춰 메모리 값이 변경됨
- [ ] persist=false 이벤트가 지정 시간 후 자동으로 해제됨
- [ ] 루프 실행이 정상 동작함
- [ ] Ladder Editor에서 Ctrl+Z/Y로 편집 취소/복원 가능
- [ ] Ctrl+Shift+P로 명령 팔레트가 열리고 명령 실행 가능
- [ ] Scope 블록에서 실시간 파형이 표시됨
- [ ] 트리거 모드(Auto/Normal/Single)가 정상 동작함
- [ ] 모든 신규 기능에 대한 테스트 통과

---

## 9. 관련 문서

- [PRD Unit 2: UI 레이아웃](./PRD_Unit2_UILayout.md) - 명령 팔레트 원본 요구사항
- [PRD Unit 5: OneCanvas](./PRD_Unit5_OneCanvas.md) - Scope 블록 원본 요구사항
- [PRD Unit 6: Scenario Editor](./PRD_Unit6_ScenarioEditor.md) - 시나리오 실행 원본 요구사항
- [PRD Unit 8: Ladder Editor](./PRD_Unit8_LadderEditor.md) - Undo/Redo 원본 요구사항
