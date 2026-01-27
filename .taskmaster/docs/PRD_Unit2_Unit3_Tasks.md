# PRD: Unit 2 & Unit 3 Implementation Tasks

이 문서는 ModOne 프로젝트의 Unit 2 (UI 레이아웃)와 Unit 3 (ModServer) 구현을 위한 추가 태스크를 정의합니다.

---

## Unit 2: UI 레이아웃 시스템

### Task: Create Main Application Shell with Menu Bar and Toolbar

**Description:**
VSCode 스타일의 메인 애플리케이션 쉘을 구현합니다. MenuBar, Toolbar, StatusBar 컴포넌트를 포함합니다.

**Details:**
1. Create `src/components/layout/MainLayout.tsx` as the root layout component
2. Implement `src/components/layout/MenuBar.tsx`:
   - File menu: New Project (Ctrl+N), Open Project (Ctrl+O), Save (Ctrl+S), Save As (Ctrl+Shift+S), Recent Projects submenu, Exit
   - Edit menu: Undo (Ctrl+Z), Redo (Ctrl+Y), Cut/Copy/Paste, Preferences
   - View menu: Toggle Sidebar (Ctrl+B), Toggle Panel submenu, Reset Layout, Zoom In/Out
   - Simulation menu: Start (F5), Stop (Shift+F5), Pause (F6), Step (F10), Reset
   - Modbus menu: Server Settings, Start Server, Stop Server, Connection Status
   - Help menu: Documentation, About
3. Implement `src/components/layout/Toolbar.tsx`:
   - Project group: New, Open, Save icons
   - Simulation group: Play, Pause, Stop, Step icons
   - View group: Panel toggle buttons
4. Implement `src/components/layout/StatusBar.tsx`:
   - Simulation status indicator (Running/Stopped/Paused)
   - Scan time display
   - Modbus connection status (TCP:502 Connected/Disconnected)
   - Memory usage indicator
5. Use Tailwind CSS for styling with consistent spacing and colors
6. Create menu state management with Zustand or React context

**Dependencies:** Task 2 (Frontend Configuration), Task 8 (Project UI Components)

**Test Strategy:**
- Unit test menu items render correctly
- Test keyboard shortcuts trigger correct actions
- Test status bar updates reflect application state
- E2E test menu navigation flow

---

### Task: Implement Sidebar with Activity Bar Navigation

**Description:**
VSCode Activity Bar 스타일의 사이드바를 구현합니다. Explorer, Search, Modbus, Settings 탭을 포함합니다.

**Details:**
1. Create `src/components/layout/Sidebar.tsx`:
   - Collapsible sidebar with configurable width (default: 250px)
   - Resize handle for width adjustment
   - Animation for show/hide transitions
2. Create `src/components/layout/ActivityBar.tsx`:
   - Vertical icon bar on the left edge
   - Icons for: Explorer, Search, Modbus, Settings
   - Active tab indicator styling
   - Tooltip on hover showing tab name
3. Create sidebar panel components:
   - `src/components/sidebar/ExplorerPanel.tsx`: Project file tree view
   - `src/components/sidebar/SearchPanel.tsx`: Global search with results
   - `src/components/sidebar/ModbusPanel.tsx`: Server status, memory overview
   - `src/components/sidebar/SettingsPanel.tsx`: Quick settings access
4. Create `src/stores/sidebarStore.ts`:
   - activePanel: string
   - isVisible: boolean
   - width: number
   - setActivePanel, toggleVisibility, setWidth actions
5. Implement file tree component for Explorer:
   - Display .mop file contents (config.yml, plc_csv/, etc.)
   - Expandable folders with icons
   - Click to open/edit files

**Dependencies:** Task 2 (Frontend Configuration)

**Test Strategy:**
- Test sidebar visibility toggle with Ctrl+B
- Test panel switching updates content correctly
- Test resize handle adjusts width within bounds
- Test file tree displays project structure

---

### Task: Build Panel System with CSS Grid Layout

**Description:**
CSS Grid 기반의 유연한 패널 시스템을 구현합니다. 패널 리사이즈와 배치를 지원합니다.

**Details:**
1. Create `src/components/panels/PanelContainer.tsx`:
   - CSS Grid layout with configurable rows/columns
   - Dynamic grid template based on panel configuration
   - Support for grid areas (e.g., "1 / 1 / 2 / 2")
2. Create `src/components/panels/Panel.tsx`:
   - Panel wrapper with header (title, minimize, maximize, close buttons)
   - Content area for panel-specific component
   - Active/inactive state styling
   - Props: id, type, title, isActive, onClose, onMinimize, onMaximize
3. Create `src/components/panels/ResizeHandle.tsx`:
   - Horizontal and vertical resize handles
   - Drag to resize adjacent panels
   - Visual feedback during drag (cursor change, highlight)
   - Minimum panel size constraints (150px)
4. Define panel types in `src/types/panel.ts`:
   ```typescript
   type PanelType = 'ladder-editor' | 'memory-visualizer' | 'one-canvas' |
                    'scenario-editor' | 'console' | 'properties';
   ```
5. Create `src/stores/panelStore.ts`:
   - panels: PanelState[]
   - gridConfig: { columns: string[], rows: string[] }
   - activePanel: string | null
   - addPanel, removePanel, updatePanelPosition, setActivePanel actions
6. Create placeholder panel content components:
   - LadderEditorPanel.tsx (placeholder for future Unit)
   - MemoryVisualizerPanel.tsx (placeholder for Unit 3 integration)
   - OneCanvasPanel.tsx (placeholder for future Unit)
   - ScenarioEditorPanel.tsx (placeholder for future Unit)
   - ConsolePanel.tsx (log output display)
   - PropertiesPanel.tsx (selected element properties)

**Dependencies:** Task 2 (Frontend Configuration)

**Test Strategy:**
- Test grid layout renders panels in correct positions
- Test resize handle adjusts panel sizes
- Test minimum size constraints are enforced
- Test panel close removes from grid

---

### Task: Implement Tab System for Panel Content

**Description:**
각 패널 영역 내에서 여러 탭을 지원하는 탭 시스템을 구현합니다.

**Details:**
1. Create `src/components/panels/TabBar.tsx`:
   - Horizontal tab list within panel header
   - Active tab indicator (underline or background)
   - Tab overflow handling (scroll or dropdown)
   - Close button on each tab (with unsaved indicator dot)
2. Create `src/components/panels/Tab.tsx`:
   - Tab component with icon, title, close button
   - Modified indicator (dot before title when unsaved)
   - Draggable for reordering (using HTML5 drag or @dnd-kit)
   - Context menu on right-click (Close, Close Others, Close All)
3. Create `src/components/panels/TabContent.tsx`:
   - Content area that switches based on active tab
   - Lazy loading of tab content for performance
4. Update Panel component to support tabs:
   - Panel can contain multiple tabs
   - Each tab has its own PanelType and content
   - Tab state management within panel
5. Add tab state to panelStore:
   - tabs: { panelId: TabState[] }
   - activeTabId: { panelId: string }
   - addTab, removeTab, setActiveTab, reorderTabs actions
6. Implement tab drag to reorder within same panel

**Dependencies:** Task 13 (Panel System)

**Test Strategy:**
- Test tab switching changes visible content
- Test tab close removes tab and content
- Test tab reorder via drag updates order
- Test modified indicator appears for unsaved tabs
- Test context menu actions work correctly

---

### Task: Add Panel Drag-and-Drop for Layout Customization

**Description:**
패널을 드래그하여 위치를 변경하고 분리/병합할 수 있는 기능을 구현합니다.

**Details:**
1. Install @dnd-kit/core and @dnd-kit/sortable for drag-and-drop
2. Create `src/components/panels/DraggablePanel.tsx`:
   - Wrap Panel component with drag handle
   - Visual feedback during drag (opacity, shadow)
   - Drop zone indicators when dragging over valid targets
3. Create `src/components/panels/DropZone.tsx`:
   - Overlay component showing valid drop areas
   - Position indicators (top, bottom, left, right, center)
   - Highlight when panel dragged over
4. Implement panel split functionality:
   - Dropping on edge splits the target area
   - Create new grid cell for dropped panel
   - Update gridConfig in panelStore
5. Implement panel merge functionality:
   - Dropping in center adds panel as new tab
   - Combine panels into tabbed panel group
6. Implement panel detach to floating window:
   - Double-click header to maximize/restore
   - Future: drag outside to create new window (Tauri multi-window)
7. Add visual guides during drag:
   - Ghost preview of panel at drop location
   - Animated transitions when panels rearrange

**Dependencies:** Task 14 (Tab System)

**Test Strategy:**
- Test panel drag shows visual feedback
- Test drop on edge creates split layout
- Test drop in center merges as tabs
- Test layout persists after drag operations
- E2E test complex layout rearrangement

---

### Task: Create Settings Dialog with Configuration Panels

**Description:**
애플리케이션 설정을 위한 다이얼로그를 구현합니다. 일반, 시뮬레이션, Modbus, 외관 설정을 포함합니다.

**Details:**
1. Create `src/components/settings/SettingsDialog.tsx`:
   - Modal dialog with sidebar navigation
   - Settings categories on left, content on right
   - Search bar to filter settings
   - Save/Cancel/Apply buttons
2. Create `src/components/settings/GeneralSettings.tsx`:
   - Language selection: 한국어, English, 日本語
   - Auto-save interval configuration
   - Start with last project option
   - Telemetry opt-in/out
3. Create `src/components/settings/SimulationSettings.tsx`:
   - Default scan time (ms)
   - Timer precision setting
   - Simulation speed multiplier (0.5x, 1x, 2x, 4x)
   - Step execution mode options
4. Create `src/components/settings/ModbusSettings.tsx`:
   - Default TCP port (502)
   - Default RTU serial settings
   - Connection timeout (ms)
   - Auto-reconnect option
5. Create `src/components/settings/AppearanceSettings.tsx`:
   - Theme selection: Light, Dark, System
   - Font size adjustment
   - Grid display toggle
   - Animation enable/disable
6. Create `src/stores/settingsStore.ts`:
   - All settings state with defaults
   - loadSettings, saveSettings actions
   - Integration with Tauri for persistence
7. Add Tauri commands for settings persistence:
   - get_app_settings, save_app_settings
   - Store in app data directory as settings.json

**Dependencies:** Task 6 (Tauri Commands)

**Test Strategy:**
- Test settings dialog opens with current values
- Test changes are saved when clicking Save
- Test Cancel discards unsaved changes
- Test settings persist after app restart
- Test theme change applies immediately

---

### Task: Implement Theme System with Dark Mode Support

**Description:**
Light/Dark/System 테마를 지원하는 테마 시스템을 구현합니다.

**Details:**
1. Create `src/providers/ThemeProvider.tsx`:
   - React context for theme state
   - Theme values: 'light' | 'dark' | 'system'
   - System theme detection using window.matchMedia
   - Auto-switch when system theme changes
2. Create `src/hooks/useTheme.ts`:
   - Access current theme
   - setTheme function
   - isDark computed value
3. Configure Tailwind CSS for dark mode:
   - Update tailwind.config.js: darkMode: 'class'
   - Add dark: variants to all color utilities
4. Create theme-aware color palette:
   - Define CSS variables for theme colors
   - --color-bg-primary, --color-text-primary, etc.
   - Update in ThemeProvider based on active theme
5. Update all existing components with dark mode styles:
   - Background colors: bg-white dark:bg-gray-900
   - Text colors: text-gray-900 dark:text-gray-100
   - Border colors: border-gray-200 dark:border-gray-700
6. Add theme toggle in:
   - Settings dialog (AppearanceSettings)
   - Status bar quick toggle
7. Persist theme preference using settingsStore

**Dependencies:** Task 16 (Settings Dialog)

**Test Strategy:**
- Test theme toggle switches visual appearance
- Test system theme follows OS preference
- Test theme persists after page reload
- Test all components have proper dark mode styles

---

### Task: Add Internationalization (i18n) Support

**Description:**
한국어, English, 日本語를 지원하는 다국어 시스템을 구현합니다.

**Details:**
1. Install react-i18next and i18next:
   ```bash
   npm install react-i18next i18next i18next-browser-languagedetector
   ```
2. Create `src/i18n/index.ts`:
   - Initialize i18next with default language
   - Configure language detector
   - Set up interpolation options
3. Create translation files:
   - `src/i18n/locales/en.json`
   - `src/i18n/locales/ko.json`
   - `src/i18n/locales/ja.json`
4. Define translation keys for:
   - Menu items (file.new, file.open, file.save, etc.)
   - Dialog titles and buttons
   - Status messages
   - Error messages
   - Settings labels
5. Create `src/hooks/useTranslation.ts`:
   - Wrapper around react-i18next useTranslation
   - Type-safe translation keys
6. Update all UI components to use translations:
   - Replace hardcoded strings with t('key')
   - Use Trans component for complex translations
7. Add language selector to Settings:
   - Dropdown with language options
   - Immediate UI update on change
8. Persist language preference in settingsStore

**Dependencies:** Task 16 (Settings Dialog), Task 2 (Frontend Configuration)

**Test Strategy:**
- Test language switch updates all visible text
- Test fallback to English for missing translations
- Test language persists after reload
- Test RTL support (future consideration)

---

### Task: Create Layout Persistence and Preset System

**Description:**
레이아웃 상태를 저장/복원하고 프리셋을 관리하는 시스템을 구현합니다.

**Details:**
1. Define layout serialization format:
   ```typescript
   interface LayoutConfig {
     grid: { columns: string[], rows: string[] };
     panels: { area: string, type: PanelType, tabs?: PanelType[] }[];
     sidebar: { visible: boolean, width: number, activePanel: string };
   }
   ```
2. Create layout presets:
   - Default: 2x2 grid with Ladder, Memory, Canvas
   - Compact: Single panel with tabs
   - Debug: Console expanded at bottom
   - Memory Focus: Large memory visualizer
3. Add layout management to panelStore:
   - saveLayout(name: string): Save current as named preset
   - loadLayout(name: string): Apply saved preset
   - resetToDefault(): Reset to default layout
   - getAvailableLayouts(): List saved layouts
4. Create Tauri commands for layout persistence:
   - save_layout, load_layout, list_layouts, delete_layout
   - Store in app data directory as layouts.json
5. Add layout menu in View menu:
   - List of available presets
   - "Save Current Layout As..."
   - "Reset Layout"
6. Save layout on application close
7. Restore last layout on application start

**Dependencies:** Task 13 (Panel System), Task 16 (Settings Dialog)

**Test Strategy:**
- Test layout saves all panel positions
- Test loading layout restores exact state
- Test presets apply correct configuration
- Test layout persists across app restarts

---

## Unit 3: ModServer (Modbus 서버)

### Task: Implement ModbusMemory Struct with Memory Map

**Description:**
Modbus 메모리 맵을 관리하는 ModbusMemory 구조체를 구현합니다. Coils, Discrete Inputs, Holding Registers, Input Registers를 포함합니다.

**Details:**
1. Add dependencies to Cargo.toml:
   ```toml
   bitvec = "1"
   parking_lot = "0.12"  # Better RwLock performance
   ```
2. Create `src-tauri/src/modbus/mod.rs` with module structure:
   ```
   modbus/
   ├── mod.rs
   ├── memory.rs
   ├── server.rs
   ├── tcp.rs
   ├── rtu.rs
   ├── protocol.rs
   └── types.rs
   ```
3. Create `src-tauri/src/modbus/memory.rs`:
   ```rust
   use bitvec::prelude::*;
   use parking_lot::RwLock;

   pub struct ModbusMemory {
       coils: BitVec<u8, Msb0>,
       discrete_inputs: BitVec<u8, Msb0>,
       holding_registers: Vec<u16>,
       input_registers: Vec<u16>,
   }
   ```
4. Implement memory access methods:
   - read_coils(start: u16, count: u16) -> Result<Vec<bool>>
   - write_coil(address: u16, value: bool) -> Result<()>
   - write_coils(start: u16, values: &[bool]) -> Result<()>
   - read_discrete_inputs(start: u16, count: u16) -> Result<Vec<bool>>
   - read_holding_registers(start: u16, count: u16) -> Result<Vec<u16>>
   - write_holding_register(address: u16, value: u16) -> Result<()>
   - write_holding_registers(start: u16, values: &[u16]) -> Result<()>
   - read_input_registers(start: u16, count: u16) -> Result<Vec<u16>>
5. Add bounds checking and error handling:
   - Return error for out-of-range addresses
   - Return error for count exceeding available range
6. Implement CSV snapshot:
   - save_to_csv(path: &Path) -> Result<()>
   - load_from_csv(path: &Path) -> Result<()>
   - Format: address,type,value per line
7. Create constructor from MemoryMapSettings:
   - new(config: &MemoryMapSettings) -> Self

**Dependencies:** Task 3 (ProjectConfig Types)

**Test Strategy:**
- Unit test read/write for each memory type
- Test boundary conditions (start=0, start=max-1)
- Test error on out-of-range access
- Test CSV roundtrip preserves all data
- Test concurrent access with RwLock

---

### Task: Implement Modbus TCP Server

**Description:**
Modbus TCP 서버를 구현합니다. tokio-modbus를 사용하여 표준 Modbus Function Codes를 처리합니다.

**Details:**
1. Add dependencies to Cargo.toml:
   ```toml
   tokio-modbus = "0.9"
   ```
2. Create `src-tauri/src/modbus/tcp.rs`:
   ```rust
   use tokio_modbus::server::tcp::Server;
   use std::sync::Arc;
   use parking_lot::RwLock;

   pub struct ModbusTcpServer {
       config: TcpConfig,
       memory: Arc<RwLock<ModbusMemory>>,
       server_handle: Option<tokio::task::JoinHandle<()>>,
       shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
   }
   ```
3. Implement ModbusTcpServer methods:
   - new(config: TcpConfig, memory: Arc<RwLock<ModbusMemory>>) -> Self
   - async start(&mut self) -> Result<()>
   - async stop(&mut self) -> Result<()>
   - is_running(&self) -> bool
   - get_connection_count(&self) -> usize
4. Implement Modbus service handler:
   - Create struct implementing tokio_modbus::server::Service trait
   - Handle Function Codes:
     - 0x01: Read Coils
     - 0x02: Read Discrete Inputs
     - 0x03: Read Holding Registers
     - 0x04: Read Input Registers
     - 0x05: Write Single Coil
     - 0x06: Write Single Register
     - 0x0F: Write Multiple Coils
     - 0x10: Write Multiple Registers
5. Add connection tracking:
   - Track connected clients (address, connect time)
   - Emit events on connect/disconnect
6. Implement graceful shutdown:
   - Stop accepting new connections
   - Wait for active requests to complete
   - Clean up resources

**Dependencies:** Task 21 (ModbusMemory)

**Test Strategy:**
- Test server starts and binds to configured port
- Test server stops and releases port
- Test each function code with external Modbus client
- Test concurrent client connections
- Test connection limit enforcement
- Integration test with pymodbus or ModbusPoll

---

### Task: Implement Modbus RTU Server

**Description:**
시리얼 포트를 통한 Modbus RTU 서버를 구현합니다.

**Details:**
1. Add dependencies to Cargo.toml:
   ```toml
   tokio-serial = "5"
   serialport = "4"  # For port enumeration
   ```
2. Create `src-tauri/src/modbus/rtu.rs`:
   ```rust
   pub struct ModbusRtuServer {
       config: RtuConfig,
       memory: Arc<RwLock<ModbusMemory>>,
       port: Option<tokio_serial::SerialStream>,
       running: bool,
   }
   ```
3. Implement port enumeration:
   - list_available_ports() -> Vec<PortInfo>
   - PortInfo: name, port_type, description
   - Filter for relevant port types (USB, Bluetooth, etc.)
4. Implement ModbusRtuServer methods:
   - new(config: RtuConfig, memory: Arc<RwLock<ModbusMemory>>) -> Self
   - async start(&mut self) -> Result<()>
   - async stop(&mut self) -> Result<()>
   - is_running(&self) -> bool
5. Implement RTU frame handling:
   - Read frames with proper timing (3.5 character silence)
   - Parse Modbus RTU frame format
   - CRC-16 validation
   - Route to same handler as TCP (different framing only)
6. Configure serial parameters:
   - Baud rate: 9600, 19200, 38400, 57600, 115200
   - Data bits: 7, 8
   - Parity: None, Odd, Even
   - Stop bits: 1, 2
7. Handle serial port errors:
   - Port disconnection
   - Framing errors
   - Parity errors

**Dependencies:** Task 21 (ModbusMemory), Task 22 (TCP Server for shared handler)

**Test Strategy:**
- Test port enumeration returns available ports
- Test server opens configured port
- Test CRC validation rejects bad frames
- Test with virtual COM port pair (com0com on Windows)
- Test serial parameter configuration

---

### Task: Create Modbus Tauri Commands

**Description:**
Modbus 서버 제어와 메모리 접근을 위한 Tauri 명령어를 구현합니다.

**Details:**
1. Create `src-tauri/src/commands/modbus.rs`:
2. Implement server control commands:
   ```rust
   #[tauri::command]
   async fn modbus_start_tcp(
       state: State<'_, ModbusState>,
       port: u16
   ) -> Result<(), String>;

   #[tauri::command]
   async fn modbus_stop_tcp(state: State<'_, ModbusState>) -> Result<(), String>;

   #[tauri::command]
   async fn modbus_start_rtu(
       state: State<'_, ModbusState>,
       config: RtuConfig
   ) -> Result<(), String>;

   #[tauri::command]
   async fn modbus_stop_rtu(state: State<'_, ModbusState>) -> Result<(), String>;

   #[tauri::command]
   async fn modbus_get_status(state: State<'_, ModbusState>) -> Result<ModbusStatus, String>;

   #[tauri::command]
   async fn modbus_list_serial_ports() -> Result<Vec<PortInfo>, String>;
   ```
3. Implement memory access commands:
   ```rust
   #[tauri::command]
   async fn modbus_read_coils(
       state: State<'_, ModbusState>,
       start: u16,
       count: u16
   ) -> Result<Vec<bool>, String>;

   #[tauri::command]
   async fn modbus_write_coil(
       state: State<'_, ModbusState>,
       address: u16,
       value: bool
   ) -> Result<(), String>;

   #[tauri::command]
   async fn modbus_read_registers(
       state: State<'_, ModbusState>,
       register_type: RegisterType,
       start: u16,
       count: u16
   ) -> Result<Vec<u16>, String>;

   #[tauri::command]
   async fn modbus_write_register(
       state: State<'_, ModbusState>,
       address: u16,
       value: u16
   ) -> Result<(), String>;

   #[tauri::command]
   async fn modbus_bulk_write(
       state: State<'_, ModbusState>,
       operations: Vec<WriteOperation>
   ) -> Result<(), String>;
   ```
4. Create ModbusState struct:
   ```rust
   pub struct ModbusState {
       memory: Arc<RwLock<ModbusMemory>>,
       tcp_server: Mutex<Option<ModbusTcpServer>>,
       rtu_server: Mutex<Option<ModbusRtuServer>>,
   }
   ```
5. Register commands in main.rs
6. Add state initialization on app start

**Dependencies:** Task 22 (TCP Server), Task 23 (RTU Server)

**Test Strategy:**
- Test each command returns correct data
- Test error handling for invalid parameters
- Test commands work when server running/stopped
- Integration test from frontend

---

### Task: Implement Modbus Event System

**Description:**
메모리 변경과 연결 상태 변경을 프론트엔드에 알리는 이벤트 시스템을 구현합니다.

**Details:**
1. Define event types in `src-tauri/src/modbus/types.rs`:
   ```rust
   #[derive(Serialize, Clone)]
   pub struct MemoryChangeEvent {
       pub register_type: RegisterType,
       pub address: u16,
       pub old_value: u16,  // or bool for coils
       pub new_value: u16,
       pub source: ChangeSource,  // Internal, External, Simulation
   }

   #[derive(Serialize, Clone)]
   pub struct ConnectionEvent {
       pub event_type: String,  // "connected", "disconnected"
       pub client_addr: String,
       pub timestamp: String,
   }
   ```
2. Add event emission to ModbusMemory:
   - Store AppHandle reference
   - Emit "modbus:memory-changed" on write operations
   - Debounce rapid changes (optional, for performance)
3. Add connection events to servers:
   - Emit "modbus:connection" on client connect/disconnect
   - Include client address in event payload
4. Create event batching for bulk updates:
   - Collect changes during bulk write
   - Emit single event with all changes
5. Add subscription management:
   - Allow frontend to subscribe to specific address ranges
   - Only emit events for subscribed ranges
6. Frontend event listening:
   ```typescript
   import { listen } from '@tauri-apps/api/event';

   listen('modbus:memory-changed', (event) => {
     const change = event.payload as MemoryChangeEvent;
     // Update UI
   });
   ```

**Dependencies:** Task 24 (Modbus Commands)

**Test Strategy:**
- Test memory write emits event
- Test event contains correct old/new values
- Test connection events fire on connect/disconnect
- Test event batching for bulk operations
- Frontend integration test receives events

---

### Task: Create Frontend Modbus Integration

**Description:**
프론트엔드에서 Modbus 서버를 제어하고 메모리를 모니터링하는 서비스와 훅을 구현합니다.

**Details:**
1. Create `src/services/modbusService.ts`:
   ```typescript
   export const modbusService = {
     // Server control
     startTcp: (port: number) => invoke('modbus_start_tcp', { port }),
     stopTcp: () => invoke('modbus_stop_tcp'),
     startRtu: (config: RtuConfig) => invoke('modbus_start_rtu', { config }),
     stopRtu: () => invoke('modbus_stop_rtu'),
     getStatus: () => invoke<ModbusStatus>('modbus_get_status'),
     listSerialPorts: () => invoke<PortInfo[]>('modbus_list_serial_ports'),

     // Memory access
     readCoils: (start: number, count: number) => invoke<boolean[]>('modbus_read_coils', { start, count }),
     writeCoil: (address: number, value: boolean) => invoke('modbus_write_coil', { address, value }),
     readRegisters: (type: RegisterType, start: number, count: number) =>
       invoke<number[]>('modbus_read_registers', { registerType: type, start, count }),
     writeRegister: (address: number, value: number) => invoke('modbus_write_register', { address, value }),
   };
   ```
2. Create `src/stores/modbusStore.ts`:
   ```typescript
   interface ModbusStore {
     status: ModbusStatus | null;
     isConnecting: boolean;
     error: string | null;
     // Memory cache for subscribed ranges
     coilCache: Map<number, boolean>;
     registerCache: Map<number, number>;
   }
   ```
3. Create `src/hooks/useModbus.ts`:
   - Server control functions
   - Status polling or event-based updates
   - Error handling with toast notifications
4. Create `src/hooks/useModbusMemory.ts`:
   ```typescript
   function useModbusMemory(type: RegisterType, start: number, count: number) {
     const [values, setValues] = useState<number[]>([]);

     useEffect(() => {
       // Initial load
       modbusService.readRegisters(type, start, count).then(setValues);

       // Subscribe to changes
       const unlisten = listen('modbus:memory-changed', (event) => {
         const change = event.payload as MemoryChangeEvent;
         if (isInRange(change.address, start, count)) {
           // Update specific value
         }
       });

       return () => { unlisten.then(fn => fn()); };
     }, [type, start, count]);

     return values;
   }
   ```
5. Create `src/types/modbus.ts` with all TypeScript types:
   - ModbusStatus, RtuConfig, PortInfo
   - RegisterType, MemoryChangeEvent, ConnectionEvent
6. Update ModbusPanel in sidebar:
   - Show server status (running/stopped)
   - Start/Stop buttons
   - Connection count
   - Quick memory view

**Dependencies:** Task 25 (Event System), Task 12 (Sidebar)

**Test Strategy:**
- Mock invoke for unit testing services
- Test useModbusMemory updates on events
- Test server control functions update status
- Integration test with running Modbus server
- E2E test memory visualization updates

---

## Additional Tasks

### Task: Set Up End-to-End Testing Infrastructure

**Description:**
Playwright를 사용한 E2E 테스트 인프라를 구축합니다.

**Details:**
1. Install Playwright:
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```
2. Create `playwright.config.ts`:
   - Configure Tauri app launch
   - Set up test directories
   - Configure screenshot/video on failure
3. Create test utilities:
   - `tests/e2e/utils/app.ts`: Tauri app lifecycle helpers
   - `tests/e2e/utils/selectors.ts`: Common element selectors
4. Create test fixtures:
   - Sample .mop files for testing
   - Mock project configurations
5. Write initial E2E tests:
   - `tests/e2e/project.spec.ts`: Create, open, save project
   - `tests/e2e/layout.spec.ts`: Panel manipulation
   - `tests/e2e/modbus.spec.ts`: Server start/stop, memory view

**Dependencies:** Task 8 (Project UI), Task 15 (Panel DnD)

**Test Strategy:**
- Run tests in CI pipeline
- Visual regression testing for layout
- Test on Windows (primary target)
