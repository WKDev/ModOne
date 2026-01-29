/**
 * Ladder Editor Elements
 *
 * SVG-based visual components for ladder diagram elements.
 */

// Shared styles
export { ELEMENT_COLORS, ELEMENT_DIMENSIONS, getElementColors } from './styles';

// Contact component
export { Contact, type ContactType, type ContactProps } from './Contact';

// Coil component
export { Coil, type CoilType, type CoilProps } from './Coil';

// Timer component
export { Timer, type TimerType, type TimerProps } from './Timer';

// Counter component
export { Counter, type CounterType, type CounterProps } from './Counter';

// Wire component
export { Wire, type WireType, type WireProps } from './Wire';

// Comparison component
export {
  Comparison,
  type ComparisonType,
  type ComparisonProps,
  type ComparisonOperand,
} from './Comparison';

// Element renderer
export {
  LadderElementRenderer,
  type LadderElementRendererProps,
  type MonitoringState,
} from './LadderElementRenderer';
