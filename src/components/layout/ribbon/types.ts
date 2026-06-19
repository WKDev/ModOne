import type { RibbonIconKey } from './ribbonIcons';

export type RibbonTabId = 'canvas' | 'ladder' | 'scenario' | 'integration' | 'layout';

export interface RibbonContext {
  simulationStatus: 'running' | 'paused' | 'stopped';
  scenarioStatus: 'idle' | 'running' | 'paused' | 'stopped';
  modbusTcpRunning: boolean;
  opcuaRunning: boolean;
}

export type RibbonPredicate = (context: RibbonContext) => boolean;

export interface RibbonActionConfig {
  id: string;
  label: string;
  commandId: string;
  icon: RibbonIconKey;
  dataTestId?: string;
  disabled?: boolean | RibbonPredicate;
  active?: boolean | RibbonPredicate;
  visible?: boolean | RibbonPredicate;
}

export interface RibbonGroupConfig {
  id: string;
  title: string;
  actions: RibbonActionConfig[];
  visible?: boolean | RibbonPredicate;
}

export interface RibbonTabConfig {
  id: RibbonTabId;
  label: string;
  groups: RibbonGroupConfig[];
  visible?: boolean | RibbonPredicate;
}

export interface RibbonResolvedAction {
  id: string;
  label: string;
  commandId: string;
  icon: RibbonIconKey;
  dataTestId?: string;
  disabled: boolean;
  active: boolean;
}

export interface RibbonResolvedGroup {
  id: string;
  title: string;
  actions: RibbonResolvedAction[];
}

export interface RibbonResolvedTab {
  id: RibbonTabId;
  label: string;
  groups: RibbonResolvedGroup[];
}
