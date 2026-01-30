/**
 * Common element selectors for E2E tests
 * All selectors use data-testid attributes for reliable element selection
 */
export const selectors = {
  // Menu Bar
  menuBar: '[data-testid="menu-bar"]',
  menuFile: '[data-testid="menu-file"]',
  menuEdit: '[data-testid="menu-edit"]',
  menuView: '[data-testid="menu-view"]',
  menuSimulation: '[data-testid="menu-simulation"]',
  menuModbus: '[data-testid="menu-modbus"]',
  menuHelp: '[data-testid="menu-help"]',

  // Menu Items
  menuNewProject: '[data-testid="menu-new-project"]',
  menuOpenProject: '[data-testid="menu-open-project"]',
  menuSave: '[data-testid="menu-save"]',
  menuSaveAs: '[data-testid="menu-save-as"]',
  menuRecentProjects: '[data-testid="menu-recent-projects"]',
  menuExit: '[data-testid="menu-exit"]',
  menuToggleSidebar: '[data-testid="menu-toggle-sidebar"]',
  menuResetLayout: '[data-testid="menu-reset-layout"]',

  // Activity Bar
  activityBar: '[data-testid="activity-bar"]',
  activityExplorer: '[data-testid="activity-explorer"]',
  activitySearch: '[data-testid="activity-search"]',
  activityModbus: '[data-testid="activity-modbus"]',
  activitySettings: '[data-testid="activity-settings"]',

  // Sidebar
  sidebar: '[data-testid="sidebar"]',
  sidebarContent: '[data-testid="sidebar-content"]',
  sidebarHeader: '[data-testid="sidebar-header"]',
  sidebarResizeHandle: '[data-testid="sidebar-resize-handle"]',

  // Project Operations
  newProjectBtn: '[data-testid="new-project-btn"]',
  openProjectBtn: '[data-testid="open-project-btn"]',
  projectNameInput: '[data-testid="project-name-input"]',
  projectFolderSelect: '[data-testid="project-folder-select"]',
  createProjectBtn: '[data-testid="create-project-btn"]',
  cancelProjectBtn: '[data-testid="cancel-project-btn"]',
  projectHeader: '[data-testid="project-header"]',
  projectName: '[data-testid="project-name"]',

  // New Project Dialog
  newProjectDialog: '[data-testid="new-project-dialog"]',
  newProjectClose: '[data-testid="new-project-close"]',

  // Unsaved Changes Dialog
  unsavedChangesDialog: '[data-testid="unsaved-changes-dialog"]',
  unsavedSaveBtn: '[data-testid="unsaved-save-btn"]',
  unsavedDiscardBtn: '[data-testid="unsaved-discard-btn"]',
  unsavedCancelBtn: '[data-testid="unsaved-cancel-btn"]',

  // Recent Projects
  recentProjectsList: '[data-testid="recent-projects-list"]',
  recentProjectItem: '[data-testid="recent-project-item"]',

  // Panel System
  panelContainer: '[data-testid="panel-container"]',
  panel: (id: string) => `[data-testid="panel-${id}"]`,
  panelHeader: (id: string) => `[data-testid="panel-header-${id}"]`,
  panelContent: (id: string) => `[data-testid="panel-content-${id}"]`,
  panelCloseBtn: (id: string) => `[data-testid="panel-close-${id}"]`,
  resizeHandleHorizontal: '[data-testid="resize-handle-horizontal"]',
  resizeHandleVertical: '[data-testid="resize-handle-vertical"]',

  // Tab System
  tabBar: '[data-testid="tab-bar"]',
  tab: (id: string) => `[data-testid="tab-${id}"]`,
  tabCloseBtn: (id: string) => `[data-testid="tab-close-${id}"]`,
  activeTab: '[data-testid="tab-active"]',

  // Modbus Controls
  modbusStartTcp: '[data-testid="modbus-start-tcp"]',
  modbusStopTcp: '[data-testid="modbus-stop-tcp"]',
  tcpStatus: '[data-testid="tcp-status"]',
  tcpPortInput: '[data-testid="tcp-port-input"]',
  modbusStartRtu: '[data-testid="modbus-start-rtu"]',
  modbusStopRtu: '[data-testid="modbus-stop-rtu"]',
  rtuStatus: '[data-testid="rtu-status"]',

  // Memory Visualizer
  memoryVisualizer: '[data-testid="memory-visualizer"]',
  memoryCoils: '[data-testid="memory-coils"]',
  memoryRegisters: '[data-testid="memory-registers"]',
  memoryAddress: (address: number) => `[data-testid="memory-address-${address}"]`,
  memoryValue: (address: number) => `[data-testid="memory-value-${address}"]`,

  // Simulation Controls
  simulationStart: '[data-testid="simulation-start"]',
  simulationStop: '[data-testid="simulation-stop"]',
  simulationPause: '[data-testid="simulation-pause"]',
  simulationStep: '[data-testid="simulation-step"]',
  simulationReset: '[data-testid="simulation-reset"]',
  simulationStatus: '[data-testid="simulation-status"]',

  // Toolbar
  toolbar: '[data-testid="toolbar"]',
  toolbarBtn: (name: string) => `[data-testid="toolbar-${name}"]`,

  // Status Bar
  statusBar: '[data-testid="status-bar"]',
  statusBarItem: (name: string) => `[data-testid="status-${name}"]`,

  // Settings Dialog
  settingsDialog: '[data-testid="settings-dialog"]',
  settingsClose: '[data-testid="settings-close"]',
  settingsTab: (name: string) => `[data-testid="settings-tab-${name}"]`,
  settingsSave: '[data-testid="settings-save"]',
  settingsCancel: '[data-testid="settings-cancel"]',

  // Console Panel
  consolePanel: '[data-testid="console-panel"]',
  consoleOutput: '[data-testid="console-output"]',
  consoleClear: '[data-testid="console-clear"]',

  // Ladder Editor
  ladderEditor: '[data-testid="ladder-editor"]',
  ladderRung: (index: number) => `[data-testid="ladder-rung-${index}"]`,
  ladderElement: (id: string) => `[data-testid="ladder-element-${id}"]`,

  // Properties Panel
  propertiesPanel: '[data-testid="properties-panel"]',
  propertyInput: (name: string) => `[data-testid="property-${name}"]`,

  // Explorer Panel
  explorerPanel: '[data-testid="explorer-panel"]',
  explorerTree: '[data-testid="explorer-tree"]',
  explorerItem: (path: string) => `[data-testid="explorer-item-${path}"]`,

  // Search Panel
  searchPanel: '[data-testid="search-panel"]',
  searchInput: '[data-testid="search-input"]',
  searchResults: '[data-testid="search-results"]',
  searchResultItem: (index: number) => `[data-testid="search-result-${index}"]`,

  // Common UI Elements
  dialogOverlay: '[data-testid="dialog-overlay"]',
  dialogContent: '[data-testid="dialog-content"]',
  errorMessage: '[data-testid="error-message"]',
  loadingSpinner: '[data-testid="loading-spinner"]',
  notification: '[data-testid="notification"]',

  // Floating Windows
  panelUndockBtn: (panelId: string) => `[data-testid="panel-undock-${panelId}"]`,
  floatingWindow: '[data-floating-window]',
  floatingWindowHeader: '[data-testid="floating-window-header"]',
  floatingWindowDockBtn: '[data-testid="floating-dock-btn"]',
  floatingWindowMinBtn: '[data-testid="floating-minimize-btn"]',
  floatingWindowMaxBtn: '[data-testid="floating-maximize-btn"]',
  floatingWindowCloseBtn: '[data-testid="floating-close-btn"]',
  floatingWindowDragHandle: '[data-testid="floating-drag-handle"]',
} as const;

export type SelectorKey = keyof typeof selectors;
