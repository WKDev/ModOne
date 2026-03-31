import { memo, useCallback, useState, useMemo } from 'react';
import {
  FolderCog, Cpu, Network, Database, Save, Grid3X3,
  Globe, Shield, FileText, Eye, Link2, Search,
} from 'lucide-react';
import { useProject } from '../../../hooks/useProject';
import { useOpcUaStore } from '../../../stores/opcuaStore';
import {
  PanelButton,
  PanelField,
  PanelInput,
  PanelSection,
  PanelSelect,
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

// ─── Category definitions ────────────────────────────────────────────────────

type CategoryId =
  | 'project'
  | 'plc'
  | 'network'
  | 'modbus-sim'
  | 'modbus-exposure'
  | 'memory-map'
  | 'auto-save'
  | 'canvas'
  | 'opcua'
  | 'sheet'
  | 'tag-watch';

const categories: { id: CategoryId; label: string; icon: React.ReactNode }[] = [
  { id: 'project', label: 'Project', icon: <FolderCog size={18} /> },
  { id: 'plc', label: 'PLC', icon: <Cpu size={18} /> },
  { id: 'network', label: 'Network', icon: <Globe size={18} /> },
  { id: 'modbus-sim', label: 'Modbus Simulation', icon: <Network size={18} /> },
  { id: 'modbus-exposure', label: 'Modbus Exposure', icon: <Link2 size={18} /> },
  { id: 'memory-map', label: 'Memory Map', icon: <Database size={18} /> },
  { id: 'auto-save', label: 'Auto Save', icon: <Save size={18} /> },
  { id: 'canvas', label: 'Canvas', icon: <Grid3X3 size={18} /> },
  { id: 'opcua', label: 'OPC UA', icon: <Shield size={18} /> },
  { id: 'sheet', label: 'Sheet', icon: <FileText size={18} /> },
  { id: 'tag-watch', label: 'Tag Watch', icon: <Eye size={18} /> },
];

// ─── Constants ───────────────────────────────────────────────────────────────

const OPCUA_POLICIES: OpcUaSecurityPolicy[] = [
  'None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256',
  'Aes128Sha256RsaOaep', 'Aes256Sha256RsPss',
];

const ADDRESS_SPACE_OPTIONS: ModbusExposureAddressSpace[] = [
  'Coil', 'DiscreteInput', 'HoldingRegister', 'InputRegister',
];

const EMPTY_RULE: ModbusExposureRule = {
  family: 'D', address_space: 'HoldingRegister', offset: 0, count: 1,
};

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationErrors {
  [key: string]: string;
}

function validateConfig(config: ReturnType<typeof getConfigRef>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!config.project.name.trim()) errors['project.name'] = 'Project name is required';
  if (config.plc.scan_time_ms < 1) errors['plc.scan_time_ms'] = 'Must be >= 1';
  if (config.modbus.simulation.unit_id < 0 || config.modbus.simulation.unit_id > 247)
    errors['modbus.simulation.unit_id'] = 'Must be 0-247';
  const opcua = config.opcua ?? DEFAULT_PROJECT_CONFIG.opcua!;
  if (opcua.port < 1 || opcua.port > 65535) errors['opcua.port'] = 'Must be 1-65535';
  if (!opcua.server_name.trim()) errors['opcua.server_name'] = 'Server name is required';
  return errors;
}

function getConfigRef(config: NonNullable<ReturnType<typeof useProject>['currentProject']>['config']) {
  return config;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const ProjectSettingsPanel = memo(function ProjectSettingsPanel() {
  const { currentProject, currentProjectPath, updateConfig } = useProject();
  const opcuaRunning = useOpcUaStore((s) => s.status?.running ?? false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('project');
  const [searchFilter, setSearchFilter] = useState('');

  const applyPatch = useCallback((patch: ProjectConfigPatch) => {
    void updateConfig(patch);
  }, [updateConfig]);

  const config = currentProject?.config;

  const errors = useMemo(() => {
    if (!config) return {};
    return validateConfig(config);
  }, [config]);

  const hasErrors = Object.keys(errors).length > 0;

  if (!currentProject || !config) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        No project open
      </div>
    );
  }

  const network = config.network ?? DEFAULT_PROJECT_CONFIG.network!;
  const opcua = config.opcua ?? DEFAULT_PROJECT_CONFIG.opcua!;
  const autoSave = config.auto_save ?? { enabled: true, interval_secs: 300, backup_count: 3 };
  const simulation = config.modbus.simulation;
  const isSerialTransport = simulation.transport === 'Rtu' || simulation.transport === 'RtuAscii';
  const exposureRules = config.modbus.exposure.rules;
  const enabledPolicies = opcua.security_policies ?? ['Basic256Sha256'];

  // ─── Patch helpers ───────────────────────────────────────────────────────

  const patchProject = (patch: Partial<typeof config.project>) =>
    applyPatch({ project: { ...config.project, ...patch } });

  const patchPlc = (patch: Partial<typeof config.plc>) =>
    applyPatch({ plc: { ...config.plc, ...patch } });

  const patchNetwork = (patch: Partial<typeof network>) =>
    applyPatch({ network: { ...network, ...patch } });

  const patchSimulation = (patch: Partial<typeof config.modbus.simulation>) =>
    applyPatch({
      modbus: { ...config.modbus, simulation: { ...config.modbus.simulation, ...patch } },
    });

  const patchExposure = (patch: Partial<typeof config.modbus.exposure>) =>
    applyPatch({
      modbus: { ...config.modbus, exposure: { ...config.modbus.exposure, ...patch } },
    });

  const patchMemoryMap = (patch: Partial<typeof config.memory_map>) =>
    applyPatch({ memory_map: { ...config.memory_map, ...patch } });

  const patchAutoSave = (patch: Partial<typeof autoSave>) =>
    applyPatch({ auto_save: { ...autoSave, ...patch } });

  const patchOpcUa = (patch: Partial<typeof opcua>) =>
    applyPatch({ opcua: { ...opcua, ...patch } });

  const updateExposureRule = (index: number, patch: Partial<ModbusExposureRule>) => {
    const nextRules = exposureRules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    patchExposure({ rules: nextRules });
  };

  const addExposureRule = () => patchExposure({ rules: [...exposureRules, EMPTY_RULE] });
  const removeExposureRule = (index: number) =>
    patchExposure({ rules: exposureRules.filter((_, i) => i !== index) });

  const togglePolicy = (policy: OpcUaSecurityPolicy) => {
    const next = enabledPolicies.includes(policy)
      ? enabledPolicies.filter((p) => p !== policy)
      : [...enabledPolicies, policy];
    if (next.length > 0) patchOpcUa({ security_policies: next });
  };

  // ─── Error display helper ────────────────────────────────────────────────

  const fieldError = (key: string) =>
    errors[key] ? (
      <span className="text-xs text-[var(--color-error)]">{errors[key]}</span>
    ) : null;

  // ─── Category content renderers ──────────────────────────────────────────

  const renderContent = () => {
    switch (activeCategory) {
      case 'project':
        return (
          <PanelSection
            title="Project"
            description="Project identity and metadata stored in the .mop manifest."
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
                {fieldError('project.name')}
              </PanelField>
              <PanelField label="Description">
                <PanelInput
                  value={config.project.description}
                  onChange={(e) => patchProject({ description: e.target.value })}
                />
              </PanelField>
            </div>
            <div className="mt-3 text-xs text-[var(--color-text-muted)]">
              <span>Created: {new Date(config.project.created_at).toLocaleString()}</span>
              <span className="mx-2">|</span>
              <span>Updated: {new Date(config.project.updated_at).toLocaleString()}</span>
            </div>
          </PanelSection>
        );

      case 'plc':
        return (
          <PanelSection title="PLC" description="PLC hardware configuration.">
            <div className="grid gap-3 md:grid-cols-3">
              <PanelField label="Manufacturer">
                <PanelSelect
                  value={config.plc.manufacturer}
                  onChange={(e) => patchPlc({ manufacturer: e.target.value as PlcManufacturer })}
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
                    patchPlc({ scan_time_ms: Math.max(1, parseInt(e.target.value || '1', 10)) })
                  }
                />
                {fieldError('plc.scan_time_ms')}
              </PanelField>
            </div>
          </PanelSection>
        );

      case 'network':
        return (
          <PanelSection
            title="Network"
            description="Bind simulated PLC services to a concrete IP/interface when commissioning against external clients."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <PanelField label="PLC IP" hint="Leave empty to bind locally.">
                <PanelInput
                  placeholder="127.0.0.1"
                  value={network.plc_ip ?? ''}
                  onChange={(e) => patchNetwork({ plc_ip: e.target.value.trim() || null })}
                />
              </PanelField>
              <PanelField label="Interface Name">
                <PanelInput
                  placeholder="Loopback"
                  value={network.interface_name ?? ''}
                  onChange={(e) => patchNetwork({ interface_name: e.target.value.trim() || null })}
                />
              </PanelField>
              <PanelField label="Subnet Mask">
                <PanelInput
                  placeholder="255.255.255.0"
                  value={network.subnet_mask ?? ''}
                  onChange={(e) => patchNetwork({ subnet_mask: e.target.value.trim() || null })}
                />
              </PanelField>
            </div>
          </PanelSection>
        );

      case 'modbus-sim':
        return (
          <PanelSection
            title="Modbus Simulation"
            description="Project-owned Modbus runtime settings stored in .mop."
          >
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={simulation.enabled ? 'success' : 'muted'}>
                {simulation.enabled ? 'Enabled' : 'Disabled'}
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
                  onChange={(e) => patchSimulation({ transport: e.target.value as ModbusSimulationTransport })}
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
                      isSerialTransport ? { com_port: e.target.value } : { address: e.target.value }
                    )
                  }
                />
              </PanelField>
            </div>
            <div className={`grid gap-3 ${isSerialTransport ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
              <PanelField label="Unit ID">
                <PanelInput
                  type="number" min={0} max={247}
                  value={simulation.unit_id}
                  onChange={(e) => patchSimulation({ unit_id: Math.max(0, Math.min(247, parseInt(e.target.value || '0', 10))) })}
                />
                {fieldError('modbus.simulation.unit_id')}
              </PanelField>
              <PanelField label="Coil Start">
                <PanelInput
                  type="number" min={0} max={65535}
                  value={simulation.coil_start_address}
                  onChange={(e) => patchSimulation({ coil_start_address: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })}
                />
              </PanelField>
              <PanelField label="Word Start">
                <PanelInput
                  type="number" min={0} max={65535}
                  value={simulation.word_start_address}
                  onChange={(e) => patchSimulation({ word_start_address: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })}
                />
              </PanelField>
              {isSerialTransport && (
                <>
                  <PanelField label="Baud Rate">
                    <PanelInput
                      type="number" min={300}
                      value={simulation.baud_rate}
                      onChange={(e) => patchSimulation({ baud_rate: Math.max(300, parseInt(e.target.value || '300', 10)) })}
                    />
                  </PanelField>
                  <PanelField label="Parity">
                    <PanelSelect
                      value={simulation.parity}
                      onChange={(e) => patchSimulation({ parity: e.target.value as typeof simulation.parity })}
                    >
                      <option value="None">None</option>
                      <option value="Even">Even</option>
                      <option value="Odd">Odd</option>
                    </PanelSelect>
                  </PanelField>
                </>
              )}
            </div>
            {isSerialTransport && (
              <div className="grid gap-3 md:grid-cols-3">
                <PanelField label="Stop Bits">
                  <PanelInput
                    type="number" min={1} max={2}
                    value={simulation.stop_bits}
                    onChange={(e) => patchSimulation({ stop_bits: Math.max(1, Math.min(2, parseInt(e.target.value || '1', 10))) })}
                  />
                </PanelField>
              </div>
            )}
          </PanelSection>
        );

      case 'modbus-exposure':
        return (
          <PanelSection
            title="Modbus Exposure"
            description="Choose how vendor-visible device families are projected into Modbus spaces."
            actions={
              <PanelButton tone="neutral" onClick={addExposureRule}>Add Rule</PanelButton>
            }
          >
            <PanelField label="Exposure Mode">
              <PanelSelect
                value={config.modbus.exposure.mode}
                onChange={(e) => patchExposure({ mode: e.target.value as typeof config.modbus.exposure.mode })}
              >
                <option value="Recommended">Recommended</option>
                <option value="LegacyWide">Legacy Wide</option>
                <option value="Custom">Custom</option>
              </PanelSelect>
            </PanelField>
            {config.modbus.exposure.mode === 'Custom' && (
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
                        <PanelInput value={rule.family} onChange={(e) => updateExposureRule(index, { family: e.target.value })} />
                      </PanelField>
                      <PanelField label="Address Space">
                        <PanelSelect value={rule.address_space} onChange={(e) => updateExposureRule(index, { address_space: e.target.value as ModbusExposureAddressSpace })}>
                          {ADDRESS_SPACE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </PanelSelect>
                      </PanelField>
                      <PanelField label="Offset">
                        <PanelInput type="number" min={0} value={rule.offset} onChange={(e) => updateExposureRule(index, { offset: Math.max(0, parseInt(e.target.value || '0', 10)) })} />
                      </PanelField>
                      <PanelField label="Count">
                        <PanelInput type="number" min={1} value={rule.count} onChange={(e) => updateExposureRule(index, { count: Math.max(1, parseInt(e.target.value || '1', 10)) })} />
                      </PanelField>
                      <div className="flex items-end">
                        <PanelButton tone="danger" className="w-full" onClick={() => removeExposureRule(index)}>Remove</PanelButton>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </PanelSection>
        );

      case 'memory-map':
        return (
          <PanelSection title="Memory Map" description="Modbus register address ranges for the simulated PLC memory.">
            <div className="grid gap-3 md:grid-cols-2">
              <PanelField label="Coil Start">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.coil_start}
                  onChange={(e) => patchMemoryMap({ coil_start: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Coil Count">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.coil_count}
                  onChange={(e) => patchMemoryMap({ coil_count: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Discrete Input Start">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.discrete_input_start}
                  onChange={(e) => patchMemoryMap({ discrete_input_start: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Discrete Input Count">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.discrete_input_count}
                  onChange={(e) => patchMemoryMap({ discrete_input_count: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Holding Register Start">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.holding_register_start}
                  onChange={(e) => patchMemoryMap({ holding_register_start: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Holding Register Count">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.holding_register_count}
                  onChange={(e) => patchMemoryMap({ holding_register_count: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Input Register Start">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.input_register_start}
                  onChange={(e) => patchMemoryMap({ input_register_start: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
              <PanelField label="Input Register Count">
                <PanelInput type="number" min={0} max={65535} value={config.memory_map.input_register_count}
                  onChange={(e) => patchMemoryMap({ input_register_count: Math.max(0, Math.min(65535, parseInt(e.target.value || '0', 10))) })} />
              </PanelField>
            </div>
          </PanelSection>
        );

      case 'auto-save':
        return (
          <PanelSection title="Auto Save" description="Automatic project backup settings.">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={autoSave.enabled}
                  onChange={(e) => patchAutoSave({ enabled: e.target.checked })}
                />
                Enable auto-save
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PanelField label="Interval (seconds)">
                <PanelInput
                  type="number" min={10}
                  value={autoSave.interval_secs}
                  onChange={(e) => patchAutoSave({ interval_secs: Math.max(10, parseInt(e.target.value || '300', 10)) })}
                />
              </PanelField>
              <PanelField label="Backup Count">
                <PanelInput
                  type="number" min={1} max={10}
                  value={autoSave.backup_count}
                  onChange={(e) => patchAutoSave({ backup_count: Math.max(1, Math.min(10, parseInt(e.target.value || '3', 10))) })}
                />
              </PanelField>
            </div>
          </PanelSection>
        );

      case 'canvas':
        return (
          <PanelSection title="Canvas" description="Canvas/grid preferences persist in the project manifest.">
            <CanvasProperties documentId={null} />
          </PanelSection>
        );

      case 'opcua':
        return (
          <PanelSection
            title="OPC UA"
            description="Project-level OPC UA server definition."
            actions={
              <StatusBadge tone={opcuaRunning ? 'warning' : opcua.enabled ? 'success' : 'muted'}>
                {opcuaRunning ? 'Restart Required' : opcua.enabled ? 'Configured' : 'Disabled'}
              </StatusBadge>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={opcua.enabled} onChange={(e) => patchOpcUa({ enabled: e.target.checked })} />
                Enable OPC UA server during simulation
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={opcua.allow_anonymous ?? false} onChange={(e) => patchOpcUa({ allow_anonymous: e.target.checked })} />
                Allow anonymous sessions
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <PanelField label="Port">
                <PanelInput type="number" min={1} max={65535} value={opcua.port}
                  onChange={(e) => patchOpcUa({ port: Math.max(1, Math.min(65535, parseInt(e.target.value || '4840', 10))) })} />
                {fieldError('opcua.port')}
              </PanelField>
              <PanelField label="Server Name">
                <PanelInput value={opcua.server_name} onChange={(e) => patchOpcUa({ server_name: e.target.value })} />
                {fieldError('opcua.server_name')}
              </PanelField>
              <PanelField label="Username">
                <PanelInput value={opcua.username ?? ''} onChange={(e) => patchOpcUa({ username: e.target.value })} />
              </PanelField>
              <PanelField label="Password">
                <PanelInput type="password" value={opcua.password ?? ''} onChange={(e) => patchOpcUa({ password: e.target.value })} />
              </PanelField>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Security Policies
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {OPCUA_POLICIES.map((policy) => (
                  <label key={policy}
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
        );

      case 'sheet':
        return (
          <PanelSection title="Sheet" description="Active sheet reference for the project.">
            <PanelField label="Active Sheet">
              <PanelInput
                value={config.sheet ?? ''}
                onChange={(e) => applyPatch({ sheet: e.target.value || undefined })}
                placeholder="e.g., A3-landscape.sheet.xml"
              />
            </PanelField>
          </PanelSection>
        );

      case 'tag-watch':
        return (
          <PanelSection title="Tag Watch" description="IDs of tags pinned to the watch list in the Tag Browser.">
            <div className="space-y-2">
              {(config.watched_tag_ids ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
                  No watched tags. Pin tags from the Tag Browser.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(config.watched_tag_ids ?? []).map((tagId) => (
                    <span key={tagId}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]"
                    >
                      {tagId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </PanelSection>
        );

      default:
        return null;
    }
  };

  // ─── Filter categories by search ─────────────────────────────────────────

  const filteredCategories = searchFilter.trim()
    ? categories.filter((c) => c.label.toLowerCase().includes(searchFilter.toLowerCase()))
    : categories;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Search */}
      <div className="px-4 py-2 border-b border-[var(--color-border)]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="설정 검색..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-48 border-r border-[var(--color-border)] py-2 shrink-0 overflow-y-auto">
          {filteredCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-r-2 border-[var(--accent-color)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </nav>

        {/* Settings Form */}
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-3xl">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Error display */}
      {hasErrors && (
        <div className="px-4 py-2 bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm border-t border-[var(--color-error)]/20">
          Validation errors: {Object.values(errors).join(', ')}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
        <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[50%]">
          {currentProjectPath || 'Unsaved project'}
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge tone={currentProject.is_modified ? 'warning' : 'success'}>
            {currentProject.is_modified ? 'Unsaved' : 'Synced'}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
});

export default ProjectSettingsPanel;
