import { BitmapText, Container, Graphics } from 'pixi.js';
import type {
  Block,
  BlockType,
  ButtonBlock,
  ContactorBlock,
  DisconnectSwitchBlock,
  EmergencyStopBlock,
  FuseBlock,
  MotorBlock,
  NetLabelBlock,
  OffPageConnectorBlock,
  OverloadRelayBlock,
  PilotLampBlock,
  PlcInBlock,
  PlcOutBlock,
  PowerSourceBlock,
  RelayBlock,
  ScopeBlock,
  SelectorSwitchBlock,
  SensorBlock,
  SolenoidValveBlock,
  TerminalBlockType,
  TextBlock,
  TransformerBlock,
} from '../types';
import type { CustomSymbolBlock } from '@/types/symbol';
import {
  ensureFontsInstalled,
  FONT_DESIGNATION,
  FONT_LABEL,
  FONT_VALUE,
} from './PixiFontManager';

const BODY_STROKE = 0x888888;
const BODY_FILL = 0x2a2a2a;
const ACCENT_GREEN = 0x10b981;
const ACCENT_RED = 0xef4444;

export interface FontNames {
  label: string;
  designation: string;
  value: string;
}

const FONT_NAMES: FontNames = {
  label: FONT_LABEL,
  designation: FONT_DESIGNATION,
  value: FONT_VALUE,
};

export type BlockDrawFunction = (container: Container, block: Block, fonts: FontNames) => void;

const drawRegistry = new Map<BlockType, BlockDrawFunction>();

function createText(text: string, fontFamily: string, fontSize: number): BitmapText {
  return new BitmapText({
    text,
    style: {
      fontFamily,
      fontSize,
    },
  });
}

function addText(
  container: Container,
  text: string,
  fontFamily: string,
  fontSize: number,
  x: number,
  y: number,
  centerX = false,
): void {
  const bitmapText = createText(text, fontFamily, fontSize);
  bitmapText.x = centerX ? x - bitmapText.width / 2 : x;
  bitmapText.y = y;
  container.addChild(bitmapText);
}

function addRectBody(container: Container, width: number, height: number, radius = 0): Graphics {
  const body = new Graphics();
  if (radius > 0) {
    body.roundRect(0, 0, width, height, radius);
  } else {
    body.rect(0, 0, width, height);
  }
  body.fill(BODY_FILL).stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(body);
  return body;
}

function addLineShape(container: Container, draw: (g: Graphics) => void, color = BODY_STROKE, width = 1.5): void {
  const shape = new Graphics();
  draw(shape);
  shape.stroke({ width, color });
  container.addChild(shape);
}

function addDashedRect(container: Container, width: number, height: number, step = 6, gap = 4): void {
  const g = new Graphics();

  const drawDashedHorizontal = (y: number): void => {
    for (let x = 0; x < width; x += step + gap) {
      const end = Math.min(x + step, width);
      g.moveTo(x, y).lineTo(end, y);
    }
  };

  const drawDashedVertical = (x: number): void => {
    for (let y = 0; y < height; y += step + gap) {
      const end = Math.min(y + step, height);
      g.moveTo(x, y).lineTo(x, end);
    }
  };

  drawDashedHorizontal(0);
  drawDashedHorizontal(height);
  drawDashedVertical(0);
  drawDashedVertical(width);

  g.stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(g);
}

function register<T extends BlockType>(
  type: T,
  draw: (container: Container, block: Extract<Block, { type: T }>, fonts: FontNames) => void,
): void {
  drawRegistry.set(type, (container, block, fonts) => {
    if (block.type !== type) {
      return;
    }
    draw(container, block as Extract<Block, { type: T }>, fonts);
  });
}

function drawPowerSource(container: Container, block: PowerSourceBlock, fonts: FontNames): void {
  const { width, height } = block.size;

  if (block.polarity === 'ground') {
    addLineShape(container, (g) => {
      const cx = width / 2;
      g.moveTo(cx, 0).lineTo(cx, height * 0.25);
      g.moveTo(width * 0.2, height * 0.25).lineTo(width * 0.8, height * 0.25);
      g.moveTo(width * 0.3, height * 0.42).lineTo(width * 0.7, height * 0.42);
      g.moveTo(width * 0.38, height * 0.58).lineTo(width * 0.62, height * 0.58);
    });
    addText(container, 'GND', fonts.designation, 11, width / 2, height * 0.68, true);
    return;
  }

  addRectBody(container, width, height, 2);
  const sign = block.polarity === 'negative' ? '-' : '+';
  addText(container, `${sign}${block.voltage}V`, fonts.designation, 11, width / 2, height / 2 - 6, true);
}

function drawRelay(container: Container, block: RelayBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);
  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, 'K', fonts.designation, 11, width / 2, height / 2 - 6, true);
  addText(container, `${block.coilVoltage}V`, fonts.value, 9, width / 2, height + 2, true);
}

function drawMotor(container: Container, block: MotorBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  const circle = new Graphics();
  circle.circle(width / 2, height / 2, Math.min(width, height) * 0.38);
  circle.fill(BODY_FILL).stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(circle);

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, 'M', fonts.designation, 11, width / 2, height / 2 - 6, true);
  addText(container, `${block.powerKw}kW`, fonts.value, 9, width / 2, height + 2, true);
}

function drawFuse(container: Container, block: FuseBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);
  addLineShape(container, (g) => {
    g.moveTo(width * 0.2, height * 0.8).lineTo(width * 0.8, height * 0.2);
  });
  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, `${block.ratingAmps}A`, fonts.value, 9, width / 2, height + 1, true);
}

function drawButton(container: Container, block: ButtonBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addLineShape(container, (g) => {
    g.moveTo(width * 0.2, height * 0.35).lineTo(width * 0.4, height * 0.35);
    g.moveTo(width * 0.6, height * 0.65).lineTo(width * 0.8, height * 0.65);
    g.moveTo(width * 0.4, height * 0.35).lineTo(width * 0.6, height * 0.65);
    g.moveTo(width * 0.28, height * 0.18).lineTo(width * 0.72, height * 0.82);
  });
  addText(container, block.contactConfig.toUpperCase(), fonts.value, 9, width / 2, height + 1, true);
}

function drawLed(container: Container, block: Block, fonts: FontNames): void {
  const { width, height } = block.size;
  addLineShape(container, (g) => {
    g.moveTo(width / 2, height * 0.1).lineTo(width / 2, height * 0.22);
    g.poly([width * 0.25, height * 0.22, width * 0.75, height * 0.22, width / 2, height * 0.68]);
    g.moveTo(width * 0.2, height * 0.72).lineTo(width * 0.8, height * 0.72);
    g.moveTo(width / 2, height * 0.72).lineTo(width / 2, height * 0.9);
  });
  addText(container, 'LED', fonts.value, 9, width / 2, height + 1, true);
}

function drawPlcIo(container: Container, block: PlcInBlock | PlcOutBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 6);
  addText(container, block.type === 'plc_in' ? 'PLC IN' : 'PLC OUT', fonts.designation, 11, width / 2, 4, true);
  addText(container, block.address, fonts.label, 10, width / 2, height / 2 - 4, true);
}

function drawContactor(container: Container, block: ContactorBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);
  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, 'KM', fonts.designation, 11, width / 2, 8, true);

  addLineShape(container, (g) => {
    const baseY = height * 0.55;
    g.moveTo(width * 0.2, baseY).lineTo(width * 0.2, baseY + 16);
    g.moveTo(width * 0.5, baseY).lineTo(width * 0.5, baseY + 16);
    g.moveTo(width * 0.8, baseY).lineTo(width * 0.8, baseY + 16);
  });

  addText(container, `${block.powerRating}kW`, fonts.value, 9, width / 2, height + 1, true);
}

function drawText(container: Container, block: TextBlock, fonts: FontNames): void {
  const styleFont = block.textStyle === 'title' ? fonts.designation : fonts.label;
  const fontSize = Math.max(8, Math.min(block.fontSize, 20));
  addText(container, block.content, styleFont, fontSize, 0, 0, false);
}

function drawNetLabel(container: Container, block: NetLabelBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  const pennant = new Graphics();
  pennant.poly([
    0,
    0,
    width - 8,
    0,
    width,
    height / 2,
    width - 8,
    height,
    0,
    height,
  ]);
  pennant.fill(BODY_FILL).stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(pennant);

  addText(container, block.netName, fonts.label, 10, 6, height / 2 - 5, false);
}

function drawScope(container: Container, block: ScopeBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);

  addLineShape(container, (g) => {
    const top = height * 0.25;
    const mid = height * 0.5;
    const bottom = height * 0.75;
    g.moveTo(width * 0.18, mid).lineTo(width * 0.32, mid);
    g.lineTo(width * 0.42, top);
    g.lineTo(width * 0.58, bottom);
    g.lineTo(width * 0.72, mid);
    g.lineTo(width * 0.82, mid);
  });

  addText(container, `${block.channels}CH`, fonts.value, 9, width / 2, height + 1, true);
}

function drawSensor(container: Container, block: SensorBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);

  addLineShape(container, (g) => {
    g.moveTo(width * 0.2, height * 0.3).lineTo(width * 0.2, height * 0.7);
    g.moveTo(width * 0.2, height * 0.5).lineTo(width * 0.7, height * 0.5);
    g.moveTo(width * 0.62, height * 0.35).lineTo(width * 0.82, height * 0.5);
    g.moveTo(width * 0.62, height * 0.65).lineTo(width * 0.82, height * 0.5);
  });

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, block.outputType, fonts.value, 9, width / 2, height + 1, true);
}

function drawTransformer(container: Container, block: TransformerBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);

  addLineShape(container, (g) => {
    const startX = width * 0.3;
    const endX = width * 0.7;
    const topStart = height * 0.25;
    const topEnd = height * 0.45;
    const bottomStart = height * 0.55;
    const bottomEnd = height * 0.75;

    for (let i = 0; i < 4; i += 1) {
      const y = topStart + ((topEnd - topStart) / 3) * i;
      g.moveTo(startX - 6, y).bezierCurveTo(startX - 2, y - 4, startX + 2, y + 4, startX + 6, y);
      g.moveTo(endX - 6, y).bezierCurveTo(endX - 2, y - 4, endX + 2, y + 4, endX + 6, y);
    }

    for (let i = 0; i < 4; i += 1) {
      const y = bottomStart + ((bottomEnd - bottomStart) / 3) * i;
      g.moveTo(startX - 6, y).bezierCurveTo(startX - 2, y - 4, startX + 2, y + 4, startX + 6, y);
      g.moveTo(endX - 6, y).bezierCurveTo(endX - 2, y - 4, endX + 2, y + 4, endX + 6, y);
    }

    g.moveTo(width * 0.46, height * 0.2).lineTo(width * 0.46, height * 0.8);
    g.moveTo(width * 0.54, height * 0.2).lineTo(width * 0.54, height * 0.8);
  }, BODY_STROKE, 1.2);

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
}

function drawOverloadRelay(container: Container, block: OverloadRelayBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);

  addLineShape(container, (g) => {
    g.moveTo(width * 0.18, height * 0.55);
    g.lineTo(width * 0.3, height * 0.4);
    g.lineTo(width * 0.42, height * 0.65);
    g.lineTo(width * 0.54, height * 0.4);
    g.lineTo(width * 0.66, height * 0.65);
    g.lineTo(width * 0.82, height * 0.45);
  });

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, `${block.currentMin}-${block.currentMax}A`, fonts.value, 9, width / 2, height + 1, true);
}

function drawDisconnectSwitch(container: Container, block: DisconnectSwitchBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);

  addLineShape(container, (g) => {
    const ys = [height * 0.28, height * 0.5, height * 0.72];
    for (const y of ys) {
      g.moveTo(width * 0.15, y).lineTo(width * 0.4, y);
      g.moveTo(width * 0.6, y).lineTo(width * 0.85, y);
    }
    g.moveTo(width * 0.35, height * 0.78).lineTo(width * 0.68, height * 0.22);
  });

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
}

function drawEmergencyStop(container: Container, block: EmergencyStopBlock, fonts: FontNames): void {
  const { width, height } = block.size;

  const button = new Graphics();
  button.circle(width / 2, height / 2, Math.min(width, height) * 0.38);
  button.fill(0x6f1d1d).stroke({ width: 2, color: ACCENT_RED });
  container.addChild(button);

  addLineShape(container, (g) => {
    g.moveTo(width * 0.32, height * 0.32).lineTo(width * 0.68, height * 0.68);
    g.moveTo(width * 0.68, height * 0.32).lineTo(width * 0.32, height * 0.68);
  }, 0xffffff, 1.6);

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
}

function drawSelectorSwitch(container: Container, block: SelectorSwitchBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  const ring = new Graphics();
  ring.circle(width / 2, height / 2, Math.min(width, height) * 0.36);
  ring.fill(BODY_FILL).stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(ring);

  const maxPos = Math.max(block.positions - 1, 1);
  const t = block.currentPosition / maxPos;
  const angle = -Math.PI * 0.75 + Math.PI * 1.5 * t;

  addLineShape(container, (g) => {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.28;
    g.moveTo(cx, cy).lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }, ACCENT_GREEN, 2);

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
}

function drawSolenoidValve(container: Container, block: SolenoidValveBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);

  addLineShape(container, (g) => {
    g.moveTo(width * 0.15, height * 0.5);
    g.lineTo(width * 0.25, height * 0.35);
    g.lineTo(width * 0.35, height * 0.65);
    g.lineTo(width * 0.45, height * 0.35);
    g.lineTo(width * 0.55, height * 0.65);
    g.lineTo(width * 0.65, height * 0.35);
    g.lineTo(width * 0.75, height * 0.65);
    g.lineTo(width * 0.85, height * 0.5);
  });

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
  addText(container, block.valveType, fonts.value, 9, width / 2, height + 1, true);
}

function drawPilotLamp(container: Container, block: PilotLampBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  const lamp = new Graphics();
  lamp.circle(width / 2, height / 2, Math.min(width, height) * 0.34);
  lamp.fill(BODY_FILL).stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(lamp);

  addLineShape(container, (g) => {
    g.moveTo(width * 0.35, height * 0.35).lineTo(width * 0.65, height * 0.65);
    g.moveTo(width * 0.65, height * 0.35).lineTo(width * 0.35, height * 0.65);
  });

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
}

function drawTerminalBlock(container: Container, block: TerminalBlockType, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 1);

  const topDot = new Graphics();
  topDot.circle(width / 2, height * 0.22, 2.5).fill(BODY_STROKE);
  container.addChild(topDot);

  const bottomDot = new Graphics();
  bottomDot.circle(width / 2, height * 0.78, 2.5).fill(BODY_STROKE);
  container.addChild(bottomDot);

  addText(container, block.designation, fonts.designation, 11, width / 2, -14, true);
}

function drawOffPageConnector(container: Container, block: OffPageConnectorBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  const shape = new Graphics();
  if (block.direction === 'incoming') {
    shape.poly([10, 0, width, 0, width, height, 10, height, 0, height / 2]);
  } else {
    shape.poly([0, 0, width - 10, 0, width, height / 2, width - 10, height, 0, height]);
  }
  shape.fill(BODY_FILL).stroke({ width: 1.5, color: BODY_STROKE });
  container.addChild(shape);

  addText(container, block.signalLabel, fonts.label, 10, width / 2, height / 2 - 5, true);
}

function drawCustomSymbol(container: Container, block: CustomSymbolBlock, fonts: FontNames): void {
  const { width, height } = block.size;
  addDashedRect(container, width, height);
  addText(container, 'CUSTOM', fonts.designation, 11, width / 2, height / 2 - 7, true);
  addText(container, block.symbolId || 'placeholder', fonts.value, 9, width / 2, height / 2 + 6, true);
}

function drawDefaultBlock(container: Container, block: Block, fonts: FontNames): void {
  const { width, height } = block.size;
  addRectBody(container, width, height, 2);
  addText(container, block.type, fonts.label, 10, width / 2, height / 2 - 5, true);
}

function initializeRegistry(): void {
  if (drawRegistry.size > 0) {
    return;
  }

  register('powersource', drawPowerSource);
  register('fuse', drawFuse);
  register('led', drawLed);
  register('pilot_lamp', drawPilotLamp);
  register('terminal_block', drawTerminalBlock);

  register('button', drawButton);
  register('emergency_stop', drawEmergencyStop);
  register('selector_switch', drawSelectorSwitch);

  register('plc_in', drawPlcIo);
  register('plc_out', drawPlcIo);

  register('relay', drawRelay);
  register('contactor', drawContactor);
  register('solenoid_valve', drawSolenoidValve);

  register('motor', drawMotor);
  register('overload_relay', drawOverloadRelay);
  register('disconnect_switch', drawDisconnectSwitch);
  register('transformer', drawTransformer);

  register('scope', drawScope);
  register('text', drawText);
  register('net_label', drawNetLabel);
  register('off_page_connector', drawOffPageConnector);
  register('sensor', drawSensor);
  register('custom_symbol', drawCustomSymbol);
}

export function drawBlock(container: Container, block: Block): void {
  ensureFontsInstalled();
  initializeRegistry();

  container.removeChildren();

  const draw = drawRegistry.get(block.type);
  if (draw) {
    draw(container, block, FONT_NAMES);
    return;
  }

  drawDefaultBlock(container, block, FONT_NAMES);
}
