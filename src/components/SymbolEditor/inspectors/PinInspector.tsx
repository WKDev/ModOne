// 선택된 핀의 전기 타입(전원/접지 시맨틱 포함)·표시 속성을 편집하는 인스펙터
import type { PinElectricalTypeV2, SymbolPin } from '../../../types/symbol';
import type { PinUpdate } from '../editorModel';
import { Section, Field, inputClass } from './fields';
import {
  PIN_TYPES,
  PIN_TYPE_LABEL,
  PIN_SHAPES,
  PIN_SHAPE_LABEL,
  PIN_ELECTRICAL_TYPES_V2,
  PIN_ELECTRICAL_TYPE_V2_LABEL,
  PIN_FUNCTIONAL_ROLES,
  PIN_FUNCTIONAL_ROLE_LABEL,
  V2_TO_V1_CATEGORY,
} from '../pinStyle';

interface PinInspectorProps {
  pin: SymbolPin;
  onUpdatePin?: (pinId: string, updates: PinUpdate) => void;
}

export function PinInspector({ pin, onUpdatePin }: PinInspectorProps) {
  return (
    <Section title="Pin Inspector" defaultOpen={true} badge="Pin">
      <Field id="pin-name" label="Pin Name" required>
        <input
          id="pin-name"
          type="text"
          value={pin.name}
          onChange={(e) => onUpdatePin?.(pin.id, { name: e.target.value })}
          className={inputClass()}
          placeholder="e.g. VCC, GND, IN1"
        />
      </Field>

      <Field id="pin-number" label="Pin Number">
        <input
          id="pin-number"
          type="text"
          value={pin.number}
          onChange={(e) => onUpdatePin?.(pin.id, { number: e.target.value })}
          className={inputClass()}
          placeholder="e.g. 1, A1"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field id="pin-type" label="Electrical Type">
          <select
            id="pin-type"
            value={pin.type}
            data-testid="pin-type-select"
            onChange={(e) => onUpdatePin?.(pin.id, { type: e.target.value as SymbolPin['type'] })}
            className={inputClass()}
          >
            {PIN_TYPES.map((t) => (
              <option key={t} value={t}>{PIN_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>

        <Field id="pin-shape" label="Shape">
          <select
            id="pin-shape"
            value={pin.shape}
            data-testid="pin-shape-select"
            onChange={(e) => onUpdatePin?.(pin.id, { shape: e.target.value as SymbolPin['shape'] })}
            className={inputClass()}
          >
            {PIN_SHAPES.map((s) => (
              <option key={s} value={s}>{PIN_SHAPE_LABEL[s]}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Detailed (KiCad) electrical type + functional role — 전원/접지/소스 시맨틱 저작 */}
      <div className="grid grid-cols-2 gap-2">
        <Field id="pin-etype-v2" label="Detailed Type">
          <select
            id="pin-etype-v2"
            value={pin.electricalType ?? ''}
            data-testid="pin-etype-v2-select"
            onChange={(e) => {
              const v = e.target.value as PinElectricalTypeV2 | '';
              if (!v) {
                onUpdatePin?.(pin.id, { electricalType: undefined });
              } else {
                // detailed 선택 시 v1 카테고리(색/단순타입)도 자동 동기화
                onUpdatePin?.(pin.id, { electricalType: v, type: V2_TO_V1_CATEGORY[v] });
              }
            }}
            className={inputClass()}
          >
            <option value="">(Electrical Type 따름)</option>
            {PIN_ELECTRICAL_TYPES_V2.map((t) => (
              <option key={t} value={t}>{PIN_ELECTRICAL_TYPE_V2_LABEL[t]}</option>
            ))}
          </select>
        </Field>

        <Field id="pin-role" label="Functional Role">
          <select
            id="pin-role"
            value={pin.functionalRole ?? 'general'}
            data-testid="pin-role-select"
            onChange={(e) =>
              onUpdatePin?.(pin.id, { functionalRole: e.target.value as SymbolPin['functionalRole'] })
            }
            className={inputClass()}
          >
            {PIN_FUNCTIONAL_ROLES.map((r) => (
              <option key={r} value={r}>{PIN_FUNCTIONAL_ROLE_LABEL[r]}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-[10px] text-neutral-500 -mt-1">
        전원·접지·소스는 Detailed Type을 Power Input/Output으로 지정하세요.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Field id="pin-orientation" label="Orientation">
          <select
            id="pin-orientation"
            value={pin.orientation}
            onChange={(e) => onUpdatePin?.(pin.id, { orientation: e.target.value as SymbolPin['orientation'] })}
            className={inputClass()}
          >
            <option value="right">Right →</option>
            <option value="left">Left ←</option>
            <option value="up">Up ↑</option>
            <option value="down">Down ↓</option>
          </select>
        </Field>

        <Field id="pin-length" label="Length">
          <input
            id="pin-length"
            type="number"
            min={0}
            step={5}
            value={pin.length}
            onChange={(e) => onUpdatePin?.(pin.id, { length: parseFloat(e.target.value) || 0 })}
            className={inputClass()}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field id="pin-pos-x" label="Position X">
          <input
            id="pin-pos-x"
            type="number"
            value={pin.position.x}
            onChange={(e) => onUpdatePin?.(pin.id, { position: { ...pin.position, x: parseFloat(e.target.value) || 0 } })}
            className={inputClass()}
            step={1}
          />
        </Field>
        <Field id="pin-pos-y" label="Position Y">
          <input
            id="pin-pos-y"
            type="number"
            value={pin.position.y}
            onChange={(e) => onUpdatePin?.(pin.id, { position: { ...pin.position, y: parseFloat(e.target.value) || 0 } })}
            className={inputClass()}
            step={1}
          />
        </Field>
      </div>

      {/* Display & visibility */}
      <Field id="pin-group" label="Group (optional)">
        <input
          id="pin-group"
          type="text"
          value={pin.group ?? ''}
          onChange={(e) => onUpdatePin?.(pin.id, { group: e.target.value || undefined })}
          className={inputClass()}
          placeholder="e.g. Power, Data"
        />
      </Field>

      <Field id="pin-desc" label="Description (tooltip)">
        <input
          id="pin-desc"
          type="text"
          value={pin.description ?? ''}
          onChange={(e) => onUpdatePin?.(pin.id, { description: e.target.value || undefined })}
          className={inputClass()}
          placeholder="Optional"
        />
      </Field>

      <div className="flex items-center gap-3 px-1 pt-1">
        <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="pin-name-visible"
            checked={pin.nameVisible !== false}
            onChange={(e) => onUpdatePin?.(pin.id, { nameVisible: e.target.checked })}
            className="accent-blue-500"
          />
          Name
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="pin-number-visible"
            checked={pin.numberVisible !== false}
            onChange={(e) => onUpdatePin?.(pin.id, { numberVisible: e.target.checked })}
            className="accent-blue-500"
          />
          Number
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="pin-hidden"
            checked={!!pin.hidden}
            onChange={(e) => onUpdatePin?.(pin.id, { hidden: e.target.checked })}
            className="accent-blue-500"
          />
          Hidden
        </label>
        <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="pin-locked"
            checked={!!pin.locked}
            onChange={(e) => onUpdatePin?.(pin.id, { locked: e.target.checked })}
            className="accent-blue-500"
          />
          Lock
        </label>
      </div>
    </Section>
  );
}
