import { memo, useCallback } from 'react';
import { useProject } from '../../../hooks/useProject';
import { useOpcUaStore } from '../../../stores/opcuaStore';
import {
  PanelButton,
  PanelField,
  PanelInput,
  PanelSection,
  PanelSelect,
  PanelShell,
  StatusBadge,
} from '../../protocol/ProtocolPanelPrimitives';
import { CanvasProperties } from './properties/CanvasProperties';
import {
  DEFAULT_PROJECT_CONFIG,
  ModbusExposureAddressSpace,
  ModbusExposureRule,
  ModbusSimulationTransport,
  OpcUaSecurityPolicy,
  PlcManufacturer,
  ProjectConfigPatch,
} from '../../../types/project';

const OPCUA_POLICIES: OpcUaSecurityPolicy[] = [
  'None',
  'Basic128Rsa15',
  'Basic256',
  'Basic256Sha256',
  'Aes128Sha256RsaOaep',
  'Aes256Sha256RsPss',
];

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

export const ProjectSettingsPanel = memo(function ProjectSettingsPanel() {
  const { currentProject, currentProjectPath, updateConfig } = useProject();
  const opcuaRunning = useOpcUaStore((s) => s.status?.running ?? false);

  const applyPatch = useCallback((patch: ProjectConfigPatch) => {
    void updateConfig(patch);
  }, [updateConfig]);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        No project open
      </div>
    );
  }

  const { config } = currentProject;
  const network: NonNullable<typeof config.network> =
    config.network ?? DEFAULT_PROJECT_CONFIG.network!;
  const opcua: NonNullable<typeof config.opcua> =
    config.opcua ?? DEFAULT_PROJECT_CONFIG.opcua!;
  const simulation = config.modbus.simulation;
  const isSerialTransport =
    simulation.transport === 'Rtu' || simulation.transport === 'RtuAscii';
  const exposureRules = config.modbus.exposure.rules;
  const enabledPolicies = opcua.security_policies ?? ['Basic256Sha256'];

  const patchProject = (patch: Partial<typeof config.project>) =>
    applyPatch({ project: { ...config.project, ...patch } });

  const patchPlc = (patch: Partial<typeof config.plc>) =>
    applyPatch({ plc: { ...config.plc, ...patch } });

  const patchSimulation = (
    patch: Partial<typeof config.modbus.simulation>,
    rootPatch?: Partial<typeof config.modbus>
  ) =>
    applyPatch({
      modbus: {
        ...config.modbus,
        ...rootPatch,
        simulation: { ...config.modbus.simulation, ...patch },
      },
    });

  const patchExposure = (patch: Partial<typeof config.modbus.exposure>) =>
    applyPatch({
      modbus: {
        ...config.modbus,
        exposure: { ...config.modbus.exposure, ...patch },
      },
    });

  const patchNetwork = (patch: Partial<typeof network>) =>
    applyPatch({ network: { ...network, ...patch } });

  const patchOpcUa = (patch: Partial<typeof opcua>) =>
    applyPatch({
      opcua: {
        ...opcua,
        ...patch,
      },
    });

  const updateExposureRule = (index: number, patch: Partial<ModbusExposureRule>) => {
    const nextRules = exposureRules.map((rule, ruleIndex) =>
      ruleIndex === index ? { ...rule, ...patch } : rule
    );
    patchExposure({ rules: nextRules });
  };

  const addExposureRule = () => {
    patchExposure({ rules: [...exposureRules, EMPTY_RULE] });
  };

  const removeExposureRule = (index: number) => {
    patchExposure({ rules: exposureRules.filter((_, ruleIndex) => ruleIndex !== index) });
  };

  const togglePolicy = (policy: OpcUaSecurityPolicy) => {
    const nextPolicies = enabledPolicies.includes(policy)
      ? enabledPolicies.filter((item) => item !== policy)
      : [...enabledPolicies, policy];

    if (nextPolicies.length === 0) {
      return;
    }

    patchOpcUa({ security_policies: nextPolicies });
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <PanelShell>
          <PanelSection
            title="Manifest"
            description="`.mop` manifest is the source of truth for project identity and protocol configuration."
            actions={
              <StatusBadge tone={currentProject.is_modified ? 'warning' : 'success'}>
                {currentProject.is_modified ? 'Unsaved' : 'Synced'}
              </StatusBadge>
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <PanelField label="Project Name">
                <PanelInput
                  value={config.project.name}
                  onChange={(e) => patchProject({ name: e.target.value })}
                />
              </PanelField>
              <PanelField label="Description">
                <PanelInput
                  value={config.project.description}
                  onChange={(e) => patchProject({ description: e.target.value })}
                />
              </PanelField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <PanelField label="Manufacturer">
                <PanelSelect
                  value={config.plc.manufacturer}
                  onChange={(e) =>
                    patchPlc({ manufacturer: e.target.value as PlcManufacturer })
                  }
                >
                  <option value="LS">LS Electric</option>
                  <option value="Mitsubishi">Mitsubishi</option>
                  <option value="Siemens">Siemens</option>
                </PanelSelect>
              </PanelField>
              <PanelField label="Model">
                <PanelInput
                  value={config.plc.model}
                  onChange={(e) => patchPlc({ model: e.target.value })}
                />
              </PanelField>
              <PanelField label="Scan Time (ms)">
                <PanelInput
                  type="number"
                  min={1}
                  value={config.plc.scan_time_ms}
                  onChange={(e) =>
                    patchPlc({ scan_time_ms: Math.max(1, Number.parseInt(e.target.value || '1', 10)) })
                  }
                />
              </PanelField>
            </div>
          </PanelSection>

          <PanelSection
            title="Network"
            description="Bind simulated PLC services to a concrete IP/interface when commissioning against external clients."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <PanelField label="PLC IP" hint="Leave empty to bind locally.">
                <PanelInput
                  placeholder="127.0.0.1"
                  value={network.plc_ip ?? ''}
                  onChange={(e) =>
                    patchNetwork({ plc_ip: e.target.value.trim() ? e.target.value : null })
                  }
                />
              </PanelField>
              <PanelField label="Interface Name">
                <PanelInput
                  placeholder="Loopback"
                  value={network.interface_name ?? ''}
                  onChange={(e) =>
                    patchNetwork({
                      interface_name: e.target.value.trim() ? e.target.value : null,
                    })
                  }
                />
              </PanelField>
              <PanelField label="Subnet Mask">
                <PanelInput
                  placeholder="255.255.255.0"
                  value={network.subnet_mask ?? ''}
                  onChange={(e) =>
                    patchNetwork({
                      subnet_mask: e.target.value.trim() ? e.target.value : null,
                    })
                  }
                />
              </PanelField>
            </div>
          </PanelSection>

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
                        : { address: e.target.value }
                    )
                  }
                />
              </PanelField>
            </div>
            <div className={`grid gap-3 ${isSerialTransport ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
              <PanelField label="Unit ID">
                <PanelInput
                  type="number"
                  min={0}
                  max={247}
                  value={simulation.unit_id}
                  onChange={(e) =>
                    patchSimulation({
                      unit_id: Math.max(0, Math.min(247, Number.parseInt(e.target.value || '0', 10))),
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
                        Math.min(65535, Number.parseInt(e.target.value || '0', 10))
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
                        Math.min(65535, Number.parseInt(e.target.value || '0', 10))
                      ),
                    })
                  }
                />
              </PanelField>
              {isSerialTransport ? (
                <>
                  <PanelField label="Baud Rate">
                    <PanelInput
                      type="number"
                      min={300}
                      value={simulation.baud_rate}
                      onChange={(e) =>
                        patchSimulation({
                          baud_rate: Math.max(300, Number.parseInt(e.target.value || '300', 10)),
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
              ) : null}
              {isSerialTransport ? (
                <PanelField label="Stop Bits">
                  <PanelInput
                    type="number"
                    min={1}
                    max={2}
                    value={simulation.stop_bits}
                    onChange={(e) =>
                      patchSimulation({
                        stop_bits: Math.max(1, Math.min(2, Number.parseInt(e.target.value || '1', 10))),
                      })
                    }
                  />
                </PanelField>
              ) : null}
            </div>
          </PanelSection>

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
                          onChange={(e) => updateExposureRule(index, { family: e.target.value })}
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
                              offset: Math.max(0, Number.parseInt(e.target.value || '0', 10)),
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
                              count: Math.max(1, Number.parseInt(e.target.value || '1', 10)),
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

          <PanelSection
            title="OPC UA"
            description="Project-level OPC UA server definition. Runtime panel uses these settings and restart is explicit."
            actions={
              <StatusBadge tone={opcuaRunning ? 'warning' : opcua.enabled ? 'success' : 'muted'}>
                {opcuaRunning ? 'Restart Required' : opcua.enabled ? 'Configured' : 'Disabled'}
              </StatusBadge>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={opcua.enabled}
                  onChange={(e) => patchOpcUa({ enabled: e.target.checked })}
                />
                Enable OPC UA server during simulation
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={opcua.allow_anonymous ?? false}
                  onChange={(e) => patchOpcUa({ allow_anonymous: e.target.checked })}
                />
                Allow anonymous sessions
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PanelField label="Port">
                <PanelInput
                  type="number"
                  min={1}
                  max={65535}
                  value={opcua.port}
                  onChange={(e) =>
                    patchOpcUa({
                      port: Math.max(1, Math.min(65535, Number.parseInt(e.target.value || '4840', 10))),
                    })
                  }
                />
              </PanelField>
              <PanelField label="Server Name">
                <PanelInput
                  value={opcua.server_name}
                  onChange={(e) => patchOpcUa({ server_name: e.target.value })}
                />
              </PanelField>
              <PanelField label="Username">
                <PanelInput
                  value={opcua.username ?? ''}
                  onChange={(e) => patchOpcUa({ username: e.target.value })}
                />
              </PanelField>
              <PanelField label="Password">
                <PanelInput
                  type="password"
                  value={opcua.password ?? ''}
                  onChange={(e) => patchOpcUa({ password: e.target.value })}
                />
              </PanelField>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Security Policies
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {OPCUA_POLICIES.map((policy) => (
                  <label
                    key={policy}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <input
                      type="checkbox"
                      checked={enabledPolicies.includes(policy)}
                      disabled={enabledPolicies.length === 1 && enabledPolicies.includes(policy)}
                      onChange={() => togglePolicy(policy)}
                    />
                    {policy}
                  </label>
                ))}
              </div>
            </div>
          </PanelSection>

          <PanelSection
            title="Canvas"
            description="Canvas/grid preferences persist in the same project manifest."
          >
            <CanvasProperties documentId={null} />
          </PanelSection>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
            <span>{currentProjectPath || 'Unsaved project'}</span>
            <span>Updated {new Date(config.project.updated_at).toLocaleString()}</span>
          </div>
        </PanelShell>
      </div>
    </div>
  );
});

export default ProjectSettingsPanel;
