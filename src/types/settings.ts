/**
 * Application settings type definitions
 * These types must match the Rust AppSettings struct in src-tauri/src/commands/settings.rs
 */

export type Language = 'ko' | 'en' | 'ja';
export type Theme = 'light' | 'dark' | 'system';
export type TimerPrecision = 'low' | 'medium' | 'high';
export type SimulationSpeed = 0.5 | 1 | 2 | 4;
export type StepExecutionMode = 'single-step' | 'until-breakpoint' | 'continuous';
export type BaudRate = 9600 | 19200 | 38400 | 57600 | 115200;
export type Parity = 'none' | 'odd' | 'even';
export type StopBits = 1 | 2;
export type LadderShortcutProfile = 'default' | 'xg5000' | 'gxworks';
/** R 키 회전 방향: 시계(cw) / 반시계(ccw) */
export type RotationDirection = 'cw' | 'ccw';

/**
 * Application settings interface
 * Stored in app_data/settings.json
 */
export interface AppSettings {
  // General settings
  language: Language;
  autoSaveInterval: number; // seconds, minimum 30
  startWithLastProject: boolean;
  telemetryEnabled: boolean;
  showWelcomePageOnStartup: boolean;

  // Simulation settings
  defaultScanTimeMs: number; // 1-1000
  timerPrecision: TimerPrecision;
  simulationSpeedMultiplier: SimulationSpeed;
  stepExecutionMode: StepExecutionMode;

  // Modbus settings
  defaultTcpPort: number; // 1-65535
  rtuComPort: string;
  rtuBaudRate: BaudRate;
  rtuParity: Parity;
  rtuStopBits: StopBits;
  connectionTimeoutMs: number;
  autoReconnect: boolean;

  // Appearance settings
  theme: Theme;
  fontSize: number; // 12-20
  gridDisplay: boolean;
  animationEnabled: boolean;
  canvasCrosshairEnabled: boolean;

  // Ladder settings
  ladderShortcutProfile: LadderShortcutProfile;

  // Canvas / symbol settings
  symbolRotationStep: number;            // R 1회당 회전 각도(도), 1-360
  symbolRotationDirection: RotationDirection; // 기본 회전 방향
  symbolRotationKeepConnections: boolean; // 회전 시 포트-와이어 연결 유지(true) / 끊기(false)

  // Sheet settings
  defaultSheet: string;     // built-in template name: 'A3-landscape' | 'A4-landscape' | etc.
  sheetSnapGrid: number;    // snap grid in mm (5 or 10)

  // Keyboard shortcut overrides
  // Only stores user-modified bindings. Key: command ID, Value: key combo string.
  // e.g. { "edit.undo": "Ctrl+Shift+Z" }
  keybindingOverrides: Record<string, string>;

  // Auto-designation prefix overrides
  // Only stores user-modified prefixes on top of the IEC 81346-2 default table.
  // Key: canonical block type, Value: prefix. e.g. { "contactor": "KM" }
  designationPrefixOverrides: Record<string, string>;
}

/**
 * Default application settings
 */
export const defaultSettings: AppSettings = {
  // General
  language: 'ko',
  autoSaveInterval: 60,
  startWithLastProject: true,
  telemetryEnabled: false,
  showWelcomePageOnStartup: true,

  // Simulation
  defaultScanTimeMs: 10,
  timerPrecision: 'medium',
  simulationSpeedMultiplier: 1,
  stepExecutionMode: 'continuous',

  // Modbus
  defaultTcpPort: 502,
  rtuComPort: '',
  rtuBaudRate: 9600,
  rtuParity: 'none',
  rtuStopBits: 1,
  connectionTimeoutMs: 3000,
  autoReconnect: true,

  // Appearance
  theme: 'system',
  fontSize: 14,
  gridDisplay: true,
  animationEnabled: true,
  canvasCrosshairEnabled: false,

  // Ladder
  ladderShortcutProfile: 'default',

  // Canvas / symbol
  symbolRotationStep: 90,
  symbolRotationDirection: 'cw',
  symbolRotationKeepConnections: true,

  // Sheet
  defaultSheet: 'A3-landscape',
  sheetSnapGrid: 5,

  // Keyboard shortcut overrides (empty = all defaults)
  keybindingOverrides: {},

  // Auto-designation prefix overrides (empty = IEC 81346-2 defaults)
  designationPrefixOverrides: {},
};
