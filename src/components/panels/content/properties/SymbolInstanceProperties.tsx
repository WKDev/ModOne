// 커스텀 심볼 인스턴스의 속성(전압·channels 등)을 편집하고, 가변 포트 심볼이면 ports를 재계산하는 패널
import { memo, useCallback } from 'react';
import type { Block } from '../../../OneCanvas/types';
import { getCustomSymbolDefinition } from '../../../OneCanvas/renderers/symbols/customSymbolBridge';
import { resolveInstancePorts } from '../../../OneCanvas/renderers/symbols/resolveInstancePorts';

type InstanceProps = Record<string, string | number | boolean>;

interface SymbolInstancePropertiesProps {
  component: Block;
  onChange: (updates: Partial<Block>) => void;
}

export const SymbolInstanceProperties = memo(function SymbolInstanceProperties({
  component,
  onChange,
}: SymbolInstancePropertiesProps) {
  const comp = component as unknown as { symbolId?: string; instanceProperties?: InstanceProps };
  const def = comp.symbolId ? getCustomSymbolDefinition(comp.symbolId) : null;
  const instanceProps: InstanceProps = comp.instanceProperties ?? {};
  const isParametric = !!def?.portTemplates?.length;

  const visibleProps = (def?.properties ?? []).filter((p) => p.visible !== false);

  const updateProp = useCallback(
    (key: string, value: string | number | boolean) => {
      const nextProps: InstanceProps = { ...instanceProps, [key]: value };
      const updates: Partial<Block> = {
        instanceProperties: nextProps,
      } as Partial<Block>;
      // Parametric symbols: re-resolve ports so terminals track the property.
      if (def && def.portTemplates && def.portTemplates.length > 0) {
        updates.ports = resolveInstancePorts(def, nextProps);
      }
      onChange(updates);
    },
    [def, instanceProps, onChange],
  );

  if (!def || visibleProps.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase text-neutral-400">
        Symbol Properties{isParametric ? ' (parametric)' : ''}
      </div>
      {visibleProps.map((p) => {
        const current = instanceProps[p.key] ?? p.value;
        const id = `inst-${p.key}`;
        return (
          <div key={p.key} className="space-y-1">
            <label htmlFor={id} className="block text-xs text-neutral-400">{p.key}</label>
            {p.type === 'boolean' ? (
              <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
                <input
                  id={id}
                  type="checkbox"
                  checked={current === true}
                  onChange={(e) => updateProp(p.key, e.target.checked)}
                  className="accent-blue-500"
                />
                {String(current)}
              </label>
            ) : p.type === 'enum' && p.options ? (
              <select
                id={id}
                value={String(current)}
                onChange={(e) => updateProp(p.key, e.target.value)}
                className="w-full px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white"
              >
                {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                id={id}
                type={p.type === 'number' ? 'number' : 'text'}
                value={String(current)}
                onChange={(e) =>
                  updateProp(p.key, p.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)
                }
                className="w-full px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white"
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

export default SymbolInstanceProperties;
