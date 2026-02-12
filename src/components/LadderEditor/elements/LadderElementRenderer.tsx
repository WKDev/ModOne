/**
 * LadderElementRenderer Component
 *
 * Switch-based renderer that maps ladder element types to their
 * corresponding visual components (Contact, Coil, Timer, Counter, etc.).
 */

import { Contact, type ContactType } from './Contact';
import { Coil, type CoilType } from './Coil';
import { Timer, type TimerType } from './Timer';
import { Counter, type CounterType } from './Counter';
import { Wire, type WireType as WireComponentType } from './Wire';
import { Comparison, type ComparisonType, type ComparisonOperand } from './Comparison';
import type {
  LadderElement,
  LadderElementType,
  TimerElement,
  CounterElement,
  CompareElement,
  TimerState,
  CounterState,
} from '../../../types/ladder';

export interface MonitoringState {
  /** Whether element is energized (ON) */
  isEnergized: boolean;
  /** Whether element is forced */
  isForced: boolean;
  /** Timer state for timer elements */
  timerState?: TimerState;
  /** Counter state for counter elements */
  counterState?: CounterState;
  /** Comparison result for comparison elements */
  comparisonResult?: boolean;
}

export interface LadderElementRendererProps {
  /** The ladder element to render */
  element: LadderElement;
  /** Optional monitoring state for live visualization */
  monitoring?: MonitoringState;
  /** Element width in pixels */
  width?: number;
  /** Element height in pixels */
  height?: number;
  /** Called when element is double-clicked */
  onDoubleClick?: () => void;
}

/** Map from element type to contact type */
const CONTACT_TYPE_MAP: Record<string, ContactType> = {
  contact_no: 'no',
  contact_nc: 'nc',
  contact_p: 'p',
  contact_n: 'n',
};

/** Map from element type to coil type */
const COIL_TYPE_MAP: Record<string, CoilType> = {
  coil: 'output',
  coil_set: 'set',
  coil_reset: 'reset',
};

/** Map from element type to timer type */
const TIMER_TYPE_MAP: Record<string, TimerType> = {
  timer_ton: 'ton',
  timer_tof: 'tof',
  timer_tmr: 'tmr',
};

/** Map from element type to counter type */
const COUNTER_TYPE_MAP: Record<string, CounterType> = {
  counter_ctu: 'ctu',
  counter_ctd: 'ctd',
  counter_ctud: 'ctud',
};

/** Map from element type to wire type */
const WIRE_TYPE_MAP: Record<string, WireComponentType> = {
  wire_h: 'horizontal',
  wire_v: 'vertical',
};

/** Valid corner wire subtypes */
const VALID_CORNER_TYPES = new Set<WireComponentType>([
  'corner_tl', 'corner_tr', 'corner_bl', 'corner_br',
]);

/** Valid junction wire subtypes */
const VALID_JUNCTION_TYPES = new Set<WireComponentType>([
  'junction_t', 'junction_b', 'junction_l', 'junction_r',
]);

/**
 * Resolve the concrete wire component type from element type and properties.
 * For corner/junction wires, reads the `direction` property to determine
 * the specific variant. Falls back to reasonable defaults.
 */
function resolveWireType(elementType: string, properties: Record<string, unknown>): WireComponentType | undefined {
  // Direct mapping for horizontal/vertical
  const directType = WIRE_TYPE_MAP[elementType];
  if (directType) return directType;

  // Corner wires: read direction from properties
  if (elementType === 'wire_corner') {
    const direction = properties?.direction as WireComponentType | undefined;
    if (direction && VALID_CORNER_TYPES.has(direction)) {
      return direction;
    }
    return 'corner_tl'; // Default fallback
  }

  // Junction wires: read direction from properties
  if (elementType === 'wire_junction') {
    const direction = properties?.direction as WireComponentType | undefined;
    if (direction && VALID_JUNCTION_TYPES.has(direction)) {
      return direction;
    }
    return 'junction_t'; // Default fallback
  }

  return undefined;
}

/** Map from element type to comparison type */
const COMPARISON_TYPE_MAP: Record<string, ComparisonType> = {
  compare_eq: 'eq',
  compare_gt: 'gt',
  compare_lt: 'lt',
  compare_ge: 'ge',
  compare_le: 'le',
  compare_ne: 'ne',
};

/** Check if element type is a contact */
function isContactElement(type: LadderElementType): boolean {
  return type.startsWith('contact_');
}

/** Check if element type is a coil */
function isCoilElement(type: LadderElementType): boolean {
  return type.startsWith('coil');
}

/** Check if element type is a timer */
function isTimerElementType(type: LadderElementType): boolean {
  return type.startsWith('timer_');
}

/** Check if element type is a counter */
function isCounterElementType(type: LadderElementType): boolean {
  return type.startsWith('counter_');
}

/** Check if element type is a comparison */
function isComparisonElementType(type: LadderElementType): boolean {
  return type.startsWith('compare_');
}

/**
 * LadderElementRenderer - Renders the appropriate component for a ladder element
 */
export function LadderElementRenderer({
  element,
  monitoring,
  width,
  height,
  onDoubleClick,
}: LadderElementRendererProps) {
  const { type, address = '', label } = element;
  const isEnergized = monitoring?.isEnergized ?? false;
  const isForced = monitoring?.isForced ?? false;

  // Contact elements
  if (isContactElement(type)) {
    const contactType = CONTACT_TYPE_MAP[type];
    if (!contactType) {
      console.warn(`Unknown contact type: ${type}`);
      return null;
    }

    return (
      <Contact
        type={contactType}
        address={address}
        label={label}
        isEnergized={isEnergized}
        isForced={isForced}
        width={width}
        height={height}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  // Coil elements
  if (isCoilElement(type)) {
    const coilType = COIL_TYPE_MAP[type];
    if (!coilType) {
      console.warn(`Unknown coil type: ${type}`);
      return null;
    }

    return (
      <Coil
        type={coilType}
        address={address}
        label={label}
        isEnergized={isEnergized}
        isForced={isForced}
        width={width}
        height={height}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  // Wire elements
  if (type.startsWith('wire_')) {
    const wireType = resolveWireType(type, (element.properties ?? {}) as Record<string, unknown>);
    if (!wireType) {
      // Unknown wire type - render as horizontal
      return (
        <Wire
          type="horizontal"
          isEnergized={isEnergized}
          width={width}
          height={height}
        />
      );
    }

    return (
      <Wire
        type={wireType}
        isEnergized={isEnergized}
        width={width}
        height={height}
      />
    );
  }

  // Rail elements (handled by PowerRail/NeutralRail components)
  if (type === 'power_rail' || type === 'neutral_rail') {
    return null;
  }

  // Timer elements
  if (isTimerElementType(type)) {
    const timerType = TIMER_TYPE_MAP[type];
    if (!timerType) {
      console.warn(`Unknown timer type: ${type}`);
      return null;
    }

    // Get timer properties from element
    const timerElement = element as TimerElement;
    const presetTime = timerElement.properties?.presetTime ?? 1000;
    const timerState = monitoring?.timerState;

    return (
      <Timer
        type={timerType}
        address={address}
        presetTime={presetTime}
        elapsedTime={timerState?.et}
        isRunning={timerState?.running}
        isDone={timerState?.done}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  // Counter elements
  if (isCounterElementType(type)) {
    const counterType = COUNTER_TYPE_MAP[type];
    if (!counterType) {
      console.warn(`Unknown counter type: ${type}`);
      return null;
    }

    // Get counter properties from element
    const counterElement = element as CounterElement;
    const presetValue = counterElement.properties?.presetValue ?? 10;
    const counterState = monitoring?.counterState;

    return (
      <Counter
        type={counterType}
        address={address}
        presetValue={presetValue}
        currentValue={counterState?.cv}
        isDone={counterState?.done}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  // Comparison elements
  if (isComparisonElementType(type)) {
    const comparisonType = COMPARISON_TYPE_MAP[type];
    if (!comparisonType) {
      console.warn(`Unknown comparison type: ${type}`);
      return null;
    }

    // Get comparison properties from element
    const compareElement = element as CompareElement;
    const compareValue = compareElement.properties?.compareValue ?? 0;

    // Build operands from properties
    const operand1: ComparisonOperand = {
      type: 'device',
      value: address || 'D0',
    };
    const operand2: ComparisonOperand = {
      type: typeof compareValue === 'number' ? 'constant' : 'device',
      value: compareValue,
    };

    return (
      <Comparison
        type={comparisonType}
        operand1={operand1}
        operand2={operand2}
        result={monitoring?.comparisonResult}
        onDoubleClick={onDoubleClick}
      />
    );
  }

  // Unknown element type
  console.warn(`Unknown element type: ${type}`);
  return (
    <div className="text-xs text-neutral-500 text-center">
      {type}
    </div>
  );
}

export default LadderElementRenderer;
