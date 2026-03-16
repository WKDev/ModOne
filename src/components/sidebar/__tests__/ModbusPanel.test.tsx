import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModbusPanel } from '../ModbusPanel';
import { useModbusStore } from '../../../stores/modbusStore';
import { useLayoutStore } from '../../../stores/layoutStore';
import { DEFAULT_PROJECT_CONFIG, type ProjectData } from '../../../types/project';
import { useProject } from '../../../hooks/useProject';

vi.mock('../../../hooks/useProject', () => ({
  useProject: vi.fn(),
}));

const mockedUseProject = vi.mocked(useProject);

function makeProject(): ProjectData {
  return {
    config: {
      ...DEFAULT_PROJECT_CONFIG,
      modbus: {
        ...DEFAULT_PROJECT_CONFIG.modbus,
        simulation: {
          ...DEFAULT_PROJECT_CONFIG.modbus.simulation,
          enabled: true,
          address: '0.0.0.0:1502',
          com_port: 'COM7',
        },
      },
      opcua: {
        ...DEFAULT_PROJECT_CONFIG.opcua!,
      },
      network: {
        ...DEFAULT_PROJECT_CONFIG.network!,
      },
    },
    is_modified: false,
  };
}

describe('ModbusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useModbusStore.getState().reset();
    useLayoutStore.getState().resetLayout();

    mockedUseProject.mockReturnValue({
      currentProject: makeProject(),
      currentProjectPath: 'C:/projects/test/test.mop',
      updateConfig: vi.fn(),
    } as unknown as ReturnType<typeof useProject>);
  });

  it('renders TCP status from modbusStore instead of layoutStore', () => {
    useLayoutStore.setState({ modbusConnected: false, modbusPort: 502 });
    useModbusStore.setState({
      status: {
        tcp_running: true,
        tcp_port: 1502,
        tcp_connections: 3,
        rtu_running: false,
      },
    });

    render(<ModbusPanel />);

    expect(screen.getByTestId('tcp-status')).toHaveTextContent('Listening on 1502');
    expect(screen.getByText('TCP 3 clients')).toBeInTheDocument();
  });
});
