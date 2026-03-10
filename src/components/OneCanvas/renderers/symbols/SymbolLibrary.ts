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
  power_source: { width: 40, height: 80 },
  ground: { width: 40, height: 40 },
  motor: { width: 80, height: 80 },
  relay_coil: { width: 40, height: 60 },
  relay_contact_no: { width: 60, height: 40 },
  relay_contact_nc: { width: 60, height: 40 },
  switch_no: { width: 60, height: 40 },
  switch_nc: { width: 60, height: 40 },
  switch_changeover: { width: 80, height: 80 },
  fuse: { width: 40, height: 60 },
  circuit_breaker: { width: 40, height: 60 },
  transformer: { width: 80, height: 80 },
  capacitor: { width: 40, height: 40 },
  resistor: { width: 60, height: 40 },
  inductor: { width: 60, height: 40 },
  diode: { width: 40, height: 40 },
  led: { width: 40, height: 40 },
  terminal: { width: 40, height: 30 },
  connector: { width: 60, height: 40 },
  plc_input: { width: 80, height: 40 },
  plc_output: { width: 80, height: 40 },
  timer_on_delay: { width: 80, height: 80 },
  timer_off_delay: { width: 80, height: 80 },
  counter_up: { width: 80, height: 80 },
  counter_down: { width: 80, height: 80 },
  junction_box: { width: 80, height: 80 },
  push_button_no: { width: 60, height: 40 },
  push_button_nc: { width: 60, height: 40 },
  overload_relay: { width: 80, height: 80 },
  contactor: { width: 80, height: 80 },
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

  // IEC battery/DC source: Long line (+), short thick line (-)
  ctx.moveTo(cx - 12, cy - 6).lineTo(cx + 12, cy - 6).stroke({ color: POWER_POSITIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx - 6, cy + 6).lineTo(cx + 6, cy + 6).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH * 2 });
  ctx.moveTo(cx, 16).lineTo(cx, cy - 6).stroke({ color: POWER_POSITIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx, cy + 6).lineTo(cx, height - 16).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

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
  const cx = width / 2;

  // IEC Relay Coil is a rectangle: A1 to A2
  ctx.rect(cx - 10, 16, 20, height - 32).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, 4).lineTo(cx, 16).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, height - 16).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createRelayContactNoContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.relay_contact_no;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  // IEC NO Contact: perpendicular line then gap
  ctx.moveTo(4, mid).lineTo(24, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(36, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(24, mid - 10).lineTo(24, mid + 10).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(36, mid - 10).lineTo(36, mid + 10).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createRelayContactNcContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.relay_contact_nc;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  // IEC NC Contact: Contacts with diagonal line
  ctx.moveTo(4, mid).lineTo(24, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(36, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(24, mid - 10).lineTo(24, mid + 10).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(36, mid - 10).lineTo(36, mid + 10).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(20, mid - 14).lineTo(40, mid + 14).stroke({ color: ERROR, width: STROKE_WIDTH });

  return ctx;
}

function createSwitchNoContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.switch_no;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(22, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(38, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(22, mid, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(38, mid, 2).fill({ color: STROKE_DEFAULT });
  ctx.moveTo(22, mid).lineTo(36, mid - 12).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createSwitchNcContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.switch_nc;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(22, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(38, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(22, mid, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(38, mid, 2).fill({ color: STROKE_DEFAULT });
  ctx.moveTo(22, mid).lineTo(36, mid - 2).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createSwitchChangeoverContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.switch_changeover;
  const ctx = new GraphicsContext();

  ctx.moveTo(4, height / 2).lineTo(24, height / 2).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(56, 20).lineTo(width - 4, 20).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(56, 40).lineTo(width - 4, 40).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  
  ctx.circle(24, height / 2, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(56, 20, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(56, 40, 2).fill({ color: STROKE_DEFAULT });
  // Arm pointing to NO (20)
  ctx.moveTo(24, height / 2).lineTo(54, 22).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createFuseContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.fuse;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.rect(14, 16, width - 28, height - 32).fill({ color: FILL_DEFAULT }).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createCircuitBreakerContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.circuit_breaker;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, 16).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, height - 16).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(cx, 16, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(cx, height - 16, 2).fill({ color: STROKE_DEFAULT });
  
  ctx.moveTo(cx, 16).lineTo(cx + 10, height - 20).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  // Cross for CB
  ctx.moveTo(cx + 2, 34).lineTo(cx + 10, 42).stroke({ color: ERROR, width: STROKE_WIDTH });
  ctx.moveTo(cx + 10, 34).lineTo(cx + 2, 42).stroke({ color: ERROR, width: STROKE_WIDTH });

  return ctx;
}

function createTransformerContext(): GraphicsContext {
  const { height } = SYMBOL_SIZES.transformer;
  const ctx = new GraphicsContext();

  ctx.moveTo(20, 4).lineTo(20, 25).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(60, 4).lineTo(60, 25).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(20, height - 4).lineTo(20, height - 25).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(60, height - 4).lineTo(60, height - 25).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  ctx.circle(32, height / 2, 16).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.circle(48, height / 2, 16).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createCapacitorContext(): GraphicsContext {
  const { width } = SYMBOL_SIZES.capacitor;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  ctx.moveTo(cx, 4).lineTo(cx, 16).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, 24).lineTo(cx, 36).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx - 10, 16).lineTo(cx + 10, 16).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx - 10, 24).lineTo(cx + 10, 24).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createResistorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.resistor;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(15, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(45, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.rect(15, 14, 30, 12).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createInductorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.inductor;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(15, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(45, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.rect(15, 14, 30, 12).fill({ color: ACTIVE }).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createDiodeContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.diode;
  const ctx = new GraphicsContext();
  const cx = width / 2;

  // Anode top (0), Cathode bottom (40)
  ctx.moveTo(cx, 4).lineTo(cx, 14).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx, 26).lineTo(cx, height - 4).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  
  // Triangle pointing down
  ctx.poly([cx - 10, 14, cx + 10, 14, cx, 26]).fill({ color: FILL_DEFAULT }).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  // Cathode bar
  ctx.moveTo(cx - 10, 26).lineTo(cx + 10, 26).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

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
  const cx = width / 2;
  const cy = height / 2;

  ctx.circle(cx, cy, 6).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createConnectorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.connector;
  const ctx = new GraphicsContext();
  const mid = height / 2;

  ctx.moveTo(4, mid).lineTo(24, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(36, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  
  // Plug
  ctx.moveTo(24, mid - 6).lineTo(30, mid).lineTo(24, mid + 6).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  // Socket
  ctx.moveTo(38, mid - 8).lineTo(30, mid).lineTo(38, mid + 8).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

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
  ctx.moveTo(42, 24).lineTo(42, 56).lineTo(50, 46).lineTo(58, 56).lineTo(58, 24).stroke({ color: ACTIVE, width: STROKE_WIDTH });

  return ctx;
}

function createTimerOffDelayContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.timer_off_delay;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawClock(ctx, 24, height / 2, 10);
  ctx.moveTo(42, 24).lineTo(42, 56).lineTo(58, 56).lineTo(58, 24).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(46, 28).lineTo(54, 28).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createCounterUpContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.counter_up;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawArrow(ctx, 18, 52, 18, 28, ACTIVE);
  ctx.moveTo(34, 56).lineTo(42, 24).lineTo(50, 56).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(50, 24).lineTo(50, 56).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

  return ctx;
}

function createCounterDownContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.counter_down;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  drawArrow(ctx, 18, 28, 18, 52, WARNING);
  ctx.moveTo(34, 24).lineTo(34, 56).lineTo(48, 56).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.arc(48, 40, 12, Math.PI / 2, -Math.PI / 2).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

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
  const { width, height } = SYMBOL_SIZES.push_button_no;
  const ctx = new GraphicsContext();
  const mid = height / 2;
  const cx = width / 2;

  ctx.moveTo(4, mid).lineTo(22, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(38, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(22, mid, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(38, mid, 2).fill({ color: STROKE_DEFAULT });

  // Moving contact and plunger
  ctx.moveTo(22, mid - 6).lineTo(38, mid - 6).stroke({ color: WARNING, width: STROKE_WIDTH });
  ctx.moveTo(cx, mid - 6).lineTo(cx, 6).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx - 6, 6).lineTo(cx + 6, 6).stroke({ color: STROKE_DEFAULT, width: Math.max(2, STROKE_WIDTH) });

  return ctx;
}

function createPushButtonNcContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.push_button_nc;
  const ctx = new GraphicsContext();
  const mid = height / 2;
  const cx = width / 2;

  ctx.moveTo(4, mid).lineTo(22, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(38, mid).lineTo(width - 4, mid).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.circle(22, mid, 2).fill({ color: STROKE_DEFAULT });
  ctx.circle(38, mid, 2).fill({ color: STROKE_DEFAULT });

  // Moving contact and plunger
  ctx.moveTo(22, mid + 6).lineTo(38, mid + 6).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(cx, mid + 6).lineTo(cx, 6).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(cx - 6, 6).lineTo(cx + 6, 6).stroke({ color: STROKE_DEFAULT, width: Math.max(2, STROKE_WIDTH) });

  return ctx;
}

function createOverloadRelayContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.overload_relay;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  // Heater square wave
  ctx.moveTo(20, 25).lineTo(32, 25).lineTo(32, 55).lineTo(48, 55).lineTo(48, 25).lineTo(60, 25).stroke({ color: WARNING, width: STROKE_WIDTH });

  return ctx;
}

function createContactorContext(): GraphicsContext {
  const { width, height } = SYMBOL_SIZES.contactor;
  const ctx = new GraphicsContext();

  drawRectShell(ctx, width, height);
  // Coil symbol inside
  ctx.rect(30, 24, 20, 32).stroke({ color: ACTIVE, width: STROKE_WIDTH });
  ctx.moveTo(40, 4).lineTo(40, 24).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });
  ctx.moveTo(40, height - 4).lineTo(40, height - 24).stroke({ color: STROKE_DEFAULT, width: STROKE_WIDTH });

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
