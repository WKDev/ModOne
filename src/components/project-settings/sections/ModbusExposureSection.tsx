import { memo, useCallback } from 'react';
import {
  PanelButton,
  PanelField,
  PanelInput,
  PanelSection,
  PanelSelect,
} from '../../protocol/ProtocolPanelPrimitives';
import type {
  ModbusExposureAddressSpace,
  ModbusExposureRule,
} from '../../../types/project';
import type { CategorySectionProps } from '../types';

const ADDRESS_SPACE_OPTIONS: ModbusExposureAddressSpace[] = [
  'Coil',
  'DiscreteInput',
  'HoldingRegister',
  'InputRegister',
];

const EMPTY_RULE: ModbusExposureRule = {
  family: 'D',
  address_space: 'HoldingRegister',
  offset: 0,
  count: 1,
};

export const ModbusExposureSection = memo(function ModbusExposureSection({
  config,
  searchFilter,
  onPatch,
}: CategorySectionProps) {
  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  const exposureRules = config.modbus.exposure.rules;

  const patchExposure = useCallback(
    (patch: Partial<typeof config.modbus.exposure>) =>
      onPatch({
        modbus: {
          ...config.modbus,
          exposure: { ...config.modbus.exposure, ...patch },
        },
      }),
    [config.modbus, onPatch],
  );

  const updateExposureRule = useCallback(
    (index: number, patch: Partial<ModbusExposureRule>) => {
      const nextRules = exposureRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...patch } : rule,
      );
      patchExposure({ rules: nextRules });
    },
    [exposureRules, patchExposure],
  );

  const addExposureRule = useCallback(() => {
    patchExposure({ rules: [...exposureRules, EMPTY_RULE] });
  }, [exposureRules, patchExposure]);

  const removeExposureRule = useCallback(
    (index: number) => {
      patchExposure({ rules: exposureRules.filter((_, ruleIndex) => ruleIndex !== index) });
    },
    [exposureRules, patchExposure],
  );

  if (!isVisible(['modbus', 'exposure', 'rule', 'family', 'register', 'coil', 'address', 'space'])) {
    return null;
  }

  return (
    <PanelSection
      title="Modbus Exposure"
      description="Choose how vendor-visible device families are projected into Modbus spaces."
      actions={
        <PanelButton tone="neutral" onClick={addExposureRule}>
          Add Rule
        </PanelButton>
      }
    >
      <PanelField label="Exposure Mode">
        <PanelSelect
          value={config.modbus.exposure.mode}
          onChange={(e) =>
            patchExposure({
              mode: e.target.value as typeof config.modbus.exposure.mode,
            })
          }
        >
          <option value="Recommended">Recommended</option>
          <option value="LegacyWide">Legacy Wide</option>
          <option value="Custom">Custom</option>
        </PanelSelect>
      </PanelField>
      {config.modbus.exposure.mode === 'Custom' ? (
        <div className="space-y-3">
          {exposureRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
              Add explicit rules when a client expects a non-default register layout.
            </div>
          ) : (
            exposureRules.map((rule, index) => (
              <div
                key={`${rule.family}-${index}`}
                className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 md:grid-cols-[1fr_1fr_120px_120px_auto]"
              >
                <PanelField label="Family">
                  <PanelInput
                    value={rule.family}
                    onChange={(e) =>
                      updateExposureRule(index, { family: e.target.value })
                    }
                  />
                </PanelField>
                <PanelField label="Address Space">
                  <PanelSelect
                    value={rule.address_space}
                    onChange={(e) =>
                      updateExposureRule(index, {
                        address_space: e.target.value as ModbusExposureAddressSpace,
                      })
                    }
                  >
                    {ADDRESS_SPACE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PanelSelect>
                </PanelField>
                <PanelField label="Offset">
                  <PanelInput
                    type="number"
                    min={0}
                    value={rule.offset}
                    onChange={(e) =>
                      updateExposureRule(index, {
                        offset: Math.max(
                          0,
                          Number.parseInt(e.target.value || '0', 10),
                        ),
                      })
                    }
                  />
                </PanelField>
                <PanelField label="Count">
                  <PanelInput
                    type="number"
                    min={1}
                    value={rule.count}
                    onChange={(e) =>
                      updateExposureRule(index, {
                        count: Math.max(
                          1,
                          Number.parseInt(e.target.value || '1', 10),
                        ),
                      })
                    }
                  />
                </PanelField>
                <div className="flex items-end">
                  <PanelButton
                    tone="danger"
                    className="w-full"
                    onClick={() => removeExposureRule(index)}
                  >
                    Remove
                  </PanelButton>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </PanelSection>
  );
});
