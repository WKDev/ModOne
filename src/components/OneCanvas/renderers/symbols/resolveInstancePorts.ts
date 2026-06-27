// PortTemplate를 인스턴스 속성으로 펼쳐 실제 pins/Port[]로 해석 (정적 pins + 템플릿)
import type { PortTemplate, SymbolDefinition, SymbolPin } from '../../../../types/symbol';
import type { Port, PortType, PortPosition } from '../../types';

export const PIN_TYPE_TO_PORT_TYPE: Record<string, PortType> = {
  input: 'input',
  output: 'output',
  bidirectional: 'bidirectional',
  power: 'input',
  passive: 'bidirectional',
};

export const PIN_ORIENTATION_TO_PORT_POSITION: Record<string, PortPosition> = {
  right: 'right',
  left: 'left',
  up: 'top',
  down: 'bottom',
};

/** Convert symbol pins to canvas ports (excludes hidden). */
export function buildStaticPorts(pins: SymbolPin[]): Port[] {
  return pins
    .filter((pin) => !pin.hidden)
    .map((pin) => ({
      id: pin.id,
      type: PIN_TYPE_TO_PORT_TYPE[pin.type] ?? 'bidirectional',
      label: pin.name,
      position: PIN_ORIENTATION_TO_PORT_POSITION[pin.orientation] ?? 'left',
      absolutePosition: { x: pin.position.x, y: pin.position.y },
    }));
}

type InstanceProps = Record<string, string | number | boolean> | undefined;

/** Resolve a template's repeat count from instance props, falling back to the property default, clamped. */
function resolveCount(t: PortTemplate, def: SymbolDefinition, instanceProps: InstanceProps): number {
  const raw = instanceProps?.[t.repeat];
  let n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    const prop = def.properties.find((p) => p.key === t.repeat);
    n = typeof prop?.value === 'number' ? prop.value : Number(prop?.value);
  }
  if (!Number.isFinite(n)) n = t.min ?? 1;
  n = Math.round(n);
  const min = t.min ?? 1;
  const max = t.max ?? Number.MAX_SAFE_INTEGER;
  return Math.max(min, Math.min(max, n));
}

/** Expand one PortTemplate into N concrete pins (absolute coords from explicit start/step). */
export function expandPortTemplate(
  t: PortTemplate,
  def: SymbolDefinition,
  instanceProps: InstanceProps,
): SymbolPin[] {
  const n = resolveCount(t, def, instanceProps);
  const numberFrom = t.numberFrom ?? 1;
  const horizontal = t.orientation === 'left' || t.orientation === 'right';
  const out: SymbolPin[] = [];
  for (let i = 0; i < n; i++) {
    const idx = i + 1; // 1-based for {i}
    const x = horizontal ? (t.x ?? 0) : (t.xStart ?? 0) + i * (t.xStep ?? 0);
    const y = horizontal ? (t.yStart ?? 0) + i * (t.yStep ?? 0) : (t.y ?? 0);
    out.push({
      id: t.idPattern.replace(/\{i\}/g, String(idx)),
      name: (t.namePattern ?? t.idPattern).replace(/\{i\}/g, String(idx)),
      number: String(numberFrom + i),
      type: t.type,
      electricalType: t.electricalType,
      functionalRole: t.functionalRole,
      shape: t.shape ?? 'line',
      position: { x, y },
      orientation: t.orientation,
      length: 0,
    });
  }
  return out;
}

/**
 * Effective pins for a symbol instance = static pins + every PortTemplate
 * expanded against the instance's property values (or property defaults).
 * De-duplicated by pin id (static wins).
 */
export function resolveEffectivePins(def: SymbolDefinition, instanceProps?: InstanceProps): SymbolPin[] {
  if (!def.portTemplates || def.portTemplates.length === 0) return def.pins;
  const expanded = def.portTemplates.flatMap((t) => expandPortTemplate(t, def, instanceProps));
  const seen = new Set(def.pins.map((p) => p.id));
  return [...def.pins, ...expanded.filter((p) => !seen.has(p.id))];
}

/** Resolve all canvas ports for a placed instance (static + templates). */
export function resolveInstancePorts(def: SymbolDefinition, instanceProps?: InstanceProps): Port[] {
  return buildStaticPorts(resolveEffectivePins(def, instanceProps));
}
