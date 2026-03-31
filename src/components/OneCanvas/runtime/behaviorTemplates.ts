import type { Block } from '../types';
import type {
  BehaviorArchetype,
  BehaviorSwitchEvaluation,
  BehaviorTemplateId,
  BehaviorVisualState,
  BlockBehaviorBinding,
  BlockRuntimeState,
  ComponentBehaviorState,
  RuntimeDeviceState,
  RuntimeState,
} from '@/types/behavior';

export interface BehaviorTemplate {
  id: BehaviorTemplateId;
  archetype: BehaviorArchetype;
  label: string;
  blockTypes: readonly string[];
  deviceScoped: boolean;
  interactionMode: 'none' | 'momentary' | 'maintained';
  defaultRuntimeState: BlockRuntimeState;
  defaultVisualState: BehaviorVisualState;
  terminalRoles: Record<string, string>;
}

const RELAY_TEMPLATE: BehaviorTemplate = {
  id: 'archetype:relay',
  archetype: 'relay',
  label: 'Relay',
  blockTypes: ['relay_coil', 'relay_contact_no', 'relay_contact_nc', 'relay'],
  deviceScoped: true,
  interactionMode: 'none',
  defaultRuntimeState: { energized: false, conducting: false },
  defaultVisualState: 'deenergized',
  terminalRoles: { in: 'A1', out: 'A2', coil_in: 'A1', coil_out: 'A2', com: 'COM', no: 'NO', nc: 'NC' },
};

const LAMP_TEMPLATE: BehaviorTemplate = {
  id: 'archetype:lamp',
  archetype: 'lamp',
  label: 'Lamp',
  blockTypes: ['led', 'pilot_lamp'],
  deviceScoped: true,
  interactionMode: 'none',
  defaultRuntimeState: { lit: false },
  defaultVisualState: 'dark',
  terminalRoles: { anode: 'L+', cathode: 'L-', in: 'L+', out: 'L-' },
};

const MOTOR_TEMPLATE: BehaviorTemplate = {
  id: 'archetype:motor',
  archetype: 'motor',
  label: 'Motor',
  blockTypes: ['motor'],
  deviceScoped: true,
  interactionMode: 'none',
  defaultRuntimeState: { running: false },
  defaultVisualState: 'stopped',
  terminalRoles: { l1: 'L1', l2: 'L2', l3: 'L3', pe: 'PE' },
};

const SWITCH_TEMPLATE: BehaviorTemplate = {
  id: 'archetype:switch',
  archetype: 'switch',
  label: 'Switch',
  blockTypes: ['button', 'push_button_no', 'push_button_nc', 'switch_no', 'switch_nc', 'switch_changeover', 'selector_switch', 'emergency_stop', 'plc_out', 'plc_output'],
  deviceScoped: false,
  interactionMode: 'maintained',
  defaultRuntimeState: { pressed: false, conducting: false },
  defaultVisualState: 'open',
  terminalRoles: { in: 'IN', out: 'OUT', com: 'COM', pos1: 'NO', pos2: 'NC' },
};

const BEHAVIOR_TEMPLATES: readonly BehaviorTemplate[] = [RELAY_TEMPLATE, LAMP_TEMPLATE, MOTOR_TEMPLATE, SWITCH_TEMPLATE];
const TEMPLATE_BY_ID = new Map<string, BehaviorTemplate>(BEHAVIOR_TEMPLATES.map((template) => [template.id, template]));
const TEMPLATE_BY_BLOCK_TYPE = new Map<string, BehaviorTemplate>();
for (const template of BEHAVIOR_TEMPLATES) {
  for (const blockType of template.blockTypes) {
    TEMPLATE_BY_BLOCK_TYPE.set(blockType, template);
  }
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(block: Block): Record<string, unknown> {
  return block as unknown as Record<string, unknown>;
}

function getBlockType(block: Block): string {
  return String(block.type);
}

export function getBehaviorTemplate(templateId: BehaviorTemplateId): BehaviorTemplate | undefined {
  return TEMPLATE_BY_ID.get(templateId);
}

export function getBehaviorTemplateForBlockType(blockType: string): BehaviorTemplate | undefined {
  return TEMPLATE_BY_BLOCK_TYPE.get(blockType);
}

export function getBehaviorTemplateForBlock(block: Block): BehaviorTemplate | undefined {
  if (block.behavior?.templateId) {
    return TEMPLATE_BY_ID.get(block.behavior.templateId as string) ?? TEMPLATE_BY_BLOCK_TYPE.get(getBlockType(block));
  }
  return TEMPLATE_BY_BLOCK_TYPE.get(getBlockType(block));
}

export function resolveDeviceId(blockId: string, designation?: string, label?: string): string {
  return designation?.trim() || label?.trim() || blockId;
}

export function resolveBehaviorBinding(block: Block): BlockBehaviorBinding | undefined {
  if (block.behavior) {
    return block.behavior;
  }

  const template = getBehaviorTemplateForBlockType(getBlockType(block));
  if (!template) return undefined;

  return {
    templateId: template.id,
    archetype: template.archetype,
    interactionMode: template.interactionMode,
    terminalRoles: template.terminalRoles,
    deviceScoped: template.deviceScoped,
    ...(template.deviceScoped
      ? { deviceId: resolveDeviceId(block.id, block.designation, block.label) }
      : {}),
  };
}

export function createBehaviorPatch(blockType: string, blockId: string, props: Partial<Block> = {}): Partial<Block> {
  const template = props.behavior?.templateId
    ? TEMPLATE_BY_ID.get(props.behavior.templateId as string)
    : getBehaviorTemplateForBlockType(blockType);

  if (!template && !props.behavior && !props.runtimeState && !props.visualState) {
    return {};
  }

  const behavior = props.behavior ?? (template
    ? {
        templateId: template.id,
        archetype: template.archetype,
        interactionMode: template.interactionMode,
        terminalRoles: template.terminalRoles,
        deviceScoped: template.deviceScoped,
        ...(template.deviceScoped
          ? { deviceId: resolveDeviceId(blockId, props.designation, props.label) }
          : {}),
      }
    : undefined);

  return {
    ...(behavior ? { behavior } : {}),
    runtimeState: {
      ...(template?.defaultRuntimeState ?? {}),
      ...(props.runtimeState ?? {}),
    },
    visualState: props.visualState ?? template?.defaultVisualState ?? 'idle',
  } as Partial<Block>;
}

function getNormallyOpen(block: Block): boolean {
  const blockType = getBlockType(block);
  if (blockType === 'relay_contact_nc' || blockType === 'switch_nc' || blockType === 'push_button_nc') {
    return false;
  }
  return readBoolean(asRecord(block).normallyOpen) ?? true;
}

function parsePlcAddress(block: Block): number {
  const raw = asRecord(block).address;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    return parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
  }
  return 0;
}

function getMaintainedConducting(block: Block, runtimeState: RuntimeState, defaultConducting: boolean): BehaviorSwitchEvaluation {
  const override = runtimeState.manualOverrides.get(block.id);
  const conducting = override ?? defaultConducting;
  const isNormallyOpen = getNormallyOpen(block);

  return {
    componentId: block.id,
    deviceId: block.behavior?.deviceId,
    stateSource: override !== undefined ? 'manual' : 'default',
    energized: conducting,
    isNormallyOpen,
    conducting,
    visualState: conducting ? 'closed' : 'open',
  };
}

export function evaluateBehaviorSwitch(block: Block, runtimeState: RuntimeState): BehaviorSwitchEvaluation | null {
  const template = getBehaviorTemplateForBlock(block);
  if (!template) return null;

  const blockType = getBlockType(block);

  if (template.archetype === 'relay' && (blockType === 'relay_contact_no' || blockType === 'relay_contact_nc')) {
    const deviceId = block.behavior?.deviceId ?? resolveDeviceId(block.id, block.designation, block.label);
    const deviceState = runtimeState.deviceStates.get(deviceId);
    const energized = deviceState?.energized ?? readBoolean(block.runtimeState?.energized) ?? false;
    const isNormallyOpen = blockType === 'relay_contact_no';
    const conducting = isNormallyOpen ? energized : !energized;

    return {
      componentId: block.id,
      deviceId,
      stateSource: 'relay',
      energized,
      isNormallyOpen,
      conducting,
      visualState: conducting ? 'closed' : 'open',
    };
  }

  if (template.archetype !== 'switch') {
    return null;
  }

  if (blockType === 'plc_out' || blockType === 'plc_output') {
    if (runtimeState.manualOverrides.has(block.id)) {
      const override = runtimeState.manualOverrides.get(block.id) ?? false;
      return {
        componentId: block.id,
        deviceId: block.behavior?.deviceId,
        stateSource: 'manual',
        energized: override,
        isNormallyOpen: getNormallyOpen(block),
        conducting: override,
        visualState: override ? 'closed' : 'open',
      };
    }

    const plcState = runtimeState.plcOutputs.get(parsePlcAddress(block)) ?? false;
    const inverted = readBoolean(asRecord(block).inverted) ?? false;
    const effectiveState = inverted ? !plcState : plcState;
    const isNormallyOpen = getNormallyOpen(block);
    const conducting = isNormallyOpen ? effectiveState : !effectiveState;

    return {
      componentId: block.id,
      deviceId: block.behavior?.deviceId,
      stateSource: 'plc',
      energized: effectiveState,
      isNormallyOpen,
      conducting,
      visualState: conducting ? 'closed' : 'open',
    };
  }

  if (blockType === 'button' || blockType === 'push_button_no' || blockType === 'push_button_nc' || blockType === 'emergency_stop') {
    if (runtimeState.manualOverrides.has(block.id)) {
      const override = runtimeState.manualOverrides.get(block.id) ?? false;
      return {
        componentId: block.id,
        deviceId: block.behavior?.deviceId,
        stateSource: 'manual',
        energized: override,
        isNormallyOpen: getNormallyOpen(block),
        conducting: override,
        visualState: override ? 'pressed' : 'released',
      };
    }

    const pressed = runtimeState.buttonStates.get(block.id) ?? readBoolean(asRecord(block).pressed) ?? false;
    const isNormallyOpen = getNormallyOpen(block);
    const conducting = isNormallyOpen ? pressed : !pressed;

    return {
      componentId: block.id,
      deviceId: block.behavior?.deviceId,
      stateSource: 'button',
      energized: pressed,
      isNormallyOpen,
      conducting,
      visualState: pressed ? 'pressed' : 'released',
    };
  }

  const defaultConducting = readString(asRecord(block).state) === 'closed' || readBoolean(asRecord(block).closed) === true;
  return getMaintainedConducting(block, runtimeState, defaultConducting);
}

export function deriveComponentBehaviorState(
  block: Block,
  runtimeState: RuntimeState,
  powered: boolean,
  reachable: boolean,
  switchState?: BehaviorSwitchEvaluation | null
): ComponentBehaviorState | null {
  const binding = resolveBehaviorBinding(block);
  if (!binding) return null;

  if (binding.archetype === 'relay') {
    const deviceId = binding.deviceId ?? resolveDeviceId(block.id, block.designation, block.label);
    const deviceState = runtimeState.deviceStates.get(deviceId);
    const energized = deviceState?.energized ?? powered;

    return {
      componentId: block.id,
      deviceId,
      templateId: binding.templateId,
      archetype: binding.archetype,
      visualState: switchState ? switchState.visualState : (energized ? 'energized' : 'deenergized'),
      powered,
      energized,
      conducting: switchState?.conducting,
    };
  }

  if (binding.archetype === 'lamp') {
    const lit = powered;
    return {
      componentId: block.id,
      deviceId: binding.deviceId,
      templateId: binding.templateId,
      archetype: binding.archetype,
      visualState: lit ? 'lit' : 'dark',
      powered,
      lit,
    };
  }

  if (binding.archetype === 'motor') {
    const running = powered || reachable;
    return {
      componentId: block.id,
      deviceId: binding.deviceId,
      templateId: binding.templateId,
      archetype: binding.archetype,
      visualState: running ? 'running' : 'stopped',
      powered,
      running,
    };
  }

  const conducting = switchState?.conducting ?? false;
  return {
    componentId: block.id,
    deviceId: binding.deviceId,
    templateId: binding.templateId,
    archetype: binding.archetype,
    visualState: switchState?.visualState ?? (conducting ? 'closed' : 'open'),
    powered,
    conducting,
    pressed: switchState?.visualState === 'pressed',
    energized: switchState?.energized,
  };
}

export function mergeRuntimeDeviceState(runtimeState: RuntimeState, deviceId: string, patch: RuntimeDeviceState): RuntimeState {
  const nextDeviceStates = new Map(runtimeState.deviceStates);
  nextDeviceStates.set(deviceId, {
    ...(nextDeviceStates.get(deviceId) ?? {}),
    ...patch,
  });

  return {
    ...runtimeState,
    deviceStates: nextDeviceStates,
  };
}
