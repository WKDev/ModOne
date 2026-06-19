import { memo } from 'react';
import {
  PanelField,
  PanelInput,
  PanelSection,
  PanelSelect,
  StatusBadge,
} from '../../protocol/ProtocolPanelPrimitives';
import type { ModbusSimulationTransport } from '../../../types/project';
import type { CategorySectionProps } from '../types';

export const ModbusSimulationSection = memo(function ModbusSimulationSection({
  config,
  searchFilter,
  onPatch,
}: CategorySectionProps) {
  const filter = searchFilter.toLowerCase();
  const isVisible = (keywords: string[]) => {
    if (!filter) return true;
    return keywords.some((kw) => kw.toLowerCase().includes(filter));
  };

  const simulation = config.modbus.simulation;
  const isSerialTransport =
    simulation.transport === 'Rtu' || simulation.transport === 'RtuAscii';

  const patchSimulation = (
    patch: Partial<typeof simulation>,
    rootPatch?: Partial<typeof config.modbus>,
  ) =>
    onPatch({
      modbus: {
        ...config.modbus,
        ...rootPatch,
        simulation: { ...config.modbus.simulation, ...patch },
      },
    });

  if (!isVisible(['modbus', 'simulation', 'transport', 'unit', 'coil', 'baud', 'parity', 'serial', 'com', 'address'])) {
    return null;
  }

  return (
    <PanelSection
      title="Modbus Simulation"
      description="Project-owned Modbus runtime settings. These are stored in `.mop` and consumed by the runtime panel."
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={simulation.enabled ? 'success' : 'muted'}>
          {simulation.enabled ? 'Simulation Enabled' : 'Simulation Disabled'}
        </StatusBadge>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={simulation.enabled}
            onChange={(e) => patchSimulation({ enabled: e.target.checked })}
          />
          Enable project-owned Modbus server
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PanelField label="Transport">
          <PanelSelect
            value={simulation.transport}
            onChange={(e) =>
              patchSimulation({
                transport: e.target.value as ModbusSimulationTransport,
              })
            }
          >
            <option value="Tcp">Modbus TCP</option>
            <option value="Rtu">Modbus RTU</option>
            <option value="TcpAscii">Modbus TCP ASCII</option>
            <option value="RtuAscii">Modbus RTU ASCII</option>
          </PanelSelect>
        </PanelField>
        <PanelField label={isSerialTransport ? 'COM Port' : 'Bind Address'}>
          <PanelInput
            placeholder={isSerialTransport ? 'COM3' : '127.0.0.1:502'}
            value={isSerialTransport ? simulation.com_port : simulation.address}
            onChange={(e) =>
              patchSimulation(
                isSerialTransport
                  ? { com_port: e.target.value }
                  : { address: e.target.value },
              )
            }
          />
        </PanelField>
      </div>
      <div
        className={`grid gap-3 ${isSerialTransport ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}
      >
        <PanelField label="Unit ID">
          <PanelInput
            type="number"
            min={0}
            max={247}
            value={simulation.unit_id}
            onChange={(e) =>
              patchSimulation({
                unit_id: Math.max(
                  0,
                  Math.min(247, Number.parseInt(e.target.value || '0', 10)),
                ),
              })
            }
          />
        </PanelField>
        <PanelField label="Coil Start">
          <PanelInput
            type="number"
            min={0}
            max={65535}
            value={simulation.coil_start_address}
            onChange={(e) =>
              patchSimulation({
                coil_start_address: Math.max(
                  0,
                  Math.min(65535, Number.parseInt(e.target.value || '0', 10)),
                ),
              })
            }
          />
        </PanelField>
        <PanelField label="Word Start">
          <PanelInput
            type="number"
            min={0}
            max={65535}
            value={simulation.word_start_address}
            onChange={(e) =>
              patchSimulation({
                word_start_address: Math.max(
                  0,
                  Math.min(65535, Number.parseInt(e.target.value || '0', 10)),
                ),
              })
            }
          />
        </PanelField>
        {isSerialTransport && (
          <>
            <PanelField label="Baud Rate">
              <PanelInput
                type="number"
                min={300}
                value={simulation.baud_rate}
                onChange={(e) =>
                  patchSimulation({
                    baud_rate: Math.max(
                      300,
                      Number.parseInt(e.target.value || '300', 10),
                    ),
                  })
                }
              />
            </PanelField>
            <PanelField label="Parity">
              <PanelSelect
                value={simulation.parity}
                onChange={(e) =>
                  patchSimulation({
                    parity: e.target.value as typeof simulation.parity,
                  })
                }
              >
                <option value="None">None</option>
                <option value="Even">Even</option>
                <option value="Odd">Odd</option>
              </PanelSelect>
            </PanelField>
          </>
        )}
        {isSerialTransport && (
          <PanelField label="Stop Bits">
            <PanelInput
              type="number"
              min={1}
              max={2}
              value={simulation.stop_bits}
              onChange={(e) =>
                patchSimulation({
                  stop_bits: Math.max(
                    1,
                    Math.min(2, Number.parseInt(e.target.value || '1', 10)),
                  ),
                })
              }
            />
          </PanelField>
        )}
      </div>
    </PanelSection>
  );
});
