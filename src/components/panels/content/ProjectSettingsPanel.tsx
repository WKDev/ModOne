import { memo, useCallback } from 'react';
import { useProjectStore } from '../../../stores/projectStore';
import { CanvasProperties } from './properties/CanvasProperties';
import type {
  ModbusSimulationTransport,
  OpcUaSecurityPolicy,
  PlcManufacturer,
} from '../../../types/project';

export const ProjectSettingsPanel = memo(function ProjectSettingsPanel() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentProjectPath = useProjectStore((s) => s.currentProjectPath);
  const updateConfig = useProjectStore((s) => s.updateConfig);

  const handleMetadataChange = useCallback((field: string, value: string) => {
    updateConfig({
      project: {
        ...(currentProject?.config.project || { name: '', description: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
        [field]: value,
      },
    });
  }, [currentProject, updateConfig]);

  const handlePlcConfigChange = useCallback(
    <K extends keyof NonNullable<typeof currentProject>['config']['plc']>(
      field: K,
      value: NonNullable<typeof currentProject>['config']['plc'][K]
    ) => {
      if (!currentProject) return;
      updateConfig({
        plc: {
          ...currentProject.config.plc,
          [field]: value,
        },
      });
    },
    [currentProject, updateConfig]
  );

  const handleSimulationChange = useCallback(
    <K extends keyof NonNullable<typeof currentProject>['config']['modbus']['simulation']>(
      field: K,
      value: NonNullable<typeof currentProject>['config']['modbus']['simulation'][K]
    ) => {
      if (!currentProject) return;
      updateConfig({
        modbus: {
          ...currentProject.config.modbus,
          simulation: {
            ...currentProject.config.modbus.simulation,
            [field]: value,
          },
        },
      });
    },
    [currentProject, updateConfig]
  );

  const handleOpcUaChange = useCallback(
    <K extends keyof NonNullable<NonNullable<typeof currentProject>['config']['opcua']>>(
      field: K,
      value: NonNullable<NonNullable<typeof currentProject>['config']['opcua']>[K]
    ) => {
      if (!currentProject) return;
      const defaults = {
        enabled: false,
        port: 4840,
        server_name: 'ModOne PLC Simulator',
        security_policy: 'Basic256Sha256' as OpcUaSecurityPolicy,
        anonymous_access: false,
        username: 'modone',
        password: 'modone',
      };
      updateConfig({
        opcua: {
          ...defaults,
          ...currentProject.config.opcua,
          [field]: value,
        },
      });
    },
    [currentProject, updateConfig]
  );

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p>No project open</p>
      </div>
    );
  }

  const simulation = currentProject.config.modbus.simulation;
  const isSerialTransport =
    simulation.transport === 'Rtu' || simulation.transport === 'RtuAscii';

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl mx-auto p-6 space-y-8">

        {/* General Information */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            General Information
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Project Name</label>
              <input
                type="text"
                value={currentProject.config.project.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded outline-none focus:outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
              <input
                type="text"
                value={currentProject.config.project.description}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* PLC Configuration */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            PLC Configuration
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Manufacturer</label>
              <select
                value={currentProject.config.plc.manufacturer}
                onChange={(e) => handlePlcConfigChange('manufacturer', e.target.value as PlcManufacturer)}
                className="w-full px-3 py-1.5 text-sm rounded outline-none appearance-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="LS">LS Electric</option>
                <option value="Mitsubishi">Mitsubishi</option>
                <option value="Siemens">Siemens</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Model</label>
              <input
                type="text"
                value={currentProject.config.plc.model}
                onChange={(e) => handlePlcConfigChange('model', e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Scan Time (ms)</label>
              <input
                type="number"
                value={currentProject.config.plc.scan_time_ms}
                onChange={(e) => handlePlcConfigChange('scan_time_ms', Number.parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-1.5 text-sm rounded outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-color)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg p-4 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Use Modbus Server Simulation
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Store project-level Modbus simulation preferences for LS, MELSEC, and future profiles.
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={simulation.enabled}
                  onChange={(e) => handleSimulationChange('enabled', e.target.checked)}
                />
                Enabled
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Simulation Transport</label>
                <select
                  value={simulation.transport}
                  onChange={(e) => handleSimulationChange('transport', e.target.value as ModbusSimulationTransport)}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none appearance-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="Tcp">Modbus TCP</option>
                  <option value="Rtu">Modbus RTU</option>
                  <option value="TcpAscii">Modbus TCP over ASCII</option>
                  <option value="RtuAscii">Modbus RTU over ASCII</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {isSerialTransport ? 'COM Port Path' : 'Address'}
                </label>
                <input
                  type="text"
                  value={isSerialTransport ? simulation.com_port : simulation.address}
                  onChange={(e) =>
                    handleSimulationChange(
                      isSerialTransport ? 'com_port' : 'address',
                      e.target.value
                    )
                  }
                  placeholder={isSerialTransport ? 'COM3 or /dev/ttyUSB0' : '127.0.0.1:502'}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div className={`grid gap-3 ${isSerialTransport ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Unit ID</label>
                <input
                  type="number"
                  min={0}
                  max={247}
                  value={simulation.unit_id}
                  onChange={(e) => handleSimulationChange('unit_id', Number.parseInt(e.target.value || '0', 10))}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Coil Start Address</label>
                <input
                  type="number"
                  min={0}
                  max={65535}
                  value={simulation.coil_start_address}
                  onChange={(e) => handleSimulationChange('coil_start_address', Number.parseInt(e.target.value || '0', 10))}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Word Start Address</label>
                <input
                  type="number"
                  min={0}
                  max={65535}
                  value={simulation.word_start_address}
                  onChange={(e) => handleSimulationChange('word_start_address', Number.parseInt(e.target.value || '0', 10))}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              {isSerialTransport && (
                <>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Baud Rate</label>
                    <input
                      type="number"
                      min={300}
                      step={300}
                      value={simulation.baud_rate}
                      onChange={(e) => handleSimulationChange('baud_rate', Number.parseInt(e.target.value || '0', 10))}
                      className="w-full px-3 py-1.5 text-sm rounded outline-none"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Parity</label>
                    <select
                      value={simulation.parity}
                      onChange={(e) => handleSimulationChange('parity', e.target.value as typeof simulation.parity)}
                      className="w-full px-3 py-1.5 text-sm rounded outline-none appearance-none"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="None">None</option>
                      <option value="Even">Even</option>
                      <option value="Odd">Odd</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Stop Bits</label>
                    <input
                      type="number"
                      min={1}
                      max={2}
                      value={simulation.stop_bits}
                      onChange={(e) => handleSimulationChange('stop_bits', Number.parseInt(e.target.value || '1', 10))}
                      className="w-full px-3 py-1.5 text-sm rounded outline-none"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* OPC UA Configuration */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            OPC UA Server
          </h2>
          <div className="rounded-lg p-4 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Enable OPC UA Server
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Expose PLC memory as OPC UA variables for HMI/SCADA integration.
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={currentProject.config.opcua?.enabled ?? false}
                  onChange={(e) => handleOpcUaChange('enabled', e.target.checked)}
                />
                Enabled
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={currentProject.config.opcua?.port ?? 4840}
                  onChange={(e) => handleOpcUaChange('port', Math.max(1, Math.min(65535, parseInt(e.target.value) || 4840)))}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Server Name</label>
                <input
                  type="text"
                  value={currentProject.config.opcua?.server_name ?? 'ModOne PLC Simulator'}
                  onChange={(e) => handleOpcUaChange('server_name', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Security Policy</label>
                <select
                  value={currentProject.config.opcua?.security_policy ?? 'Basic256Sha256'}
                  onChange={(e) => handleOpcUaChange('security_policy', e.target.value as OpcUaSecurityPolicy)}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none appearance-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="Basic256Sha256">Basic256Sha256</option>
                  <option value="None">None (No Encryption)</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={currentProject.config.opcua?.anonymous_access ?? false}
                    onChange={(e) => handleOpcUaChange('anonymous_access', e.target.checked)}
                  />
                  Anonymous Access
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
                <input
                  type="text"
                  value={currentProject.config.opcua?.username ?? 'modone'}
                  onChange={(e) => handleOpcUaChange('username', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <input
                  type="password"
                  value={currentProject.config.opcua?.password ?? 'modone'}
                  onChange={(e) => handleOpcUaChange('password', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* Canvas & Grid */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Canvas & Grid
          </h2>
          <CanvasProperties documentId={null} />
        </section>

        <div style={{ borderTop: '1px solid var(--border-color)' }} />

        {/* Footer info */}
        <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{currentProjectPath || 'Unsaved project'}</span>
          <span>Updated {new Date(currentProject.config.project.updated_at).toLocaleString()}</span>
        </div>

      </div>
    </div>
  );
});

export default ProjectSettingsPanel;
