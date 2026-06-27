import { useMemo } from 'react';
import { AlertTriangle, Cable, ExternalLink, Play, Square } from 'lucide-react';
import { useProject } from '../../hooks/useProject';
import { useModbusStore } from '../../stores/modbusStore';
import { useEditorAreaStore } from '../../stores/editorAreaStore';
import {
  PanelButton,
  PanelField,
  PanelInput,
  PanelSection,
  PanelShell,
  StatusBadge,
} from '../protocol/ProtocolPanelPrimitives';
import type { ProjectConfigPatch } from '../../types/project';
import type { RtuConfig, TcpServerConfig } from '../../types/modbus';
import { TrafficLogPanel } from './modbus/TrafficLogPanel';
import { ClientStatsPanel } from './modbus/ClientStatsPanel';
import { GeneratorPanel } from './modbus/GeneratorPanel';

function parseTcpAddress(address: string, fallbackHost: string | null): TcpServerConfig {
  const trimmed = address.trim();
  const fallback = fallbackHost?.trim() || '127.0.0.1';
  const match = trimmed.match(/^(.*):(\d+)$/);

  if (match) {
    const [, host, portString] = match;
    const port = Number.parseInt(portString, 10);
    return {
      bind_address: host.trim() || fallback,
      port: Number.isFinite(port) ? port : 502,
    };
  }

  const maybePort = Number.parseInt(trimmed, 10);
  if (Number.isFinite(maybePort)) {
    return { bind_address: fallback, port: maybePort };
  }

  return {
    bind_address: trimmed || fallback,
    port: 502,
  };
}

function stringifyTcpAddress(bindAddress: string, port: number): string {
  const host = bindAddress.trim() || '127.0.0.1';
  return `${host}:${port}`;
}

function toRtuConfig(simulation: {
  com_port: string;
  baud_rate: number;
  parity: 'None' | 'Even' | 'Odd';
  stop_bits: number;
  unit_id: number;
}): RtuConfig {
  return {
    com_port: simulation.com_port.trim() || 'COM1',
    baud_rate: simulation.baud_rate,
    parity: simulation.parity,
    stop_bits: simulation.stop_bits === 2 ? 'Two' : 'One',
    data_bits: 'Eight',
    unit_id: simulation.unit_id,
  };
}

export function ModbusPanel() {
  const { currentProject, updateConfig } = useProject();
  const {
    status,
    error,
    isConnecting,
    coilCache,
    discreteCache,
    holdingRegisterCache,
    inputRegisterCache,
    startTcp,
    stopTcp,
    startRtu,
    stopRtu,
  } = useModbusStore();

  const openProjectSettingsTab = useEditorAreaStore((state) => state.openProjectSettingsTab);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-[var(--color-text-muted)]">
        Open a project to configure Modbus runtime settings.
      </div>
    );
  }

  const simulation = currentProject.config.modbus.simulation;
  const memoryMap = currentProject.config.memory_map;
  const tcpDefaults = parseTcpAddress(
    simulation.address,
    currentProject.config.network?.plc_ip ?? null
  );

  const memorySections = useMemo(
    () => [
      {
        name: 'Coils',
        used: coilCache.size,
        total: memoryMap.coil_count,
      },
      {
        name: 'Discrete Inputs',
        used: discreteCache.size,
        total: memoryMap.discrete_input_count,
      },
      {
        name: 'Holding Registers',
        used: holdingRegisterCache.size,
        total: memoryMap.holding_register_count,
      },
      {
        name: 'Input Registers',
        used: inputRegisterCache.size,
        total: memoryMap.input_register_count,
      },
    ],
    [
      coilCache,
      discreteCache,
      holdingRegisterCache,
      inputRegisterCache,
      memoryMap.coil_count,
      memoryMap.discrete_input_count,
      memoryMap.holding_register_count,
      memoryMap.input_register_count,
    ]
  );

  const applyPatch = (patch: ProjectConfigPatch) => {
    void updateConfig(patch);
  };

  const patchSimulation = (patch: Partial<typeof simulation>) => {
    applyPatch({
      modbus: {
        simulation: {
          ...simulation,
          ...patch,
        },
      },
    });
  };

  const handleTcpPortChange = (rawValue: string) => {
    const nextPort = Math.max(1, Math.min(65535, Number.parseInt(rawValue || '502', 10)));
    patchSimulation({
      address: stringifyTcpAddress(tcpDefaults.bind_address ?? '127.0.0.1', nextPort),
    });
  };

  const handleTcpHostChange = (nextHost: string) => {
    patchSimulation({
      address: stringifyTcpAddress(nextHost, tcpDefaults.port ?? 502),
    });
  };

  const handleStartTcp = async () => {
    const config: TcpServerConfig = {
      bind_address: tcpDefaults.bind_address,
      port: tcpDefaults.port,
      unit_id: simulation.unit_id,
    };
    await startTcp(config);
  };

  const handleStartRtu = async () => {
    await startRtu(toRtuConfig(simulation));
  };

  return (
    <div className="h-full overflow-y-auto">
      <PanelShell>
        <PanelSection
          title="Runtime"
          description="Runtime status is sourced from the shared Modbus store, not a mock sidebar toggle."
          actions={
            <StatusBadge
              tone={
                status?.tcp_running || status?.rtu_running
                  ? 'success'
                  : simulation.enabled
                    ? 'warning'
                    : 'muted'
              }
            >
              {status?.tcp_running || status?.rtu_running
                ? 'Live'
                : simulation.enabled
                  ? 'Ready'
                  : 'Disabled'}
            </StatusBadge>
          }
        >
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Cable size={14} className="text-[var(--color-accent)]" />
              {status?.tcp_running || status?.rtu_running ? 'Server active' : 'Server stopped'}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              TCP {status?.tcp_connections ?? 0} clients
            </div>
          </div>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/8 px-3 py-2 text-sm text-[var(--color-error)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="flex gap-2">
            <PanelButton tone="neutral" className="flex-1" onClick={openProjectSettingsTab}>
              <ExternalLink size={14} />
              Project Settings
            </PanelButton>
          </div>
        </PanelSection>

        <PanelSection
          title="TCP Server"
          description="TCP controls read their defaults from `.mop` simulation settings."
          actions={
            <StatusBadge tone={status?.tcp_running ? 'success' : 'muted'}>
              {status?.tcp_running ? 'Running' : 'Stopped'}
            </StatusBadge>
          }
        >
          <div
            data-testid="tcp-status"
            className={`rounded-xl border px-3 py-2 text-sm ${
              status?.tcp_running
                ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
            }`}
          >
            {status?.tcp_running
              ? `Listening on ${status.tcp_port ?? tcpDefaults.port ?? 502}`
              : `Stopped, configured for ${tcpDefaults.bind_address ?? '127.0.0.1'}:${
                  tcpDefaults.port ?? 502
                }`}
          </div>
          <div className="grid gap-3">
            <PanelField label="Bind Address">
              <PanelInput
                value={tcpDefaults.bind_address ?? '127.0.0.1'}
                onChange={(e) => handleTcpHostChange(e.target.value)}
              />
            </PanelField>
            <PanelField label="Port">
              <PanelInput
                data-testid="tcp-port-input"
                type="number"
                min={1}
                max={65535}
                value={tcpDefaults.port ?? 502}
                onChange={(e) => handleTcpPortChange(e.target.value)}
              />
            </PanelField>
          </div>
          <div className="flex gap-2">
            <PanelButton
              data-testid="modbus-start-tcp"
              tone="primary"
              className="flex-1"
              disabled={Boolean(status?.tcp_running) || isConnecting}
              onClick={() => {
                void handleStartTcp();
              }}
            >
              <Play size={14} />
              {isConnecting && !status?.tcp_running ? 'Starting...' : 'Start TCP'}
            </PanelButton>
            <PanelButton
              data-testid="modbus-stop-tcp"
              tone="danger"
              className="flex-1"
              disabled={!status?.tcp_running || isConnecting}
              onClick={() => {
                void stopTcp();
              }}
            >
              <Square size={14} />
              {isConnecting && status?.tcp_running ? 'Stopping...' : 'Stop TCP'}
            </PanelButton>
          </div>
        </PanelSection>

        <PanelSection
          title="RTU Server"
          description="Serial runtime uses the same manifest-backed defaults exposed in project settings."
          actions={
            <StatusBadge tone={status?.rtu_running ? 'success' : 'muted'}>
              {status?.rtu_running ? 'Running' : 'Stopped'}
            </StatusBadge>
          }
        >
          <div
            data-testid="rtu-status"
            className={`rounded-xl border px-3 py-2 text-sm ${
              status?.rtu_running
                ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
            }`}
          >
            {status?.rtu_running
              ? `Attached to ${(status.rtu_port ?? simulation.com_port) || 'serial port'}`
              : `Stopped, configured for ${simulation.com_port || 'COM1'} @ ${simulation.baud_rate}`}
          </div>
          <div className="grid gap-3">
            <PanelField label="COM Port">
              <PanelInput
                value={simulation.com_port}
                placeholder="COM3"
                onChange={(e) => patchSimulation({ com_port: e.target.value })}
              />
            </PanelField>
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
          </div>
          <div className="flex gap-2">
            <PanelButton
              data-testid="modbus-start-rtu"
              tone="primary"
              className="flex-1"
              disabled={Boolean(status?.rtu_running) || isConnecting}
              onClick={() => {
                void handleStartRtu();
              }}
            >
              <Play size={14} />
              {isConnecting && !status?.rtu_running ? 'Starting...' : 'Start RTU'}
            </PanelButton>
            <PanelButton
              data-testid="modbus-stop-rtu"
              tone="danger"
              className="flex-1"
              disabled={!status?.rtu_running || isConnecting}
              onClick={() => {
                void stopRtu();
              }}
            >
              <Square size={14} />
              {isConnecting && status?.rtu_running ? 'Stopping...' : 'Stop RTU'}
            </PanelButton>
          </div>
        </PanelSection>

        <PanelSection
          title="Address Space"
          description="Used counters reflect the live caches hydrated by runtime change events."
        >
          <div className="space-y-2">
            {memorySections.map((section) => (
              <div
                key={section.name}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--color-text-secondary)]">{section.name}</span>
                <span className="text-[var(--color-text-muted)]">
                  {section.used} / {section.total}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Active Clients
            </div>
            <ClientStatsPanel />
          </div>
        </PanelSection>

        <PanelSection
          title="Traffic"
          description="Live request/response log from connected Modbus clients."
        >
          <TrafficLogPanel />
        </PanelSection>

        <PanelSection
          title="Value Generators"
          description="Drive registers/coils with waveforms to exercise HMI trends and alarms."
        >
          <GeneratorPanel />
        </PanelSection>
      </PanelShell>
    </div>
  );
}
