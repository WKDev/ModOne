/**
 * LadderNetworkList Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LadderNetworkList } from '../LadderNetworkList';
import { useLadderStore } from '../../../stores/ladderStore';
import type { LadderNetwork } from '../../../types/ladder';

// Helper to create mock networks
function createMockNetwork(id: string, label?: string): LadderNetwork {
  return {
    id,
    label,
    elements: new Map(),
    wires: [],
    enabled: true,
  };
}

describe('LadderNetworkList', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useLadderStore.setState({
        networks: new Map(),
        currentNetworkId: null,
        selectedElementIds: new Set(),
        clipboard: [],
        gridConfig: {
          columns: 10,
          cellWidth: 80,
          cellHeight: 60,
          showGridLines: true,
          snapToGrid: true,
        },
        mode: 'edit',
        monitoringState: null,
        history: [],
        historyIndex: -1,
        isDirty: false,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state when no networks', () => {
    render(<LadderNetworkList />);

    expect(screen.getByText('No networks')).toBeInTheDocument();
    expect(screen.getByText('0 network(s)')).toBeInTheDocument();
  });

  it('renders network list with networks', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    expect(screen.getByText('Network 1')).toBeInTheDocument();
    expect(screen.getByText('Network 2')).toBeInTheDocument();
    expect(screen.getByText('2 network(s)')).toBeInTheDocument();
  });

  it('highlights selected network', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const selectedItem = screen.getByText('Network 1').closest('[role="button"]');
    expect(selectedItem).toHaveClass('bg-blue-600');

    const unselectedItem = screen.getByText('Network 2').closest('[role="button"]');
    expect(unselectedItem).not.toHaveClass('bg-blue-600');
  });

  it('selects network on click', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const network2Item = screen.getByText('Network 2').closest('[role="button"]');
    fireEvent.click(network2Item!);

    expect(useLadderStore.getState().currentNetworkId).toBe('net-2');
  });

  it('calls onNetworkSelect callback when network selected', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const onNetworkSelect = vi.fn();

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network1]]),
        currentNetworkId: null,
      });
    });

    render(<LadderNetworkList onNetworkSelect={onNetworkSelect} />);

    const networkItem = screen.getByText('Network 1').closest('[role="button"]');
    fireEvent.click(networkItem!);

    expect(onNetworkSelect).toHaveBeenCalledWith('net-1');
  });

  it('adds new network when Add button clicked', () => {
    act(() => {
      useLadderStore.setState({
        networks: new Map(),
        currentNetworkId: null,
      });
    });

    render(<LadderNetworkList />);

    fireEvent.click(screen.getByText('Add Network'));

    expect(useLadderStore.getState().networks.size).toBe(1);
  });

  it('shows element count badge', () => {
    const network = createMockNetwork('net-1', 'Network 1');
    network.elements.set('el-1', {
      id: 'el-1',
      type: 'contact_no',
      position: { row: 0, col: 0 },
      address: 'M0000',
      properties: {},
    });
    network.elements.set('el-2', {
      id: 'el-2',
      type: 'coil',
      position: { row: 0, col: 9 },
      address: 'M0001',
      properties: {},
    });

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides delete button when only one network', () => {
    const network = createMockNetwork('net-1', 'Network 1');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    // Delete button should not be visible (no X icon with title "Delete network")
    expect(screen.queryByTitle('Delete network')).not.toBeInTheDocument();
  });

  it('shows delete button when multiple networks', () => {
    const network1 = createMockNetwork('net-1', 'Network 1');
    const network2 = createMockNetwork('net-2', 'Network 2');

    act(() => {
      useLadderStore.setState({
        networks: new Map([
          ['net-1', network1],
          ['net-2', network2],
        ]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    // Both delete buttons should exist
    expect(screen.getAllByTitle('Delete network')).toHaveLength(2);
  });

  it('edits label on double-click', async () => {
    const network = createMockNetwork('net-1', 'Network 1');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const label = screen.getByText('Network 1');
    fireEvent.doubleClick(label);

    // Input should appear
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Network 1');

    // Change value and blur
    await userEvent.clear(input);
    await userEvent.type(input, 'New Label');
    fireEvent.blur(input);

    // Label should be updated in store
    const updatedNetwork = useLadderStore.getState().networks.get('net-1');
    expect(updatedNetwork?.label).toBe('New Label');
  });

  it('cancels edit on Escape', async () => {
    const network = createMockNetwork('net-1', 'Original Label');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const label = screen.getByText('Original Label');
    fireEvent.doubleClick(label);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Changed');
    await userEvent.keyboard('{Escape}');

    // Label should not be changed
    expect(screen.getByText('Original Label')).toBeInTheDocument();
  });

  it('saves edit on Enter', async () => {
    const network = createMockNetwork('net-1', 'Network 1');

    act(() => {
      useLadderStore.setState({
        networks: new Map([['net-1', network]]),
        currentNetworkId: 'net-1',
      });
    });

    render(<LadderNetworkList />);

    const label = screen.getByText('Network 1');
    fireEvent.doubleClick(label);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Saved Label{Enter}');

    const updatedNetwork = useLadderStore.getState().networks.get('net-1');
    expect(updatedNetwork?.label).toBe('Saved Label');
  });

  it('hides add button when showAddButton is false', () => {
    render(<LadderNetworkList showAddButton={false} />);

    expect(screen.queryByText('Add Network')).not.toBeInTheDocument();
  });
});
