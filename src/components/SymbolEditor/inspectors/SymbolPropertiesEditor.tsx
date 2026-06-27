// 심볼 인스턴스 속성(voltage·netName 등 key/type/기본값)을 추가·편집하는 패널
import { Plus, Trash2 } from 'lucide-react';
import type { SymbolProperty } from '../../../types/symbol';
import { inputClass } from './fields';

const PROPERTY_TYPES: SymbolProperty['type'][] = ['string', 'number', 'boolean', 'enum'];

/** 타입에 맞는 기본 에디터 위젯. */
function editorTypeFor(type: SymbolProperty['type']): SymbolProperty['editorType'] {
  switch (type) {
    case 'number': return 'number';
    case 'boolean': return 'checkbox';
    case 'enum': return 'select';
    default: return 'text';
  }
}

/** 타입 전환 시 안전한 기본값. */
function defaultValueFor(type: SymbolProperty['type']): string | number | boolean {
  switch (type) {
    case 'number': return 0;
    case 'boolean': return false;
    default: return '';
  }
}

interface SymbolPropertiesEditorProps {
  properties: SymbolProperty[];
  onChange: (next: SymbolProperty[]) => void;
}

export function SymbolPropertiesEditor({ properties, onChange }: SymbolPropertiesEditorProps) {
  const update = (index: number, patch: Partial<SymbolProperty>) =>
    onChange(properties.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const remove = (index: number) =>
    onChange(properties.filter((_, i) => i !== index));

  const add = () =>
    onChange([
      ...properties,
      { key: '', value: '', type: 'string', editorType: 'text', visible: true },
    ]);

  return (
    <div className="space-y-3">
      {properties.length === 0 && (
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          정의된 속성이 없습니다. 전압·정격 전류·넷 이름 같은 인스턴스 속성을 추가하세요.
        </p>
      )}

      {properties.map((p, i) => (
        <div key={i} className="rounded border border-neutral-700 bg-neutral-900/40 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={p.key}
              data-testid={`prop-key-${i}`}
              onChange={(e) => update(i, { key: e.target.value })}
              className={inputClass()}
              placeholder="key (e.g. voltage)"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              data-testid={`prop-remove-${i}`}
              className="shrink-0 p-1.5 rounded text-neutral-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
              title="속성 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={p.type}
              data-testid={`prop-type-${i}`}
              onChange={(e) => {
                const type = e.target.value as SymbolProperty['type'];
                update(i, { type, editorType: editorTypeFor(type), value: defaultValueFor(type) });
              }}
              className={inputClass()}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {p.type === 'boolean' ? (
              <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  checked={p.value === true}
                  onChange={(e) => update(i, { value: e.target.checked })}
                  className="accent-blue-500"
                />
                기본값 (참)
              </label>
            ) : (
              <input
                type={p.type === 'number' ? 'number' : 'text'}
                value={String(p.value ?? '')}
                data-testid={`prop-default-${i}`}
                onChange={(e) =>
                  update(i, {
                    value: p.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                  })
                }
                className={inputClass()}
                placeholder="기본값"
              />
            )}
          </div>

          {p.type === 'enum' && (
            <input
              type="text"
              value={(p.options ?? []).join(', ')}
              onChange={(e) =>
                update(i, {
                  options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              className={inputClass()}
              placeholder="옵션: a, b, c"
            />
          )}

          <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={p.visible !== false}
              onChange={(e) => update(i, { visible: e.target.checked })}
              className="accent-blue-500"
            />
            인스턴스 패널에 표시
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        data-testid="prop-add"
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded border border-dashed border-neutral-600 text-neutral-300 hover:bg-neutral-700/40 transition-colors"
      >
        <Plus size={14} />
        속성 추가
      </button>
    </div>
  );
}
