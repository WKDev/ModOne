export type BehaviorArchetype = 'relay' | 'lamp' | 'motor' | 'switch';

export type BehaviorTemplateId =
  | 'archetype:relay'
  | 'archetype:lamp'
  | 'archetype:motor'
  | 'archetype:switch';

export type BehaviorStateSource =
  | 'plc'
  | 'button'
  | 'relay'
  | 'manual'
  | 'circuit'
  | 'default';

export type BehaviorVisualState =
  | 'idle'
  | 'open'
  | 'closed'
  | 'pressed'
  | 'released'
  | 'lit'
  | 'dark'
  | 'running'
  | 'stopped'
  | 'energized'
  | 'deenergized';

export type BlockRuntimeValue = string | number | boolean;
export type BlockRuntimeState = Record<string, BlockRuntimeValue>;

export interface SymbolBehaviorBinding {
  templateId?: BehaviorTemplateId | (string & {});
  archetype?: BehaviorArchetype | (string & {});
  interactionMode?: 'none' | 'momentary' | 'maintained';
  terminalRoles?: Record<string, string>;
  deviceScoped?: boolean;
  /** IFTTT-style behavior rules (from XML) */
  rules?: import('./behaviorRules').BehaviorRule[];
  /** Block simulation domain */
  domain?: import('./behaviorRules').BlockDomain;
}

export interface BlockBehaviorBinding extends SymbolBehaviorBinding {
  deviceId?: string;
}

export interface RuntimeDeviceState {
  energized?: boolean;
  lit?: boolean;
  running?: boolean;
  pressed?: boolean;
  conducting?: boolean;
  position?: number;
  fault?: boolean;
}

export interface RuntimeState {
  plcOutputs: Map<number, boolean>;
  buttonStates: Map<string, boolean>;
  manualOverrides: Map<string, boolean>;
  deviceStates: Map<string, RuntimeDeviceState>;
}

export interface BehaviorSwitchEvaluation {
  componentId: string;
  deviceId?: string;
  stateSource: BehaviorStateSource;
  energized: boolean;
  isNormallyOpen: boolean;
  conducting: boolean;
  visualState: BehaviorVisualState;
}

export interface ComponentBehaviorState {
  componentId: string;
  deviceId?: string;
  templateId?: BehaviorTemplateId | (string & {});
  archetype?: BehaviorArchetype | (string & {});
  visualState: BehaviorVisualState;
  powered: boolean;
  energized?: boolean;
  conducting?: boolean;
  lit?: boolean;
  running?: boolean;
  pressed?: boolean;
}

export function createEmptyRuntimeState(): RuntimeState {
  return {
    plcOutputs: new Map(),
    buttonStates: new Map(),
    manualOverrides: new Map(),
    deviceStates: new Map(),
  };
}
