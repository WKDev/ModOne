/**
 * Circuit domain types.
 *
 * Rendering-agnostic contracts for schematic/circuit data.
 */

import type { PinElectricalTypeV2, PinFunctionalRole } from './symbol';

// ============================================================================
// Core primitives
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Rect = Position & Size;
export type Rotation = 0 | 90 | 180 | 270;

export interface Flip {
  horizontal: boolean;
  vertical: boolean;
}

export type BlockPropertyValue = string | number | boolean;
export type BlockProperties = Record<string, BlockPropertyValue>;

export function generateId(prefix = 'id'): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${suffix}`;
}

// ============================================================================
// Ports
// ============================================================================

export type PortPosition = 'top' | 'right' | 'bottom' | 'left';
export type PortType = 'input' | 'output' | 'bidirectional' | 'power' | 'passive';

export interface Port {
  id: string;
  name: string;
  position: PortPosition;
  type: PortType;
  offset: Position;
  electricalType?: string;
}

export interface PortV2 {
  id: string;
  name: string;
  position: PortPosition;
  type: PortType;
  offset: Position;
  number?: string;
  electricalType?: PinElectricalTypeV2;
  functionalRole?: PinFunctionalRole;
}

// ============================================================================
// Blocks
// ============================================================================

export type CanonicalBlockType =
  | 'power_source'
  | 'motor'
  | 'relay_coil'
  | 'relay_contact_no'
  | 'relay_contact_nc'
  | 'switch_no'
  | 'switch_nc'
  | 'switch_changeover'
  | 'fuse'
  | 'circuit_breaker'
  | 'transformer'
  | 'capacitor'
  | 'resistor'
  | 'inductor'
  | 'diode'
  | 'led'
  | 'ground'
  | 'terminal'
  | 'connector'
  | 'plc_input'
  | 'plc_output'
  | 'timer_on_delay'
  | 'timer_off_delay'
  | 'counter_up'
  | 'counter_down'
  | 'junction_box'
  | 'push_button_no'
  | 'push_button_nc'
  | 'overload_relay'
  | 'contactor'
  | 'custom_symbol'
  // legacy/compat values still present across consumers/tests
  | 'powersource'
  | 'plc_in'
  | 'plc_out'
  | 'button'
  | 'scope'
  | 'text'
  | 'relay'
  | 'emergency_stop'
  | 'selector_switch'
  | 'solenoid_valve'
  | 'sensor'
  | 'pilot_lamp'
  | 'net_label'
  | 'terminal_block'
  | 'disconnect_switch'
  | 'off_page_connector';

export type BlockType = CanonicalBlockType | (string & {});

export interface BaseBlock<T extends string = BlockType> {
  id: string;
  type: T;
  position: Position;
  size: Size;
  ports: Port[];
  rotation?: Rotation;
  flip?: Flip;
  label?: string;
  designation?: string;
  properties?: BlockProperties;
  locked?: boolean;
  visible?: boolean;
  layer?: string;
  selected?: boolean;
}

export type PowerPolarity = 'positive' | 'negative' | 'ground';
export type ContactState = 'open' | 'closed';
export type LedColor = 'red' | 'green' | 'blue' | 'yellow' | 'white';
export type ButtonMode = 'momentary' | 'stationary';
export type ContactConfig = '1a' | '1b' | '1a1b' | '2a' | '2b' | '2a2b' | '3a3b';
export type TriggerMode = 'auto' | 'normal' | 'single';
export type TextStyle = 'label' | 'title' | 'note' | 'section';

export interface PowerSourceBlock extends BaseBlock<'power_source' | 'powersource'> {
  voltage?: number;
  frequency?: number;
  polarity?: PowerPolarity;
  sourceKind?: 'ac' | 'dc';
  phaseCount?: 1 | 3;
  maxCurrent?: number;
}

export interface MotorBlock extends BaseBlock<'motor'> {}
export interface RelayCoilBlock extends BaseBlock<'relay_coil' | 'relay'> {
  coilVoltage?: number;
  coilType?: 'standard' | 'latching' | 'time_delay';
  ratedVoltage?: number;
  energized?: boolean;
}
export interface RelayContactNoBlock extends BaseBlock<'relay_contact_no'> { state?: ContactState }
export interface RelayContactNcBlock extends BaseBlock<'relay_contact_nc'> { state?: ContactState }
export interface SwitchNoBlock extends BaseBlock<'switch_no'> { state?: ContactState }
export interface SwitchNcBlock extends BaseBlock<'switch_nc'> { state?: ContactState }
export interface SwitchChangeoverBlock extends BaseBlock<'switch_changeover' | 'selector_switch'> {}
export interface FuseBlock extends BaseBlock<'fuse'> {}
export interface CircuitBreakerBlock extends BaseBlock<'circuit_breaker' | 'disconnect_switch'> {}
export interface TransformerBlock extends BaseBlock<'transformer'> {}
export interface CapacitorBlock extends BaseBlock<'capacitor'> {}
export interface ResistorBlock extends BaseBlock<'resistor'> {}
export interface InductorBlock extends BaseBlock<'inductor'> {}
export interface DiodeBlock extends BaseBlock<'diode'> {}
export interface LedBlock extends BaseBlock<'led' | 'pilot_lamp'> {
  color?: LedColor;
  forwardVoltage?: number;
  lit?: boolean;
}
export interface GroundBlock extends BaseBlock<'ground'> {}
export interface TerminalBlock extends BaseBlock<'terminal' | 'terminal_block'> {}
export interface ConnectorBlock extends BaseBlock<'connector' | 'off_page_connector'> {}
export interface PlcInputBlock extends BaseBlock<'plc_input' | 'plc_in' | 'sensor'> {
  address?: string;
  signalType?: 'digital' | 'analog';
  thresholdVoltage?: number;
  inverted?: boolean;
}
export interface PlcOutputBlock extends BaseBlock<'plc_output' | 'plc_out'> {
  address?: string;
  signalType?: 'digital' | 'analog';
  normallyOpen?: boolean;
  inverted?: boolean;
}
export interface TimerOnDelayBlock extends BaseBlock<'timer_on_delay'> {}
export interface TimerOffDelayBlock extends BaseBlock<'timer_off_delay'> {}
export interface CounterUpBlock extends BaseBlock<'counter_up'> {}
export interface CounterDownBlock extends BaseBlock<'counter_down'> {}
export interface JunctionBoxBlock extends BaseBlock<'junction_box'> {}
export interface PushButtonNoBlock extends BaseBlock<'push_button_no' | 'button'> {
  mode?: ButtonMode;
  contactConfig?: ContactConfig;
  pressed?: boolean;
}
export interface PushButtonNcBlock extends BaseBlock<'push_button_nc' | 'emergency_stop'> {
  mode?: ButtonMode;
  contactConfig?: ContactConfig;
  pressed?: boolean;
}
export interface OverloadRelayBlock extends BaseBlock<'overload_relay'> {}
export interface ContactorBlock extends BaseBlock<'contactor' | 'solenoid_valve'> {}
export interface CustomSymbolBlock extends BaseBlock<'custom_symbol' | 'scope' | 'text' | 'net_label'> {
  symbolId?: string;
  selectedUnit?: number;
  instanceProperties?: BlockProperties;
  content?: string;
  textStyle?: TextStyle;
  triggerMode?: TriggerMode;
  channels?: 1 | 2 | 3 | 4;
  timeBase?: number;
  voltageScale?: number;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  showBorder?: boolean;
}

export type Block =
  | PowerSourceBlock
  | MotorBlock
  | RelayCoilBlock
  | RelayContactNoBlock
  | RelayContactNcBlock
  | SwitchNoBlock
  | SwitchNcBlock
  | SwitchChangeoverBlock
  | FuseBlock
  | CircuitBreakerBlock
  | TransformerBlock
  | CapacitorBlock
  | ResistorBlock
  | InductorBlock
  | DiodeBlock
  | LedBlock
  | GroundBlock
  | TerminalBlock
  | ConnectorBlock
  | PlcInputBlock
  | PlcOutputBlock
  | TimerOnDelayBlock
  | TimerOffDelayBlock
  | CounterUpBlock
  | CounterDownBlock
  | JunctionBoxBlock
  | PushButtonNoBlock
  | PushButtonNcBlock
  | OverloadRelayBlock
  | ContactorBlock
  | CustomSymbolBlock;

export type BlockByType<T extends BlockType> = Extract<Block, { type: T }>;
export type RelayBlock = RelayCoilBlock | RelayContactNoBlock | RelayContactNcBlock;
export type ButtonBlock = PushButtonNoBlock | PushButtonNcBlock;
export type LEDBlock = LedBlock;
export type PLCInputBlock = PlcInputBlock;
export type PLCOutputBlock = PlcOutputBlock;
export type PlcInBlock = PlcInputBlock;
export type PlcOutBlock = PlcOutputBlock;
export type ScopeBlock = CustomSymbolBlock;
export type TextBlock = CustomSymbolBlock;

/**
 * ComponentInstance — unified component type for the v2 symbol pipeline.
 * Replaces the 27 specialized Block interfaces in the long term.
 * Currently additive — Block union remains for backward compat.
 */
export interface ComponentInstance {
  id: string;
  symbolId: string;           // references SymbolDefinition.id
  type: string;               // backward compat — maps to symbolId via registry
  position: Position;
  rotation: number;
  instanceProperties: Record<string, unknown>;
  selectedUnit?: number;
  ports: Port[];
  label?: string;
  designation?: string;
}

const BLOCK_TYPE_SET: Readonly<Record<CanonicalBlockType, true>> = {
  power_source: true,
  motor: true,
  relay_coil: true,
  relay_contact_no: true,
  relay_contact_nc: true,
  switch_no: true,
  switch_nc: true,
  switch_changeover: true,
  fuse: true,
  circuit_breaker: true,
  transformer: true,
  capacitor: true,
  resistor: true,
  inductor: true,
  diode: true,
  led: true,
  ground: true,
  terminal: true,
  connector: true,
  plc_input: true,
  plc_output: true,
  timer_on_delay: true,
  timer_off_delay: true,
  counter_up: true,
  counter_down: true,
  junction_box: true,
  push_button_no: true,
  push_button_nc: true,
  overload_relay: true,
  contactor: true,
  custom_symbol: true,
  powersource: true,
  plc_in: true,
  plc_out: true,
  button: true,
  scope: true,
  text: true,
  relay: true,
  emergency_stop: true,
  selector_switch: true,
  solenoid_valve: true,
  sensor: true,
  pilot_lamp: true,
  net_label: true,
  terminal_block: true,
  disconnect_switch: true,
  off_page_connector: true,
};

export function isBlockType(value: string): value is CanonicalBlockType {
  return value in BLOCK_TYPE_SET;
}

export function isBlockOfType<T extends BlockType>(block: Block, type: T): block is BlockByType<T> {
  return block.type === type;
}

export function isPowerSource(block: Block): block is PowerSourceBlock {
  return block.type === 'power_source' || block.type === 'powersource';
}

export declare function getBlockDefaults(type: BlockType, id?: string, size?: Size, position?: Position, props?: Partial<Block>): Block;

// ============================================================================
// Wires
// ============================================================================

/** @deprecated Use PortEndpoint from '@/components/OneCanvas/types' instead */

export interface PortEndpoint {
  type: 'port';
  blockId?: string;
  componentId?: string;
  portId: string;
}

/** @deprecated Use PortEndpoint from '@/components/OneCanvas/types' instead */

export interface LegacyPortEndpoint {
  componentId: string;
  portId: string;
}

/** @deprecated Use JunctionEndpoint from '@/components/OneCanvas/types' instead */

export interface JunctionEndpoint {
  type: 'junction';
  junctionId: string;
}

/** @deprecated Use JunctionEndpoint from '@/components/OneCanvas/types' instead */

export interface LegacyJunctionEndpoint {
  junctionId: string;
}

/** @deprecated Use FloatingEndpoint from '@/components/OneCanvas/types' instead */

export interface FloatingEndpoint {
  type: 'floating';
  position: Position;
}

/** @deprecated Use WireEndpoint from '@/components/OneCanvas/types' instead */

export type WireEndpoint =
  | PortEndpoint
  | JunctionEndpoint
  | FloatingEndpoint
  | LegacyPortEndpoint
  | LegacyJunctionEndpoint;
export type HandleConstraint = 'free' | 'horizontal' | 'vertical';

export interface WireHandle {
  position: Position;
  constraint?: HandleConstraint;
  source?: 'auto' | 'user' | 'endpoint' | 'segment';
}

export interface Wire {
  id: string;
  from: WireEndpoint;
  to: WireEndpoint;
  handles?: WireHandle[];
  routingMode?: 'auto' | 'manual';
  netName?: string;
  layer?: string;
  fromExitDirection?: PortPosition;
  toExitDirection?: PortPosition;
}

/** @deprecated Use isPortEndpoint from '@/components/OneCanvas/types' instead */

export function isPortEndpoint(endpoint: WireEndpoint): endpoint is PortEndpoint {
  return 'portId' in endpoint && ('type' in endpoint ? endpoint.type === 'port' : true);
}

/** @deprecated Use isJunctionEndpoint from '@/components/OneCanvas/types' instead */

export function isJunctionEndpoint(endpoint: WireEndpoint): endpoint is JunctionEndpoint {
  return 'junctionId' in endpoint && !('position' in endpoint);
}

/** @deprecated Use isFloatingEndpoint from '@/components/OneCanvas/types' instead */

export function isFloatingEndpoint(endpoint: WireEndpoint): endpoint is FloatingEndpoint {
  return 'position' in endpoint;
}

/** @deprecated Use endpointKey from '@/components/OneCanvas/utils/canvasHelpers' instead */

export function endpointKey(endpoint: WireEndpoint): string {
  if (isPortEndpoint(endpoint)) {
    const ownerId = endpoint.blockId ?? endpoint.componentId ?? 'unknown';
    return `port:${ownerId}:${endpoint.portId}`;
  }
  if (isJunctionEndpoint(endpoint)) {
    return `junction:${endpoint.junctionId}`;
  }
  if (isFloatingEndpoint(endpoint)) {
    return `floating:${endpoint.position.x}:${endpoint.position.y}`;
  }
  return 'floating:0:0';
}

// ============================================================================
// Junctions
// ============================================================================

export interface Junction {
  id: string;
  position: Position;
  connectedWireIds?: string[];
  netName?: string;
}

// ============================================================================
// Circuit state
// ============================================================================

export interface CircuitMetadata {
  name: string;
  description: string;
  author?: string;
  createdAt?: string;
  modifiedAt?: string;
  version?: string;
  tags: string[];
}

export interface CircuitViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface CircuitState {
  components: Map<string, Block>;
  wires: Wire[];
  junctions: Map<string, Junction>;
  metadata: CircuitMetadata;
  viewport?: CircuitViewport;
  // optional compatibility mirrors
  blocks?: Record<string, Block>;
  wireMap?: Record<string, Wire>;
}

export interface SerializableCircuitState {
  components: Record<string, Block>;
  wires: Wire[];
  junctions?: Record<string, Junction>;
  metadata: CircuitMetadata;
  viewport?: CircuitViewport;
}

export function toSerializable(state: CircuitState): SerializableCircuitState {
  return {
    components: Object.fromEntries(state.components),
    wires: [...state.wires],
    junctions: state.junctions.size > 0 ? Object.fromEntries(state.junctions) : undefined,
    metadata: state.metadata,
    viewport: state.viewport,
  };
}

export function fromSerializable(data: SerializableCircuitState): CircuitState {
  return {
    components: new Map(Object.entries(data.components)),
    wires: [...data.wires],
    junctions: new Map(Object.entries(data.junctions ?? {})),
    metadata: data.metadata,
    viewport: data.viewport,
  };
}

// ============================================================================
// Selection
// ============================================================================

export type SelectionType = string;

export interface SelectionItem {
  type: SelectionType;
  id: string;
  subIndex?: number;
}

// Compatibility: most call sites treat Selection as an item.
export type Selection = SelectionItem;

export interface SelectionGroup {
  items: SelectionItem[];
  bounds?: Rect;
}

export function isBlockSelectionItem(item: SelectionItem): item is SelectionItem & { type: 'block' | 'component' } {
  return item.type === 'block' || item.type === 'component';
}

export function isWireSelectionItem(item: SelectionItem): item is SelectionItem & { type: 'wire' } {
  return item.type === 'wire';
}

export function isJunctionSelectionItem(item: SelectionItem): item is SelectionItem & { type: 'junction' } {
  return item.type === 'junction';
}

export function isHandleSelectionItem(item: SelectionItem): item is SelectionItem & { type: 'handle' } {
  return item.type === 'handle';
}

export function isSegmentSelectionItem(item: SelectionItem): item is SelectionItem & { type: 'segment' } {
  return item.type === 'segment';
}

export interface SelectionState {
  items: SelectionItem[];
}

export function createSelectionState(items: SelectionItem[] = []): SelectionState {
  return { items: [...items] };
}

export function addToSelectionState(state: SelectionState, item: SelectionItem): SelectionState {
  const exists = state.items.some(
    (entry) => entry.id === item.id && entry.type === item.type && entry.subIndex === item.subIndex,
  );
  return exists ? state : { items: [...state.items, item] };
}

export function removeFromSelectionState(state: SelectionState, id: string): SelectionState {
  return { items: state.items.filter((item) => item.id !== id) };
}

export function toggleInSelectionState(state: SelectionState, item: SelectionItem): SelectionState {
  const exists = state.items.some(
    (entry) => entry.id === item.id && entry.type === item.type && entry.subIndex === item.subIndex,
  );
  if (exists) {
    return {
      items: state.items.filter(
        (entry) => !(entry.id === item.id && entry.type === item.type && entry.subIndex === item.subIndex),
      ),
    };
  }
  return { items: [...state.items, item] };
}

export function clearSelectionState(): SelectionState {
  return { items: [] };
}

export function getAllSelectedIds(state: SelectionState): string[] {
  return state.items.map((item) => item.id);
}

export function selectionStateToArray(state: SelectionState): SelectionItem[] {
  return [...state.items];
}

// ============================================================================
// Legacy type migration
// ============================================================================

export type LegacyBlockType =
  | 'powersource'
  | 'plc_in'
  | 'plc_out'
  | 'button'
  | 'scope'
  | 'text'
  | 'relay'
  | 'emergency_stop'
  | 'selector_switch'
  | 'solenoid_valve'
  | 'sensor'
  | 'pilot_lamp'
  | 'net_label'
  | 'terminal_block'
  | 'disconnect_switch'
  | 'off_page_connector';

const LEGACY_BLOCK_TYPE_MAP: Readonly<Record<LegacyBlockType, BlockType>> = {
  powersource: 'power_source',
  plc_in: 'plc_input',
  plc_out: 'plc_output',
  button: 'push_button_no',
  scope: 'custom_symbol',
  text: 'custom_symbol',
  relay: 'relay_coil',
  emergency_stop: 'push_button_nc',
  selector_switch: 'switch_changeover',
  solenoid_valve: 'contactor',
  sensor: 'plc_input',
  pilot_lamp: 'led',
  net_label: 'custom_symbol',
  terminal_block: 'terminal',
  disconnect_switch: 'circuit_breaker',
  off_page_connector: 'connector',
};

export function migrateLegacyBlockType(blockType: string): BlockType | string {
  return LEGACY_BLOCK_TYPE_MAP[blockType as LegacyBlockType] ?? blockType;
}
