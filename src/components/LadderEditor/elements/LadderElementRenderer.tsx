/**
 * LadderElementRenderer Component
 *
 * Switch-based renderer that maps ladder element types to their
 * corresponding visual components (Contact, Coil, etc.).
 */

import { Contact, type ContactType } from './Contact';
import { Coil, type CoilType } from './Coil';
import type { LadderElement, LadderElementType } from '../../../types/ladder';

export interface MonitoringState {
  /** Whether element is energized (ON) */
  isEnergized: boolean;
  /** Whether element is forced */
  isForced: boolean;
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

/** Check if element type is a contact */
function isContactElement(type: LadderElementType): boolean {
  return type.startsWith('contact_');
}

/** Check if element type is a coil */
function isCoilElement(type: LadderElementType): boolean {
  return type.startsWith('coil');
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

  // Wire elements (will be handled separately in wire components)
  if (type.startsWith('wire_')) {
    // TODO: Implement wire rendering in Task 75
    return null;
  }

  // Rail elements (handled by PowerRail/NeutralRail components)
  if (type === 'power_rail' || type === 'neutral_rail') {
    return null;
  }

  // Timer elements (will be implemented in Task 74)
  if (type.startsWith('timer_')) {
    return (
      <div className="text-xs text-neutral-400 text-center">
        Timer
        <br />
        {address}
      </div>
    );
  }

  // Counter elements (will be implemented in Task 74)
  if (type.startsWith('counter_')) {
    return (
      <div className="text-xs text-neutral-400 text-center">
        Counter
        <br />
        {address}
      </div>
    );
  }

  // Comparison elements (will be implemented in Task 85)
  if (type.startsWith('compare_')) {
    return (
      <div className="text-xs text-neutral-400 text-center">
        Compare
        <br />
        {address}
      </div>
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
