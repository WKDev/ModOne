import { GraphicsContext } from 'pixi.js';
import type { BlockType } from '../../types';

type SymbolSize = { width: number; height: number };

type CanonicalSymbolType =
  | 'power_source'
  | 'ground'
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
  | 'custom_symbol';

const STROKE_DEFAULT = 0xd0d4da;
const FILL_DEFAULT = 0x1a1d23;
const ACTIVE = 0x3b82f6;
const ERROR = 0xef4444;
const GROUND = 0x22c55e;
const POWER_POSITIVE = 0xef4444;
const WARNING = 0xeab308;

const STROKE_WIDTH = 2;

const SYMBOL_SIZES: Record<CanonicalSymbolType, SymbolSize> = {
  power_source: { width: 60, height: 80 },
  ground: { width: 40, height: 40 },
  motor: { width: 80, height: 80 },
  relay_coil: { width: 60, height: 60 },
  relay_contact_no: { width: 60, height: 40 },
  relay_contact_nc: { width: 60, height: 40 },
  switch_no: { width: 60, height: 40 },
  switch_nc: { width: 60, height: 40 },
  switch_changeover: { width: 60, height: 60 },
  fuse: { width: 40, height: 60 },
  circuit_breaker: { width: 60, height: 60 },
  transformer: { width: 80, height: 80 },
  capacitor: { width: 40, height: 40 },
  resistor: { width: 60, height: 30 },
  inductor: { width: 60, height: 30 },
  diode: { width: 40, height: 40 },
  led: { width: 40, height: 40 },
  terminal: { width: 40, height: 30 },
  connector: { width: 60, height: 40 },
  plc_input: { width: 80, height: 40 },
  plc_output: { width: 80, height: 40 },
  timer_on_delay: { width: 80, height: 60 },
  timer_off_delay: { width: 80, height: 60 },
  counter_up: { width: 80, height: 60 },
  counter_down: { width: 80, height: 60 },
  junction_box: { width: 80, height: 80 },
  push_button_no: { width: 60, height: 40 },
  push_button_nc: { width: 60, height: 40 },
  overload_relay: { width: 60, height: 60 },
  contactor: { width: 60, height: 60 },
  custom_symbol: { width: 60, height: 60 },
};

const LEGACY_TYPE_MAP: Record<string, CanonicalSymbolType> = {
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

const symbolContextCache = new Map<string, GraphicsContext>();

function normalizeType(type: BlockType | string): CanonicalSymbolType {
  if (Object.prototype.hasOwnProperty.call(SYMBOL_SIZES, type)) {
    return type as CanonicalSymbolType;
  }
  return LEGACY_TYPE_MAP[type] ?? 'custom_symbol';
}

function drawClock(ctx: GraphicsContext, cx: number, cy: number, r: number): void {
  ctx.circle(cx, cy, r).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, cy).lineTo(cx, cy - r * 0.55).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, cy).lineTo(cx + r * 0.45, cy).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
}

function drawArrow(ctx: GraphicsContext, x1: number, y1: number, x2: number, y2: number, color: number): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / len;
  const uy = dy / len;
  const hx = x2 - ux * 8;
  const hy = y2 - uy * 8;

  ctx.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width: STROKE_WIDTH });
  ctx.moveTo(x2, y2).lineTo(hx - uy * 4, hy + ux * 4).stroke({ color, width: STROKE_WIDTH });
  ctx.moveTo(x2, y2).lineTo(hx + uy * 4, hy - ux * 4).stroke({ color, width: STROKE_WIDTH });
}

function drawRectShell(ctx: GraphicsContext, width: number, height: number): void {
  ctx.rect(4, 4, width - 8, height - 8)
    .fill({ color: FILL_DEFAULT })
    .stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
}

function createPowerSourceContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.power_source;
  const ctx = new GraphicsContext();
  const cx = width / 2;
  const cy = height / 2;

  ctx.circle(cx, cy, 20).fill({ color: FILL_DEFAULT }).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx - 6, cy - 6).lineTo(cx + 6, cy - 6).stroke({ color: POWER_POSITIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx, cy - 12).lineTo(cx, cy).stroke({ color: POWER_POSITIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx - 6, cy + 10).lineTo(cx + 6, cy + 10).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createGroundContext(): GraphicsContext {
  const { width } = SYMBOL_SIZES.ground;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, 12).stroke({ color: GROUND, width: STROKE_WIDTH });
  ctx.moveTo(cx - 12, 16).lineTo(cx + 12, 16).stroke({ color: GROUND, width: STROKE_WIDTH });
  ctx.moveTo(cx - 8, 22).lineTo(cx + 8, 22).stroke({ color: GROUND, width: STROKE_WIDTH });
  ctx.moveTo(cx - 4, 28).lineTo(cx + 4, 28).stroke({ color: GROUND, width: STROKE_WIDTH });

  return ctx;
}

function createMotorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.motor;
  const ctx = new GraphicsContext();
  const cx = width / 2;
  const cy = height / 2;

  ctx.circle(cx, cy, 30).fill({ color: FILL_DEFAULT }).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx - 12, cy + 12).lineTo(cx - 12, cy - 12).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx - 12, cy - 12).lineTo(cx, cy).lineTo(cx + 12, cy - 12).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx + 12, cy - 12).lineTo(cx + 12, cy + 12).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createRelayCoilContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.relay_coil;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  ctx.moveTo(14, 44).lineTo(14, 16).lineTo(30, 30).lineTo(46, 16).lineTo(46, 44)
    .stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createRelayContactNoContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.relay_contact_no;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(20, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(40, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(20, mid + 8).lineTo(40, mid - 8).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createRelayContactNcContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.relay_contact_nc;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(20, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(20, mid).lineTo(40, mid).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(40, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(24, mid - 8).lineTo(36, mid + 8).stroke({ color: ERROR, width: STROKE_WIDTH });

  return ctx;
}

function createSwitchNoContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.switch_no;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(20, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(20, mid).lineTo(42, mid - 10).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(42, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(20, mid, 2).fill({ color: WARNING });

  return ctx;
}

function createSwitchNcContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.switch_nc;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(20, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(20, mid).lineTo(42, mid).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(42, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(20, mid, 2).fill({ color: WARNING });

  return ctx;
}

function createSwitchChangeoverContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.switch_changeover;
  const ctx = new GraphicsContext();

  ctx.moveTo(4, height / 2).lineTo(18, height / 2).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(42, 18).lineTo(width - 4, 18).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(42, 42).lineTo(width - 4, 42).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(18, height / 2).lineTo(42, 20).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.circle(18, height / 2, 2).fill({ color: WARNING });

  return ctx;
}

function createFuseContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.fuse;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, 14).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.rect(10, 14, width - 20, height - 28).fill({ color: FILL_DEFAULT }).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(cx, 14).lineTo(cx, height - 14).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(cx, height - 14).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createCircuitBreakerContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.circuit_breaker;
  const ctx = new GraphicsContext();

  ctx.moveTo(width / 2, 4).lineTo(width / 2, 16).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(width / 2, height - 16).lineTo(width / 2, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(16, 18).lineTo(30, 30).lineTo(44, 22).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.arc(width / 2, 34, 10, Math.PI * 0.15, Math.PI * 0.85).stroke({ color: ERROR, width: STROKE_WIDTH });

  return ctx;
}

function createTransformerContext(): GraphicsContext {
  const { width } = SYMBOL_SIZES.transformer;
  const ctx = new GraphicsContext();

  ctx.moveTo(4, 25).lineTo(18, 25).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(4, 55).lineTo(18, 55).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(62, 25).lineTo(width - 4, 25).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(62, 55).lineTo(width - 4, 55).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.arc(24, 25, 6, -Math.PI / 2, Math.PI / 2).arc(24, 37, 6, -Math.PI / 2, Math.PI / 2).arc(24, 49, 6, -Math.PI / 2, Math.PI / 2)
    .stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.arc(56, 25, 6, Math.PI / 2, -Math.PI / 2).arc(56, 37, 6, Math.PI / 2, -Math.PI / 2).arc(56, 49, 6, Math.PI / 2, -Math.PI / 2)
    .stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(40, 16).lineTo(40, 64).stroke({ color: STROKE_DEFAULT, width: 1 });

  return ctx;
}

function createCapacitorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.capacitor;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, 12).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx - 8, 12).lineTo(cx - 8, height - 12).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx + 8, 12).lineTo(cx + 8, height - 12).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx, height - 12).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createResistorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.resistor;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(10, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(10, mid).lineTo(16, mid - 6).lineTo(22, mid + 6).lineTo(28, mid - 6).lineTo(34, mid + 6).lineTo(40, mid - 6).lineTo(46, mid + 6).lineTo(52, mid)
    .stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(52, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createInductorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.inductor;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(12, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.arc(18, mid, 6, Math.PI, 0).arc(30, mid, 6, Math.PI, 0).arc(42, mid, 6, Math.PI, 0).arc(54, mid, 6, Math.PI, 0)
    .stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(54, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createDiodeContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.diode;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, 10).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.poly([cx - 10, 24, cx + 10, 24, cx, 12]).fill({ color: FILL_DEFAULT }).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx - 10, 28).lineTo(cx + 10, 28).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, 28).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createLedContext(): GraphicsContext {
  const { width } = SYMBOL_SIZES.led;
  const ctx = createDiodeContext();
  const cx = width / 2;

  drawArrow(ctx, cx + 6, 10, cx + 14, 4, ACTIVE);
  drawArrow(ctx, cx + 2, 14, cx + 10, 8, ACTIVE);

  return ctx;
}

function createTerminalContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.terminal;
  const ctx = new GraphicsContext();

  ctx.rect(10, 7, width - 20, height - 14)
    .fill({ color: FILL_DEFAULT })
    .stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(width / 2, height / 2, 2).fill({ color: ACTIVE });

  return ctx;
}

function createConnectorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.connector;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  ctx.circle(18, height / 2, 3).fill({ color: ACTIVE });
  ctx.circle(width - 18, height / 2, 3).fill({ color: ACTIVE });
  ctx.moveTo(24, height / 2).lineTo(width - 24, height / 2).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createPlcInputContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.plc_input;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawArrow(ctx, 10, height / 2, width - 12, height / 2, ACTIVE);

  return ctx;
}

function createPlcOutputContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.plc_output;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawArrow(ctx, width - 10, height / 2, 12, height / 2, ACTIVE);

  return ctx;
}

function createTimerOnDelayContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.timer_on_delay;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawClock(ctx, 24, height / 2, 10);
  ctx.moveTo(42, 18).lineTo(42, 42).lineTo(50, 34).lineTo(58, 42).lineTo(58, 18).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createTimerOffDelayContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.timer_off_delay;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawClock(ctx, 24, height / 2, 10);
  ctx.moveTo(42, 18).lineTo(42, 42).lineTo(58, 42).lineTo(58, 18).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(46, 22).lineTo(54, 22).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createCounterUpContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.counter_up;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawArrow(ctx, 18, 40, 18, 20, ACTIVE);
  ctx.moveTo(34, 42).lineTo(42, 18).lineTo(50, 42).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(50, 18).lineTo(50, 42).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createCounterDownContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.counter_down;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawArrow(ctx, 18, 20, 18, 40, WARNING);
  ctx.moveTo(34, 18).lineTo(34, 42).lineTo(48, 42).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.arc(48, 30, 12, Math.PI / 2, -Math.PI / 2).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createJunctionBoxContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.junction_box;
  const ctx = new GraphicsContext();
  const cx = width / 2;
  const cy = height / 2;

  drawRectShell(ctx, width, height);
  ctx.circle(cx, 8, 3).fill({ color: ACTIVE });
  ctx.circle(width - 8, cy, 3).fill({ color: ACTIVE });
  ctx.circle(cx, height - 8, 3).fill({ color: ACTIVE });
  ctx.circle(8, cy, 3).fill({ color: ACTIVE });

  return ctx;
}

function createPushButtonNoContext(): GraphicsContext {
  const { width } = SYMBOL_SIZES.push_button_no;
  const ctx = createSwitchNoContext();

  ctx.moveTo(width / 2 - 8, 6).lineTo(width / 2 + 8, 6).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(width / 2, 6).lineTo(width / 2, 14).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createPushButtonNcContext(): GraphicsContext {
  const { width } = SYMBOL_SIZES.push_button_nc;
  const ctx = createSwitchNcContext();

  ctx.moveTo(width / 2 - 8, 6).lineTo(width / 2 + 8, 6).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(width / 2, 6).lineTo(width / 2, 14).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createOverloadRelayContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.overload_relay;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  ctx.moveTo(width / 2, 4).lineTo(width / 2, 12).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(width / 2, height - 12).lineTo(width / 2, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(16, 20).lineTo(24, 28).lineTo(16, 36).lineTo(24, 44).lineTo(16, 52).lineTo(24, 56).stroke({ color: ERROR, width: STROKE_WIDTH });

  return ctx;
}

function createContactorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.contactor;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  ctx.moveTo(width / 2, 4).lineTo(width / 2, 12).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(width / 2, height - 12).lineTo(width / 2, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(16, 20).lineTo(16, 42).lineTo(26, 30).lineTo(36, 42).lineTo(36, 20).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(42, 20).lineTo(50, 20).lineTo(42, 30).lineTo(50, 40).lineTo(42, 50).lineTo(50, 50).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createCustomSymbolContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.custom_symbol;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  ctx.moveTo(22, 22).arc(30, 22, 8, Math.PI, 0).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(38, 22).lineTo(30, 32).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(30, 42, 2).fill({ color: STROKE_DEFAULT });

  return ctx;
}

const SYMBOL_BUILDERS: Record<CanonicalSymbolType, () => GraphicsContext> = {
  power_source: createPowerSourceContext,
  ground: createGroundContext,
  motor: createMotorContext,
  relay_coil: createRelayCoilContext,
  relay_contact_no: createRelayContactNoContext,
  relay_contact_nc: createRelayContactNcContext,
  switch_no: createSwitchNoContext,
  switch_nc: createSwitchNcContext,
  switch_changeover: createSwitchChangeoverContext,
  fuse: createFuseContext,
  circuit_breaker: createCircuitBreakerContext,
  transformer: createTransformerContext,
  capacitor: createCapacitorContext,
  resistor: createResistorContext,
  inductor: createInductorContext,
  diode: createDiodeContext,
  led: createLedContext,
  terminal: createTerminalContext,
  connector: createConnectorContext,
  plc_input: createPlcInputContext,
  plc_output: createPlcOutputContext,
  timer_on_delay: createTimerOnDelayContext,
  timer_off_delay: createTimerOffDelayContext,
  counter_up: createCounterUpContext,
  counter_down: createCounterDownContext,
  junction_box: createJunctionBoxContext,
  push_button_no: createPushButtonNoContext,
  push_button_nc: createPushButtonNcContext,
  overload_relay: createOverloadRelayContext,
  contactor: createContactorContext,
  custom_symbol: createCustomSymbolContext,
};

function createContext(type: CanonicalSymbolType): GraphicsContext {
  const builder = SYMBOL_BUILDERS[type] ?? SYMBOL_BUILDERS.custom_symbol;
  return builder();
}

export function getSymbolContext(type: BlockType | string): GraphicsContext {
  let ctx = symbolContextCache.get(type);
  if (!ctx) {
    const canonicalType = normalizeType(type);
    ctx = symbolContextCache.get(canonicalType);
    if (!ctx) {
      ctx = createContext(canonicalType);
      symbolContextCache.set(canonicalType, ctx);
    }
    symbolContextCache.set(type, ctx);
  }
  return ctx;
}

export function getSymbolSize(type: BlockType | string): SymbolSize {
  return SYMBOL_SIZES[normalizeType(type)] ?? SYMBOL_SIZES.custom_symbol;
}
