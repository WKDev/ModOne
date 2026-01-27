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
};
