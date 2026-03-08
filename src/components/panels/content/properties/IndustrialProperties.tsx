/**
 * Industrial Properties Component
 *
 * Generic property editor for industrial block types (relay, fuse, motor, etc.).
 * Displays designation, type-specific fields, and common properties.
 */

import { memo, useCallback, useState, useEffect } from 'react';
import { CommonProperties } from './CommonProperties';
import type { Block } from '../../../OneCanvas/types';
import type { ComponentInstance } from '@/types/circuit';

// ============================================================================
// Types
// ============================================================================

interface IndustrialPropertiesProps {
  component: Block | ComponentInstance;
  onChange: (updates: Partial<Block>) => void;
}

// ============================================================================
// Field Config per Type
// ============================================================================

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
}

function getFieldsForType(blockType: string): FieldConfig[] {
  switch (blockType) {
    case 'relay':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'coilVoltage', label: 'Coil Voltage (V)', type: 'number' },
        { key: 'contacts', label: 'Contact Type', type: 'select', options: [
          { value: 'NO', label: 'Normally Open (NO)' },
          { value: 'NC', label: 'Normally Closed (NC)' },
        ]},
      ];
    case 'fuse':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'fuseType', label: 'Type', type: 'select', options: [
          { value: 'fuse', label: 'Fuse' },
          { value: 'mcb', label: 'MCB' },
          { value: 'mpcb', label: 'MPCB' },
        ]},
        { key: 'ratingAmps', label: 'Rating (A)', type: 'number' },
      ];
    case 'motor':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'powerKw', label: 'Power (kW)', type: 'number' },
        { key: 'voltageRating', label: 'Voltage (V)', type: 'number' },
      ];
    case 'emergency_stop':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
      ];
    case 'selector_switch':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'positions', label: 'Positions', type: 'select', options: [
          { value: '2', label: '2 positions' },
          { value: '3', label: '3 positions' },
        ]},
      ];
    case 'solenoid_valve':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'valveType', label: 'Valve Type', type: 'select', options: [
          { value: '2-2', label: '2/2' },
          { value: '3-2', label: '3/2' },
          { value: '5-2', label: '5/2' },
          { value: '5-3', label: '5/3' },
        ]},
        { key: 'coilVoltage', label: 'Coil Voltage (V)', type: 'number' },
      ];
    case 'sensor':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'sensorType', label: 'Sensor Type', type: 'select', options: [
          { value: 'proximity_inductive', label: 'Proximity (Inductive)' },
          { value: 'proximity_capacitive', label: 'Proximity (Capacitive)' },
          { value: 'photoelectric', label: 'Photoelectric' },
          { value: 'limit_switch', label: 'Limit Switch' },
        ]},
        { key: 'outputType', label: 'Output', type: 'select', options: [
          { value: 'PNP', label: 'PNP (Sourcing)' },
          { value: 'NPN', label: 'NPN (Sinking)' },
        ]},
      ];
    case 'pilot_lamp':
      return [
        { key: 'designation', label: 'Designation', type: 'text' },
        { key: 'lampColor', label: 'Color', type: 'select', options: [
          { value: 'red', label: 'Red' },
          { value: 'green', label: 'Green' },
          { value: 'yellow', label: 'Yellow' },
          { value: 'blue', label: 'Blue' },
          { value: 'white', label: 'White' },
        ]},
        { key: 'voltageRating', label: 'Voltage (V)', type: 'number' },
      ];
    default:
      return [];
  }
}

// ============================================================================
// Component
// ============================================================================

export const IndustrialProperties = memo(function IndustrialProperties({
  component,
  onChange,
}: IndustrialPropertiesProps) {
  const fields = getFieldsForType(component.type);
  const comp = component as unknown as Record<string, unknown>;

  // Local state for text/number fields
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const values: Record<string, string> = {};
    fields.forEach((f) => {
      values[f.key] = String(comp[f.key] ?? '');
    });
    setLocalValues(values);
  }, [component.id, component.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((key: string, value: string, fieldType: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    if (fieldType === 'select') {
      onChange({ [key]: value } as Partial<Block>);
    }
  }, [onChange]);

  const handleBlur = useCallback((key: string, fieldType: string) => {
    const value = localValues[key];
    if (fieldType === 'number') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        onChange({ [key]: num } as Partial<Block>);
      }
    } else if (fieldType === 'text') {
      onChange({ [key]: value } as Partial<Block>);
    }
  }, [localValues, onChange]);

  return (
    <div className="space-y-4">
      <CommonProperties component={component} onChange={onChange} />

      {/* Type badge */}
      <div className="px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-400 text-center uppercase tracking-wider">
        {component.type.replace(/_/g, ' ')}
      </div>

      {/* Dynamic fields */}
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs text-neutral-400 mb-1">{field.label}</label>
          {field.type === 'select' ? (
            <select
              value={String(comp[field.key] ?? '')}
              onChange={(e) => handleChange(field.key, e.target.value, 'select')}
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white"
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              value={localValues[field.key] ?? String(comp[field.key] ?? '')}
              onChange={(e) => handleChange(field.key, e.target.value, field.type)}
              onBlur={() => handleBlur(field.key, field.type)}
              className="w-full px-2 py-1 bg-neutral-800 border border-neutral-600 rounded text-sm text-white"
            />
          )}
        </div>
      ))}
    </div>
  );
});

export default IndustrialProperties;
