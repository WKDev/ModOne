/**
 * CompareProperties Component
 *
 * Property editor for comparison block elements (EQ, GT, LT, GE, LE, NE).
 */

import { useCallback, useMemo } from 'react';
import { PropertyField, type SelectOption } from './PropertyField';
import { OperandField } from './OperandField';
import type { CompareElement, CompareType, CompareProperties as ComparePropsType } from '../../../types/ladder';

export interface ComparePropertiesProps {
  /** Compare element to edit */
  element: CompareElement;
  /** Called when element is updated */
  onUpdate: (updates: Partial<CompareElement>) => void;
  /** Whether editing is disabled */
  disabled?: boolean;
  /** Called when device button is clicked for address field */
  onDeviceSelect?: () => void;
}

/** Comparison type options */
const COMPARE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'compare_eq', label: '= (Equal)' },
  { value: 'compare_gt', label: '> (Greater Than)' },
  { value: 'compare_lt', label: '< (Less Than)' },
  { value: 'compare_ge', label: '>= (Greater or Equal)' },
  { value: 'compare_le', label: '<= (Less or Equal)' },
  { value: 'compare_ne', label: '<> (Not Equal)' },
];

/** Comparison operator options for properties */
const OPERATOR_OPTIONS: SelectOption[] = [
  { value: '=', label: '=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '<>', label: '<>' },
];

/**
 * Format operation for display
 */
function formatOperation(
  address: string,
  operator: string,
  compareValue: string | number
): string {
  const valueStr = typeof compareValue === 'number' ? compareValue.toString() : compareValue;
  return `${address} ${operator} ${valueStr}`;
}

/**
 * CompareProperties - Property editor for comparison elements
 */
export function CompareProperties({
  element,
  onUpdate,
  disabled = false,
  onDeviceSelect,
}: ComparePropertiesProps) {
  const handleAddressChange = useCallback(
    (value: string | number) => {
      onUpdate({ address: String(value) });
    },
    [onUpdate]
  );

  const handleTypeChange = useCallback(
    (value: string | number) => {
      onUpdate({ type: value as CompareType });
    },
    [onUpdate]
  );

  const handleOperatorChange = useCallback(
    (value: string | number) => {
      onUpdate({
        properties: {
          ...element.properties,
          operator: value as ComparePropsType['operator'],
        },
      });
    },
    [onUpdate, element.properties]
  );

  const handleCompareValueChange = useCallback(
    (value: string | number) => {
      onUpdate({
        properties: {
          ...element.properties,
          compareValue: value,
        },
      });
    },
    [onUpdate, element.properties]
  );

  const handleLabelChange = useCallback(
    (value: string | number) => {
      onUpdate({ label: String(value) || undefined });
    },
    [onUpdate]
  );

  // Format the operation preview
  const operationPreview = useMemo(() => {
    return formatOperation(
      element.address,
      element.properties.operator,
      element.properties.compareValue
    );
  }, [element.address, element.properties.operator, element.properties.compareValue]);

  return (
    <div className="space-y-3">
      {/* Operation preview */}
      <div className="p-2 bg-neutral-800 rounded border border-neutral-700">
        <div className="text-xs text-neutral-400 mb-1">Operation</div>
        <div className="text-sm font-mono text-blue-300">{operationPreview}</div>
      </div>

      <PropertyField
        label="Type"
        type="select"
        value={element.type}
        onChange={handleTypeChange}
        options={COMPARE_TYPE_OPTIONS}
        disabled={disabled}
      />

      <PropertyField
        label="Operand 1 (Address)"
        type="text"
        value={element.address}
        onChange={handleAddressChange}
        placeholder="D0000"
        disabled={disabled}
        showDeviceButton
        onDeviceButtonClick={onDeviceSelect}
      />

      <PropertyField
        label="Operator"
        type="select"
        value={element.properties.operator}
        onChange={handleOperatorChange}
        options={OPERATOR_OPTIONS}
        disabled={disabled}
      />

      <OperandField
        label="Operand 2 (Value)"
        value={element.properties.compareValue}
        onChange={handleCompareValueChange}
        disabled={disabled}
        onDeviceSelect={onDeviceSelect}
        minConstant={-32768}
        maxConstant={32767}
      />

      <PropertyField
        label="Label"
        type="text"
        value={element.label || ''}
        onChange={handleLabelChange}
        placeholder="Optional label"
        disabled={disabled}
      />
    </div>
  );
}

export default CompareProperties;
